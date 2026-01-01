'use client';

import { Clock, Users, User as UserIcon, AlertTriangle } from 'lucide-react';
import { CallControls } from './CallControls';

interface RoomUIProps {
  isGroup: boolean;
  isGroupCall: boolean;
  otherParticipants: { id: string; name: string; avatar?: string }[];
  participants: { id: string; name: string; avatar?: string }[];
  user: { id: string; full_name?: string; avatar_url?: string | null } | null;
  hostId: string | null;
  callDuration: number;
  formatDuration: (s: number) => string;
  isInCall: boolean;
  callEndedByPeer: boolean;
  isLeaving: boolean;
  isAudioEnabled: boolean;
  toggleAudio: () => void;
  leaveRoom: () => void;
  error: string | null;
}

export function RoomUI({
  isGroup,
  isGroupCall,
  otherParticipants,
  participants,
  user,
  hostId,
  callDuration,
  formatDuration,
  isInCall,
  callEndedByPeer,
  isLeaving,
  isAudioEnabled,
  toggleAudio,
  leaveRoom,
  error,
}: RoomUIProps) {
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #fffbeb, #f5f5f4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e7e5e4',
          padding: '2rem',
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '9999px',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto'
          }}>
            <AlertTriangle size={32} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#292524',
            marginBottom: '0.75rem'
          }}>Connection Issue</h2>
          <p style={{ color: '#57534e', marginBottom: '1.5rem' }}>{error}</p>
          <button
            onClick={() => window.location.href = '/connect'}
            style={{
              background: '#f59e0b',
              color: '#ffffff',
              fontWeight: '700',
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#d97706'}
            onMouseOut={(e) => e.currentTarget.style.background = '#f59e0b'}
          >
            Return to Connections
          </button>
        </div>
      </div>
    );
  }

  // 🔹 ONE-ON-ONE
  if (!isGroupCall && otherParticipants.length === 1) {
    const other = otherParticipants[0];
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #fffbeb, #f5f5f4)',
        padding: '1rem',
        paddingTop: '5rem'
      }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        `}</style>
        <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '0.75rem',
            border: '1px solid #e7e5e4',
            padding: '2rem',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#292524',
              marginBottom: '0.5rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {other.name || 'Anonymous'}
            </h2>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.25rem',
              background: '#ffedd5',
              color: '#92400e',
              borderRadius: '9999px',
              padding: '0.25rem 0.75rem',
              margin: '0 auto 1.25rem auto',
              width: 'fit-content'
            }}>
              <Clock size={14} />
              <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                {formatDuration(callDuration)}
              </span>
            </div>

            <div style={{
              width: '5rem',
              height: '5rem',
              borderRadius: '9999px',
              background: '#ffedd5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 15rem auto'
            }}>
              <UserIcon size={40} style={{ color: '#b45309' }} />
            </div>

            <CallControls
              isInCall={isInCall}
              callEndedByPeer={callEndedByPeer}
              isLeaving={isLeaving}
              isAudioEnabled={isAudioEnabled}
              toggleAudio={toggleAudio}
              leaveRoom={leaveRoom}
            />
          </div>
        </div>
      </div>
    );
  }

  // 🔹 GROUP CALL
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #fffbeb, #f5f5f4)',
      padding: '1rem',
      paddingTop: '3rem'
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>
      <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e7e5e4',
          padding: '2rem',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#292524',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.375rem'
          }}>
            <Users size={18} />
            Group Call
          </h2>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.25rem',
            background: '#ffedd5',
            color: '#92400e',
            borderRadius: '9999px',
            padding: '0.25rem 0.75rem',
            margin: '0 auto 1.5rem auto',
            width: 'fit-content'
          }}>
            <Clock size={14} />
            <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
              {formatDuration(callDuration)}
            </span>
          </div>

          {/* PARTICIPANT LIST — GROUP ONLY */}
          <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
            {participants.length === 0 ? (
              <div style={{ 
                padding: '1rem', 
                color: '#ef4444',
                fontStyle: 'italic',
                background: '#fee2e2',
                borderRadius: '0.5rem'
              }}>
                🔴 No participants loaded! Check:
                <ul style={{ textAlign: 'left', marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                  <li>room_participants table has active rows?</li>
                  <li>Supabase RLS allows your user to read them?</li>
                  <li>fetchParticipants() is called and resolves?</li>
                </ul>
              </div>
            ) : (
              participants.map((p) => {
                const isHost = p.id === hostId;
                const isMe = p.id === user?.id;

                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: isHost ? '#fffbeb' : '#fafafa',
                      border: isHost ? '1px solid #f59e0b' : '1px solid #e7e5e4',
                      borderRadius: '0.75rem',
                      marginBottom: '0.75rem',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '9999px',
                      background: isHost ? '#fef3c7' : '#e7e5e4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '0.75rem',
                      flexShrink: 0,
                    }}>
                      {p.avatar ? (
                        <img
                          src={p.avatar}
                          alt={p.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '9999px',
                          }}
                        />
                      ) : (
                        <UserIcon size={16} style={{ color: isHost ? '#b45309' : '#78716c' }} />
                      )}
                    </div>
                    <div style={{ overflow: 'hidden', textAlign: 'left' }}>
                      <div style={{
                        fontWeight: isHost ? '700' : '500',
                        color: '#292524',
                        fontSize: '0.95rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {p.name}
                        {isHost && (
                          <span style={{
                            background: '#f59e0b',
                            color: 'white',
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '9999px',
                            marginLeft: '0.35rem',
                          }}>
                            Host
                          </span>
                        )}
                      </div>
                      {isMe && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                        }}>
                          (You)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <CallControls
            isInCall={isInCall}
            callEndedByPeer={callEndedByPeer}
            isLeaving={isLeaving}
            isAudioEnabled={isAudioEnabled}
            toggleAudio={toggleAudio}
            leaveRoom={leaveRoom}
          />
        </div>
      </div>
    </div>
  );
}