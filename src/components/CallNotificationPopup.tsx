'use client';

import { useCall } from '@/context/CallContext';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Room, RemoteTrack, LocalTrack } from 'livekit-client';
import toast from 'react-hot-toast';

export default function CallNotificationPopup() {
  const {
    incomingCall,
    setIncomingCall,
    callState,
    setCallState,
    setCallType,
    setCallRoom,
    setLocalAudioTrack,
    setLocalVideoTrack,
    setRemoteAudioTrack,
    setIsMuted,
    setIsCameraOff,
    startCallTimer,
    rejectCall: contextRejectCall,
  } = useCall();

  const autoDeclineTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Define rejectCall BEFORE useEffect that uses it
  const rejectCall = () => {
    // Use the context's rejectCall function
    contextRejectCall();
    
    // Clear the auto-decline timer
    if (autoDeclineTimerRef.current) {
      clearTimeout(autoDeclineTimerRef.current);
      autoDeclineTimerRef.current = null;
    }
  };

  // Auto-decline after 30s
  useEffect(() => {
    if (incomingCall) {
      if (autoDeclineTimerRef.current) clearTimeout(autoDeclineTimerRef.current);
      autoDeclineTimerRef.current = setTimeout(() => {
        rejectCall();
        autoDeclineTimerRef.current = null;
      }, 30_000);
    } else {
      if (autoDeclineTimerRef.current) {
        clearTimeout(autoDeclineTimerRef.current);
        autoDeclineTimerRef.current = null;
      }
    }
    return () => {
      if (autoDeclineTimerRef.current) {
        clearTimeout(autoDeclineTimerRef.current);
        autoDeclineTimerRef.current = null;
      }
    };
  }, [incomingCall, rejectCall]);

  const acceptCall = async () => {
    if (!incomingCall || !incomingCall.roomName) {
      toast.error('Invalid call data');
      return;
    }

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in');
      return;
    }

    const currentUserId = session.user.id;
    const userName = session.user.user_metadata?.full_name || session.user.email || 'Anonymous';

    try {
      // Set call state to connected
      setCallType(incomingCall.callType);
      setCallState('connected');
      
      // Clear the auto-decline timer
      if (autoDeclineTimerRef.current) {
        clearTimeout(autoDeclineTimerRef.current);
        autoDeclineTimerRef.current = null;
      }

      // Set incoming call to null after accepting
      setIncomingCall(null);

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

      // Publish local tracks
      let audioTrack: LocalTrack | null = null;

      // Publish audio track
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

      // For video calls, handle video tracks
      if (incomingCall.callType === 'video') {
        let videoTrack: LocalTrack | null = null;
        try {
          const tracks = await room.localParticipant.createTracks({ video: true });
          if (tracks[0]) {
            await room.localParticipant.publishTrack(tracks[0]);
            videoTrack = tracks[0];
            setLocalVideoTrack(videoTrack);
          }
        } catch (e) {
          console.warn('Video track creation failed:', e);
        }
      }

      // Start the call timer
      startCallTimer();
      
    } catch (err) {
      console.error('CallCheck accept error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to join call');
      setCallState('ended');
      setTimeout(() => setCallState('idle'), 1000);
    }
  };

  if (!incomingCall || callState !== 'idle') return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-t-3xl p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold mb-2">
          Incoming {incomingCall.callType} call
        </h3>
        <p className="text-gray-600 mb-4">From {incomingCall.callerName}</p>
        <div className="flex gap-4">
          <button
            onClick={acceptCall}
            className="flex-1 bg-green-500 text-white py-2 rounded-full font-medium hover:bg-green-600 transition"
          >
            Accept
          </button>
          <button
            onClick={rejectCall}
            className="flex-1 bg-gray-500 text-white py-2 rounded-full font-medium hover:bg-gray-600 transition"
          >
            Decline
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          Auto-declining in 30 seconds…
        </p>
      </div>
    </div>
  );
}