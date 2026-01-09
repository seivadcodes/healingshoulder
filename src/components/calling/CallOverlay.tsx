'use client';

import { useEffect, useRef } from 'react';
import { useCall } from '@/context/CallContext';

// Inline SVG icons (unchanged)
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

const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const CameraOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M21.5 12c.9 0 1.5-.5 1.5-1.5V7a2 2 0 0 0-2-2h-4l-2-3h-6l-2 3H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2M12 18a6 6 0 0 0 6-6" />
  </svg>
);

const PhoneOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a1 1 0 0 0 1.32 1.32l4-4a1 1 0 0 0 0-1.32l-4-4a1 1 0 0 0-1.32 1.32L13.66 9H7a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2.34l-2.97 2.97a1 1 0 0 0 1.32 1.32l4-4z" />
  </svg>
);

export default function CallOverlay() {
  const {
    callState,
    callType,
    incomingCall,
    remoteVideoTrack,
    remoteAudioTrack, // 👈 make sure this is in your context!
    localVideoTrack,
    isMuted,
    calleeName,
    isCameraOff,
    setIsMuted,
    setIsCameraOff,
    hangUp,
    acceptCall,
    rejectCall,
  } = useCall();

  const isInCall = ['calling', 'ringing', 'connecting', 'connected'].includes(callState);
  const isCallActive = callState === 'connected';

  // Determine the name to display
  const displayName = incomingCall
    ? incomingCall.callerName
    : calleeName || 'Calling…';

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null); // 👈 new ref for audio

  // 🔊 Attach remote AUDIO track
  useEffect(() => {
    if (remoteAudioTrack && callState === 'connected' && remoteAudioRef.current) {
      const audioEl = remoteAudioRef.current;
      remoteAudioTrack.attach(audioEl);

      // Attempt to play (user interaction already happened via call button)
      audioEl.play().catch(e => console.warn('Remote audio play failed:', e));

      return () => {
        remoteAudioTrack.detach();
      };
    }
  }, [remoteAudioTrack, callState]);

  // 📹 Attach remote VIDEO track
  useEffect(() => {
    if (remoteVideoTrack && remoteVideoRef.current) {
      remoteVideoTrack.attach(remoteVideoRef.current);
      return () => {
        remoteVideoTrack.detach();
      };
    }
  }, [remoteVideoTrack]);

  // 📷 Attach local VIDEO track
  useEffect(() => {
    if (localVideoTrack && !isCameraOff && localVideoRef.current) {
      localVideoTrack.attach(localVideoRef.current);
      return () => {
        localVideoTrack.detach();
      };
    }
  }, [localVideoTrack, isCameraOff]);

  // Incoming call popup
  if (callState === 'idle' && incomingCall) {
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
            Incoming {incomingCall.callType === 'video' ? 'Video' : 'Call'}
          </h2>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>
            From: <strong>{incomingCall.callerName}</strong>
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button
              onClick={rejectCall}
              style={{
                padding: '12px 24px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              Decline
            </button>
            <button
              onClick={acceptCall}
              style={{
                padding: '12px 24px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ongoing or outgoing call UI
  if (isInCall) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        {/* 🔇 Hidden audio element for remote participant */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          style={{ display: 'none' }}
        />

        {/* Main area */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '800px',
          aspectRatio: '16 / 9',
          backgroundColor: '#000',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '24px'
        }}>
          {/* Video or placeholder with name */}
          {callType === 'video' && remoteVideoTrack ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#fff',
              fontSize: '20px',
              textAlign: 'center',
              padding: '16px'
            }}>
              {callState === 'calling' || callState === 'ringing' ? (
                <>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>📞</div>
                  <div>Calling</div>
                  <div style={{ fontWeight: '600', fontSize: '22px', marginTop: '6px' }}>
                    {displayName}
                  </div>
                </>
              ) : callState === 'connecting' ? (
                <>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔄</div>
                  <div>Connecting…</div>
                  <div style={{ fontWeight: '600', fontSize: '22px', marginTop: '6px' }}>
                    {displayName}
                  </div>
                </>
              ) : callState === 'connected' ? (
                callType === 'audio' ? (
                  <>
                    <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔊</div>
                    <div>In call with</div>
                    <div style={{ fontWeight: '600', fontSize: '22px', marginTop: '6px' }}>
                      {displayName}
                    </div>
                  </>
                ) : (
                  'Waiting for video…'
                )
              ) : (
                'Call in progress'
              )}
            </div>
          )}

          {/* Local preview */}
          {callType === 'video' && localVideoTrack && !isCameraOff && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              width: '120px',
              height: '90px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid white'
            }}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            onClick={() => setIsMuted(!isMuted)}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: isMuted ? '#ef4444' : '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {isMuted ? <MicOffIcon /> : <MicIcon />}
          </button>

          {callType === 'video' && (
            <button
              onClick={() => setIsCameraOff(!isCameraOff)}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: isCameraOff ? '#4b5563' : '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {isCameraOff ? <CameraOffIcon /> : <CameraIcon />}
            </button>
          )}

          <button
            onClick={hangUp}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <PhoneOffIcon />
          </button>
        </div>
      </div>
    );
  }

  return null;
}