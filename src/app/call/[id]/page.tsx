'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PhoneOff, Mic, MicOff, User, ArrowLeft } from 'lucide-react';
import {
  Room,
  RoomEvent,
  ParticipantEvent,
  Track,
  createLocalTracks,
  RemoteParticipant
} from 'livekit-client';

export default function CallPage() {
  const params = useParams();
  const sessionId = params?.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [sessionData, setSessionData] = useState<any>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [otherParticipant, setOtherParticipant] = useState<any>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach(el => {
        el.pause();
        el.remove();
      });
      if (timerRef.current) clearInterval(timerRef.current);
      if (room) room.disconnect();
    };
  }, [room]);

  // Fetch session data and validate user is part of this session
  useEffect(() => {
    const initializeCall = async () => {
      try {
        const { data: { session: authSession }, error: authError } = await supabase.auth.getSession();
        if (authError || !authSession?.user) {
          router.push('/auth');
          return;
        }

        // Get current user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authSession.user.id)
          .single();

        if (profileError) throw profileError;
        setCurrentUser(profileData);

        // Get session details
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select(`
            *,
            session_participants!inner (
              user_id,
              profiles:profiles(user_id,full_name,avatar_url)
            )
          `)
          .eq('id', sessionId)
          .single();

        if (sessionError) throw sessionError;
        setSessionData(session);

        // Check if the current user is a participant in this session
        const isParticipant = session.session_participants.some(
          (p: any) => p.user_id === authSession.user.id
        );

        if (!isParticipant) {
          setError('You are not authorized to join this call');
          return;
        }

        // Get other participant (for one-on-one calls)
        if (session.session_type === 'one_on_one') {
          const otherParticipantData = session.session_participants.find(
            (p: any) => p.user_id !== authSession.user.id
          );
          setOtherParticipant(otherParticipantData?.profiles || null);
        }

        // Update session status to active
        await supabase
          .from('sessions')
          .update({ status: 'active' })
          .eq('id', sessionId);

        // Connect to the room
        await connectToRoom(sessionId);

        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing call:', err);
        setError('Failed to join the call. Please try again.');
        setIsLoading(false);
      }
    };

    if (sessionId) {
      initializeCall();
    }
  }, [sessionId, router]);

  const connectToRoom = async (roomName: string) => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      // Create unique identity for this participant
      const identity = `${authSession?.user.id}-${Date.now()}`;

      // Get LiveKit token from our API endpoint
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity,
          room: roomName,
          isPublisher: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get LiveKit token');
      }

      const { token, url } = await response.json();

      // Create and configure LiveKit room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          videoEncoding: { maxBitrate: 1_000_000 },
        },
      });

      // Event handlers
      newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log('Participant connected:', participant.identity);
      });

      // Handle remote participant disconnect
      newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        
        // For one-on-one calls, end the call if the other participant disconnects
        if (sessionData?.session_type === 'one_on_one') {
          setCallStatus('ended');
          setTimeout(() => {
            endCall();
          }, 2000);
        }
      });

      // Handle room disconnect (e.g., network loss)
      newRoom.on(RoomEvent.Disconnected, () => {
        setCallStatus('ended');
        setError('Connection lost. Please try again.');
        setTimeout(() => endCall(), 2000);
      });

      // Handle track subscription (when we receive audio/video from others)
      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        handleTrackSubscribed(track, publication, participant);
      });

      // Connect to the room
      await newRoom.connect(url, token);

      // Create and publish local audio track
      const audioTracks = await createLocalTracks({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      });

      if (audioTracks[0]) {
        await newRoom.localParticipant.publishTrack(audioTracks[0]);
      }

      setRoom(newRoom);
      return newRoom;
    } catch (err) {
      console.error('Connection error:', err);
      setError('Failed to connect to call');
      setCallStatus('ended');
      throw err;
    }
  };

  const handleTrackSubscribed = (track: any, _publication: any, participant: any) => {
    if (track.kind === Track.Kind.Audio) {
      // Start timer and update status ONLY when we receive the first remote audio track
      if (callStatus !== 'connected') {
        setCallStatus('connected');
        setCallDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }
      
      const element = track.attach();
      element.volume = 0.8;
      element.style.display = 'none';
      document.body.appendChild(element);
      audioElementsRef.current.push(element);
      
      participant.on(ParticipantEvent.TrackUnpublished, () => {
        element.remove();
        audioElementsRef.current = audioElementsRef.current.filter(e => e !== element);
      });
    }
  };

  const toggleMute = async () => {
  if (!room) return;

  const localParticipant = room.localParticipant;
  const publication = localParticipant.getTrackPublication(Track.Source.Microphone);
  const audioTrack = publication?.track;

  if (audioTrack) {
    if (isMuted) {
      await audioTrack.unmute();
    } else {
      await audioTrack.mute();
    }
    setIsMuted(!isMuted);
  }
};

  const endCall = async () => {
    try {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Disconnect from room
      if (room) {
        room.disconnect();
        setRoom(null);
      }

      // Update session status in database
      if (sessionData?.id) {
        await supabase
          .from('sessions')
          .update({ status: 'ended' })
          .eq('id', sessionData.id);
        
        // Update support request status if applicable
        await supabase
          .from('support_requests')
          .update({ status: 'completed' })
          .eq('session_id', sessionData.id);
      }

      // Redirect to connect page
      router.push('/connect');
    } catch (err) {
      console.error('Error ending call:', err);
      router.push('/connect');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-stone-600 text-lg">Connecting to your call...</p>
          <p className="text-stone-500 mt-2">Please ensure your microphone is enabled</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-lg text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center border border-red-200 mx-auto mb-4">
            <PhoneOff className="text-red-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">Call Error</h2>
          <p className="text-stone-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/connect')}
            className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-6 rounded-lg flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowLeft size={18} />
            Back to Connect
          </button>
        </div>
      </div>
    );
  }

  // Main call interface
  const displayName = otherParticipant?.full_name || 'Support Partner';
  const displayAvatar = otherParticipant?.avatar_url || null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar */}
      <div className="p-4 sm:p-6 text-center border-b border-gray-800">
        <button 
          onClick={() => router.push('/connect')}
          className="absolute left-4 top-4 text-gray-400 hover:text-white"
          aria-label="Back to connect"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold">{displayName}</h1>
        <p className="text-gray-400 mt-1 text-sm">
          {callStatus === 'connecting' && 'Connecting...'}
          {callStatus === 'connected' && `Active • ${formatTime(callDuration)}`}
          {callStatus === 'ended' && 'Call ended'}
        </p>
      </div>

      {/* Main area - avatar */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-48 h-48 rounded-full bg-gray-800 flex items-center justify-center border-4 border-gray-700 overflow-hidden">
          {displayAvatar ? (
            <img 
              src={displayAvatar} 
              alt={displayName} 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-5xl font-medium">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Call ended overlay */}
      {callStatus === 'ended' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-10">
          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <PhoneOff size={32} className="text-gray-400" />
            </div>
            <p className="text-lg text-gray-300">
              Call has ended
            </p>
            <button
              onClick={() => router.push('/connect')}
              className="mt-6 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-6 rounded-lg flex items-center justify-center gap-2"
            >
              <ArrowLeft size={18} />
              Back to Connect
            </button>
          </div>
        </div>
      )}

      {/* Connection status indicator */}
      {callStatus === 'connecting' && (
        <div className="absolute top-4 right-4 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-sm">
          Connecting...
        </div>
      )}

      {/* Controls */}
      <div className="p-6 pb-8">
        <div className="flex justify-center gap-8 mb-8">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
        </div>
        <div className="flex justify-center">
          <button
            onClick={endCall}
            className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg"
            aria-label="End call"
          >
            <PhoneOff size={32} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}