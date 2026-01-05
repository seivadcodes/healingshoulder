// app/events/[id]/live/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  LiveKitRoom, 
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  useParticipants,
  useChat,
  isTrackReference,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track as LiveKitTrack } from 'livekit-client';

type Event = {
  id: string;
  title: string;
  host_id: string;
};

export default function LiveEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [hostName, setHostName] = useState<string>('Loading...');
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const supabase = createClient();

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const initializeRoom = async () => {
      try {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('id, title, host_id')
          .eq('id', eventId)
          .single();

        if (eventError) throw new Error('Failed to load event');
        setEvent(eventData);

        const { data: hostData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', eventData.host_id)
          .single();
        setHostName(hostData?.full_name || 'Host');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('You must be logged in to join');

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .single();
        
        const userName = profile?.full_name || session.user.email || 'Anonymous';

        const response = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: eventId,
            identity: session.user.id,
            name: userName,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to get access token');
        }

        const { token } = await response.json();
        setToken(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeRoom();
  }, [eventId, supabase]);

  const handleLeave = () => {
    router.push(`/events/${eventId}`);
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Joining live event...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <h1 style={styles.errorTitle}>Connection Failed</h1>
        <p style={styles.errorText}>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={styles.retryButton}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={styles.errorContainer}>
        <h1 style={styles.errorTitle}>Event Not Found</h1>
        <p style={styles.errorText}>The requested event does not exist.</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Preparing connection...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.eventInfo}>
            <h1 style={{...styles.eventTitle, fontSize: isMobile ? '1.125rem' : '1.5rem'}}>
              Live: {event.title}
            </h1>
            <p style={styles.hostName}>Hosted by: {hostName}</p>
          </div>
          {!isMobile && (
            <button
              onClick={handleLeave}
              style={styles.leaveButton}
              title="Leave this live event"
            >
              Leave Event
            </button>
          )}
        </div>
      </header>

      <div style={styles.liveKitWrapper}>
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          audio={true}
          video={true}
          onDisconnected={() => setError('Disconnected from room')}
          style={styles.liveKitRoom}
        >
          <div style={{
            ...styles.mainContent,
            flexDirection: isMobile ? 'column' : 'row',
            padding: isMobile ? '0.5rem' : '1rem',
            height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 80px)',
          }}>
            {/* Main video content */}
            <div style={{
              ...styles.videoColumn,
              flex: isMobile ? '1' : '2',
              marginBottom: isMobile ? '1rem' : '0',
            }}>
              {/* Main speaker/host video */}
              <div style={styles.mainSpeakerContainer}>
                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>Host</h3>
                </div>
                <div style={{
                  ...styles.mainVideoWrapper,
                  aspectRatio: isMobile ? '4/3' : '16/9',
                  height: isMobile ? 'auto' : '60vh',
                }}>
                  <MainSpeaker hostId={event.host_id} isMobile={isMobile} />
                </div>
              </div>

              {/* Participants section */}
              <div style={{
                ...styles.participantsSection,
                flexDirection: isMobile ? 'column' : 'row',
                marginTop: isMobile ? '1rem' : '0',
              }}>
                <div style={{
                  ...styles.participantsContainer,
                  flex: isMobile ? '1' : '1',
                  marginBottom: isMobile ? '1rem' : '0',
                }}>
                  <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>Participants</h3>
                  </div>
                  <div style={{
                    ...styles.participantsGrid,
                    gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(140px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: isMobile ? '0.5rem' : '1rem',
                  }}>
                    <OtherParticipants hostId={event.host_id} isMobile={isMobile} />
                  </div>
                </div>
                
                {/* Media controls - positioned differently on mobile */}
                {isMobile ? (
                  <div style={styles.mobileMediaControlsContainer}>
                    <MediaControlButtons onLeave={handleLeave} />
                  </div>
                ) : (
                  <div style={styles.mediaControlsSidebar}>
                    <MediaControlButtons onLeave={handleLeave} />
                  </div>
                )}
              </div>
            </div>

            {/* Chat column - hidden on mobile unless toggled */}
            {!isMobile && (
              <div style={{
                ...styles.chatColumn,
                flex: '1',
                minWidth: '300px',
              }}>
                <CustomChat />
              </div>
            )}

            {/* Mobile chat toggle button */}
            {isMobile && (
              <div style={styles.mobileChatToggle}>
                <button
                  onClick={() => setShowMobileChat(!showMobileChat)}
                  style={styles.mobileChatToggleButton}
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width: '20px', height: '20px'}}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>Chat</span>
                </button>
              </div>
            )}

           {/* Mobile chat (always mounted, toggled via display) */}
{isMobile && (
  <div style={{
    ...styles.mobileChatOverlay,
    display: showMobileChat ? 'flex' : 'none',
  }}>
    <div style={styles.mobileChatHeader}>
      <h3 style={styles.mobileChatTitle}>Live Chat</h3>
      <button
        onClick={() => setShowMobileChat(false)}
        style={styles.mobileChatCloseButton}
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width: '20px', height: '20px'}}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div style={{
      ...styles.mobileChatContent,
      height: 'calc(100vh - 200px)',
    }}>
      <CustomChat />
    </div>
  </div>
)}
          </div>
          
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}

function MainSpeaker({ hostId, isMobile }: { hostId: string; isMobile: boolean }) {
  const participants = useParticipants();

  const mainParticipant = participants.find(p => p.identity === hostId) || participants[0];

  // Get CAMERA track of main participant
  const cameraTracks = useTracks([
    { source: LiveKitTrack.Source.Camera, withPlaceholder: false }
  ]);
  const cameraTrackRef = cameraTracks.find(track => 
    isTrackReference(track) && track.participant.identity === mainParticipant?.identity
  );

  // Get SCREEN SHARE track of main participant
  const screenTracks = useTracks([
    { source: LiveKitTrack.Source.ScreenShare, withPlaceholder: false }
  ]);
  const screenTrackRef = screenTracks.find(track => 
    isTrackReference(track) && track.participant.identity === mainParticipant?.identity
  );

  // Prefer screen share if available; otherwise fall back to camera
  const activeTrackRef = screenTrackRef || cameraTrackRef;

  if (!mainParticipant) {
    return (
      <div style={styles.mainSpeakerPlaceholder}>
        <div style={{...styles.avatarLarge, width: isMobile ? '60px' : '80px', height: isMobile ? '60px' : '80px'}}>
          <svg viewBox="0 0 20 20" style={styles.avatarIcon}>
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
        <p style={styles.waitingText}>Waiting for host to join...</p>
      </div>
    );
  }

  return (
    <div style={styles.mainSpeaker}>
      <div style={styles.videoContainer}>
        {activeTrackRef && isTrackReference(activeTrackRef) ? (
          <ParticipantTile 
            trackRef={activeTrackRef} 
            style={{
              ...styles.participantTile,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }} 
          />
        ) : (
          <div style={{ color: '#94a3b8', textAlign: 'center' as const, alignSelf: 'center' }}>
            {screenTrackRef ? null : 'No video'}
          </div>
        )}
      </div>
      <div style={styles.speakerInfo}>
        <span style={{
          ...styles.speakerName,
          fontSize: isMobile ? '0.75rem' : '0.875rem',
        }}>
          {mainParticipant.name || mainParticipant.identity}
        </span>
        {mainParticipant.identity === hostId && (
          <span style={styles.hostBadge}>Host</span>
        )}
        {screenTrackRef && (
          <span style={{ ...styles.hostBadge, backgroundColor: '#8b5cf6' }}>Presenting</span>
        )}
      </div>
    </div>
  );
}

function OtherParticipants({ hostId, isMobile }: { hostId: string; isMobile: boolean }) {
  const allCameraTracks = useTracks([LiveKitTrack.Source.Camera]);
  
  const otherTracks = allCameraTracks.filter(track => 
    isTrackReference(track) && track.participant.identity !== hostId
  );

  const placeholderCount = Math.max(0, (isMobile ? 2 : 4) - otherTracks.length);

  return (
    <>
      {otherTracks.map((trackRef) => (
        <div key={trackRef.participant.sid} style={styles.participantCard}>
          <div style={styles.participantVideo}>
            {isTrackReference(trackRef) && (
              <ParticipantTile 
                trackRef={trackRef} 
                
                style={{
                  ...styles.smallParticipantTile,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            )}
          </div>
          <div style={{
            ...styles.participantName,
            fontSize: isMobile ? '0.7rem' : '0.75rem',
            padding: isMobile ? '0.25rem' : '0.5rem',
          }}>
            {trackRef.participant.name || trackRef.participant.identity}
          </div>
        </div>
      ))}
      
      {Array.from({ length: placeholderCount }).map((_, i) => (
        <div key={`placeholder-${i}`} style={styles.participantCard}>
          <div style={styles.participantPlaceholder}>
            <svg viewBox="0 0 20 20" style={styles.avatarIconSmall}>
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
          <div style={styles.participantName}>...</div>
        </div>
      ))}
    </>
  );
}

function MediaControlButtons({ onLeave }: { onLeave?: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleAudio = useCallback(async () => {
    if (localParticipant) {
      const enabled = !isAudioEnabled;
      if (enabled) {
        await localParticipant.setMicrophoneEnabled(true);
      } else {
        await localParticipant.setMicrophoneEnabled(false);
      }
      setIsAudioEnabled(enabled);
    }
  }, [localParticipant, isAudioEnabled]);

  const toggleVideo = useCallback(async () => {
    if (localParticipant) {
      const enabled = !isVideoEnabled;
      if (enabled) {
        await localParticipant.setCameraEnabled(true);
      } else {
        await localParticipant.setCameraEnabled(false);
      }
      setIsVideoEnabled(enabled);
    }
  }, [localParticipant, isVideoEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;

    if (isScreenSharing) {
      const screenTracks = Array.from(localParticipant.trackPublications.values()).filter(
        pub => pub.source === LiveKitTrack.Source.ScreenShare
      );
      for (const pub of screenTracks) {
        if (pub.track) {
          pub.track.stop();
          localParticipant.unpublishTrack(pub.track);
        }
      }
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        const track = stream.getVideoTracks()[0];
        if (track) {
          await localParticipant.publishTrack(track, {
            source: LiveKitTrack.Source.ScreenShare,
          });
          setIsScreenSharing(true);

          track.onended = () => {
            localParticipant.unpublishTrack(track);
            setIsScreenSharing(false);
          };
        }
      } catch (err) {
        console.error('Screen share denied or failed:', err);
      }
    }
  }, [localParticipant, isScreenSharing]);

  return (
    <div style={{
      ...styles.mediaControlsContainer,
      flexDirection: isMobile ? 'row' : 'column',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
      gap: isMobile ? '0.5rem' : '0.75rem',
      padding: isMobile ? '0.75rem' : '1rem',
    }}>
      {/* Audio Button */}
      <button
        onClick={toggleAudio}
        style={{
          ...styles.mediaControlButton,
          ...(isAudioEnabled ? styles.mediaControlButtonActive : styles.mediaControlButtonInactive),
          flexDirection: isMobile ? 'column' : 'row',
          padding: isMobile ? '0.5rem' : '0.75rem',
          flex: isMobile ? '1' : 'auto',
        }}
        title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
          ...styles.mediaControlIcon,
          width: isMobile ? '20px' : '24px',
          height: isMobile ? '20px' : '24px',
        }}>
          {isAudioEnabled ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          )}
        </svg>
        <span style={{
          ...styles.mediaControlText,
          fontSize: isMobile ? '0.7rem' : '0.75rem',
          marginTop: isMobile ? '0.25rem' : '0',
        }}>
          {isAudioEnabled ? 'Mute' : 'Unmute'}
        </span>
      </button>

      {/* Video Button */}
      <button
        onClick={toggleVideo}
        style={{
          ...styles.mediaControlButton,
          ...(isVideoEnabled ? styles.mediaControlButtonActive : styles.mediaControlButtonInactive),
          flexDirection: isMobile ? 'column' : 'row',
          padding: isMobile ? '0.5rem' : '0.75rem',
          flex: isMobile ? '1' : 'auto',
        }}
        title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
          ...styles.mediaControlIcon,
          width: isMobile ? '20px' : '24px',
          height: isMobile ? '20px' : '24px',
        }}>
          {isVideoEnabled ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          )}
        </svg>
        <span style={{
          ...styles.mediaControlText,
          fontSize: isMobile ? '0.7rem' : '0.75rem',
          marginTop: isMobile ? '0.25rem' : '0',
        }}>
          {isVideoEnabled ? 'Stop Video' : 'Start Video'}
        </span>
      </button>

      {/* Screen Share Button */}
      <button
        onClick={toggleScreenShare}
        style={{
          ...styles.mediaControlButton,
          ...(isScreenSharing ? styles.mediaControlButtonActive : styles.mediaControlButtonInactive),
          flexDirection: isMobile ? 'column' : 'row',
          padding: isMobile ? '0.5rem' : '0.75rem',
          flex: isMobile ? '1' : 'auto',
        }}
        title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
          ...styles.mediaControlIcon,
          width: isMobile ? '20px' : '24px',
          height: isMobile ? '20px' : '24px',
        }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span style={{
          ...styles.mediaControlText,
          fontSize: isMobile ? '0.7rem' : '0.75rem',
          marginTop: isMobile ? '0.25rem' : '0',
        }}>
          {isScreenSharing ? 'Stop Share' : 'Share'}
        </span>
      </button>

      {/* Leave Button */}
      {onLeave && (
        <button
          onClick={onLeave}
          style={{
            ...styles.leaveButtonInControls,
            flexDirection: isMobile ? 'column' : 'row',
            padding: isMobile ? '0.5rem' : '0.75rem',
            fontSize: isMobile ? '0.7rem' : '0.75rem',
            flex: isMobile ? '1' : 'auto',
          }}
          title="Leave this live event"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
            width: isMobile ? '20px' : '20px',
            height: isMobile ? '20px' : '20px',
            marginBottom: isMobile ? '0.25rem' : '0',
          }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Leave
        </button>
      )}
    </div>
  );
}

function CustomChat() {
  const { chatMessages, send } = useChat();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSend = () => {
    if (message.trim()) {
      send(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.chatContainer}>
      <div style={styles.chatHeader}>
        <h3 style={styles.chatTitle}>Live Chat</h3>
        {!isMobile && <p style={styles.chatSubtitle}>Send messages to everyone</p>}
      </div>

      <div style={styles.messagesContainer}>
        {chatMessages.length === 0 ? (
          <div style={styles.emptyChat}>
            <svg 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              style={styles.emptyChatIcon}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
              />
            </svg>
            <p style={styles.emptyChatText}>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div style={styles.messagesList}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} style={styles.messageItem}>
                <div style={styles.messageHeader}>
                  <span style={styles.messageSender}>
                    {msg.from?.name || 'Anonymous'}
                  </span>
                  <span style={styles.messageTime}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <p style={styles.messageContent}>{msg.message}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div style={styles.messageInputContainer}>
        <div style={styles.inputWrapper}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            rows={isMobile ? 1 : 2}
            style={{
              ...styles.messageInput,
              fontSize: isMobile ? '0.875rem' : '0.875rem',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            style={{
              ...styles.sendButton,
              ...(!message.trim() ? styles.sendButtonDisabled : {}),
              padding: isMobile ? '0.5rem 1rem' : '0.5rem 1rem',
            }}
          >
            {isMobile ? 'Send' : 'Send'}
          </button>
        </div>
        {!isMobile && (
          <p style={styles.inputHint}>
            Press Enter to send, Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
  },
  
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#0f172a',
  },
  
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #3b82f6',
    borderTop: '5px solid transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  
  loadingText: {
    marginTop: '1rem',
    fontSize: '1rem',
    color: '#cbd5e1',
  },
  
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '2rem',
    backgroundColor: '#0f172a',
    textAlign: 'center' as const,
  },
  
  errorTitle: {
    fontSize: '1.875rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
    color: '#ef4444',
  },
  
  errorText: {
    fontSize: '1rem',
    marginBottom: '2rem',
    color: '#cbd5e1',
    maxWidth: '400px',
  },
  
  retryButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#2563eb',
    },
  },
  
  header: {
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
    padding: '0.75rem 1rem',
  },
  
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
  },
  
  eventInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: '1',
    minWidth: '0',
  },
  
  eventTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    margin: '0 0 0.25rem 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  
  hostName: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    margin: '0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  
  leaveButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
    ':hover': {
      backgroundColor: '#b91c1c',
      transform: 'translateY(-1px)',
    },
    ':active': {
      transform: 'translateY(0)',
    },
  },
  
  liveKitWrapper: {
    flex: '1',
    overflow: 'hidden',
  },
  
  liveKitRoom: {
    height: '100%',
  },
  
  mainContent: {
    display: 'flex',
    height: 'calc(100vh - 80px)',
    padding: '1rem',
    gap: '1rem',
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
  },
  
  videoColumn: {
    flex: '2',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  
  chatColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    border: '1px solid #334155',
    height: '100%',
  },
  
  mainSpeakerContainer: {
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    border: '1px solid #334155',
    flex: '1',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  participantsSection: {
    display: 'flex',
    gap: '1rem',
  },
  
  participantsContainer: {
    flex: '1',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    padding: '1rem',
    border: '1px solid #334155',
    overflow: 'auto',
    minHeight: '200px',
  },
  
  mediaControlsSidebar: {
    width: '120px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  mobileMediaControlsContainer: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    border: '1px solid #334155',
  },
  
  mediaControlsContainer: {
    display: 'flex',
    gap: '0.75rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    padding: '1rem',
    border: '1px solid #334155',
  },
  
  mediaControlButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    gap: '0.5rem',
  },
  
  mediaControlButtonActive: {
    backgroundColor: '#0f172a',
    color: '#3b82f6',
    border: '1px solid #334155',
    ':hover': {
      backgroundColor: '#1e293b',
      transform: 'translateY(-2px)',
    },
  },
  
  mediaControlButtonInactive: {
    backgroundColor: '#334155',
    color: '#94a3b8',
    border: '1px solid #475569',
    ':hover': {
      backgroundColor: '#475569',
      transform: 'translateY(-2px)',
    },
  },
  
  mediaControlIcon: {
    width: '24px',
    height: '24px',
  },
  
  mediaControlText: {
    fontSize: '0.75rem',
    fontWeight: '500',
  },
  
  sectionHeader: {
    padding: '1rem 1rem 0.5rem 1rem',
  },
  
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    margin: '0 0 0.5rem 0',
    color: '#f8fafc',
  },
  
  mainVideoWrapper: {
    backgroundColor: '#0f172a',
    borderRadius: '0.375rem',
    overflow: 'hidden',
    position: 'relative' as const,
    flex: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  mainSpeakerPlaceholder: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: '#0f172a',
  },
  
  avatarLarge: {
    width: '80px',
    height: '80px',
    backgroundColor: '#334155',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  
  avatarIcon: {
    width: '40px',
    height: '40px',
    color: '#94a3b8',
  },
  
  waitingText: {
    color: '#94a3b8',
    fontSize: '0.875rem',
  },
  
  mainSpeaker: {
    height: '100%',
    width: '100%',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  videoContainer: {
    flex: '1',
    backgroundColor: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    height: '100%',
    width: '100%',
  },
  
  participantTile: {
    objectFit: 'contain' as const,
  },
  
  speakerInfo: {
    position: 'absolute' as const,
    bottom: '0',
    left: '0',
    right: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '0.5rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  speakerName: {
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  
  hostBadge: {
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: '0.75rem',
    padding: '0.125rem 0.5rem',
    borderRadius: '0.25rem',
  },
  
  participantsGrid: {
    display: 'grid',
    gap: '1rem',
  },
  
  participantCard: {
    backgroundColor: '#0f172a',
    borderRadius: '0.375rem',
    overflow: 'hidden',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  participantVideo: {
    aspectRatio: '16/9',
    backgroundColor: '#0f172a',
    flex: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  
  smallParticipantTile: {
    objectFit: 'contain' as const,
  },
  
  participantName: {
    padding: '0.5rem',
    fontSize: '0.75rem',
    textAlign: 'center' as const,
    color: '#cbd5e1',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  
  participantPlaceholder: {
    aspectRatio: '16/9',
    backgroundColor: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  avatarIconSmall: {
    width: '24px',
    height: '24px',
    color: '#94a3b8',
  },
  
  chatContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
  },
  
  chatHeader: {
    padding: '1rem',
    borderBottom: '1px solid #334155',
  },
  
  chatTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    margin: '0 0 0.25rem 0',
  },
  
  chatSubtitle: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    margin: '0',
  },
  
  messagesContainer: {
    flex: '1',
    overflowY: 'auto' as const,
    padding: '1rem',
  },
  
  emptyChat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#64748b',
  },
  
  emptyChatIcon: {
    width: '48px',
    height: '48px',
    marginBottom: '1rem',
  },
  
  emptyChatText: {
    fontSize: '0.875rem',
    textAlign: 'center' as const,
  },
  
  messagesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  
  messageItem: {
    backgroundColor: '#0f172a',
    borderRadius: '0.375rem',
    padding: '0.75rem',
    border: '1px solid #334155',
  },
  
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.25rem',
  },
  
  messageSender: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#60a5fa',
  },
  
  messageTime: {
    fontSize: '0.625rem',
    color: '#94a3b8',
  },
  
  messageContent: {
    fontSize: '0.875rem',
    margin: '0',
    color: '#e2e8f0',
    wordBreak: 'break-word' as const,
  },
  
  messageInputContainer: {
    padding: '1rem',
    borderTop: '1px solid #334155',
  },
  
  inputWrapper: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  
  messageInput: {
    flex: '1',
    padding: '0.5rem',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.375rem',
    color: '#f8fafc',
    fontSize: '0.875rem',
    resize: 'none' as const,
    fontFamily: 'inherit',
  },
  
  sendButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    whiteSpace: 'nowrap',
    ':hover': {
      backgroundColor: '#2563eb',
    },
  },
  
  sendButtonDisabled: {
    backgroundColor: '#475569',
    cursor: 'not-allowed',
    opacity: '0.5',
    ':hover': {
      backgroundColor: '#475569',
    },
  },
  
  leaveButtonInControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
    transition: 'all 0.2s',
    textAlign: 'center' as const,
    width: '100%',
    gap: '0.5rem',
    ':hover': {
      backgroundColor: '#b91c1c',
      transform: 'translateY(-2px)',
    },
    ':active': {
      transform: 'translateY(0)',
    },
  },
  
  inputHint: {
    fontSize: '0.625rem',
    color: '#94a3b8',
    margin: '0',
  },
  
  mobileChatToggle: {
    position: 'fixed' as const,
    bottom: '80px',
    right: '1rem',
    zIndex: 100,
  },
  
  mobileChatToggleButton: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '0.5rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '60px',
    height: '60px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    gap: '0.25rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    ':hover': {
      backgroundColor: '#2563eb',
    },
  },
  
  mobileChatOverlay: {
    position: 'fixed' as const,
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  mobileChatHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  
  mobileChatTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    margin: '0',
  },
  
  mobileChatCloseButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '0.5rem',
    ':hover': {
      color: '#f8fafc',
    },
  },
  
  mobileChatContent: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column' as const,
  },
};

// Add CSS keyframes for spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}