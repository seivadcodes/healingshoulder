// app/connect2/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Connect2Page() {
  const [requests, setRequests] = useState<{ id: string; user_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  // Fetch & subscribe to active requests
  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('support_requests')
        .select('id, user_id')
        .eq('status', 'pending');

      if (error) {
        console.error('Failed to load requests:', error);
      } else {
        setRequests(data || []);
      }
      setLoading(false);
    };

    fetchRequests();

    // Realtime subscription
    const channel = supabase
      .channel('support_requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRequests((prev) => [...prev, payload.new as any]);
          } else if (payload.eventType === 'DELETE' || payload.eventType === 'UPDATE') {
            setRequests((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleNeedToTalk = async () => {
    setSubmitting(true);

    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      alert('You must be signed in');
      setSubmitting(false);
      return;
    }

    const user = data.user;
    const roomId = crypto.randomUUID(); // Full UUID — valid for UUID column

    const { error: insertError } = await supabase
      .from('support_requests')
      .insert({
        id: roomId,
        user_id: user.id, // ✅ This is the requester — matches your DB column
        status: 'pending',
      });

    if (insertError) {
      console.error('Failed to create request:', insertError);
      alert('Failed to request support');
    } else {
      router.push(`/room/${roomId}`);
    }

    setSubmitting(false);
  };

  const acceptRequest = async (roomId: string) => {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    alert('You must be signed in');
    return;
  }

  const user = authData.user;

  // Fetch the request to check who the requester is
  const { data: requestData, error: fetchError } = await supabase
    .from('support_requests')
    .select('user_id')
    .eq('id', roomId)
    .single();

  if (fetchError) {
    console.error('Failed to fetch request:', fetchError);
    alert('Could not load request details');
    return;
  }

  // requestData is the row (or null)
  if (!requestData) {
    alert('Request not found');
    return;
  }

  if (requestData.user_id === user.id) {
    alert('You cannot accept your own request.');
    return;
  }

  const { error: updateError } = await supabase
    .from('support_requests')
    .update({ status: 'accepted' })
    .eq('id', roomId)
    .eq('status', 'pending');

  if (updateError) {
    console.error('Failed to accept request:', updateError);
    alert('Failed to accept request');
    return;
  }

  router.push(`/room/${roomId}`);
};
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Need to Talk?</h1>

      <button
        onClick={handleNeedToTalk}
        disabled={submitting}
        className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-6 py-3 rounded-lg font-medium"
      >
        {submitting ? 'Creating room...' : 'I need to talk'}
      </button>

      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Active Requests</h2>
        {loading ? (
          <p>Loading...</p>
        ) : requests.length === 0 ? (
          <p className="text-gray-500">No one is requesting support right now.</p>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="border p-4 rounded-lg bg-white shadow">
              <p>A community member needs to talk</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => acceptRequest(req.id)}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                >
                  Accept
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}