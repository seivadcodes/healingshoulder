// app/room/[id]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
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
} from 'lucide-react';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';

type Profile = {
  id: string;
  full_name?: string;
  avatar_url?: string | null;
};

type RoomRecord = {
  id: string;
  room_id: string;
  user_id: string;
  acceptor_id: string | null;
  status: string;
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const supabase = createClient();
  const roomId = params.id as string;

  // State
  const [user, setUser] = useState<Profile | null>(null);
  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);
  const [participants, setParticipants] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [callEndedByPeer, setCallEndedByPeer] = useState(false);

  // Refs
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseChannelRef = useRef<any>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/auth');
    }
  }, [authUser, authLoading, router]);

  // Cleanup on unmount or leave
  const cleanupCall = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (remoteAudioRef.current) {
      document.body.removeChild(remoteAudioRef.current);
      remoteAudioRef.current = null;
    }
    if (supabaseChannelRef.current) {
      supabase.removeChannel(supabaseChannelRef.current);
      supabaseChannelRef.current = null;
    }
    setIsInCall(false);
    setCallDuration(0);
  };

  // Initialize room & user
  useEffect(() => {
    if (!authUser?.id || !roomId) return;

    const initialize = async () => {
      try {
        // Load user profile
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', authUser.id)
          .single();

        if (profileErr) throw profileErr;
        setUser(profile);

        // Verify room access
        const { data: roomData, error: roomErr } = await supabase
          .from('quick_connect_requests')
          .select('id, room_id, user_id, acceptor_id, status')
          .eq('room_id', roomId)
          .single();

        if (roomErr || !roomData) throw new Error('Room not found');
        if (roomData.status !== 'matched') throw new Error('Room is not active');
        if (roomData.user_id !== authUser.id && roomData.acceptor_id !== authUser.id) {
          throw new Error('Not authorized');
        }

        setRoomRecord(roomData);

        // Load participant profiles
        const ids = roomData.acceptor_id
          ? [roomData.user_id, roomData.acceptor_id]
          : [roomData.user_id];

        const { data: profiles, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', ids);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const parts = ids.map(id => {
          const p = profileMap.get(id);
          return {
            id,
            name: p?.full_name || 'Anonymous',
            avatar: p?.avatar_url || undefined,
          };
        });

        setParticipants(parts);

        // Set up Supabase Realtime channel for this room
        const channelName = `room:${roomId}`;
        const channel = supabase
          .channel(channelName)
          .on('broadcast', { event: 'call_ended' }, (payload) => {
            console.log('Received call_ended signal from peer');
            setCallEndedByPeer(true);
          })
          .subscribe();

        supabaseChannelRef.current = channel;

        // Join LiveKit room
        await joinLiveKitRoom(roomId, authUser.id);

      } catch (err: any) {
        console.error('Init error:', err);
        setError(err.message || 'Failed to join room');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      cleanupCall();
      if (room) room.disconnect();
    };
  }, [roomId, authUser?.id]);

  // Join LiveKit
  const joinLiveKitRoom = async (roomName: string, identity: string) => {
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!livekitUrl) {
      setError('LiveKit URL not configured');
      return;
    }

    const newRoom = new Room();
    setRoom(newRoom);
    setIsInCall(true);

    newRoom.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const element = track.attach();
        element.autoplay = true;
        element.muted = false;
        element.volume = 1.0;

        if (remoteAudioRef.current) {
          document.body.removeChild(remoteAudioRef.current);
        }
        remoteAudioRef.current = element;
        document.body.appendChild(element);
        setRemoteMuted(false);
      }
    });

    newRoom.on(RoomEvent.TrackUnsubscribed, () => {
      setRemoteMuted(true);
    });

    newRoom.on(RoomEvent.Disconnected, () => {
      cleanupCall();
    });

    newRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      if (state === ConnectionState.Disconnected) {
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

      intervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('LiveKit join error:', err);
      setError(`Call failed: ${err.message}`);
      cleanupCall();
    }
  };

  const toggleAudio = () => {
    if (!room) return;
    const localAudioTrack = room.localParticipant.audioTrackPublications.values().next().value?.track;
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
      if (endedByUser) {
        await supabaseChannelRef.current?.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { by: authUser?.id },
        });

        await supabase
          .from('quick_connect_requests')
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

  // Handle peer ending the call
  useEffect(() => {
    if (callEndedByPeer && isInCall) {
      console.log('Peer ended the call. Disconnecting...');
      if (room) room.disconnect();
      setTimeout(() => {
        router.push('/connect');
      }, 1000);
    }
  }, [callEndedByPeer, isInCall, room, router]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // === Loading State ===
  if (authLoading || isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #fffbeb, #f4f4f5)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: '50%',
            border: '4px solid transparent',
            borderTopColor: '#f59e0b',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }}></div>
          <p style={{ color: '#78716c' }}>Joining room...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // === Error State ===
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #fffbeb, #f4f4f5)',
        padding: '1rem',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          border: '1px solid #e5e5e5',
          padding: '2rem',
          maxWidth: '32rem',
          width: '100%',
          textAlign: 'center',
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '9999px',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <AlertTriangle size={32} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#1c1917',
            marginBottom: '0.75rem',
          }}>Connection Issue</h2>
          <p style={{ color: '#44403c', marginBottom: '1.5rem' }}>{error}</p>
          <button
            onClick={() => router.push('/connect')}
            style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              fontWeight: '700',
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
          >
            Return to Connections
          </button>
        </div>
      </div>
    );
  }

  // === Main UI ===
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #fffbeb, #f4f4f5)',
      padding: '1rem',
      paddingTop: '5rem',
    }}>
      <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1c1917' }}>Audio Call</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {participants.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '9999px',
                      border: p.id === user?.id ? '2px solid #f59e0b' : '2px solid #d6d3d1',
                      backgroundColor: '#e5e5e4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {p.avatar ? (
                      <img
                        src={p.avatar}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ color: '#44403c', fontWeight: '600', fontSize: '1rem' }}>
                        {p.name.charAt(0)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <span style={{ color: '#78716c', fontSize: '0.875rem' }}>
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              borderRadius: '9999px',
              padding: '0.25rem 0.75rem',
            }}>
              <Clock size={16} />
              <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{formatDuration(callDuration)}</span>
            </div>
            <button
              onClick={() => leaveRoom(true)}
              disabled={isLeaving}
              style={{
                backgroundColor: isLeaving ? '#d6d3d1' : '#ef4444',
                color: 'white',
                fontWeight: '700',
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                border: 'none',
                cursor: isLeaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              onMouseEnter={(e) => {
                if (!isLeaving) e.currentTarget.style.backgroundColor = isLeaving ? '#d6d3d1' : '#dc2626';
              }}
              onMouseLeave={(e) => {
                if (!isLeaving) e.currentTarget.style.backgroundColor = '#ef4444';
              }}
            >
              {isLeaving ? (
                <div style={{
                  width: '1rem',
                  height: '1rem',
                  borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: 'white',
                  animation: 'spin 1s linear infinite',
                }}></div>
              ) : (
                <PhoneOff size={18} />
              )}
              Leave
            </button>
          </div>
        </div>

        {/* Call Status Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          border: '1px solid #e5e5e5',
          padding: '2rem',
          textAlign: 'center',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            width: '5rem',
            height: '5rem',
            borderRadius: '9999px',
            backgroundColor: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <UserIcon size={40} style={{ color: '#d97706' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1c1917', marginBottom: '0.5rem' }}>
            {isInCall ? 'Call in Progress' : 'Connecting...'}
          </h2>
          <p style={{ color: '#44403c' }}>
            {remoteMuted ? 'Other participant muted' : 'Listening...'}
          </p>
        </div>

        {/* Participants */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          border: '1px solid #e5e5e5',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1c1917', marginBottom: '1rem' }}>Participants</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {participants.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: p.id === user?.id ? '#fffbeb' : 'transparent',
                }}
              >
                <div
                  style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '9999px',
                    border: p.id === user?.id ? '2px solid #f59e0b' : '1px solid #d6d3d1',
                    backgroundColor: '#e5e5e4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {p.avatar ? (
                    <img
                      src={p.avatar}
                      alt={p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9999px' }}
                    />
                  ) : (
                    <span style={{ color: '#44403c', fontWeight: '600', fontSize: '1.125rem' }}>
                      {p.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontWeight: '600', color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </h3>
                  <p style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: p.id === user?.id
                      ? '#d97706'
                      : callEndedByPeer
                      ? '#64748b'
                      : remoteMuted
                      ? '#64748b'
                      : '#16a34a',
                  }}>
                    {p.id === user?.id
                      ? 'You'
                      : callEndedByPeer
                      ? 'Left'
                      : remoteMuted
                      ? 'Muted'
                      : 'Connected'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audio Control */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          border: '1px solid #e5e5e5',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ fontWeight: '700', color: '#1c1917', marginBottom: '1rem' }}>Audio Control</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={toggleAudio}
              disabled={!isInCall || callEndedByPeer}
              style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                border: 'none',
                cursor: !isInCall || callEndedByPeer ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                backgroundColor: !isInCall || callEndedByPeer
                  ? '#f5f5f4'
                  : isAudioEnabled
                  ? '#dbeafe'
                  : '#f5f5f4',
                color: !isInCall || callEndedByPeer
                  ? '#a8a29e'
                  : isAudioEnabled
                  ? '#1e40af'
                  : '#64748b',
              }}
            >
              {isAudioEnabled ? <Mic size={28} /> : <MicOff size={28} />}
              <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                {isAudioEnabled ? 'Mute' : 'Unmute'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}