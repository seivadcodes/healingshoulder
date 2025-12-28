'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Button from '@/components/ui/button';
import { Phone, MessageCircle, Loader2, X } from 'lucide-react';

type Call = {
  id: string;
  caller_id: string;
  caller_name: string;
  room_name: string;
  status: 'pending' | 'accepted' | 'cancelled';
  acceptor_id?: string;
  acceptor_name?: string;
};

export default function Connect2Page() {
  const [pendingCall, setPendingCall] = useState<Call | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<Call | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'in-call'>('idle');
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const callIdFromUrl = searchParams.get('callId');
  const supabase = createClient();

  // Auth check and user setup
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/auth');
        return;
      }
      
      const fullName =
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'Someone';
      
      setCurrentUser({
        id: session.user.id,
        name: fullName
      });
    };
    checkAuth();
  }, [router, supabase]);

  // Redirect if callId is in URL
  useEffect(() => {
    if (callIdFromUrl && currentUser) {
      router.push(`/calls2?callId=${callIdFromUrl}`);
    }
  }, [callIdFromUrl, currentUser, router]);

  // Realtime listener for calls
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel('public-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: 'status=eq.pending',
        },
        (payload) => {
          const call = payload.new as Call;
          // Only show calls from other users
          if (call.caller_id !== currentUser.id) {
            setIncomingRequest(call);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
        },
        (payload) => {
          const call = payload.new as Call;

          // If our pending call was accepted
          if (pendingCall?.id === call.id && call.status === 'accepted') {
            setStatus('in-call');
            router.push(`/calls2?callId=${call.id}`);
            return;
          }

          // If the incoming request we're seeing changes status, dismiss it
          if (incomingRequest?.id === call.id && call.status !== 'pending') {
            setIncomingRequest(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, pendingCall?.id, incomingRequest?.id, router, supabase]);

  const askForHelp = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    const roomName = `help-${Date.now()}-${currentUser.id}`;
    
    const { data: call, error } = await supabase
      .from('calls')
      .insert({
        caller_id: currentUser.id,
        caller_name: currentUser.name,
        room_name: roomName,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to send help request:', error);
      alert(`Failed: ${error.message || 'Unknown error'}`);
      setLoading(false);
      return;
    }

    setPendingCall(call);
    setStatus('waiting');
    setLoading(false);
  };

  const acceptHelpRequest = async () => {
    if (!incomingRequest || !currentUser) return;

    const { error } = await supabase
      .from('calls')
      .update({
        status: 'accepted',
        acceptor_id: currentUser.id,
        acceptor_name: currentUser.name,
      })
      .eq('id', incomingRequest.id);

    if (error) {
      alert('Failed to accept call. Please try again.');
      return;
    }

    // Remove from local state immediately
    setIncomingRequest(null);
    // Redirect to call page
    router.push(`/calls2?callId=${incomingRequest.id}`);
  };

  const cancelRequest = async () => {
    if (!pendingCall) return;
    await supabase.from('calls').delete().eq('id', pendingCall.id);
    setPendingCall(null);
    setStatus('idle');
  };

  // Waiting screen
  if (status === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100 p-4">
        <div className="text-center max-w-md">
          <MessageCircle className="mx-auto h-16 w-16 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold text-stone-800 mb-2">Waiting for Support</h2>
          <p className="text-stone-600 mb-6">
            A community member will be notified. You'll be connected as soon as someone accepts.
          </p>
          <Button
            onClick={cancelRequest}
            variant="outline"
            className="border-stone-300 text-stone-700"
          >
            Cancel Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100 p-4">
      {/* Incoming Request Modal */}
      {incomingRequest && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex flex-col items-center">
              <button 
                onClick={() => setIncomingRequest(null)}
                className="absolute top-4 right-4 text-stone-500 hover:text-stone-700"
              >
                <X size={24} />
              </button>
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center border-2 border-amber-300">
                <Phone className="text-amber-600" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-stone-800 mt-4">Support Request</h2>
              <p className="text-stone-600 mt-2">{incomingRequest.caller_name} needs help.</p>

              <div className="flex gap-6 mt-8 w-full">
                <Button
                  onClick={() => setIncomingRequest(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Decline
                </Button>

                <Button
                  onClick={acceptHelpRequest}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Accept
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main UI */}
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-stone-800 mb-4">Need to Talk?</h1>
        <p className="text-stone-600 mb-8">
          Press below to ask for anonymous support. If you're here to help, you'll see a request appear.
        </p>

        <Button
          onClick={askForHelp}
          disabled={loading}
          className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Sending...
            </>
          ) : (
            'Ask for Help'
          )}
        </Button>

        <p className="text-stone-500 text-sm mt-6">
          All conversations are private, anonymous, and ephemeral.
        </p>
      </div>
    </div>
  );
}