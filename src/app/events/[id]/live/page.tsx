// app/events/[id]/live/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  LiveKitRoom, 
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  useChat,
  TrackReferenceOrPlaceholder,
  isTrackReference,
  DisconnectButton
} from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
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
  const [activeView, setActiveView] = useState<'chat' | 'participants'>('chat');
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
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Live: {event.title}</h1>
              <p className="text-gray-400 mt-1">Hosted by: {hostName}</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveView('chat')}
                className={`px-4 py-2 rounded-lg transition ${activeView === 'chat' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                Chat
              </button>
              {/* Participants button commented out */}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          audio={true}
          video={true}
          onDisconnected={() => setError('Disconnected from room')}
          className="flex flex-col h-[calc(100vh-180px)]"
        >
          <div className="flex flex-1 gap-6 min-h-0 h-full"> {/* Left Column - Video Grid */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Main Host Video */}
              <div className="max-h-[60vh] bg-gray-800 rounded-xl overflow-hidden mb-4 flex-shrink-0">
                <MainSpeaker hostId={event.host_id} />
              </div>
              
              {/* Other Participants Grid */}
              <div className="max-h-[30vh] bg-gray-800 rounded-xl p-4 overflow-y-auto flex-shrink-0">
                <h3 className="text-white font-semibold mb-3">Other Participants</h3>
                <div className="grid grid-cols-3 gap-4 auto-rows-min">
                  <OtherParticipants hostId={event.host_id} />
                </div>
              </div>
            </div>

            {/* Right Column - Chat */}
            <div className="w-96 bg-gray-800 rounded-xl flex flex-col overflow-hidden flex-shrink-0">
              <CustomChat />
            </div>
          </div>
          
          {/* Control Bar with Leave Button */}
          <div className="mt-4 flex justify-between items-center">
            <ControlBar 
              controls={{ microphone: true, camera: true, screenShare: true }}
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

// Main Speaker Component
function MainSpeaker({ hostId }: { hostId: string }) {
  const participants = useParticipants();
  const host = participants.find(p => p.identity === hostId);
  const mainParticipant = host || participants[0];

  const cameraTracks = useTracks([Track.Source.Camera]);
  const trackRef = cameraTracks.find(track => 
    isTrackReference(track) && track.participant.identity === mainParticipant?.identity
  );

  if (!mainParticipant) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto rounded-full bg-gray-700 flex items-center justify-center mb-4">
            <svg className="w-16 h-16 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-gray-400">Waiting for host to join...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative bg-gray-900">
      {trackRef && isTrackReference(trackRef) && (
        <ParticipantTile
          trackRef={trackRef}
          className="!h-full !w-full"
        />
      )}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg">
        {mainParticipant.name || mainParticipant.identity}
        {mainParticipant.identity === hostId && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500 rounded">Host</span>
        )}
      </div>
    </div>
  );
}

// Other Participants Component
function OtherParticipants({ hostId }: { hostId: string }) {
  const participants = useParticipants();
  const allCameraTracks = useTracks([Track.Source.Camera]);
  
  const otherTracks = allCameraTracks.filter(track => 
    isTrackReference(track) && track.participant.identity !== hostId
  );

  const placeholderCount = Math.max(0, 3 - otherTracks.length);

  return (
    <>
      {otherTracks.map((trackRef) => (
        <div key={trackRef.participant.sid} className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
          {isTrackReference(trackRef) && (
            <ParticipantTile
              trackRef={trackRef}
              className="!h-full !w-full"
            />
          )}
          <div className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs px-2 py-1 rounded truncate">
            {trackRef.participant.name || trackRef.participant.identity}
          </div>
        </div>
      ))}
      
      {Array.from({ length: placeholderCount }).map((_, i) => (
        <div key={`placeholder-${i}`} className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
      ))}
    </>
  );
}

// Custom Chat Component
function CustomChat() {
  const { chatMessages, send } = useChat();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSend = () => {
    if (message.trim()) {
      send(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <h3 className="text-white font-semibold">Live Chat</h3>
        <p className="text-gray-400 text-sm">Send messages to everyone</p>
      </div>

      {/* Messages Container */}
      {/* Messages Container */}
<div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
        {chatMessages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {chatMessages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-lg max-w-[85%] ${msg.from?.isLocal ? 'ml-auto bg-blue-600' : 'bg-gray-700'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-semibold text-sm ${msg.from?.isLocal ? 'text-blue-100' : 'text-gray-300'}`}>
                    {msg.from?.name || 'Anonymous'}
                  </span>
                  <span className="text-xs opacity-75">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-white break-words">{msg.message}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-700 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="self-end px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Send
          </button>
        </div>
        <p className="text-gray-400 text-xs mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}