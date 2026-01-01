// room/[id]/CallControls.tsx
'use client';

import { Mic, MicOff, PhoneOff } from 'lucide-react';

export function CallControls({
  isInCall,
  callEndedByPeer,
  isLeaving,
  isAudioEnabled,
  toggleAudio,
  leaveRoom,
}: {
  isInCall: boolean;
  callEndedByPeer: boolean;
  isLeaving: boolean;
  isAudioEnabled: boolean;
  toggleAudio: () => void;
  leaveRoom: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '0.75rem',
      flexWrap: 'wrap'
    }}>
      <button
        onClick={toggleAudio}
        disabled={!isInCall || callEndedByPeer}
        style={{
          padding: '0.625rem 1.25rem',
          borderRadius: '9999px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'background-color 0.2s',
          backgroundColor: !isInCall || callEndedByPeer
            ? '#f5f5f4'
            : isAudioEnabled
              ? '#f0fdf4'
              : '#fef2f2',
          color: !isInCall || callEndedByPeer
            ? '#9ca3af'
            : isAudioEnabled
              ? '#047857'
              : '#dc2626',
          cursor: !isInCall || callEndedByPeer ? 'not-allowed' : 'pointer',
          border: 'none',
          fontWeight: '600',
          fontSize: '0.875rem',
          minWidth: '90px'
        }}
        onMouseOver={(e) => {
          if (!isInCall || callEndedByPeer) return;
          e.currentTarget.style.background = isAudioEnabled ? '#d1fae5' : '#fecaca';
        }}
        onMouseOut={(e) => {
          if (!isInCall || callEndedByPeer) return;
          e.currentTarget.style.background = isAudioEnabled ? '#f0fdf4' : '#fef2f2';
        }}
      >
        {isAudioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
        {isAudioEnabled ? 'Mute' : 'Unmute'}
      </button>

      <button
        onClick={leaveRoom}
        disabled={isLeaving || callEndedByPeer}
        style={{
          padding: '0.625rem 1.25rem',
          borderRadius: '9999px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'background-color 0.2s',
          backgroundColor: isLeaving || callEndedByPeer ? '#e7e5e4' : '#fef2f2',
          color: isLeaving || callEndedByPeer ? '#9ca3af' : '#dc2626',
          cursor: isLeaving || callEndedByPeer ? 'not-allowed' : 'pointer',
          border: 'none',
          fontWeight: '600',
          fontSize: '0.875rem',
          minWidth: '90px'
        }}
        onMouseOver={(e) => {
          if (isLeaving || callEndedByPeer) return;
          e.currentTarget.style.background = '#fecaca';
        }}
        onMouseOut={(e) => {
          if (isLeaving || callEndedByPeer) return;
          e.currentTarget.style.background = '#fef2f2';
        }}
      >
        {isLeaving ? (
          <div style={{
            animation: 'spin 1s linear infinite',
            borderRadius: '9999px',
            height: '12px',
            width: '12px',
            border: '2px solid transparent',
            borderLeftColor: '#dc2626'
          }}></div>
        ) : (
          <PhoneOff size={16} style={{ color: '#dc2626' }} />
        )}
        <span style={{ color: '#dc2626' }}>Leave</span>
      </button>
    </div>
  );
}