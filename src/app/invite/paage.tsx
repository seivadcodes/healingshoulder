'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { X, User, Navigation, Bell } from 'lucide-react';

type User = {
  id: string;
  full_name: string;
  avatar_url?: string;
};

type NavigationRequest = {
  fromId: string;
  fromName: string;
  targetPath: string;
  timestamp: number;
};

export default function InvitePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<NavigationRequest | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Fetch other users
  useEffect(() => {
    const loadUsers = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .neq('id', session.user.id)
        .limit(10);

      if (error) {
        setError('Failed to load users');
      } else {
        setUsers(data || []);
      }
      setIsLoading(false);
    };

    loadUsers();
  }, []);

  // Listen for navigation requests on YOUR private channel
  useEffect(() => {
    const listenForInvites = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const channel = supabase
        .channel(`user:${session.user.id}`) // 👈 private to this user
        .on('broadcast', { event: 'navigate_request' }, (payload: any) => {
          const req = payload.payload as NavigationRequest;
          setNotification(req);
          // Auto-hide after 10 seconds
          setTimeout(() => setNotification(null), 10000);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    listenForInvites();
  }, []);

  const sendNavigationRequest = async () => {
    if (!selectedUser) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Get sender's display name
    const senderName = session.user.user_metadata?.full_name || 'Community Member';

    // Send to RECEIVER'S private channel
    await supabase
      .channel(`user:${selectedUser.id}`)
      .send({
        type: 'broadcast',
        event: 'navigate_request',
        payload: {
          fromId: session.user.id,
          fromName: senderName,
          targetPath: '/calls', // or any path you want
          timestamp: Date.now(),
        } satisfies NavigationRequest,
      });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-stone-600">Loading community...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100 p-4">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 max-w-sm p-4 bg-white border border-amber-200 rounded-lg shadow-lg z-50 flex items-start gap-3">
          <div className="mt-0.5 text-amber-600">
            <Bell size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-800">
              {notification.fromName} sent you a link
            </p>
            <p className="text-xs text-stone-600 mt-1">
              “Would you like to go to {notification.targetPath}?”
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  router.push(notification.targetPath);
                  setNotification(null);
                }}
                className="text-xs bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600"
              >
                Go
              </button>
              <button
                onClick={() => setNotification(null)}
                className="text-xs text-stone-500 hover:text-stone-700"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-stone-400 hover:text-stone-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main UI */}
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-stone-800">Send a Page Invite</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-stone-600 hover:text-stone-900"
          >
            <X size={24} />
          </button>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-100 bg-stone-50">
            <p className="text-stone-700">
              Select a community member and send them a link to this page (or another).
              If they’re online, they’ll see your invitation.
            </p>
          </div>

          <div className="divide-y divide-stone-100">
            {users.map((user) => (
              <div
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-amber-50 transition-colors ${
                  selectedUser?.id === user.id ? 'bg-amber-50 ring-2 ring-amber-200' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 flex-shrink-0 flex items-center justify-center border border-amber-200 overflow-hidden">
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.full_name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-amber-800 font-medium">
                      {user.full_name?.charAt(0).toUpperCase() || <User size={16} />}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-stone-800 truncate">{user.full_name}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedUser && (
          <div className="mt-6 bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-800 mb-3">
              Invite {selectedUser.full_name}?
            </h2>
            <button
              onClick={sendNavigationRequest}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <Navigation size={20} />
              Send Invite to /calls
            </button>
          </div>
        )}
      </div>
    </div>
  );
}