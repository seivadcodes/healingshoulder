// app/events/[id]/live/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  LiveKitRoom, 
  ControlBar,
  useParticipants,
  DisconnectButton,
  RoomAudioRenderer
} from '@livekit/components-react';
import { Participant } from 'livekit-client';
import '@livekit/components-styles';

type Event = {
  id: string;
  title: string;
  host_id: string;
};

export default function LiveEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [hostName, setHostName] = useState<string>('Loading...');
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const initializeRoom = async () => {
      try {
        // 1. Fetch event details
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('id, title, host_id')
          .eq('id', eventId)
          .single();

        if (eventError) throw new Error('Failed to load event');
        setEvent(eventData);

        // 2. Fetch host name
        const { data: hostData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', eventData.host_id)
          .single();
        setHostName(hostData?.full_name || 'Host');

        // 3. Get current user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('You must be logged in to join');

        // 4. Get user's profile name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .single();
        
        const userName = profile?.full_name || session.user.email || 'Anonymous';

        // 5. Get LiveKit token
        const response = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: eventId,
            identity: session.user.id,
            name: userName,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to get access token');
        }

        const { token } = await response.json();
        setToken(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeRoom();
  }, [eventId, supabase]);

  const handleLeave = () => {
    router.push(`/events/${eventId}`);
  };

  if (isLoading) {
    return (
      <div className="pt-16 p-6 text-center">
        <div className="animate-pulse text-2xl">Joining live event...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-16 p-6 max-w-2xl mx-auto text-center text-red-500">
        <h1 className="text-2xl font-bold mb-4">Connection Failed</h1>
        <p className="text-lg">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="pt-16 p-6 text-center">
        Event not found
      </div>
    );
  }

  if (!token) {
    return (
      <div className="pt-16 p-6 text-center">
        Preparing connection...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="pt-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white">Live: {event.title}</h1>
          <p className="text-gray-400 mt-1">Hosted by: {hostName}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          audio={true}
          video={false}
          onDisconnected={() => setError('Disconnected from room')}
          className="flex flex-col h-[calc(100vh-180px)]"
        >
          {/* Participant List */}
          <div className="flex-1 bg-gray-800 rounded-xl p-6 overflow-y-auto mb-4">
            <h2 className="text-xl font-bold text-white mb-4">Participants</h2>
            <AudioParticipantsList hostId={event.host_id} />
          </div>
          
          {/* Control Bar with Leave Button */}
          <div className="flex justify-between items-center">
            <ControlBar 
              controls={{ 
                microphone: true, 
                camera: false, 
                screenShare: false, 
                chat: false 
              }}
              variation='minimal'
              className="!bg-gray-800 !border-t-0 !rounded-lg"
            />
            <button
              onClick={handleLeave}
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition ml-3"
            >
              Leave Room
            </button>
          </div>
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}

// Audio Participants List Component
function AudioParticipantsList({ hostId }: { hostId: string }) {
  const participants = useParticipants();

  // Sort participants: host first, then by speaking status, then alphabetically
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.identity === hostId) return -1;
    if (b.identity === hostId) return 1;
    if (a.isSpeaking && !b.isSpeaking) return -1;
    if (!a.isSpeaking && b.isSpeaking) return 1;
    return (a.name || a.identity).localeCompare(b.name || b.identity);
  });

  return (
    <div className="space-y-3">
      {sortedParticipants.map(participant => (
        <ParticipantItem 
          key={participant.sid} 
          participant={participant} 
          isHost={participant.identity === hostId} 
        />
      ))}
    </div>
  );
}

// Individual Participant Item
function ParticipantItem({ 
  participant, 
  isHost 
}: { 
  participant: Participant; 
  isHost: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-3 bg-gray-700 rounded-lg">
      {/* Speaking indicator */}
      <div className={`w-3 h-3 rounded-full ${participant.isSpeaking ? 'bg-green-500' : 'bg-gray-500'}`} />
      
      {/* Participant name */}
      <span className="text-white font-medium flex-1">
        {participant.name || participant.identity}
      </span>
      
      {/* Host badge */}
      {isHost && (
        <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
          Host
        </span>
      )}
      
      {/* Mute status */}
      {!participant.isMicrophoneEnabled && (
        <span className="text-gray-400 text-sm">(muted)</span>
      )}
    </div>
  );
}