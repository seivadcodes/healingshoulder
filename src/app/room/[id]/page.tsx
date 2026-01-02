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
  callStartedAt: Date | null; // New field
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const [roomMeta, setRoomMeta] = useState<RoomMetadata | null>(null);
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Timer state
  const [elapsedTime, setElapsedTime] = useState<number>(0); // in seconds
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initializeRoom = async () => {
      try {
        // Get current user
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth');
          return;
        }

        const userId = session.user.id;

        // Try to find this room in either quick_connect_requests or quick_group_requests
        let roomType: RoomType | null = null;
        let hostId: string | null = null;
        let callStartedAt: Date | null = null;

        // Check 1:1 requests
        const { data: oneOnOne } = await supabase
          .from('quick_connect_requests')
          .select('user_id, acceptor_id, status, expires_at, call_started_at')
          .eq('room_id', roomId)
          .single();

        if (oneOnOne && oneOnOne.status === 'matched') {
          const now = new Date().toISOString();
          if (new Date(oneOnOne.expires_at) > new Date(now)) {
            roomType = 'one-on-one';
            hostId = oneOnOne.user_id;
            callStartedAt = oneOnOne.call_started_at ? new Date(oneOnOne.call_started_at) : null;
          }
        }

        // Check group requests if 1:1 not found
        if (!roomType) {
          const { data: group } = await supabase
            .from('quick_group_requests')
            .select('user_id, status, expires_at, call_started_at')
            .eq('room_id', roomId)
            .single();

          if (group) {
            const now = new Date().toISOString();
            const isExpired = new Date(group.expires_at) <= new Date(now);

            if (!isExpired) {
              if (group.status === 'available' || group.status === 'matched') {
                roomType = 'group';
                hostId = group.user_id;
                callStartedAt = group.call_started_at ? new Date(group.call_started_at) : null;
              }
            }
          }
        }

        if (!roomType || !hostId) {
          throw new Error('Room not found or expired');
        }

        // Validate current user is a participant
        const { data: participant } = await supabase
          .from('room_participants')
          .select('user_id')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .single();

        if (!participant) {
          throw new Error('You are not authorized to join this room');
        }

        // Get user name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single();
        const userName = profile?.full_name || session.user.email || 'Anonymous';

        // Get LiveKit token
        const tokenRes = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: roomId,
            identity: userId,
            name: userName,
          }),
        });

        if (!tokenRes.ok) {
          const errData = await tokenRes.json();
          throw new Error(errData.error || 'Failed to get LiveKit token');
        }

        const { token } = await tokenRes.json();

        // Set metadata
        setRoomMeta({
          id: roomId,
          type: roomType,
          hostId,
          title: roomType === 'group' ? 'Group Call' : 'Private Call',
          callStartedAt,
        });
        setToken(token);

        // Start timer if call has started
        if (callStartedAt) {
          const interval = setInterval(() => {
            const now = new Date();
            const diff = Math.floor((now.getTime() - callStartedAt.getTime()) / 1000);
            setElapsedTime(diff);
          }, 1000);
          setTimerInterval(interval);
        }

      } catch (err) {
        console.error('Room init error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    initializeRoom();
  }, [roomId, router, supabase]);

  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  const handleLeave = () => {
    router.push('/connect');
  };

  // Format time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
      {/* Header */}
      <div className="pt-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white">{roomMeta.title}</h1>
          <p className="text-gray-400 mt-1">
            {roomMeta.type === 'group' ? 'Group support call' : 'One-on-one conversation'}
          </p>
          {roomMeta.callStartedAt && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-300">
              <Timer className="w-4 h-4" />
              <span>Call duration: {formatTime(elapsedTime)}</span>
            </div>
          )}
        </div>
      </div>

      {/* LiveKit Room */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          audio={true}
          video={false}
          onDisconnected={() => setError('Disconnected from room')}
          className="flex flex-col h-[calc(100vh-180px)]"
        >
          {/* Participant list */}
          <div className="flex-1 bg-gray-800 rounded-xl p-6 overflow-y-auto mb-4">
            <h2 className="text-xl font-bold text-white mb-4">
              {roomMeta.type === 'group' ? 'Participants' : 'In Call'}
            </h2>
            <AudioParticipantsList hostId={roomMeta.hostId} />
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center">
            <ControlBar
              controls={{
                microphone: true,
                camera: false,
                screenShare: false,
                chat: false,
              }}
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

// === Shared Participant List Component ===
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
      <span className="text-white font-medium flex-1">
        {participant.name || participant.identity}
      </span>
      {isHost && (
        <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
          Host
        </span>
      )}
      {!participant.isMicrophoneEnabled && (
        <span className="text-gray-400 text-sm">(muted)</span>
      )}
    </div>
  );
}