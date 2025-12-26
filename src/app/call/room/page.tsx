// app/call/room/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LiveKitRoom } from '@livekit/components-react';
import { VideoConference } from '@livekit/components-react';
import { createClient } from '@/lib/supabase';
import { generateRoomName } from '@/lib/utils';
import '@livekit/components-styles';
import { RoomEvent } from 'livekit-client';

export default function CallRoomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room');
  const supabase = createClient();
  const [token, setToken] = useState('');
  const [roomName, setRoomName] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const roomRef = useRef<any>(null);

  // Initialize user and room
  useEffect(() => {
    const init = async () => {
      if (!roomParam) {
        router.push('/call');
        return;
      }

      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session?.user) throw new Error('Unauthorized');

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', session.user.id)
          .single();

        if (!profile) throw new Error('Profile not found');

        const currentUserData = {
          id: profile.id,
          fullName: profile.full_name || 'User',
        };
        setCurrentUser(currentUserData);
        
        // Validate room format
        const roomParts = roomParam.split('-');
        if (roomParts.length !== 2) {
          throw new Error('Invalid room format');
        }

        // Verify user is part of this room
        if (!roomParam.includes(currentUserData.id)) {
          throw new Error('Not authorized for this room');
        }

        setRoomName(roomParam);
        
        // Get token with connection pre-warming
        const tokenRes = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: roomParam }),
        });

        if (!tokenRes.ok) throw new Error('Failed to get token');
        const { token } = await tokenRes.json();
        setToken(token);
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize call');
      }
    };

    init();
  }, [roomParam, router]);

  const handleLeave = async () => {
    setIsLeaving(true);
    if (roomRef.current) {
      await roomRef.current.disconnect();
    }
    router.push('/call?success=true');
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">✕</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/call')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Back to User Selection
          </button>
        </div>
      </div>
    );
  }

  if (!token || !roomName || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-gray-700 font-medium">Establishing ultra-fast connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={handleLeave}
          disabled={isLeaving}
          className={`px-4 py-2 rounded-lg font-medium flex items-center transition ${
            isLeaving
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {isLeaving ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Ending Call
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Leave Call
            </>
          )}
        </button>
      </div>

      <LiveKitRoom
  ref={roomRef}
  token={token}
  serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
  audio={true}
  video={true}
  className="h-screen w-screen"
>
  <VideoConference className="h-full" />
</LiveKitRoom>
    </div>
  );
}