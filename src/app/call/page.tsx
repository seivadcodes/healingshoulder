'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { generateRoomName } from '@/lib/utils';

interface CallUser {
  id: string;
  fullName: string;
}

export default function CallPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const successParam = searchParams.get('success');

  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string } | null>(null);
  const [users, setUsers] = useState<CallUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize user data
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();

        if (authError || !session?.user) {
          router.push('/auth');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          setError('Failed to load your profile.');
          setIsLoading(false);
          return;
        }

        const currentUserData = {
          id: profile.id,
          fullName: profile.full_name || 'Friend',
        };
        setCurrentUser(currentUserData);

        const { data: otherUsers, error: usersError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .neq('id', session.user.id)
          .limit(20);

        if (usersError) {
          console.warn('Failed to fetch other users:', usersError.message);
          setUsers([]);
        } else if (otherUsers) {
          const validUsers = otherUsers
            .filter((u: any) => u && u.full_name && u.id)
            .map((u: any) => ({
              id: u.id,
              fullName: u.full_name,
            }));
          setUsers(validUsers);
        }
      } catch (err: any) {
        console.error('Unexpected error during init:', err);
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [router, supabase]);

  const handleStartCall = async () => {
    if (!selectedUserId || !currentUser) return;

    setIsConnecting(true);
    setError(null);
    const roomName = generateRoomName(currentUser.id, selectedUserId);

    try {
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName }),
      });

      if (!tokenRes.ok) {
        const data = await tokenRes.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to get LiveKit token');
      }

      router.push(`/call/room?room=${encodeURIComponent(roomName)}`);
    } catch (err: any) {
      console.error('Call initiation failed:', err);
      setError(err.message || 'Failed to start call. Please try again.');
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-lg">Loading users...</div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">One-on-One Support Call</h1>
          <p className="text-gray-600 mt-2">Connect with others who understand</p>
        </div>

        {successParam === 'true' && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg">
            Call ended successfully. You can start another call below.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select someone to call
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isConnecting}
              >
                <option value="">— Choose a user —</option>
                {users.length > 0 ? (
                  users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName}
                    </option>
                  ))
                ) : (
                  <option disabled>No other users available</option>
                )}
              </select>
            </div>

            <button
              onClick={handleStartCall}
              disabled={!selectedUserId || isConnecting}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white flex items-center justify-center transition ${
                selectedUserId && !isConnecting
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isConnecting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  Start Call
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-500 mt-4">
              {isConnecting
                ? 'Establishing ultra-fast connection...'
                : users.length === 0
                ? 'No other users are currently available.'
                : 'Select a user to initiate a support call.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}