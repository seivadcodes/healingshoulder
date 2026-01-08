'use client';
import { useEffect, useRef } from 'react';
import { useCall } from '@/context/CallContext';
import type { RemoteTrack, LocalTrack } from 'livekit-client';

// SVG icons
const MicIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const MicOffIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-6 0v4.34" />
    <path d="M19 15v2a7 7 0 0 1-14 0v-2" />
  </svg>
);

const PhoneOffIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M10.68 13.31a1 1 0 0 0 1.32 1.32l4-4a1 1 0 0 0 0-1.32l-4-4a1 1 0 0 0-1.32 1.32L13.66 9H7a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2.34l-2.97 2.97a1 1 0 0 0 1.32 1.32l4-4z" />
  </svg>
);

const formatCallDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function CallOverlay() {
  const {
    callState,
    callType,
    callDuration,
    remoteAudioTrack,
    localAudioTrack,
    isMuted,
    setIsMuted,
    hangUp,
    incomingCall,
    acceptCall,
    rejectCall,
  } = useCall();

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const remoteTrackIdRef = useRef<string | null>(null);

  // Attach remote audio track when available
  // In CallOverlay component
useEffect(() => {
  const audioElement = remoteAudioRef.current;
  
  if (audioElement && remoteAudioTrack) {
    try {
      // Attach the track to the audio element
      remoteAudioTrack.attach(audioElement);
      
      // Try to play (might fail due to autoplay policies)
      audioElement.play().catch(e => {
        console.warn('Audio playback requires user interaction:', e);
        // We can't do much here except wait for user interaction
      });
      
      return () => {
        // Detach the track when component unmounts or track changes
        remoteAudioTrack.detach(audioElement);
      };
    } catch (e) {
      console.error('Error attaching remote audio track:', e);
    }
  }
  
  return () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
    }
  };
}, [remoteAudioTrack]);

  // Handle incoming call acceptance/rejection
  useEffect(() => {
    if (incomingCall && callState === 'idle') {
      // Set to ringing state when receiving a call
      // Note: This is handled by the signaling provider elsewhere
    }
  }, [incomingCall, callState]);

  // Mute/unmute handler
  const toggleMute = async () => {
    // This will be implemented when we have the room connection
    setIsMuted(!isMuted);
    
    // In a real implementation, you would toggle the audio track here
    console.log(`Microphone ${isMuted ? 'unmuted' : 'muted'}`);
  };

  // Only show overlay when in a call state
  if (callState === 'idle' && !incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      {/* Hidden audio element for remote audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      
      {/* Call Status Header */}
      <div className="text-center mb-8">
        {incomingCall && callState === 'idle' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-2">Incoming Call</h2>
            <p className="text-lg text-white/90">{incomingCall.callerName}</p>
            <p className="text-sm text-blue-300 mt-1">Audio call</p>
          </>
        )}
        
        {callState === 'calling' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-2">Calling</h2>
            <div className="flex justify-center items-center space-x-1">
              <span className="text-lg text-white/90 animate-pulse">.</span>
              <span className="text-lg text-white/90 animate-pulse delay-100">.</span>
              <span className="text-lg text-white/90 animate-pulse delay-200">.</span>
            </div>
          </>
        )}
        
        {callState === 'ringing' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-2">Ringing</h2>
            <div className="flex justify-center items-center space-x-1">
              <span className="text-lg text-white/90 animate-pulse">.</span>
              <span className="text-lg text-white/90 animate-pulse delay-100">.</span>
              <span className="text-lg text-white/90 animate-pulse delay-200">.</span>
            </div>
          </>
        )}
        
        {callState === 'connected' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-1">Connected</h2>
            <div className="bg-black/30 text-white text-3xl font-mono px-4 py-1 rounded-lg inline-block">
              {formatCallDuration(callDuration)}
            </div>
          </>
        )}
        
        {callState === 'ended' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-2">Call Ended</h2>
            <div className="text-lg text-red-400">Disconnected</div>
          </>
        )}
      </div>
      
      {/* Incoming Call Controls */}
      {incomingCall && callState === 'idle' && (
        <div className="flex gap-8 mb-12">
          <button
            onClick={rejectCall}
            className="p-4 rounded-full bg-red-600 flex flex-col items-center hover:bg-red-700 transition-colors"
          >
            <div className="w-12 h-12 bg-red-700 rounded-full flex items-center justify-center mb-2">
              <PhoneOffIcon className="text-white w-6 h-6" />
            </div>
            <span className="text-white font-medium">Decline</span>
          </button>
          
          <button
            onClick={acceptCall}
            className="p-4 rounded-full bg-green-600 flex flex-col items-center hover:bg-green-700 transition-colors"
          >
            <div className="w-12 h-12 bg-green-700 rounded-full flex items-center justify-center mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white w-6 h-6"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <span className="text-white font-medium">Accept</span>
          </button>
        </div>
      )}
      
      {/* Call Controls - shown when in calling/ringing/connected states */}
      {(callState === 'calling' || callState === 'ringing' || callState === 'connected') && (
        <div className="flex gap-8 mb-8">
          {/* Mute button - only shown when connected */}
          {callState === 'connected' && (
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full flex flex-col items-center ${
                isMuted ? 'bg-red-500/90' : 'bg-gray-700/90'
              } hover:opacity-90 transition-opacity`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                isMuted ? 'bg-red-600' : 'bg-gray-800'
              }`}>
                {isMuted ? (
                  <MicOffIcon className="text-white w-6 h-6" />
                ) : (
                  <MicIcon className="text-white w-6 h-6" />
                )}
              </div>
              <span className="text-white font-medium">
                {isMuted ? 'Unmute' : 'Mute'}
              </span>
            </button>
          )}
          
          {/* Hang up button */}
          <button
            onClick={hangUp}
            className="p-4 rounded-full bg-red-600/90 flex flex-col items-center hover:bg-red-700 transition-colors"
          >
            <div className="w-12 h-12 bg-red-700 rounded-full flex items-center justify-center mb-2">
              <PhoneOffIcon className="text-white w-6 h-6" />
            </div>
            <span className="text-white font-medium">End Call</span>
          </button>
        </div>
      )}
      
      {/* Call Information */}
      {incomingCall && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-400">
            {incomingCall.callerName} is calling you
          </p>
        </div>
      )}
    </div>
  );
}