'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  AlertTriangle,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';

// Inject keyframes for animations
const Keyframes = () => (
  <>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      .pulse {
        animation: pulse 1.5s infinite;
      }
    `}</style>
  </>
);

type Profile = {
  id: string;
  full_name?: string;
  avatar_url?: string | null;
};

type RoomParticipant = {
  user_id: string;
};

type RoomRecord = {
  room_id: string;
  status: string;
};

interface CallEndedMessage {
  by: string;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const supabase = createClient();
  const roomId = params.id as string;

  // Detect room type from ID
  const isGroupCall = typeof roomId === 'string' && roomId.startsWith('group-call-');
  const isOneOnOne = typeof roomId === 'string' && roomId.startsWith('quick-connect-');

  // Redirect if invalid room ID
  useEffect(() => {
    if (!authLoading && roomId && !isGroupCall && !isOneOnOne) {
      router.push('/connect');
    }
  }, [authLoading, roomId, isGroupCall, isOneOnOne, router]);

  // State
  const [user, setUser] = useState<Profile | null>(null);
  const [participants, setParticipants] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callEndedByPeer, setCallEndedByPeer] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Refs
  const remoteAudioRefs = useRef<(HTMLAudioElement | null)[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const callDurationStartedRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/auth');
    }
  }, [authUser, authLoading, router]);

  // Cleanup on unmount or leave
  const cleanupCall = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    remoteAudioRefs.current.forEach((el) => {
      if (el && el.parentElement) {
        el.parentElement.removeChild(el);
      }
    });
    remoteAudioRefs.current = [];
    if (supabaseChannelRef.current) {
      supabase.removeChannel(supabaseChannelRef.current);
      supabaseChannelRef.current = null;
    }
    setIsInCall(false);
    setCallDuration(0);
    callDurationStartedRef.current = false;
    setConnectionStatus('disconnected');
  }, [supabase]);

  // Initialize room & user
  useEffect(() => {
    if (!authUser?.id || !roomId || (!isOneOnOne && !isGroupCall) || hasInitializedRef.current) return;
    
    hasInitializedRef.current = true;
    setIsLoading(true);
    setError(null);
    setConnectionStatus('connecting');

    const initialize = async () => {
      try {
        // Run critical queries in parallel
        const roomTable = isOneOnOne ? 'quick_connect_requests' : 'quick_group_requests';
        
        const [profileResult, roomCheckResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', authUser.id)
            .single<Profile>(),
          
          supabase
            .from(roomTable)
            .select('room_id, status')
            .eq('room_id', roomId)
            .single<RoomRecord>()
        ]);

        // Handle profile result
        if (profileResult.error) throw profileResult.error;
        setUser(profileResult.data);

        // Handle room check result
        if (roomCheckResult.error || !roomCheckResult.data || roomCheckResult.data.status !== 'matched') {
          throw new Error('Room not found or not active');
        }

        // Get participant IDs
        const { data: participantRows, error: partErr } = await supabase
          .from('room_participants')
          .select('user_id')
          .eq('room_id', roomId)
          .eq('active', true)
          .returns<RoomParticipant[]>();

        if (partErr) throw partErr;

        const participantIds = participantRows.map(p => p.user_id);
        
        // Ensure current user is authorized
        if (!participantIds.includes(authUser.id)) {
          throw new Error('Not authorized to join this room');
        }

        // Get profiles for participants
        const { data: profiles, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', participantIds)
          .returns<Profile[]>();

        if (profilesErr) throw profilesErr;

        // Create participant profiles map
        const profileMap = new Map(
          profiles.map(p => [p.id, p])
        );

        const parts = participantIds.map(id => {
          const p = profileMap.get(id);
          return {
            id,
            name: p?.full_name || 'Anonymous',
            avatar: p?.avatar_url || undefined,
          };
        });

        setParticipants(parts);

        // Setup Supabase channel (non-blocking)
        setupSupabaseChannel(roomId);

        // Connect to LiveKit (non-blocking UI)
        setIsLoading(false);
        setConnectionStatus('connecting');
        await joinLiveKitRoom(roomId, authUser.id);
        
      } catch (err: any) {
        console.error('Init error:', err);
        setError(err.message || 'Failed to join room');
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      cleanupCall();
      if (room) room.disconnect();
    };
  }, [roomId, authUser?.id, isOneOnOne, isGroupCall, cleanupCall, supabase, room]);

  const setupSupabaseChannel = useCallback((roomId: string) => {
    const channelName = `room:${roomId}`;
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'call_ended' }, (payload: { payload: CallEndedMessage }) => {
        console.log('Received call_ended signal from peer');
        setCallEndedByPeer(true);
      })
      .subscribe();

    supabaseChannelRef.current = channel;
  }, [supabase]);

  const joinLiveKitRoom = async (roomName: string, identity: string) => {
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!livekitUrl) {
      setError('LiveKit URL not configured');
      return;
    }

    const newRoom = new Room();
    setRoom(newRoom);
    setConnectionStatus('connecting');

    const hasActiveRemoteAudio = () => {
      for (const participant of newRoom.remoteParticipants.values()) {
        for (const publication of participant.audioTrackPublications.values()) {
          if (publication.isSubscribed && publication.track) {
            return true;
          }
        }
      }
      return false;
    };

    const startCallTimer = () => {
      if (callDurationStartedRef.current) return;
      callDurationStartedRef.current = true;
      setCallDuration(0);
      intervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    };

    const checkAndStartCall = () => {
      if (!callDurationStartedRef.current && hasActiveRemoteAudio()) {
        startCallTimer();
      }
    };

    newRoom.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const element = track.attach();
        element.autoplay = true;
        element.muted = false;
        element.volume = 1.0;
        remoteAudioRefs.current.push(element);
        document.body.appendChild(element);
        checkAndStartCall();
      }
    });

    newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
      const elements = track.detach();
      elements.forEach(element => {
        const index = remoteAudioRefs.current.findIndex(el => el === element);
        if (index > -1) {
          remoteAudioRefs.current[index] = null;
          if (element.parentElement) {
            element.parentElement.removeChild(element);
          }
        }
      });
      // Clean up null references
      remoteAudioRefs.current = remoteAudioRefs.current.filter(el => el !== null);
    });

    newRoom.on(RoomEvent.ParticipantConnected, () => {
      setTimeout(checkAndStartCall, 500);
    });

    newRoom.on(RoomEvent.Connected, () => {
      setConnectionStatus('connected');
      setIsInCall(true);
      setTimeout(checkAndStartCall, 500);
    });

    newRoom.on(RoomEvent.Disconnected, cleanupCall);
    newRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      if (state === ConnectionState.Disconnected) {
        setConnectionStatus('disconnected');
        cleanupCall();
      }
    });

    try {
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, identity }),
      });

      if (!tokenRes.ok) throw new Error(`Token error: ${tokenRes.status}`);
      const { token } = await tokenRes.json();

      await newRoom.connect(livekitUrl, token);

      const tracks = await newRoom.localParticipant.createTracks({ audio: true });
      tracks.forEach((track) => {
        newRoom.localParticipant.publishTrack(track);
      });

    } catch (err: any) {
      console.error('LiveKit join error:', err);
      setError(`Call failed: ${err.message}`);
      cleanupCall();
    }
  };

  const toggleAudio = () => {
    if (!room) return;
    const localAudioTrack = Array.from(room.localParticipant.audioTrackPublications.values())[0]?.track;
    if (localAudioTrack) {
      if (isAudioEnabled) {
        localAudioTrack.mute();
      } else {
        localAudioTrack.unmute();
      }
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const leaveRoom = async (endedByUser: boolean = true) => {
    if (isLeaving) return;
    setIsLeaving(true);

    try {
      if (endedByUser && supabaseChannelRef.current) {
        await supabaseChannelRef.current.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { by: authUser?.id },
        });

        const table = isOneOnOne ? 'quick_connect_requests' : 'quick_group_requests';
        await supabase
          .from(table)
          .update({ status: 'completed' })
          .eq('room_id', roomId);
      }

      if (room) {
        room.disconnect();
      }

      router.push('/connect');
    } catch (err) {
      console.error('Leave room error:', err);
      setError('Failed to leave room');
    } finally {
      setIsLeaving(false);
    }
  };

  useEffect(() => {
    if (callEndedByPeer && isInCall) {
      console.log('Peer ended the call. Disconnecting...');
      leaveRoom(false);
    }
  }, [callEndedByPeer, isInCall, leaveRoom]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state with better feedback
  if (authLoading || isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #fffbeb, #f5f5f4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <Keyframes />
        <div style={{ textAlign: 'center' }}>
          <div style={{
            animation: 'spin 1s linear infinite',
            borderRadius: '9999px',
            height: '3rem',
            width: '3rem',
            border: '2px solid transparent',
            borderLeftColor: '#f59e0b',
            margin: '0 auto 1rem auto'
          }}></div>
          <p style={{ color: '#57534e', fontWeight: 500 }}>
            {connectionStatus === 'connecting' 
              ? 'Connecting to call...' 
              : 'Preparing your call...'}
          </p>
          <p className="pulse" style={{ color: '#92400e', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            This should only take a few seconds
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #fffbeb, #f5f5f4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e7e5e4',
          padding: '2rem',
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '9999px',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto'
          }}>
            <AlertTriangle size={32} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#292524',
            marginBottom: '0.75rem'
          }}>Connection Issue</h2>
          <p style={{ color: '#57534e', marginBottom: '1.5rem' }}>{error}</p>
          <button
            onClick={() => router.push('/connect')}
            style={{
              background: '#f59e0b',
              color: '#ffffff',
              fontWeight: '700',
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#d97706'}
            onMouseOut={(e) => e.currentTarget.style.background = '#f59e0b'}
          >
            Return to Connections
          </button>
        </div>
      </div>
    );
  }

  // Determine participant display
  const otherParticipants = participants.filter(p => p.id !== user?.id);
  const isGroup = isGroupCall || otherParticipants.length > 1;

  // Main UI
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #fffbeb, #f5f5f4)',
      padding: '1rem',
      paddingTop: '5rem'
    }}>
      <Keyframes />
      <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e7e5e4',
          padding: '2rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          position: 'relative'
        }}>
          {/* Connection status badge */}
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            background: connectionStatus === 'connected' 
              ? '#dcfce7' 
              : connectionStatus === 'connecting' 
                ? '#ffedd5' 
                : '#fee2e2',
            color: connectionStatus === 'connected' 
              ? '#166534' 
              : connectionStatus === 'connecting' 
                ? '#92400e' 
                : '#b91c1c',
            fontSize: '0.75rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            {connectionStatus === 'connected' && '●'}
            {connectionStatus === 'connecting' && (
              <span style={{ animation: 'spin 1s linear infinite' }}>◯</span>
            )}
            {connectionStatus === 'disconnected' && '⨯'}
            {connectionStatus === 'connected' 
              ? 'Connected' 
              : connectionStatus === 'connecting' 
                ? 'Connecting...' 
                : 'Disconnected'}
          </div>

          {/* Name of the other participant or group label */}
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#292524',
            marginBottom: '0.5rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {isGroup ? (
              <>
                <Users size={18} style={{ marginRight: '0.25rem' }} />
                Group Call
              </>
            ) : (
              otherParticipants[0]?.name || 'Anonymous'
            )}
          </h2>

          {/* Timer */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.25rem',
            background: '#ffedd5',
            color: '#92400e',
            borderRadius: '9999px',
            padding: '0.25rem 0.75rem',
            margin: '0 auto 1.25rem auto',
            width: 'fit-content'
          }}>
            <Clock size={14} />
            <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
              {formatDuration(callDuration)}
            </span>
          </div>

          {/* Human head icon */}
          <div style={{
            width: '5rem',
            height: '5rem',
            borderRadius: '9999px',
            background: '#ffedd5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto'
          }}>
            {isGroup ? (
              <Users size={40} style={{ color: '#b45309' }} />
            ) : (
              <UserIcon size={40} style={{ color: '#b45309' }} />
            )}
          </div>

          {/* Status message */}
          <p style={{ 
            color: '#57534e', 
            marginBottom: '1.25rem',
            minHeight: '1.25rem',
            fontSize: '0.875rem'
          }}>
            {connectionStatus === 'connected' && (
              <span style={{ color: '#166534', fontWeight: 500 }}>
                {isGroup 
                  ? `${participants.length} participants connected` 
                  : 'Call connected'}
              </span>
            )}
            {connectionStatus === 'connecting' && (
              <span className="pulse" style={{ color: '#92400e' }}>
                Establishing connection...
              </span>
            )}
            {callEndedByPeer && (
              <span style={{ color: '#b91c1c', fontWeight: 500 }}>
                Call ended by other participant
              </span>
            )}
          </p>

          {/* Call Controls: Mute + Leave */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            {/* Mute Button */}
            <button
              onClick={toggleAudio}
              disabled={!isInCall || callEndedByPeer || connectionStatus !== 'connected'}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                backgroundColor: !isInCall || callEndedByPeer || connectionStatus !== 'connected'
                  ? '#f5f5f4' 
                  : isAudioEnabled 
                    ? '#f0fdf4' 
                    : '#fef2f2',
                color: !isInCall || callEndedByPeer || connectionStatus !== 'connected'
                  ? '#9ca3af' 
                  : isAudioEnabled 
                    ? '#047857' 
                    : '#dc2626',
                cursor: !isInCall || callEndedByPeer || connectionStatus !== 'connected' 
                  ? 'not-allowed' 
                  : 'pointer',
                border: 'none',
                fontWeight: '600',
                fontSize: '0.875rem',
                minWidth: '90px',
                opacity: (!isInCall || callEndedByPeer || connectionStatus !== 'connected') ? 0.7 : 1
              }}
            >
              {isAudioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
              {isAudioEnabled ? 'Mute' : 'Unmute'}
            </button>

            {/* Leave Button */}
            <button
              onClick={() => leaveRoom(true)}
              disabled={isLeaving || callEndedByPeer}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                backgroundColor: isLeaving || callEndedByPeer
                  ? '#e7e5e4' 
                  : '#fef2f2',
                color: isLeaving || callEndedByPeer
                  ? '#9ca3af' 
                  : '#dc2626',
                cursor: isLeaving || callEndedByPeer ? 'not-allowed' : 'pointer',
                border: 'none',
                fontWeight: '600',
                fontSize: '0.875rem',
                minWidth: '90px',
                opacity: (isLeaving || callEndedByPeer) ? 0.7 : 1
              }}
            >
              {isLeaving ? (
                <div style={{
                  animation: 'spin 1s linear infinite',
                  borderRadius: '9999px',
                  height: '12px',
                  width: '12px',
                  border: '2px solid transparent',
                  borderLeftColor: '#dc2626'
                }}></div>
              ) : (
                <PhoneOff size={16} />
              )}
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}