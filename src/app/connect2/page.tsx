// app/connect2/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { X, Loader2 } from 'lucide-react';

type GriefType =
  | 'parent'
  | 'child'
  | 'spouse'
  | 'sibling'
  | 'friend'
  | 'pet'
  | 'miscarriage'
  | 'caregiver'
  | 'suicide'
  | 'other';

type SupportRequest = {
  id: string;
  user_id: string;
  grief_type: GriefType;
  description: string | null;
  created_at: string;
  requester_name: string;
};

type Profile = {
  full_name: string | null;
};

const griefTypeLabels: Record<GriefType, string> = {
  parent: 'Loss of a Parent',
  child: 'Loss of a Child',
  spouse: 'Grieving a Partner',
  sibling: 'Loss of a Sibling',
  friend: 'Loss of a Friend',
  pet: 'Pet Loss',
  miscarriage: 'Pregnancy or Infant Loss',
  caregiver: 'Caregiver Grief',
  suicide: 'Suicide Loss',
  other: 'Other Loss',
};

export default function Connect2Page() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedGriefType, setSelectedGriefType] = useState<GriefType | ''>('');
  const [description, setDescription] = useState('');
  const [acceptingRequest, setAcceptingRequest] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
  const fetchRequests = async () => {
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    let query = supabase
      .from('support_requests')
      .select(`
        id,
        user_id,
        grief_type,
        description,
        created_at,
        requester_profile: profiles!support_requests_user_id_fkey (full_name)
      `)
      .eq('status', 'pending');

    if (currentUser) {
      query = query.neq('user_id', currentUser.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to load requests:', error);
      setRequests([]);
    } else {
      const formatted = (data || []).map((req: any) => ({
        ...req,
        requester_name: req.requester_profile?.full_name?.trim() || 'Someone',
      }));
      setRequests(formatted);
    }
    setLoading(false);
  };

  fetchRequests();

  // Realtime channel
  const channel = supabase
    .channel('support_requests')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_requests',
        filter: 'status=eq.pending',
      },
      async (payload) => {
        // Same as before – add new pending requests (not your own)
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser && payload.new.user_id === currentUser.id) return;

        const { data: newRequest, error: fetchError } = await supabase
          .from('support_requests')
          .select(`
            id,
            user_id,
            grief_type,
            description,
            created_at,
            requester_profile: profiles!support_requests_user_id_fkey (full_name)
          `)
          .eq('id', payload.new.id)
          .single();

        if (fetchError || !newRequest) return;

        const profileData = newRequest.requester_profile;
        let fullName: string | null = null;
        if (Array.isArray(profileData) && profileData.length > 0) {
          fullName = profileData[0].full_name;
        } else if (profileData && typeof profileData === 'object' && 'full_name' in profileData) {
          fullName = (profileData as Profile).full_name;
        }
        const requesterName = fullName?.trim() || 'Someone';

        setRequests((prev) => {
          if (prev.some(req => req.id === newRequest.id)) return prev;
          return [{ ...newRequest, requester_name: requesterName }, ...prev];
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_requests',
        filter: 'status=eq.accepted', // only accepted (not cancelled)
      },
      async (payload) => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (!currentUser) return;

        const roomId = payload.new.id;
        const requesterId = payload.new.user_id;
        const acceptorId = payload.new.accepted_by;

        // If I'm the requester → redirect me to the room
        if (currentUser.id === requesterId) {
          console.log('[Connect2] Your request was accepted! Redirecting to room...');
          // Small delay helps avoid race conditions
          setTimeout(() => {
            router.push(`/room/${roomId}`);
          }, 300);
        }

        // If I'm the acceptor → already handled in acceptRequest(), but safe to ignore here
        // If I'm neither → do nothing
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_requests',
        filter: 'status=eq.cancelled',
      },
      (payload) => {
        setRequests((prev) => prev.filter((r) => r.id !== payload.new.id));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [supabase, router]);

  const handleCreateRequest = async () => {
    if (!selectedGriefType) {
      alert('Please select a grief type.');
      return;
    }

    setSubmitting(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      alert('You must be signed in');
      setSubmitting(false);
      return;
    }

    const roomId = crypto.randomUUID();

    const { error: insertError } = await supabase
      .from('support_requests')
      .insert({
        id: roomId,
        user_id: user.id,
        status: 'pending',
        grief_type: selectedGriefType,
        description: description || null,
      });

    if (insertError) {
      console.error('Failed to create request:', insertError);
      alert('Failed to request support');
    } else {
      setShowModal(false);
      setSelectedGriefType('');
      setDescription('');
      router.push(`/room/${roomId}`);
    }

    setSubmitting(false);
  };

  const acceptRequest = async (roomId: string, requesterUserId: string) => {
    setAcceptingRequest(roomId);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        alert('You must be signed in');
        setAcceptingRequest(null);
        return;
      }

      if (requesterUserId === user.id) {
        alert('You cannot accept your own request.');
        setAcceptingRequest(null);
        return;
      }

      console.log(`[Connect2] Accepting request ${roomId} for user ${requesterUserId}`);
      
      // First, update the request status
      const { error: updateError } = await supabase
        .from('support_requests')
        .update({ 
          status: 'accepted',
          accepted_by: user.id
        })
        .eq('id', roomId)
        .eq('status', 'pending');

      if (updateError) {
        console.error('Failed to accept request:', updateError);
        alert('Failed to accept request. Please try again.');
        setAcceptingRequest(null);
        return;
      }

      console.log(`[Connect2] Successfully accepted request ${roomId}, redirecting to room`);
      
      // Add a small delay to ensure the database update propagates
      await new Promise(resolve => setTimeout(resolve, 500));
      
      router.push(`/room/${roomId}`);
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('An error occurred while accepting the request');
      setAcceptingRequest(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Need to Talk?</h1>

      <button
        onClick={() => setShowModal(true)}
        className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg font-medium"
      >
        I need to talk
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-stone-200">
              <h2 className="text-xl font-semibold text-stone-800">What are you grieving?</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-stone-500 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Grief type
                </label>
                <select
                  value={selectedGriefType}
                  onChange={(e) => setSelectedGriefType(e.target.value as GriefType)}
                  className="w-full p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">Select your experience</option>
                  {(Object.keys(griefTypeLabels) as GriefType[]).map((type) => (
                    <option key={type} value={type}>
                      {griefTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Anything you'd like to share? (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="I'm looking for someone who understands..."
                  className="w-full min-h-[80px] rounded-md border border-stone-300 px-3 py-2 text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-stone-200">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRequest}
                  disabled={!selectedGriefType || submitting}
                  className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Request'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Active Requests</h2>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">No one is requesting support right now.</p>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="border p-4 rounded-lg bg-white shadow hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <span className="inline-block bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded capitalize">
                    {griefTypeLabels[req.grief_type] || req.grief_type}
                  </span>
                  <p className="mt-2">
                    <span className="font-medium text-amber-700">{req.requester_name}</span> is looking for someone who understands
                  </p>
                  {req.description && (
                    <p className="mt-2 text-stone-700 italic pl-1 border-l-2 border-amber-200">"{req.description}"</p>
                  )}
                </div>
                <span className="text-xs text-stone-500 whitespace-nowrap">
                  {formatDistanceToNow(new Date(req.created_at))} ago
                </span>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => acceptRequest(req.id, req.user_id)}
                  disabled={acceptingRequest === req.id}
                  className={`${
                    acceptingRequest === req.id 
                      ? 'bg-amber-300 cursor-not-allowed' 
                      : 'bg-amber-500 hover:bg-amber-600'
                  } text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2`}
                >
                  {acceptingRequest === req.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    'Accept Request'
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}