'use client';
import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Room, RemoteAudioTrack, LocalAudioTrack } from 'livekit-client';
import toast from 'react-hot-toast';

type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';
type CallType = 'audio' | 'video';

type IncomingCall = {
  callerId: string;
  callerName: string;
  callerAvatar?: string | null;
  callType: CallType;
  roomName: string;
  conversationId: string;
};

type CallContextType = {
  callState: CallState;
  callType: CallType;
  calleeName: string | null;
  calleeAvatar?: string | null;
  incomingCall: IncomingCall | null;
  callRoom: Room | null;
  remoteAudioTrack: RemoteAudioTrack | null;
  localAudioTrack: LocalAudioTrack | null;
  isMuted: boolean;
  isCameraOff: boolean;
  participantName: string;
  participantAvatar?: string | null;
  callDuration: number;
  acceptCall: (roomName: string) => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
  startCall: (calleeId: string, calleeName: string, type: CallType, roomName: string, conversationId: string, calleeAvatar?: string | null) => Promise<void>;
  setIsMuted: (muted: boolean) => void;
  setIsCameraOff: (off: boolean) => void;
  setParticipantName: (name: string) => void;
  setParticipantAvatar: (avatar: string | null) => void;
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({
  children,
  userId,
  fullName,
}: {
  children: ReactNode;
  userId: string;
  fullName: string;
}) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('audio');
  const [calleeName, setCalleeName] = useState<string | null>(null);
  const [calleeAvatar, setCalleeAvatar] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callRoom, setCallRoom] = useState<Room | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<RemoteAudioTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(true);
  const [participantName, setParticipantName] = useState('');
  const [participantAvatar, setParticipantAvatar] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const supabase = createClient();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer management effect
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callState]);

  // Clear all call state when idle
  useEffect(() => {
    if (callState === 'idle') {
      setIncomingCall(null);
      setCalleeName(null);
      setCalleeAvatar(null);
      setRemoteAudioTrack(null);
      setLocalAudioTrack(null);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [callState]);

  // Listen for incoming calls
  useEffect(() => {
    const channel = supabase
      .channel('call_notifications')
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const { callerId, callerName, callerAvatar, callType, roomName, conversationId } = payload.payload;
        
        // Only process if we're not already in a call
        if (callState === 'idle') {
          console.log('CallCheck: Received incoming call', payload.payload);
          setIncomingCall({ callerId, callerName, callerAvatar, callType, roomName, conversationId });
          setCallState('ringing');
          setParticipantName(callerName);
          setParticipantAvatar(callerAvatar || null);
        }
      })
      .on('broadcast', { event: 'call_rejected' }, () => {
        if (callState === 'calling') {
          console.log('CallCheck: Call rejected by callee');
          toast.error('Call rejected');
          hangUp();
        }
      })
      .on('broadcast', { event: 'call_accepted' }, (payload) => {
        if (callState === 'calling') {
          console.log('CallCheck: Call accepted by callee, connecting to room');
          setCallState('connecting');
          connectToRoom(payload.payload.roomName);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callState, supabase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callRoom) {
        hangUp();
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callRoom]);

  // Handle mute state changes
  useEffect(() => {
    if (localAudioTrack && callState === 'connected') {
      const mediaStreamTrack = localAudioTrack.mediaStreamTrack;
      if (mediaStreamTrack) {
        mediaStreamTrack.enabled = !isMuted;
      }
    }
  }, [isMuted, localAudioTrack, callState]);

  const connectToRoom = async (roomName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');
      
      const userName = session.user.user_metadata?.full_name || 
                      session.user.email?.split('@')[0] || 
                      'Anonymous';
      
      // Get token from API
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: roomName,
          identity: session.user.id,
          name: userName,
        }),
      });
      
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get token');
      }
      
      const { token } = await tokenRes.json();
      
      // Connect to room
      const room = new Room();
      
      // Handle track subscriptions
      room.on('trackSubscribed', (track) => {
        console.log('CallCheck: Track subscribed', track.kind);
        if (track.kind === 'audio' && track instanceof RemoteAudioTrack) {
          setRemoteAudioTrack(track);
        }
      });
      
      room.on('disconnected', () => {
        console.log('CallCheck: Room disconnected');
        hangUp();
      });
      
      await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);
      console.log('CallCheck: Successfully connected to room', roomName);
      
      // Publish local audio track
      const tracks = await room.localParticipant.createTracks({ audio: true });
      if (tracks[0]) {
        await room.localParticipant.publishTrack(tracks[0]);
        setLocalAudioTrack(tracks[0] as LocalAudioTrack);
      }
      
      setCallRoom(room);
      setCallState('connected');
      return room;
    } catch (error) {
      console.error('CallCheck: Failed to connect to room:', error);
      toast.error('Failed to connect to call');
      hangUp();
      throw error;
    }
  };

  const startCall = async (calleeId: string, calleeName: string, type: CallType, roomName: string, conversationId: string, avatarUrl?: string | null) => {
    try {
      console.log('CallCheck: Starting call to', calleeName);
      
      // Validate inputs
      if (!calleeId || !calleeName || !roomName || !conversationId) {
        throw new Error('Missing required call parameters');
      }
      
      // Reset duration for new call
      setCallDuration(0);
      
      setCallType(type);
      setCalleeName(calleeName);
      setCalleeAvatar(avatarUrl || null);
      setParticipantName(calleeName);
      setParticipantAvatar(avatarUrl || null);
      setCallState('calling');
      
      // Get current user info
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');
      
      const callerName = session.user.user_metadata?.full_name || 
                        session.user.email?.split('@')[0] || 
                        'Anonymous';
      
      const callerAvatar = session.user.user_metadata?.avatar_url || null;
      
      // Send notification to callee
      await supabase.channel('call_notifications').send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: {
          callerId: session.user.id,
          callerName,
          callerAvatar,
          callType: type,
          roomName,
          conversationId,
        },
      });
      
    } catch (error) {
      console.error('CallCheck: Failed to start call:', error);
      toast.error('Failed to start call');
      setCallState('idle');
    }
  };

  const acceptCall = async (roomName: string) => {
    try {
      console.log('CallCheck: Accepting call for room', roomName);
      
      if (!incomingCall) {
        throw new Error('No incoming call to accept');
      }
      
      // Reset duration for new call
      setCallDuration(0);
      
      setCallType(incomingCall.callType);
      setParticipantName(incomingCall.callerName);
      setParticipantAvatar(incomingCall.callerAvatar || null);
      
      // Notify caller that call was accepted
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');
      
      await supabase.channel('call_notifications').send({
        type: 'broadcast',
        event: 'call_accepted',
        payload: {
          roomName: roomName,
        },
      });
      
      // Clear incoming call state first
      setIncomingCall(null);
      
      // Set state to connecting BEFORE connecting to room
      setCallState('connecting');
      
      // Connect to room
      await connectToRoom(roomName);
      
    } catch (error) {
      console.error('CallCheck: Failed to accept call:', error);
      toast.error('Failed to accept call');
      hangUp();
    }
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    
    console.log('CallCheck: Rejecting call from', incomingCall.callerName);
    
    // Notify caller that call was rejected
    supabase.channel('call_notifications').send({
      type: 'broadcast',
      event: 'call_rejected',
      payload: {},
    });
    
    setIncomingCall(null);
    setCallState('idle');
  };

  const hangUp = useCallback(() => {
    console.log('CallCheck: Hanging up call, current state:', callState);
    
    if (callRoom) {
      // Unpublish all tracks
      callRoom.localParticipant.trackPublications.forEach((publication) => {
        if (publication.track) {
          callRoom.localParticipant.unpublishTrack(publication.track);
          publication.track.stop();
        }
      });
      
      callRoom.disconnect();
      setCallRoom(null);
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setRemoteAudioTrack(null);
    setLocalAudioTrack(null);
    setCallState('ended');
    
    // Return to idle state after a brief delay
    setTimeout(() => {
      setCallState('idle');
      setCallDuration(0); // Reset duration after hangup completes
    }, 500);
  }, [callRoom, callState]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        calleeName,
        calleeAvatar,
        incomingCall,
        callRoom,
        remoteAudioTrack,
        localAudioTrack,
        isMuted,
        isCameraOff,
        participantName,
        participantAvatar,
        callDuration,
        acceptCall,
        rejectCall,
        hangUp,
        startCall,
        setIsMuted,
        setIsCameraOff,
        setParticipantName,
        setParticipantAvatar,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};