'use client';
import { useEffect, useRef, useState } from 'react';
import { useCall } from '@/context/CallContext';

// SVG Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const MicOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-6 0v4.34" />
    <path d="M19 15v2a7 7 0 0 1-14 0v-2" />
  </svg>
);

const PhoneOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a1 1 0 0 0 1.32 1.32l4-4a1 1 0 0 0 0-1.32l-4-4a1 1 0 0 0-1.32 1.32L13.66 9H7a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2.34l-2.97 2.97a1 1 0 0 0 1.32 1.32l4-4z" />
  </svg>
);

const LoadingSpinner = () => (
  <div style={{ 
    width: '30px', 
    height: '30px', 
    border: '3px solid rgba(255,255,255,0.3)', 
    borderTop: '3px solid white', 
    borderRadius: '50%', 
    animation: 'spin 1s linear infinite'
  }} />
);

const formatDuration = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function CallOverlay() {
  const {
    callState,
    callType,
    incomingCall,
    remoteAudioTrack,
    isMuted,
    participantName,
    participantAvatar,
    callDuration,
    setIsMuted,
    acceptCall,
    rejectCall,
    hangUp,
  } = useCall();
  
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isHangingUp, setIsHangingUp] = useState(false);
  
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Attach remote audio track
  useEffect(() => {
    if (remoteAudioTrack && remoteAudioRef.current && callState === 'connected') {
      remoteAudioTrack.attach(remoteAudioRef.current);
      remoteAudioRef.current.play().catch(e => console.warn('CallCheck: Audio play failed:', e));
      
      return () => {
        remoteAudioTrack.detach();
      };
    }
  }, [remoteAudioTrack, callState]);

  // Handle incoming call acceptance
  const handleAccept = async () => {
    if (!incomingCall) return;
    setIsAccepting(true);
    try {
      await acceptCall(incomingCall.roomName);
    } catch (error) {
      console.error('CallCheck: Error accepting call', error);
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle incoming call rejection
  const handleReject = async () => {
    setIsRejecting(true);
    try {
      rejectCall();
    } finally {
      setIsRejecting(false);
    }
  };

  // Handle hang up
  const handleHangUp = async () => {
    setIsHangingUp(true);
    try {
      hangUp();
    } finally {
      setIsHangingUp(false);
    }
  };

  // Incoming call popup - show this first before any other UI
  if (callState === 'ringing' && incomingCall) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
            Incoming {incomingCall.callType === 'video' ? 'Video' : 'Audio'} Call
          </h2>
          
          {/* Caller Avatar */}
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            margin: '0 auto 16px',
            backgroundColor: '#e0e7ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '2px solid #4f46e5'
          }}>
            {incomingCall.callerAvatar ? (
              <img 
                src={incomingCall.callerAvatar} 
                alt={incomingCall.callerName} 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover' 
                }} 
              />
            ) : (
              <span style={{ 
                fontSize: '32px', 
                fontWeight: 'bold', 
                color: '#4f46e5' 
              }}>
                {incomingCall.callerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          
          <p style={{ color: '#64748b', marginBottom: '24px', fontWeight: '500', fontSize: '18px' }}>
            {incomingCall.callerName}
          </p>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button
              onClick={handleReject}
              disabled={isRejecting}
              style={{
                padding: '12px 24px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: isRejecting ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                opacity: isRejecting ? 0.8 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isRejecting ? <LoadingSpinner /> : 'Decline'}
            </button>
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              style={{
                padding: '12px 24px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: isAccepting ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                opacity: isAccepting ? 0.8 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isAccepting ? <LoadingSpinner /> : 'Accept'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Don't show the call UI if we're idle and have no incoming call
  if (callState === 'idle' && !incomingCall) {
    return null;
  }

  // Show the call UI for all other states
  const isInCall = ['calling', 'connecting', 'connected', 'ended', 'ringing'].includes(callState);
  
  // Determine what to show in the main display area
  const getMainDisplayContent = () => {
    switch (callState) {
      case 'calling':
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '120px', 
              height: '120px', 
              borderRadius: '50%', 
              margin: '0 auto 20px',
              backgroundColor: '#e0e7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '3px solid #4f46e5'
            }}>
              {participantAvatar ? (
                <img 
                  src={participantAvatar} 
                  alt={participantName || 'User'} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover' 
                  }} 
                />
              ) : (
                <span style={{ 
                  fontSize: '48px', 
                  fontWeight: 'bold', 
                  color: '#4f46e5' 
                }}>
                  {(participantName || 'User').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: 'white', marginBottom: '8px' }}>
              Calling
            </div>
            <div style={{ fontWeight: '700', fontSize: '28px', color: 'white' }}>
              {participantName || 'User'}
            </div>
          </div>
        );
      case 'connecting':
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '120px', 
              height: '120px', 
              borderRadius: '50%', 
              margin: '0 auto 20px',
              backgroundColor: '#e0e7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '3px solid #4f46e5'
            }}>
              {participantAvatar ? (
                <img 
                  src={participantAvatar} 
                  alt={participantName || 'User'} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover' 
                  }} 
                />
              ) : (
                <span style={{ 
                  fontSize: '48px', 
                  fontWeight: 'bold', 
                  color: '#4f46e5' 
                }}>
                  {(participantName || 'User').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: 'white', marginBottom: '8px' }}>
              Connecting...
            </div>
            <div style={{ fontWeight: '700', fontSize: '28px', color: 'white' }}>
              {participantName || 'User'}
            </div>
            <div style={{ marginTop: '16px' }}>
              <LoadingSpinner />
            </div>
          </div>
        );
      case 'connected':
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '160px', 
              height: '160px', 
              borderRadius: '50%', 
              margin: '0 auto 24px',
              backgroundColor: '#e0e7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '4px solid #10b981',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)'
            }}>
              {participantAvatar ? (
                <img 
                  src={participantAvatar} 
                  alt={participantName || 'User'} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover' 
                  }} 
                />
              ) : (
                <span style={{ 
                  fontSize: '64px', 
                  fontWeight: 'bold', 
                  color: '#4f46e5' 
                }}>
                  {(participantName || 'User').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            <div style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.2)', 
              borderRadius: '20px', 
              padding: '8px 24px', 
              display: 'inline-block', 
              marginBottom: '12px'
            }}>
              <span style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: '#10b981' 
              }}>
                {formatDuration(callDuration)}
              </span>
            </div>
            
            <div style={{ fontSize: '20px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>
              In call with
            </div>
            <div style={{ fontWeight: '700', fontSize: '28px', color: 'white' }}>
              {participantName || 'User'}
            </div>
          </div>
        );
      case 'ended':
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px', color: '#10b981' }}>✅</div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>
              Call ended
            </div>
            <div style={{ fontWeight: '700', fontSize: '28px', color: 'white' }}>
              Total duration: {formatDuration(callDuration)}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#0f172a',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      {/* Hidden audio element for remote participant */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
      />
      
      {/* Main area with avatar */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '600px',
        height: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {getMainDisplayContent()}
      </div>
      
      {/* Controls - Only show when in call states */}
      {isInCall && (
        <div style={{ 
          display: 'flex', 
          gap: '24px', 
          alignItems: 'center',
          marginTop: '24px'
        }}>
          {(callState === 'connected' || callState === 'connecting') && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              disabled={callState !== 'connected'}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: isMuted ? '#ef4444' : '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: callState === 'connected' ? 'pointer' : 'not-allowed',
                opacity: callState === 'connected' ? 1 : 0.6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </button>
          )}
          
          <button
            onClick={handleHangUp}
            disabled={isHangingUp || callState === 'ended'}
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: isHangingUp || callState === 'ended' ? 'not-allowed' : 'pointer',
              opacity: isHangingUp || callState === 'ended' ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
            }}
          >
            {isHangingUp ? <LoadingSpinner /> : <PhoneOffIcon />}
          </button>
        </div>
      )}
    </div>
  );
}