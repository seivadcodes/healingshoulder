// app/room/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function RoomPage() {
  const params = useParams();
  const roomId = params?.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<{
    user_id: string;
    status: string;
    grief_type: string;
  } | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [userRole, setUserRole] = useState<'requester' | 'responder' | null>(null);

  useEffect(() => {
    const initRoom = async () => {
      if (!roomId) {
        setError('Invalid room ID');
        setLoading(false);
        return;
      }

      // Get current user
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setError('You must be signed in to join a room');
        setLoading(false);
        return;
      }

      const user = authData.user;
      setCurrentUser({ id: user.id });

      // Fetch room data
      const { data: room, error: roomError } = await supabase
        .from('support_requests')
        .select('user_id, status, grief_type')
        .eq('id', roomId)
        .single();

      if (roomError || !room) {
        setError('Room not found or no longer available');
        setLoading(false);
        return;
      }

      // Determine role
      const role = room.user_id === user.id ? 'requester' : 'responder';

      // Optional: prevent responder from joining if not accepted
      if (room.status !== 'accepted' && role === 'responder') {
        setError('This support session has not been accepted yet');
        setLoading(false);
        return;
      }

      setRoomData(room);
      setUserRole(role);
      setLoading(false);
    };

    initRoom();
  }, [roomId, supabase]);

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p>Loading room...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-red-600 bg-red-50 p-4 rounded-lg">
          {error}
        </div>
        <button
          onClick={() => router.push('/connect2')}
          className="mt-4 text-blue-600 hover:underline"
        >
          ← Back to support requests
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Support Room</h1>
        <p className="text-gray-600">
          Grief type: <span className="font-medium">{roomData?.grief_type}</span>
        </p>
        <p className="mt-2">
          {userRole === 'requester' ? (
            <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm">
              You asked for help
            </span>
          ) : (
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
              You’re offering support
            </span>
          )}
        </p>
      </div>

      <div className="border rounded-lg p-6 bg-gray-50 min-h-[400px]">
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <p className="text-lg">Real-time support coming soon...</p>
          <p className="mt-2 text-sm">This room will soon include live chat or video.</p>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => router.push('/connect2')}
          className="text-gray-700 hover:text-gray-900"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}