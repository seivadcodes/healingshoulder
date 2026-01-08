'use client';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Room } from 'livekit-client';
import type { RemoteTrack, LocalTrack } from 'livekit-client';
// Add these imports at the top of the file
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';

type IncomingCall = {
  roomName: string;
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
  conversationId: string;
};

type CallContextType = {
  // Call state
  callState: CallState;
  setCallState: (state: CallState) => void;
  
  callType: 'audio' | 'video';
  setCallType: (type: 'audio' | 'video') => void;
  
  // Incoming call
  incomingCall: IncomingCall | null;
  setIncomingCall: (call: IncomingCall | null) => void;
  
  // Room & tracks
  callRoom: Room | null;
  setCallRoom: (room: Room | null) => void;
  
  // Audio tracks
  remoteAudioTrack: RemoteTrack | null;
  setRemoteAudioTrack: (track: RemoteTrack | null) => void;
  
  localAudioTrack: LocalTrack | null;
  setLocalAudioTrack: (track: LocalTrack | null) => void;
  
  // Video tracks (for video calls)
  remoteVideoTrack: RemoteTrack | null;
  setRemoteVideoTrack: (track: RemoteTrack | null) => void;
  
  localVideoTrack: LocalTrack | null;
  setLocalVideoTrack: (track: LocalTrack | null) => void;
  
  // Controls
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  
  isCameraOff: boolean;
  setIsCameraOff: (off: boolean) => void;
  
  // Call duration (in seconds)
  callDuration: number;
  setCallDuration: (duration: number) => void;
  
  // Timer controls
  startCallTimer: () => void;
  resetCallTimer: () => void;
  
  // Call actions
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [callDuration, setCallDuration] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callRoom, setCallRoom] = useState<Room | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<RemoteTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalTrack | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<RemoteTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalTrack | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Start the timer when call is connected
  const startCallTimer = () => {
    resetCallTimer();
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  // Reset the timer
  const resetCallTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setCallDuration(0);
  };

  // Cleanup on unmount
useEffect(() => {
  return () => {
    resetCallTimer();
    if (callRoom) {
      callRoom.disconnect();
    }
  };
}, [callRoom, resetCallTimer]); // Add resetCallTimer to dependencies

  const acceptCall = async () => {
  if (!incomingCall) return;
  
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in');
      return;
    }

    const currentUserId = session.user.id;
    const userName = session.user.user_metadata?.full_name || session.user.email || 'Anonymous';

    // Set UI state
    setCallType(incomingCall.callType);
    setCallState('connecting');
    
    // Get token and connect to room
    const tokenRes = await fetch('/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: incomingCall.roomName,
        identity: currentUserId,
        name: userName,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      throw new Error(err.error || 'Token failed');
    }

    const { token } = await tokenRes.json();
    const room = new Room();
    setCallRoom(room);
    
    // Subscribe to track events
    room.on('trackSubscribed', (track: RemoteTrack) => {
      console.log('📥 Subscribed to remote track:', track.kind);
      if (track.kind === 'audio') {
        setRemoteAudioTrack(track);
      }
    });

    // Connect to room
    await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);
    console.log('CallCheck: Callee joined room successfully');

    // Publish local audio track
    let audioTrack: LocalTrack | null = null;
    try {
      const tracks = await room.localParticipant.createTracks({ audio: true });
      if (tracks[0]) {
        await room.localParticipant.publishTrack(tracks[0]);
        audioTrack = tracks[0];
        setLocalAudioTrack(audioTrack);
      }
    } catch (e) {
      console.warn('Audio track creation failed:', e);
    }

    // Set state to connected
    setCallState('connected');
    startCallTimer();
    
    // Clear incoming call state
    setIncomingCall(null);
  } catch (error) {
    console.error('Failed to accept call:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to join call');
    setCallState('ended');
    setTimeout(() => setCallState('idle'), 1000);
  }
};
  const rejectCall = () => {
    if (!incomingCall) return;
    
    // Notify caller that call was rejected
    console.log('Rejecting call from:', incomingCall.callerName);
    
    // Clear incoming call state
    setIncomingCall(null);
    setCallState('idle');
  };

  const hangUp = () => {
    if (callRoom) {
      // Unpublish all tracks before disconnecting
      Array.from(callRoom.localParticipant.trackPublications.values()).forEach((publication) => {
        if (publication.track) {
          callRoom.localParticipant.unpublishTrack(publication.track);
        }
      });
      
      callRoom.disconnect();
      setCallRoom(null);
    }
    
    // Reset all call states
    setRemoteAudioTrack(null);
    setLocalAudioTrack(null);
    setRemoteVideoTrack(null);
    setLocalVideoTrack(null);
    resetCallTimer();
    setCallState('ended');
    
    // After a brief delay, return to idle state
    setTimeout(() => {
      setCallState('idle');
    }, 1000);
  };

  return (
    <CallContext.Provider
      value={{
        callState,
        setCallState,
        callType,
        setCallType,
        callDuration,
        setCallDuration,
        startCallTimer,
        resetCallTimer,
        incomingCall,
        setIncomingCall,
        callRoom,
        setCallRoom,
        remoteAudioTrack,
        setRemoteAudioTrack,
        localAudioTrack,
        setLocalAudioTrack,
        remoteVideoTrack,
        setRemoteVideoTrack,
        localVideoTrack,
        setLocalVideoTrack,
        isMuted,
        setIsMuted,
        isCameraOff,
        setIsCameraOff,
        acceptCall,
        rejectCall,
        hangUp,
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