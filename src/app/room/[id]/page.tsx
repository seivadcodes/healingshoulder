'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LiveKitRoom,
  ControlBar,
  useParticipants,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Participant } from 'livekit-client';
import '@livekit/components-styles';
import { PhoneOff, Timer } from 'lucide-react';

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
  const supabase = createClient();

  // Debug: log key states
  useEffect(() => {
    console.log('[RoomPage] roomId:', roomId);
    console.log('[RoomPage] roomMeta:', roomMeta);
  }, [roomId, roomMeta]);

  useEffect(() => {
    const initializeRoom = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth');
          return;
        }
        const userId = session.user.id;

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

        setRoomMeta({ id: roomId, type: roomType, hostId, title: roomType === 'group' ? 'Group Call' : 'Private Call', callStartedAt });
        setToken(token);

        // Start or initialize timer
        await maybeStartCallTimer(roomId, roomType, userId, callStartedAt);

      } catch (err) {
        console.error('[RoomPage] Init error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    initializeRoom();
  }, [roomId, router, supabase]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [timerInterval]);

  // Helper: attempt to start timer (and set call_started_at if needed)
  const maybeStartCallTimer = async (
    roomId: string,
    roomType: RoomType,
    userId: string,
    existingCallStartedAt: Date | null
  ) => {
    // If already set, just start counting
    if (existingCallStartedAt) {
      const interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - existingCallStartedAt.getTime()) / 1000);
        setElapsedTime(diff);
      }, 1000);
      setTimerInterval(interval);
      return;
    }

    // Otherwise: check participant count
    const { count } = await supabase
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    const participantCount = count || 0;
    console.log('[Timer] Participant count:', participantCount, 'roomType:', roomType);

    // Start call only if ≥2 participants (applies to both 1:1 and group)
    if (participantCount >= 2) {
      const now = new Date();
      // Update DB
      if (roomType === 'one-on-one') {
        await supabase
          .from('quick_connect_requests')
          .update({ call_started_at: now.toISOString() })
          .eq('room_id', roomId);
      } else {
        await supabase
          .from('quick_group_requests')
          .update({ call_started_at: now.toISOString() })
          .eq('room_id', roomId);
      }

      // Start timer
      setElapsedTime(0);
      const interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
      setTimerInterval(interval);

      // Refresh roomMeta to reflect new callStartedAt
      setRoomMeta((prev) =>
        prev
          ? { ...prev, callStartedAt: now }
          : null
      );
      console.log('[Timer] Started call timer at:', now);
    } else {
      console.log('[Timer] Not enough participants to start timer');
    }
  };

  // ✅ LEAVE CALL: remove from room_participants AND redirect
 const handleLeave = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    router.push('/auth');
    return;
  }

  const userId = session.user.id;
  const roomId = params.id as string;

  // 1. Remove self from participants
  await supabase
    .from('room_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);

  // 2. If this user is the HOST, mark the request as "completed" to prevent auto-redirect
  if (roomMeta && roomMeta.hostId === userId) {
    console.log('[RoomPage] Host is leaving — marking request as completed');
    
    if (roomMeta.type === 'one-on-one') {
      await supabase
        .from('quick_connect_requests')
        .update({ status: 'completed', expires_at: new Date().toISOString() })
        .eq('room_id', roomId);
    } else {
      await supabase
        .from('quick_group_requests')
        .update({ status: 'completed', expires_at: new Date().toISOString() })
        .eq('room_id', roomId);
    }
  }

  // Optional: notify others via LiveKit disconnect, but not needed for redirect fix

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
      <div className="pt-16 p-6 text-center">
        <div className="animate-pulse text-xl">Joining room...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-16 p-6 max-w-2xl mx-auto text-center">
        <PhoneOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-red-600 mb-2">Unable to Join</h1>
        <p className="text-gray-700 mb-6">{error}</p>
        <button
          onClick={() => router.push('/connect')}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Back to Connections
        </button>
      </div>
    );
  }

  if (!roomMeta || !token) {
    return (
      <div className="pt-16 p-6 text-center">
        Invalid room
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="pt-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white">{roomMeta.title}</h1>
          <p className="text-gray-400 mt-1">
            {roomMeta.type === 'group' ? 'Group support call' : 'One-on-one conversation'}
          </p>
          {/* 🔴 TIMER DISPLAY — now shows even if just started */}
          {roomMeta.callStartedAt || elapsedTime > 0 ? (
            <div className="flex items-center gap-2 mt-2 text-sm text-green-400 font-mono">
              <Timer className="w-4 h-4" />
              <span>Call duration: {formatTime(elapsedTime)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2 text-sm text-yellow-400">
              <Timer className="w-4 h-4" />
              <span>Waiting for participants...</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8">
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          audio={true}
          video={false}
          onDisconnected={() => setError('Disconnected from room')}
          className="flex flex-col h-[calc(100vh-180px)]"
        >
          <div className="flex-1 bg-gray-800 rounded-xl p-6 overflow-y-auto mb-4">
            <h2 className="text-xl font-bold text-white mb-4">
              {roomMeta.type === 'group' ? 'Participants' : 'In Call'}
            </h2>
            <AudioParticipantsList hostId={roomMeta.hostId} />
          </div>

          <div className="flex justify-between items-center">
            <ControlBar
              controls={{ microphone: true, camera: false, screenShare: false, chat: false }}
              variation="minimal"
              className="!bg-gray-800 !border-t-0 !rounded-lg"
            />
            <button
              onClick={handleLeave}
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition ml-3"
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

// Participant components unchanged
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
    <div className="space-y-3">
      {sorted.map((p) => (
        <ParticipantItem key={p.sid} participant={p} isHost={p.identity === hostId} />
      ))}
    </div>
  );
}

function ParticipantItem({ participant, isHost }: { participant: Participant; isHost: boolean }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-gray-700 rounded-lg">
      <div className={`w-3 h-3 rounded-full ${participant.isSpeaking ? 'bg-green-500' : 'bg-gray-500'}`} />
      <span className="text-white font-medium flex-1">{participant.name || participant.identity}</span>
      {isHost && <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">Host</span>}
      {!participant.isMicrophoneEnabled && <span className="text-gray-400 text-sm">(muted)</span>}
    </div>
  );
}