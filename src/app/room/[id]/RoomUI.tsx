// room/[id]/RoomUI.tsx
'use client';

import { Clock, Users, User as UserIcon, AlertTriangle } from 'lucide-react';
import { CallControls } from './CallControls';

interface RoomUIProps {
  isGroup: boolean;
  otherParticipants: { name: string }[];
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
  otherParticipants,
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
            {isGroup ? (
              <>
                <Users size={18} style={{ marginRight: '0.25rem' }} />
                Group Call
              </>
            ) : (
              otherParticipants[0]?.name || 'Anonymous'
            )}
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
            {isGroup ? (
              <Users size={40} style={{ color: '#b45309' }} />
            ) : (
              <UserIcon size={40} style={{ color: '#b45309' }} />
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