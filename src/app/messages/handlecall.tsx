'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { createClient } from '@/lib/supabase';
import dynamic from 'next/dynamic';

// Dynamically import LiveKit components to avoid SSR issues
const LiveKitRoom = dynamic(() => import('@livekit/components-react').then(mod => mod.LiveKitRoom), { ssr: false });
const VideoConference = dynamic(() => import('@livekit/components-react').then(mod => mod.VideoConference), { ssr: false });
const ControlBar = dynamic(() => import('@livekit/components-react').then(mod => mod.ControlBar), { ssr: false });
const TrackToggle = dynamic(() => import('@livekit/components-react').then(mod => mod.TrackToggle), { ssr: false });

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  otherUserId: string;
  otherUserName: string;
  currentUserId: string;
  currentUserName: string;
  callType: 'audio' | 'video';
}

interface CallStatus {
  isConnected: boolean;
  isConnecting: boolean;
  isRinging: boolean;
  error: string | null;
}

export function CallModal({
  isOpen,
  onClose,
  conversationId,
  otherUserId,
  otherUserName,
  currentUserId,
  currentUserName,
  callType
}: CallModalProps) {
  const [token, setToken] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>({
    isConnected: false,
    isConnecting: false,
    isRinging: false,
    error: null
  });
  const [callDuration, setCallDuration] = useState<number>(0);
  const [localAudioEnabled, setLocalAudioEnabled] = useState<boolean>(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState<boolean>(callType === 'video');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  
  const roomName = `call-${conversationId}`;
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const callEndAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements
  useEffect(() => {
    notificationAudioRef.current = new Audio('/sounds/notification.mp3');
    ringtoneAudioRef.current = new Audio('/sounds/ringtone.mp3');
    callEndAudioRef.current = new Audio('/sounds/call-end.mp3');
    
    // Fallback to system sounds if custom sounds don't exist
    notificationAudioRef.current.addEventListener('error', () => {
      console.warn('Notification sound not found, using default');
    });
    
    ringtoneAudioRef.current.addEventListener('error', () => {
      console.warn('Ringtone sound not found, using default');
    });
    
    callEndAudioRef.current.addEventListener('error', () => {
      console.warn('Call end sound not found, using default');
    });

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      stopAllSounds();
    };
  }, []);

  const playSound = (sound: 'notification' | 'ringtone' | 'callEnd') => {
    try {
      switch (sound) {
        case 'notification':
          notificationAudioRef.current?.play().catch(console.error);
          break;
        case 'ringtone':
          ringtoneAudioRef.current?.play().catch(console.error);
          break;
        case 'callEnd':
          callEndAudioRef.current?.play().catch(console.error);
          break;
      }
    } catch (err) {
      console.error('Error playing sound:', err);
    }
  };

  const stopAllSounds = () => {
    [notificationAudioRef.current, ringtoneAudioRef.current, callEndAudioRef.current].forEach(audio => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  };

  const startCallDurationTimer = () => {
    setCallStartTime(new Date());
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopCallDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setCallDuration(0);
    setCallStartTime(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendCallNotification = async (type: 'incoming' | 'missed' | 'ended') => {
    try {
      const supabase = createClient();
      
      // Get other user's device tokens for push notifications (if implemented)
      const { data: otherUserProfile } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', otherUserId)
        .single();

      // Create a call notification in the database
      await supabase.from('call_notifications').insert({
        conversation_id: conversationId,
        from_user_id: currentUserId,
        to_user_id: otherUserId,
        call_type: callType,
        status: type,
        room_name: roomName
      });

      // Send push notification (implement based on your push service)
      if (otherUserProfile?.fcm_token) {
        // Implement push notification logic here
        console.log('Would send push notification to:', otherUserProfile.fcm_token);
      }
    } catch (err) {
      console.error('Error sending call notification:', err);
    }
  };

  const initiateCall = async () => {
    if (callStatus.isConnecting || callStatus.isConnected) return;
    
    setCallStatus(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      // Play ringtone
      playSound('ringtone');
      setCallStatus(prev => ({ ...prev, isRinging: true }));
      
      // Send incoming call notification to other user
      await sendCallNotification('incoming');
      
      // Get LiveKit token
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room: roomName,
          identity: currentUserId,
          name: currentUserName
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get call token');
      }

      const data = await response.json();
      setToken(data.token);
      stopAllSounds();
      
      setCallStatus(prev => ({ 
        ...prev, 
        isConnecting: false, 
        isRinging: false,
        isConnected: true 
      }));
      
      startCallDurationTimer();
      toast.success(`Call connected with ${otherUserName}`);
      
    } catch (err) {
      console.error('Call initiation error:', err);
      setCallStatus(prev => ({ 
        ...prev, 
        isConnecting: false, 
        isRinging: false, 
        error: 'Failed to start call' 
      }));
      stopAllSounds();
      toast.error('Failed to start call');
      
      // Send missed call notification
      await sendCallNotification('missed');
    }
  };

  const endCall = async () => {
    stopAllSounds();
    stopCallDurationTimer();
    
    if (callStatus.isConnected) {
      // Send call ended notification
      await sendCallNotification('ended');
      playSound('callEnd');
    }
    
    setToken(null);
    setCallStatus({
      isConnected: false,
      isConnecting: false,
      isRinging: false,
      error: null
    });
    
    onClose();
    toast('Call ended');
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    setLocalAudioEnabled(!isMuted);
    // In a real implementation, this would toggle the actual audio track
  };

  const toggleCamera = () => {
    setIsCameraOff(!isCameraOff);
    setLocalVideoEnabled(!isCameraOff);
    // In a real implementation, this would toggle the actual video track
  };

  const handleDisconnect = () => {
    endCall();
  };

  // Auto-start call when modal opens
  useEffect(() => {
    if (isOpen && !callStatus.isConnected && !callStatus.isConnecting) {
      const timer = setTimeout(() => {
        initiateCall();
      }, 500); // Small delay for modal animation
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key to end call
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        endCall();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '1200px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Call Header */}
        <div style={{
          padding: '20px 24px',
          backgroundColor: '#2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #333'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              fontSize: '18px',
              color: 'white'
            }}>
              {otherUserName.charAt(0)}
            </div>
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'white',
                margin: 0
              }}>
                {otherUserName}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                {callStatus.isConnected ? (
                  <>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      animation: 'pulse 2s infinite'
                    }}></div>
                    <span style={{ fontSize: '14px', color: '#10b981' }}>
                      Connected • {formatDuration(callDuration)}
                    </span>
                  </>
                ) : callStatus.isRinging ? (
                  <span style={{ fontSize: '14px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ animation: 'pulse 1s infinite' }}>🔔</span>
                    Ringing...
                  </span>
                ) : callStatus.isConnecting ? (
                  <span style={{ fontSize: '14px', color: '#f59e0b' }}>
                    Connecting...
                  </span>
                ) : (
                  <span style={{ fontSize: '14px', color: '#ef4444' }}>
                    Call failed
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <button
            onClick={endCall}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '24px',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ✕
          </button>
        </div>

        {/* Call Content */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {token && callStatus.isConnected ? (
            // LiveKit Video/Audio Call
            <div style={{ width: '100%', height: '100%' }}>
              <LiveKitRoom
                serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://your-livekit-server'}
                token={token}
                connect={true}
                audio={localAudioEnabled}
                video={localVideoEnabled}
                onDisconnected={handleDisconnect}
                options={{
                  adaptiveStream: true,
                  dynacast: true,
                  publishDefaults: {
                    simulcast: true,
                  },
                }}
                style={{ width: '100%', height: '100%' }}
              >
                <VideoConference
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    '--lk-control-bar-height': '80px',
                    '--lk-control-bar-background': 'rgba(0, 0, 0, 0.7)',
                    '--lk-browser-background-color': '#1a1a1a'
                  } as React.CSSProperties}
                >
                  <ControlBar
                    controls={{
                      microphone: true,
                      camera: true,
                      screenShare: true,
                      leave: true,
                    }}
                    variation='minimal'
                    style={{
                      position: 'absolute',
                      bottom: '20px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      borderRadius: '20px',
                      padding: '12px 24px',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                </VideoConference>
              </LiveKitRoom>
              
              {/* Custom Controls Overlay */}
              <div style={{
                position: 'absolute',
                bottom: '100px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '16px',
                zIndex: 10
              }}>
                <button
                  onClick={toggleMute}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: isMuted ? '#ef4444' : '#4b5563',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    color: 'white',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {isMuted ? '🎤' : '🎤'}
                </button>
                
                {callType === 'video' && (
                  <button
                    onClick={toggleCamera}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: isCameraOff ? '#ef4444' : '#4b5563',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      color: 'white',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {isCameraOff ? '📷' : '📹'}
                  </button>
                )}
                
                <button
                  onClick={endCall}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    color: 'white',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  📞
                </button>
              </div>
            </div>
          ) : (
            // Pre-call or connecting screen
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '40px',
              textAlign: 'center',
              color: 'white'
            }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                backgroundColor: '#2a2a2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '32px',
                border: '4px solid #4f46e5',
                animation: callStatus.isRinging ? 'ring 2s infinite' : 'none'
              }}>
                <div style={{
                  fontSize: '48px',
                  color: '#4f46e5'
                }}>
                  {otherUserName.charAt(0)}
                </div>
              </div>
              
              <h2 style={{
                fontSize: '28px',
                fontWeight: '700',
                marginBottom: '8px'
              }}>
                {callStatus.isRinging ? 'Calling...' : callStatus.isConnecting ? 'Connecting...' : 'Starting Call'}
              </h2>
              
              <p style={{
                fontSize: '16px',
                color: '#94a3b8',
                marginBottom: '40px',
                maxWidth: '400px'
              }}>
                {callStatus.isRinging 
                  ? `Waiting for ${otherUserName} to answer...` 
                  : callStatus.isConnecting
                  ? 'Connecting to the call server...'
                  : `Starting ${callType === 'video' ? 'video' : 'audio'} call with ${otherUserName}`
                }
              </p>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '40px' }}>
                <div style={{
                  padding: '12px 24px',
                  backgroundColor: '#2a2a2a',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: localAudioEnabled ? '#10b981' : '#ef4444'
                  }}></div>
                  <span>{localAudioEnabled ? 'Audio on' : 'Audio off'}</span>
                </div>
                
                {callType === 'video' && (
                  <div style={{
                    padding: '12px 24px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: localVideoEnabled ? '#10b981' : '#ef4444'
                    }}></div>
                    <span>{localVideoEnabled ? 'Camera on' : 'Camera off'}</span>
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '20px' }}>
                <button
                  onClick={toggleMute}
                  style={{
                    padding: '16px 24px',
                    backgroundColor: isMuted ? '#ef4444' : '#4b5563',
                    color: 'white',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '140px'
                  }}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                
                {callType === 'video' && (
                  <button
                    onClick={toggleCamera}
                    style={{
                      padding: '16px 24px',
                      backgroundColor: isCameraOff ? '#ef4444' : '#4b5563',
                      color: 'white',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      minWidth: '140px'
                    }}
                  >
                    {isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                  </button>
                )}
                
                <button
                  onClick={endCall}
                  style={{
                    padding: '16px 24px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '140px'
                  }}
                >
                  End Call
                </button>
              </div>
              
              {callStatus.error && (
                <div style={{
                  marginTop: '24px',
                  padding: '12px 24px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  color: '#ef4444'
                }}>
                  {callStatus.error}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Call Type Indicator */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 16px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'white',
          fontSize: '14px',
          backdropFilter: 'blur(10px)'
        }}>
          {callType === 'video' ? '📹 Video Call' : '🎤 Audio Call'}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes ring {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}