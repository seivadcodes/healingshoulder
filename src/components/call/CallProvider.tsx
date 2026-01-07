// src/components/call/CallProvider.tsx
'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Room } from 'livekit-client';

type CallInvitation = {
  caller_id: string;
  caller_name: string;
  room_id: string;
};

type CallContextType = {
  outgoingCall: (roomId: string, participantName: string) => void;
  endCall: () => void;
  isCallActive: boolean;
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children, currentUserId }: { children: ReactNode; currentUserId: string | null }) {
  const supabase = createClient();
  const [incomingCall, setIncomingCall] = useState<CallInvitation | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeParticipantName, setActiveParticipantName] = useState<string>('');

  // 🔔 Listen for incoming call invitations
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`user:${currentUserId}`)
      .on('broadcast', { event: 'call_invitation' }, (payload) => {
        const { caller_id, caller_name, room_id } = payload.payload;
        setIncomingCall({ caller_id, caller_name, room_id });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // 📞 Start an outgoing call
  const outgoingCall = (roomId: string, participantName: string) => {
    setActiveRoomId(roomId);
    setActiveParticipantName(participantName);
    setIsCallActive(true);
  };

  // 🚪 End current call
  const endCall = () => {
    setIsCallActive(false);
    setActiveRoomId(null);
    setActiveParticipantName('');
  };

  // ✅ Accept incoming call
  const handleAccept = async () => {
    if (!incomingCall || !currentUserId) return;

    try {
      // Add self to room_participants
      await supabase
        .from('room_participants')
        .upsert({ room_id: incomingCall.room_id, user_id: currentUserId });

      // Notify caller
      const channel = supabase.channel(`user:${incomingCall.caller_id}`);
      await channel.send({
        type: 'broadcast',
        event: 'call_accepted',
        payload: { room_id: incomingCall.room_id },
      });

      // Start call
      setActiveRoomId(incomingCall.room_id);
      setActiveParticipantName(incomingCall.caller_name);
      setIsCallActive(true);
      setIncomingCall(null);
    } catch (err) {
      console.error('Failed to accept call:', err);
      toast.error('Could not join call');
    }
  };

  // ❌ Decline incoming call
  const handleDecline = async () => {
    if (!incomingCall || !currentUserId) return;

    try {
      const channel = supabase.channel(`user:${incomingCall.caller_id}`);
      await channel.send({
        type: 'broadcast',
        event: 'call_declined',
        payload: { by: currentUserId },
      });
      setIncomingCall(null);
      toast('Call declined', { icon: '📞' });
    } catch (err) {
      console.error('Failed to decline call:', err);
      setIncomingCall(null);
    }
  };

  return (
    <CallContext.Provider value={{ outgoingCall, endCall, isCallActive }}>
      {children}

      {/* 🔔 Incoming Call Banner (global) */}
      {incomingCall && (
        <div
          style={{
            position: 'fixed',
            top: '4rem',
            left: 0,
            right: 0,
            zIndex: 10000,
            maxWidth: '48rem',
            margin: '0 auto',
            padding: '0.75rem 1rem',
            backgroundColor: '#1e3a8a',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: '0 0 0.5rem 0.5rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>📞 Incoming call from <strong>{incomingCall.caller_name}</strong></span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleAccept}
              style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Accept
            </button>
            <button
              onClick={handleDecline}
              style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* 📞 Active Call Modal (global) */}
      {isCallActive && activeRoomId && currentUserId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <HandleCall
            roomId={activeRoomId}
            participantName={activeParticipantName}
            currentUserId={currentUserId}
            onEndCall={endCall}
          />
        </div>
      )}
    </CallContext.Provider>
  );
}

// ✅ HandleCall: Full-featured LiveKit call component (must return JSX)
function HandleCall({
  roomId,
  participantName,
  currentUserId,
  onEndCall,
}: {
  roomId: string;
  participantName: string;
  currentUserId: string;
  onEndCall: () => void;
}) {
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected' | 'ended'>('idle');
  const roomRef = useRef<Room | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (callStatus !== 'idle') return;

    const startCall = async () => {
      setCallStatus('connecting');

      try {
        // Fetch LiveKit token
        const tokenRes = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: roomId,
            identity: currentUserId,
            name: 'You',
          }),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.json();
          throw new Error(err.error || 'Failed to get call token');
        }
        const { token } = await tokenRes.json();

        // Initialize LiveKit Room
        const room = new Room();

        // Handle remote participant video
        room.on('trackSubscribed', (track, _, participant) => {
          if (participant.identity === currentUserId) return; // skip self
          const element = track.attach();
          if (remoteVideoRef.current) {
            remoteVideoRef.current.innerHTML = '';
            remoteVideoRef.current.appendChild(element);
          }
        });

        room.on('trackUnsubscribed', (track) => {
          track.detach().forEach(el => el.remove());
        });

        // Connect to room
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);

        // Enable mic and camera
        await room.localParticipant.setMicrophoneEnabled(true);
        const camPub = await room.localParticipant.setCameraEnabled(true);
        if (camPub?.track && localVideoRef.current) {
          const localEl = camPub.track.attach();
          localVideoRef.current.innerHTML = '';
          localVideoRef.current.appendChild(localEl);
        }

        roomRef.current = room;
        setCallStatus('connected');
      } catch (err) {
        console.error('Call connection failed:', err);
        toast.error('Unable to connect to call');
        onEndCall();
      }
    };

    startCall();
  }, [callStatus, roomId, currentUserId, onEndCall]);

  const handleEnd = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    onEndCall();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  // ✅ MUST RETURN JSX (this fixes your "cannot be used as JSX component" error)
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
        height: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
      }}
    >
      {/* Remote video */}
      <div
        ref={remoteVideoRef}
        style={{
          width: '100%',
          height: '80%',
          background: '#111',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          fontSize: '1.25rem',
        }}
      >
        {callStatus === 'connecting' ? 'Connecting…' : `In call with ${participantName}`}
      </div>

      {/* Local preview */}
      <div
        ref={localVideoRef}
        style={{
          position: 'absolute',
          bottom: '80px',
          right: '20px',
          width: '160px',
          height: '120px',
          background: '#222',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '2px solid #4f46e5',
        }}
      ></div>

      {/* End call button */}
      <button
        onClick={handleEnd}
        style={{
          marginTop: '1.5rem',
          padding: '0.5rem 1.5rem',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '9999px',
          cursor: 'pointer',
          fontWeight: '600',
          fontSize: '1rem',
        }}
      >
        End Call
      </button>
    </div>
  );
}

// ✅ Hook for child components
export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
}