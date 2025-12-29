// app/room/[id]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PhoneOff, Video, VideoOff, Mic, MicOff, Clock, AlertTriangle, User as UserIcon } from 'lucide-react';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const roomId = params.id as string;
  
  // User and room state
  const [user, setUser] = useState<any>(null);
  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  
  // Media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  // Media elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // WebRTC
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  
  // Call state
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callStartedAt, setCallStartedAt] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  
  // Timeout for missing participant
  const missingParticipantTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Get user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/auth');
          return;
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;
        setUser(profile);

        // Verify room exists and user is part of it
        await verifyRoomAccess(session.user.id);
        
        // Setup media
        await setupMedia();
        
        // Setup real-time room updates
        setupRoomSubscription();
        
        // Start call timer
        setCallStartedAt(new Date());
        
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to join the room. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      cleanup();
    };
  }, [roomId]);

  // Timer for call duration
  useEffect(() => {
    if (!callStartedAt || !isCallActive) return;

    const timer = setInterval(() => {
      const duration = Math.floor((Date.now() - callStartedAt.getTime()) / 1000);
      setCallDuration(duration);
    }, 1000);

    return () => clearInterval(timer);
  }, [callStartedAt, isCallActive]);

  // Handle missing participant timeout
  useEffect(() => {
    if (participants.length < 2 && !missingParticipantTimeoutRef.current) {
      // Set a 30-second timeout for the second participant to join
      missingParticipantTimeoutRef.current = setTimeout(() => {
        setError('The other participant hasn\'t joined yet. Please wait a moment or end the call.');
      }, 30000);
    } else if (participants.length >= 2 && missingParticipantTimeoutRef.current) {
      clearTimeout(missingParticipantTimeoutRef.current);
      missingParticipantTimeoutRef.current = null;
    }

    return () => {
      if (missingParticipantTimeoutRef.current) {
        clearTimeout(missingParticipantTimeoutRef.current);
      }
    };
  }, [participants]);

 const verifyRoomAccess = async (userId: string) => {
  try {
    // Fetch room data — include acceptor_id!
    const { data: roomData, error: roomError } = await supabase
      .from('quick_connect_requests')
      .select(`
        id,
        status,
        room_id,
        user_id,
        acceptor_id,
        created_at,
        requester_profile:profiles!user_id(id, full_name, avatar_url)
      `)
      .eq('room_id', roomId)
      .single();

    if (roomError) throw roomError;
    if (!roomData) throw new Error('Room not found');

    // Room must be in "matched" status
    if (roomData.status !== 'matched') {
      throw new Error('This room is no longer active');
    }

    // Check if current user is either requester or acceptor
    const isRequester = roomData.user_id === userId;
    const isAcceptor = roomData.acceptor_id === userId;

    if (!isRequester && !isAcceptor) {
      throw new Error('You are not authorized to join this room');
    }

    // Set room state
    setRoom(roomData);

    // Build participants list
    const participantsList = [];

    // Add requester
    participantsList.push({
      user_id: roomData.user_id,
      full_name: roomData.requester_profile?.[0]?.full_name || 'Anonymous',
      avatar_url: roomData.requester_profile?.[0]?.avatar_url || null,
      isSelf: isRequester,
    });

    // Add acceptor (if exists)
    if (roomData.acceptor_id) {
      const { data: acceptorProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', roomData.acceptor_id)
        .single();

      if (profileError) {
        console.warn('Could not load acceptor profile:', profileError);
      }

      participantsList.push({
        user_id: roomData.acceptor_id,
        full_name: acceptorProfile?.full_name || 'Anonymous',
        avatar_url: acceptorProfile?.avatar_url || null,
        isSelf: isAcceptor,
      });
    }

    setParticipants(participantsList);
    return roomData;
  } catch (err) {
    console.error('Room verification failed:', err);
    throw err;
  }
};
  const setupMedia = async () => {
    try {
      // Get media permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // Prevent echo
      }
      
      // Setup WebRTC connection
      await setupWebRTC();
      
    } catch (err) {
      console.error('Media setup failed:', err);
      setError('Failed to access camera/microphone. Please check permissions.');
    }
  };

  const setupWebRTC = async () => {
    try {
      // Create peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });
      
      peerConnectionRef.current = peerConnection;

      // Add local stream tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          // Send candidate to other peer (would use signaling server in production)
          console.log('ICE candidate:', event.candidate);
        }
      };

      // Handle remote stream
      peerConnection.ontrack = event => {
        const remoteStream = new MediaStream();
        event.streams[0].getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
        
        setRemoteStream(remoteStream);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // In a real app, you'd exchange SDP offers/answers via signaling
      // For this demo, we'll simulate connection after 2 seconds
      setTimeout(() => {
        setIsCallActive(true);
      }, 2000);

    } catch (err) {
      console.error('WebRTC setup failed:', err);
      setError('Failed to establish video connection. Please try again.');
    }
  };

  const setupRoomSubscription = () => {
    // Subscribe to room updates to detect when participants leave
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quick_connect_requests',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          if (payload.new.status !== 'matched') {
            // Room has been closed
            handleCallEnd('The call has ended');
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Also listen for participant changes (in a real app, you'd have a participants table)
    // For this demo, we'll just monitor the room status
  };

  const toggleAudio = () => {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !isAudioEnabled;
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !isVideoEnabled;
      setIsVideoEnabled(!isVideoEnabled);
      
      if (localVideoRef.current) {
        localVideoRef.current.classList.toggle('hidden', !isVideoEnabled);
      }
    }
  };

  const leaveRoom = async () => {
    if (isLeaving) return;
    
    setIsLeaving(true);
    try {
      // Update room status to completed
      await supabase
        .from('quick_connect_requests')
        .update({ status: 'completed' })
        .eq('room_id', roomId);

      // Cleanup resources
      cleanup();
      
      // Return to connect page
      router.push('/connect');
    } catch (err) {
      console.error('Failed to leave room:', err);
      setError('Failed to leave the room. Please try again.');
      setIsLeaving(false);
    }
  };

  const handleCallEnd = (reason: string) => {
    setError(reason);
    setIsCallActive(false);
    cleanup();
    
    // Auto-redirect after 3 seconds
    setTimeout(() => {
      router.push('/connect');
    }, 3000);
  };

  const cleanup = () => {
    // Clean up media streams
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    
    // Clean up peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Clean up Supabase channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // Clean up timeout
    if (missingParticipantTimeoutRef.current) {
      clearTimeout(missingParticipantTimeoutRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-stone-600">Joining room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100 p-4">
        <div className="bg-white rounded-xl border border-stone-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-3">Connection Issue</h2>
          <p className="text-stone-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/connect')}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-full transition-colors"
          >
            Return to Connections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Room Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Active Connection</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex -space-x-2">
                {participants.map((participant, index) => (
                  <div 
                    key={participant.user_id || index} 
                    className={`w-10 h-10 rounded-full border-2 ${
                      participant.isSelf ? 'border-amber-400' : 'border-stone-200'
                    } bg-stone-200 flex items-center justify-center overflow-hidden`}
                  >
                    {participant.avatar_url ? (
                      <img 
                        src={participant.avatar_url} 
                        alt={participant.full_name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-stone-700 font-medium">
                        {participant.full_name.charAt(0)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-stone-600">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-3 py-1">
              <Clock size={16} />
              <span className="font-medium">{formatDuration(callDuration)}</span>
            </div>
            <button
              onClick={leaveRoom}
              disabled={isLeaving}
              className={`${
                isLeaving 
                  ? 'bg-stone-200 cursor-not-allowed' 
                  : 'bg-red-500 hover:bg-red-600'
              } text-white font-bold py-2 px-4 rounded-full flex items-center gap-2 transition-colors`}
            >
              {isLeaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <PhoneOff size={18} />
              )}
              End Call
            </button>
          </div>
        </div>

        {/* Video Container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main video (remote participant) */}
          <div className="lg:col-span-2 bg-stone-800 rounded-xl overflow-hidden aspect-video relative">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full bg-stone-700 flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-amber-400 flex items-center justify-center mb-4">
                  <UserIcon className="text-white" size={28} />
                </div>
                <h3 className="text-white text-xl font-bold mb-2">
                  {participants.find(p => !p.isSelf)?.full_name || 'Anonymous'}
                </h3>
                <p className="text-stone-300">Joining the call...</p>
              </div>
            )}
            
            {/* Local video overlay */}
            <div className="absolute bottom-4 right-4 w-32 h-24 bg-stone-800 rounded-lg overflow-hidden border-2 border-white">
              {localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${
                    isVideoEnabled ? '' : 'opacity-50'
                  }`}
                />
              ) : (
                <div className="w-full h-full bg-stone-700 flex items-center justify-center">
                  <UserIcon className="text-stone-400" size={20} />
                </div>
              )}
            </div>
          </div>
          
          {/* Participant info and controls */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-xl font-bold text-stone-800 mb-4">Participants</h2>
            
            <div className="space-y-4 mb-6">
              {participants.map((participant) => (
                <div 
                  key={participant.user_id} 
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    participant.isSelf ? 'bg-amber-50' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full ${
                    participant.isSelf ? 'border-2 border-amber-400' : 'border border-stone-200'
                  } bg-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0`}>
                    {participant.avatar_url ? (
                      <img 
                        src={participant.avatar_url} 
                        alt={participant.full_name} 
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-stone-700 font-medium text-lg">
                        {participant.full_name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-stone-800 truncate">{participant.full_name}</h3>
                    <p className={`text-xs ${
                      participant.isSelf ? 'text-amber-600' : 'text-green-500'
                    } font-medium`}>
                      {participant.isSelf ? 'You' : 'Connected'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t border-stone-200 pt-4">
              <h3 className="font-medium text-stone-800 mb-3">Call Controls</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={toggleAudio}
                  className={`p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${
                    isAudioEnabled 
                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' 
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                  <span className="text-sm font-medium">{isAudioEnabled ? 'Mute' : 'Unmute'}</span>
                </button>
                
                <button
                  onClick={toggleVideo}
                  className={`p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${
                    isVideoEnabled 
                      ? 'bg-purple-50 text-purple-700 hover:bg-purple-100' 
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                  <span className="text-sm font-medium">{isVideoEnabled ? 'Hide' : 'Show'} Video</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 text-center mb-8">
          <div className="flex items-center justify-center gap-2 text-amber-600">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
            <span className="font-medium">Connection active • HD quality</span>
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-amber-600" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-stone-800 mb-1">Connection Tips</h3>
              <ul className="text-stone-600 space-y-1 text-sm">
                <li>• If you can't hear or see the other person, try toggling your microphone or camera</li>
                <li>• For best results, use a stable internet connection</li>
                <li>• The call will automatically end after 30 minutes</li>
                <li>• You can end the call anytime by clicking "End Call"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}