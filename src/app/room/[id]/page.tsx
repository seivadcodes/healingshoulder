// room/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { RoomUI } from './RoomUI';
import { useRoomLogic } from './useRoomLogic';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id as string;

  const {
    isLoading,
    error,
    user,
    participants,
    otherParticipants,
    isInCall,
    callEndedByPeer,
    isLeaving,
    isAudioEnabled,
    toggleAudio,
    leaveRoom,
    callDuration,
    formatDuration,
    isGroupCall,
    hostId, // ✅ Get hostId from hook
  } = useRoomLogic(roomId);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #fffbeb, #f5f5f4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            animation: 'spin 1s linear infinite',
            borderRadius: '9999px',
            height: '3rem',
            width: '3rem',
            border: '2px solid transparent',
            borderLeftColor: '#f59e0b',
            margin: '0 auto 1rem auto'
          }}></div>
          <p style={{ color: '#57534e' }}>Joining room...</p>
        </div>
      </div>
    );
  }

  return (
    <RoomUI
      isGroupCall={isGroupCall}
      participants={participants}
      user={user}
      hostId={hostId} // ✅ CORRECT — this is the facilitator's ID
      isGroup={isGroupCall || otherParticipants.length > 1}
      otherParticipants={otherParticipants}
      callDuration={callDuration}
      formatDuration={formatDuration}
      isInCall={isInCall}
      callEndedByPeer={callEndedByPeer}
      isLeaving={isLeaving}
      isAudioEnabled={isAudioEnabled}
      toggleAudio={toggleAudio}
      leaveRoom={leaveRoom}
      error={error}
    />
  );
}