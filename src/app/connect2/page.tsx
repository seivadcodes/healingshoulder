// app/connect2/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Phone, PhoneOff, Mic, MicOff, X, MessageCircle, HelpCircle, Check, Loader } from 'lucide-react';
import { 
  Room, 
  
  RoomEvent,
  ParticipantEvent,
  Track,
  createLocalTracks,
  RemoteParticipant
} from 'livekit-client';

export default function ConnectPage() {
  const [helpRequests, setHelpRequests] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();
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
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/auth');
        return;
      }

      setCurrentUser(session.user);

      // Load existing help requests
      const { data, error } = await supabase
        .from('help_requests')
        .select('*')
        .eq('status', 'open')
        .neq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Failed to load help requests');
      } else {
        setHelpRequests(data || []);
      }

      setIsLoading(false);

      // Subscribe to real-time updates
      const channel = supabase
        .channel('help_requests')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'help_requests',
          filter: `status=eq.open,user_id=neq.${session.user.id}`
        }, (payload: any) => {
          setHelpRequests(prev => [payload.new, ...prev]);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'help_requests'
        }, (payload: any) => {
          if (payload.new.status === 'accepted' || payload.new.status === 'closed') {
            setHelpRequests(prev => prev.filter(req => req.id !== payload.new.id));
          }
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'help_requests'
        }, (payload: any) => {
          setHelpRequests(prev => prev.filter(req => req.id !== payload.old.id));
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        if (room) room.disconnect();
      };
    };

    initialize();
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

      // Handle remote participant disconnect
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

  const createHelpRequest = async () => {
    if (!requestMessage.trim() || !currentUser) return;
    
    setSubmittingRequest(true);
    try {
      const { error } = await supabase
        .from('help_requests')
        .insert({
          user_id: currentUser.id,
          message: requestMessage.trim(),
          status: 'open'
        });

      if (error) throw error;

      // Clear form and close modal
      setRequestMessage('');
      setShowRequestModal(false);
      
      // Show success message
      setError(null);
    } catch (err) {
      setError('Failed to create help request. Please try again.');
      console.error('Request creation error:', err);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const acceptHelpRequest = async (request: any) => {
    if (!currentUser) return;
    
    try {
      // Create room name for the call
      const roomName = `help-${Date.now()}`;
      
      // Update the help request to accepted status
      const { error: updateError } = await supabase
        .from('help_requests')
        .update({ 
          status: 'accepted',
          accepted_by: currentUser.id,
          room_name: roomName
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Set up active call
      setActiveCall({
        id: request.id,
        roomName,
        isHelper: true,
        requester: request.user,
        message: request.message
      });
      
      setCallStatus('connecting');
      setCallDuration(0);
      
      // Connect to the room
      await connectToRoom(roomName, 'helper');
      
      // Notify the requester (this will be handled by real-time updates on their end)
    } catch (err) {
      setError('Failed to accept help request. Please try again.');
      console.error('Accept error:', err);
    }
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
    setCallStatus('ended');
    setCallDuration(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle incoming accepted requests (when someone accepts our request)
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`user_requests:${currentUser.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'help_requests',
        filter: `user_id=eq.${currentUser.id},status=eq.accepted`
      }, async (payload: any) => {
        if (payload.new.room_name && payload.new.accepted_by) {
          // Get helper's profile
          const { data: helperData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', payload.new.accepted_by)
            .single();

          setActiveCall({
            id: payload.new.id,
            roomName: payload.new.room_name,
            isHelper: false,
            helper: helperData,
            message: payload.new.message
          });
          
          setCallStatus('connecting');
          setCallDuration(0);
          
          // Connect to the room
          await connectToRoom(payload.new.room_name, 'requester');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-stone-600">Loading community support...</p>
        </div>
      </div>
    );
  }

  // Active Call View
  if (activeCall) {
    const displayName = activeCall.isHelper 
      ? `${activeCall.requester?.full_name || 'Community Member'} (Requester)`
      : `${activeCall.helper?.full_name || 'Helper'} (Helper)`;

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
          {activeCall.message && (
            <p className="text-amber-400 mt-2 italic">"{activeCall.message}"</p>
          )}
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
                {activeCall.isHelper 
                  ? 'Call ended' 
                  : 'Call ended by other party'}
              </p>
              <button
                onClick={() => router.push('/connect2')}
                className="mt-4 px-6 py-2 bg-amber-500 rounded-full font-medium hover:bg-amber-600 transition-colors"
              >
                Return to Support Hub
              </button>
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100 p-4">
      {error && (
        <div className="fixed top-4 right-4 max-w-sm p-4 bg-red-100 text-red-700 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <HelpCircle className="text-amber-600" /> Community Support Hub
          </h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-stone-600 hover:text-stone-900"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-6 bg-amber-50 border-b border-amber-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-full mt-1">
                <MessageCircle className="text-amber-700" size={24} />
              </div>
              <div>
                <h2 className="font-bold text-stone-800">Need Immediate Support?</h2>
                <p className="text-stone-600 mt-1">
                  Share what's happening with the community. Someone will be with you shortly.
                </p>
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="mt-3 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors shadow-md"
                >
                  <HelpCircle size={18} />
                  Ask for Help Now
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {helpRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <HelpCircle className="text-amber-600" size={32} />
                </div>
                <h3 className="text-stone-800 font-medium">No Active Requests</h3>
                <p className="text-stone-500 mt-2">
                  Be the first to support someone in need. Check back soon or create your own request.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-stone-800 mb-4">Active Requests</h2>
                <div className="space-y-4">
                  {helpRequests.map((request) => (
                    <div 
                      key={request.id} 
                      className="border border-stone-200 rounded-xl p-5 hover:border-amber-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center border border-amber-200">
                              <span className="text-amber-800 font-medium text-lg">
                                {request.user?.full_name?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-medium text-stone-800">{request.user?.full_name || 'Community Member'}</h3>
                              <p className="text-xs text-stone-500 mt-0.5">
                                {new Date(request.created_at).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                          </div>
                          <p className="text-stone-700 italic pl-13">"{request.message}"</p>
                        </div>
                        <button
                          onClick={() => acceptHelpRequest(request)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors shadow"
                        >
                          <Check size={18} />
                          Accept Request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-stone-800">Request Support</h2>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-stone-500 hover:text-stone-700"
              >
                <X size={24} />
              </button>
            </div>
            
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Share what's happening... Be as open as you feel comfortable."
              className="w-full h-40 p-4 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none mb-4"
              maxLength={500}
            />
            <p className="text-right text-sm text-stone-500 mb-4">{requestMessage.length}/500</p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-800 font-medium py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createHelpRequest}
                disabled={submittingRequest || requestMessage.trim().length < 10}
                className={`flex-1 font-medium py-3 rounded-xl transition-colors flex items-center justify-center ${
                  submittingRequest || requestMessage.trim().length < 10
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                {submittingRequest ? (
                  <>
                    <Loader className="animate-spin mr-2" size={18} />
                    Sending...
                  </>
                ) : (
                  'Post Request'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}