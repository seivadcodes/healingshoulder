// app/room/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function RoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [roomInfo, setRoomInfo] = useState<{
    requester: string;
    acceptor: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to safely extract full_name from profile data (handles array or object)
  const getFullName = (profileData: any): string => {
    if (!profileData) return '';
    if (Array.isArray(profileData)) {
      return profileData.length > 0 ? profileData[0]?.full_name || '' : '';
    }
    return profileData.full_name || '';
  };

  useEffect(() => {
    const fetchRoomInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data, error } = await supabase
          .from('support_requests')
          .select(`
            user_id,
            accepted_by,
            requester_profile: profiles!support_requests_user_id_fkey (full_name),
            acceptor_profile: profiles!support_requests_accepted_by_fkey (full_name)
          `)
          .eq('id', roomId)
          .single();

        if (error) throw error;

        // If not yet accepted, show waiting message
        if (!data.accepted_by) {
          setError('This room is not ready yet. Please wait for your support partner.');
          return;
        }

        const requesterName = getFullName(data.requester_profile).trim() || 'Requester';
        const acceptorName = getFullName(data.acceptor_profile).trim() || 'Supporter';

        setRoomInfo({
          requester: requesterName,
          acceptor: acceptorName,
        });
      } catch (err) {
        console.error('Room error:', err);
        setError('Failed to load room. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomInfo();

    // Realtime listener for room cancellation
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_requests',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          if (payload.new.status === 'cancelled') {
            router.push('/connect2');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <h2 className="text-lg font-bold text-red-800 mb-2">Room Error</h2>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => router.push('/connect2')}
            className="mt-4 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Requests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="text-center bg-amber-50/50 border border-amber-200 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-amber-800 mb-4">Support Room</h1>

        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-stone-500">Requester</p>
            <p className="font-medium">{roomInfo?.requester}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-stone-500">Supporter</p>
            <p className="font-medium">{roomInfo?.acceptor}</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-green-800 font-medium">✅ You're both here!</p>
          <p className="text-green-700 text-sm mt-1">
            Testing room connection...
          </p>
        </div>

        <button
          onClick={() => router.push('/connect2')}
          className="mt-6 text-stone-600 hover:text-stone-800 underline"
        >
          Leave room
        </button>
      </div>
    </div>
  );
}