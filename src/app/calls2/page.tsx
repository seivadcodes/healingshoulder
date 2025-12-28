'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Phone, PhoneOff, Mic, MicOff, X, User } from 'lucide-react';
import { 
  Room, 
  RoomEvent, 
  ParticipantEvent,
  Track,
  createLocalTracks,
  RemoteParticipant
} from 'livekit-client';

export default function CallsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const router = useRouter();
  const supabase = createClient();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach(el => {
        el.pause();
        el.remove();
      });
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/auth');
        return;
      }

      // Set current user for caller name
      const userProfile = session.user.user_metadata;
      setCurrentUser({
        id: session.user.id,
        name: userProfile?.full_name || 'You',
      });

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .neq('id', session.user.id)
        .limit(10);

      if (error) {
        setError('Failed to load users');
      } else {
        setUsers(data || []);
      }
      setIsLoading(false);
    };

    loadUsers();

    const channel = supabase.channel('calls')
      .on('broadcast', { event: 'incoming_call' }, (payload: any) => {
        setIncomingCall(payload.payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (room) room.disconnect();
    };
  }, []);

  const connectToRoom = async (roomName: string, identityPrefix: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const identity = `${identityPrefix}-${session?.user.id}`;
      
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identity,
          room: roomName,
          isPublisher: true
        }),
      });

      const { token, url } = await response.json();
      
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          videoEncoding: { maxBitrate: 1_000_000 },
        },
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        setCallStatus('ended');
        setTimeout(() => {
          endCall();
        }, 2000);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        setCallStatus('ended');
        setTimeout(() => endCall(), 2000);
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        handleTrackSubscribed(track, publication, participant);
      });

      await newRoom.connect(url, token);
      
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

  const initiateCall = async () => {
    if (!selectedUser || !currentUser) return;
    
    const roomName = `call-${Date.now()}`;
    const { data: { session } } = await supabase.auth.getSession();
    
    const { error } = await supabase
      .from('calls')
      .insert({
        caller_id: session?.user.id,
        callee_id: selectedUser.id,
        room_name: roomName,
        status: 'ringing'
      });

    await supabase.channel('calls')
      .send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: {
          caller_id: session?.user.id,
          caller_name: currentUser.name,
          room_name: roomName,
          timestamp: Date.now()
        }
      });

    setActiveCall({
      id: Date.now().toString(),
      roomName,
      isCaller: true,
      with: selectedUser
    });
    
    setCallStatus('connecting');
    setCallDuration(0);
    await connectToRoom(roomName, 'caller');
  };

  const acceptCall = async () => {
    if (!incomingCall || !currentUser) return;
    
    setActiveCall({
      id: Date.now().toString(),
      roomName: incomingCall.room_name,
      isCaller: false,
      with: { id: incomingCall.caller_id, name: incomingCall.caller_name }
    });
    
    setIncomingCall(null);
    setCallStatus('connecting');
    setCallDuration(0);
    await connectToRoom(incomingCall.room_name, 'callee');
  };

  const endCall = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (room) {
      room.disconnect();
      setRoom(null);
    }
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus('ended');
    setCallDuration(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-stone-600">Loading community members...</p>
        </div>
      </div>
    );
  }

  // === Active Call View ===
  if (activeCall) {
    const displayName = activeCall.with.full_name || activeCall.with.name || 'Community Member';

    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        {/* Top bar */}
        <div className="p-6 text-center border-b border-gray-800">
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-gray-400 mt-1">
            {callStatus === 'connecting' ? 'Connecting...' : 
             callStatus === 'connected' ? `Active • ${formatTime(callDuration)}` : 
             'Call ended'}
          </p>
        </div>

        {/* Main area - avatar */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-gray-800 flex items-center justify-center border-4 border-gray-700">
            <span className="text-5xl">{displayName.charAt(0).toUpperCase()}</span>
          </div>
        </div>

        {/* Call ended overlay */}
        {callStatus === 'ended' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="text-center p-6">
              <p className="text-lg text-gray-300">
                {activeCall.isCaller 
                  ? 'Call ended' 
                  : 'Call ended by other party'}
              </p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-8 pb-12">
          <div className="flex justify-center gap-8 mb-8">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-4 rounded-full ${
                isMuted 
                  ? 'bg-red-500/20 text-red-400 border border-red-500' 
                  : 'bg-gray-700 text-white'
              }`}
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

  // === Incoming Call Overlay ===
  if (incomingCall) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center border-2 border-amber-300 animate-pulse">
              <Phone className="text-amber-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-stone-800 mt-4">Incoming Call</h2>
            <p className="text-stone-600 mt-2">{incomingCall.caller_name}</p>
            
            <div className="flex gap-6 mt-8 w-full">
              <button
                onClick={endCall}
                className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-800 font-medium py-3 rounded-full flex items-center justify-center gap-2 transition-colors"
              >
                <X size={20} />
              </button>
              
              <button
                onClick={acceptCall}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-full flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                <Phone size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === Main User List ===
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100 p-4">
      {error && (
        <div className="fixed top-4 right-4 max-w-sm p-4 bg-red-100 text-red-700 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-stone-800">Connect With Community</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-stone-600 hover:text-stone-900"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-100 bg-stone-50">
            <p className="text-stone-700">
              Select someone from your community to start a private audio call. 
              This is a sacred space for sharing grief — your conversation stays between you.
            </p>
          </div>
          
          <div className="divide-y divide-stone-100">
            {users.map((user) => (
              <div
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-amber-50 transition-colors ${
                  selectedUser?.id === user.id ? 'bg-amber-50 ring-2 ring-amber-200' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 flex-shrink-0 flex items-center justify-center border border-amber-200 overflow-hidden">
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.full_name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-amber-800 font-medium">
                      {user.full_name?.charAt(0) || <User size={20} />}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-stone-800 truncate">{user.full_name}</h3>
                  <p className="text-stone-500 text-sm mt-1">Community member</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {selectedUser && (
          <div className="mt-6 bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-800 mb-3">Confirm Call Participants</h2>
            
            {/* Caller and Callee Name Inputs */}
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Caller (You)
                </label>
                <input
                  type="text"
                  value={currentUser?.name || 'You'}
                  readOnly
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-100 text-stone-800 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Callee
                </label>
                <input
                  type="text"
                  value={selectedUser.full_name}
                  readOnly
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-100 text-stone-800 cursor-not-allowed"
                />
              </div>
            </div>

            <p className="text-stone-600 mb-4">
              You're about to start an audio call with {selectedUser.full_name}. 
              This creates a private space where you can share your grief journey.
            </p>
            <button
              onClick={initiateCall}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md hover:shadow-lg"
            >
              <Phone size={20} />
              Start Call
            </button>
          </div>
        )}
      </div>
    </div>
  );
}