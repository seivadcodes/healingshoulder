'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LiveKitRoom,
  
  useParticipants,
  useLocalParticipant,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Participant } from 'livekit-client';

import { PhoneOff, Timer, User, Mic, MicOff } from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';

type RoomType = 'one-on-one' | 'group';
type RoomMetadata = {
  id: string;
  type: RoomType;
  hostId: string;
  title: string;
  callStartedAt: Date | null;
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const [roomMeta, setRoomMeta] = useState<RoomMetadata | null>(null);
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [callEndedByPeer, setCallEndedByPeer] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const supabase = createClient();
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);
const [otherParticipantName, setOtherParticipantName] = useState<string | null>(null);

   const checkAndStartTimer = useCallback(
  async (roomId: string, roomType: RoomType, userId: string) => {
    // Avoid re-entrancy if timer already running
    if (timerInterval) return;

    try {
      if (roomType === 'one-on-one') {
        const { count } = await supabase
          .from('room_participants')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId);

        if ((count || 0) < 2) {
          return;
        }

        const { data: req } = await supabase
          .from('quick_connect_requests')
          .select('call_started_at')
          .eq('room_id', roomId)
          .single();

        const callStartedAt = req?.call_started_at ? new Date(req.call_started_at) : null;

        if (callStartedAt) {
          const now = new Date();
          const diff = Math.floor((now.getTime() - callStartedAt.getTime()) / 1000);
          setElapsedTime(diff);
          const interval = setInterval(() => {
            const now = new Date();
            const diff = Math.floor((now.getTime() - callStartedAt.getTime()) / 1000);
            setElapsedTime(diff);
          }, 1000);
          setTimerInterval(interval);
        } else {
          const now = new Date();
          await supabase
            .from('quick_connect_requests')
            .update({ call_started_at: now.toISOString() })
            .eq('room_id', roomId);

          setRoomMeta((prev) => (prev ? { ...prev, callStartedAt: now } : null));
          setElapsedTime(0);
          const interval = setInterval(() => {
            setElapsedTime((prev) => prev + 1);
          }, 1000);
          setTimerInterval(interval);
        }
      } else if (roomType === 'group') {
        const { data: group } = await supabase
          .from('quick_group_requests')
          .select('call_started_at, user_id')
          .eq('room_id', roomId)
          .single();

        if (!group) return;

        const isHost = userId === group.user_id;
        const callStartedAt = group.call_started_at ? new Date(group.call_started_at) : null;

        if (isHost) {
          if (!callStartedAt) {
            const now = new Date();
            await supabase
              .from('quick_group_requests')
              .update({ call_started_at: now.toISOString() })
              .eq('room_id', roomId);

            setRoomMeta((prev) => (prev ? { ...prev, callStartedAt: now } : null));
            setElapsedTime(0);
            const interval = setInterval(() => {
              setElapsedTime((prev) => prev + 1);
            }, 1000);
            setTimerInterval(interval);
          } else {
            const now = new Date();
            const diff = Math.floor((now.getTime() - callStartedAt.getTime()) / 1000);
            setElapsedTime(diff);
            const interval = setInterval(() => {
              const now = new Date();
              const diff = Math.floor((now.getTime() - callStartedAt.getTime()) / 1000);
              setElapsedTime(diff);
            }, 1000);
            setTimerInterval(interval);
          }
        } else {
          if (callStartedAt) {
            const now = new Date();
            const diff = Math.floor((now.getTime() - callStartedAt.getTime()) / 1000);
            setElapsedTime(diff);
            const interval = setInterval(() => {
              const now = new Date();
              const diff = Math.floor((now.getTime() - callStartedAt.getTime()) / 1000);
              setElapsedTime(diff);
            }, 1000);
            setTimerInterval(interval);
          }
        }
      }
    } catch (err) {
      console.error('Error in checkAndStartTimer:', err);
    }
  },
  [supabase, timerInterval, setRoomMeta, setTimerInterval, setElapsedTime]
);

  // 🔴 Set up Supabase broadcast listener for call_ended
  useEffect(() => {
    if (!roomId || !roomMeta) return;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on('broadcast', { event: 'call_ended' }, (payload) => {
        console.log('[RoomPage] Received call_ended:', payload);
        setCallEndedByPeer(true);
      })
      .subscribe();

    broadcastChannelRef.current = channel;

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, roomMeta, supabase]);

  // 🚪 Auto-redirect if peer ended the call
  useEffect(() => {
    if (callEndedByPeer) {
      router.push('/connect');
    }
  }, [callEndedByPeer, router]);

  useEffect(() => {
  const initializeRoom = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      const userId = session.user.id;
      setCurrentUserId(userId);

      let roomType: RoomType | null = null;
      let hostId: string | null = null;
      let callStartedAt: Date | null = null;

      // --- Check 1:1 ---
      const { data: oneOnOne } = await supabase
        .from('quick_connect_requests')
        .select('user_id, acceptor_id, status, expires_at, call_started_at')
        .eq('room_id', roomId)
        .single();

      if (oneOnOne && oneOnOne.status === 'matched') {
        if (new Date(oneOnOne.expires_at) > new Date()) {
          roomType = 'one-on-one';
          hostId = oneOnOne.user_id;
          callStartedAt = oneOnOne.call_started_at ? new Date(oneOnOne.call_started_at) : null;

          // 👇 FETCH OTHER PARTICIPANT'S NAME FOR 1:1 CALLS
          const otherUserId = userId === oneOnOne.user_id ? oneOnOne.acceptor_id : oneOnOne.user_id;
          const { data: otherProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', otherUserId)
            .single();
          setOtherParticipantName(otherProfile?.full_name || 'Anonymous');
        }
      }

      // --- Check group ---
      if (!roomType) {
        const { data: group } = await supabase
          .from('quick_group_requests')
          .select('user_id, status, expires_at, call_started_at')
          .eq('room_id', roomId)
          .single();

        if (group && new Date(group.expires_at) > new Date()) {
          if (group.status === 'available' || group.status === 'matched') {
            roomType = 'group';
            hostId = group.user_id;
            callStartedAt = group.call_started_at ? new Date(group.call_started_at) : null;
          }
        }
      }

      if (!roomType || !hostId) {
        throw new Error('Room not found or expired');
      }

      // Ensure user is still a participant
      const { data: participant } = await supabase
        .from('room_participants')
        .select('user_id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();

      if (!participant) {
        throw new Error('You are no longer in this room');
      }

      // Get user name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      const userName = profile?.full_name || session.user.email || 'Anonymous';

      // Get token
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomId, identity: userId, name: userName }),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json();
        throw new Error(errData.error || 'Failed to get LiveKit token');
      }
      const { token } = await tokenRes.json();

      setRoomMeta({ 
        id: roomId, 
        type: roomType, 
        hostId, 
        title: roomType === 'group' ? 'Group Call' : 'Private Call', 
        callStartedAt 
      });
      setToken(token);

      // Start or initialize timer
      await checkAndStartTimer(roomId, roomType, userId);

    } catch (err) {
      console.error('[RoomPage] Init error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  initializeRoom();
}, [roomId, router, supabase, checkAndStartTimer]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [timerInterval]);

  // 🔴 Realtime listener for room_participants changes (for group rooms)
  useEffect(() => {
    if (!roomId || !roomMeta || roomMeta.type !== 'group' || !currentUserId) {
      return;
    }

    const participantsChannel = supabase
      .channel(`room_participants:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log('[RoomPage] room_participants changed:', payload);
          await checkAndStartTimer(roomId, roomMeta.type, currentUserId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantsChannel);
    };
}, [roomId, roomMeta, supabase, currentUserId, checkAndStartTimer]); // ✅ added

  // Helper: attempt to start timer (and set call_started_at if needed)

  // ✅ LEAVE CALL: remove from room_participants, broadcast if 1:1, AND redirect
  const handleLeave = async () => {
    if (!currentUserId) return;

    // 1. Remove self from participants
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', currentUserId);

    // 2. Broadcast call_ended AND mark as completed if it's a one-on-one call
    if (roomMeta?.type === 'one-on-one' && broadcastChannelRef.current) {
      try {
        // Broadcast to peer
        broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { by: currentUserId },
        });

        // Mark room as completed in DB
        await supabase
          .from('quick_connect_requests')
          .update({ status: 'completed' })
          .eq('room_id', roomId);
      } catch (err) {
        console.warn('Failed to broadcast call_ended or update room status:', err);
      }
    }

    // 3. Redirect
    router.push('/connect');
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // === UI Rendering ===

  if (isLoading) {
    return (
      <div style={{ paddingTop: '4rem', padding: '1.5rem', textAlign: 'center' }}>
        <div style={{ 
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          fontSize: '1.25rem'
        }}>Joining room...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        paddingTop: '4rem', 
        padding: '1.5rem', 
        maxWidth: '32rem', 
        margin: '0 auto', 
        textAlign: 'center'
      }}>
        <PhoneOff style={{ width: '4rem', height: '4rem', color: '#ef4444', margin: '0 auto 1rem' }} />
        <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#dc2626', marginBottom: '0.5rem' }}>Unable to Join</h1>
        <p style={{ color: '#374151', marginBottom: '1.5rem' }}>{error}</p>
        <button
          onClick={() => router.push('/connect')}
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: '#2563eb',
            color: 'white',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.3s'
          }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = '#2563eb'}
        >
          Back to Connections
        </button>
      </div>
    );
  }

  if (!roomMeta || !token) {
    return (
      <div style={{ paddingTop: '4rem', padding: '1.5rem', textAlign: 'center' }}>
        Invalid room
      </div>
    );
  }

  // PHONE CALL INTERFACE FOR ONE-ON-ONE
if (roomMeta.type === 'one-on-one') {
  return (
    <div style={{
      height: '100dvh', // 👈 use dvh (dynamic viewport height) for mobile safety
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0f172a'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '1.5rem',
        textAlign: 'center',
        borderBottom: '1px solid #334155',
        flexShrink: 0 // 👈 never shrink
      }}>
        <h1 style={{ 
          fontSize: '1.875rem', 
          fontWeight: '700', 
          color: 'white',
          marginBottom: '0.25rem'
        }}>{roomMeta.title}</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>One-on-one conversation</p>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '0.5rem', 
          marginTop: '0.5rem'
        }}>
          <Timer style={{ width: '1.25rem', height: '1.25rem', color: '#10b981' }} />
          <span style={{ 
            color: '#10b981', 
            fontFamily: 'monospace', 
            fontSize: '1.125rem',
            fontWeight: '600'
          }}>
            {formatTime(elapsedTime)}
          </span>
        </div>
      </div>

      {/* Main Content Area — THIS IS THE KEY */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden', // prevent overflow
        position: 'relative'
      }}>
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          audio={true}
          video={false}
          onDisconnected={() => setError('Disconnected from room')}
          style={{ 
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
         {/* Participant View — now safely centered in available space */}
<div style={{
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '3rem',
}}>
  <PhoneCallParticipants 
    currentUserId={currentUserId!} 
    otherParticipantName={otherParticipantName} 
  />
</div>

          {/* Footer Controls */}
          <div style={{ 
            padding: '1.5rem',
            borderTop: '1px solid #334155',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '2rem',
            flexShrink: 0 // 👈 critical: don't let this shrink or get overlapped
          }}>
            <MuteButton />
            <button
              onClick={handleLeave}
              style={{
                width: '4.5rem',
                height: '4.5rem',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.3s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#dc2626'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#ef4444'}
            >
              <PhoneOff style={{ width: '2rem', height: '2rem', color: 'white' }} />
            </button>
          </div>
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}

  // GROUP CALL INTERFACE (with inline CSS)
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#0f172a'
    }}>
      <div style={{ 
        paddingTop: '4rem', 
        padding: '1.5rem'
      }}>
        <div style={{ 
          maxWidth: '80rem', 
          margin: '0 auto'
        }}>
          <h1 style={{ 
            fontSize: '1.875rem', 
            fontWeight: '700', 
            color: 'white'
          }}>{roomMeta.title}</h1>
          <p style={{ 
            color: '#94a3b8', 
            marginTop: '0.25rem'
          }}>
            Group support call
          </p>
          {/* 🔴 ALWAYS SHOW TIMER FOR GROUP CALLS */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            marginTop: '0.5rem',
            color: '#10b981',
            fontFamily: 'monospace',
            fontSize: '0.875rem'
          }}>
            <Timer style={{ width: '1rem', height: '1rem' }} />
            <span>Call duration: {formatTime(elapsedTime)}</span>
          </div>
        </div>
      </div>

      <div style={{ 
        maxWidth: '80rem', 
        margin: '0 auto', 
        padding: '1.5rem', 
        paddingBottom: '2rem'
      }}>
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          audio={true}
          video={false}
          onDisconnected={() => setError('Disconnected from room')}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: 'calc(100vh - 16rem)'
          }}
        >
          <div style={{ 
            flex: 1, 
            backgroundColor: '#1e293b', 
            borderRadius: '0.75rem', 
            padding: '1.5rem', 
            overflowY: 'auto', 
            marginBottom: '1rem'
          }}>
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '700', 
              color: 'white', 
              marginBottom: '1rem'
            }}>
              Participants
            </h2>
            <AudioParticipantsList hostId={roomMeta.hostId} />
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            <div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  backgroundColor: '#1e293b',
  borderRadius: '0.75rem',
  padding: '0.5rem 1rem',
}}>
  <MuteButton />
</div>
            <button
              onClick={handleLeave}
              style={{
                marginLeft: '0.75rem',
                padding: '0.625rem 1.25rem',
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.3s'
              }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#dc2626'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#ef4444'}
            >
              Leave Call
            </button>
          </div>
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}

// Mute Button Component for one-on-one calls
function MuteButton() {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    if (localParticipant) {
      const newState = !localParticipant.isMicrophoneEnabled;
      localParticipant.setMicrophoneEnabled(newState);
      setIsMuted(!newState);
    }
  };

  return (
    <button
      onClick={toggleMute}
      style={{
        width: '3.5rem',
        height: '3.5rem',
        borderRadius: '50%',
        backgroundColor: isMuted ? '#ef4444' : '#4b5563',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.3s',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}
      onMouseOver={e => e.currentTarget.style.backgroundColor = isMuted ? '#dc2626' : '#374151'}
      onMouseOut={e => e.currentTarget.style.backgroundColor = isMuted ? '#ef4444' : '#4b5563'}
    >
      {isMuted ? (
        <MicOff style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
      ) : (
        <Mic style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
      )}
    </button>
  );
}

// Phone call specific participant component (now only shows the other participant)
// Phone call specific participant component (now only shows the other participant)
function PhoneCallParticipants({ 
  currentUserId, 
  otherParticipantName 
}: { 
  currentUserId: string; 
  otherParticipantName: string | null; 
}) {
  const participants = useParticipants();

  if (participants.length < 2) {
    return (
      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '1.125rem' }}>
        Waiting for {otherParticipantName || 'the other participant'} to join...
      </div>
    );
  }

  // Find the participant whose identity is NOT the current user
  const otherParticipant = participants.find(p => p.identity !== currentUserId);

  if (!otherParticipant) {
    return <div>Unable to identify peer</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            width: '12rem',
            height: '12rem',
            borderRadius: '50%',
            backgroundColor: otherParticipant.isSpeaking ? '#10b981' : '#334155',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'background-color 0.3s',
            marginBottom: '1rem',
            border: otherParticipant.isSpeaking ? '3px solid #059669' : 'none',
          }}
        >
          <User style={{ width: '5rem', height: '5rem', color: 'white' }} />
        </div>
        <div style={{ textAlign: 'center', color: 'white', fontSize: '1.25rem', fontWeight: '600' }}>
          {otherParticipant.name || 'Participant'}
          {otherParticipant.isSpeaking && (
            <span style={{ display: 'block', color: '#10b981', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Speaking
            </span>
          )}
          {!otherParticipant.isMicrophoneEnabled && (
            <span style={{ display: 'block', color: '#f87171', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Microphone off
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
// Participant components for group calls
function AudioParticipantsList({ hostId }: { hostId: string }) {
  const participants = useParticipants();
  const sorted = [...participants].sort((a, b) => {
    if (a.identity === hostId) return -1;
    if (b.identity === hostId) return 1;
    if (a.isSpeaking && !b.isSpeaking) return -1;
    if (!a.isSpeaking && b.isSpeaking) return 1;
    return (a.name || a.identity).localeCompare(b.name || b.identity);
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {sorted.map((p) => (
        <ParticipantItem key={p.sid} participant={p} isHost={p.identity === hostId} />
      ))}
    </div>
  );
}

function ParticipantItem({ participant, isHost }: { participant: Participant; isHost: boolean }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '1rem', 
      padding: '0.75rem', 
      backgroundColor: '#334155', 
      borderRadius: '0.5rem'
    }}>
      <div style={{ 
        width: '0.75rem', 
        height: '0.75rem', 
        borderRadius: '9999px', 
        backgroundColor: participant.isSpeaking ? '#10b981' : '#94a3b8'
      }} />
      <span style={{ 
        color: 'white', 
        fontWeight: '500', 
        flex: 1 
      }}>{participant.name || participant.identity}</span>
      {isHost && <span style={{ 
        padding: '0.25rem 0.5rem', 
        fontSize: '0.75rem', 
        backgroundColor: '#3b82f6', 
        color: 'white', 
        borderRadius: '9999px'
      }}>Host</span>}
      {!participant.isMicrophoneEnabled && <span style={{ 
        color: '#94a3b8', 
        fontSize: '0.875rem'
      }}>(muted)</span>}
    </div>
  );
}

