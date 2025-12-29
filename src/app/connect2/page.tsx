'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Phone, X, MessageCircle, Clock, User } from 'lucide-react';

export default function ConnectPage() {
  const [user, setUser] = useState<any>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [availableRequests, setAvailableRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const [isPostingRequest, setIsPostingRequest] = useState(false);
  const isRedirectingRef = useRef(false);
  const requestSubscriptionRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/auth');
          return;
        }

        // Get current user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;
        
        if (isMounted) {
          setUser(profile);
        }

        // Fetch active requests first
        await fetchActiveRequests(session.user.id);
        
        // Then fetch available requests
        await fetchAvailableRequests(session.user.id);

        // Setup realtime subscription for ALL relevant requests
        setupRealtimeSubscription(session.user.id);
      } catch (err) {
        console.error('Initialization error:', err);
        if (isMounted) {
          setError('Failed to load connection requests');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      // Cleanup subscriptions
      if (requestSubscriptionRef.current) {
        supabase.removeChannel(requestSubscriptionRef.current);
      }
    };
  }, []);

  // Setup realtime subscription that handles both available requests and matched status changes
  const setupRealtimeSubscription = (userId: string) => {
    if (requestSubscriptionRef.current) {
      supabase.removeChannel(requestSubscriptionRef.current);
    }

    const channel = supabase
      .channel('quick_connect_requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quick_connect_requests'
        },
        async (payload) => {
          // Prevent duplicate processing during redirect
          if (isRedirectingRef.current) return;
          
          try {
            // Handle matched status for current user's request
            if (
              payload.eventType === 'UPDATE' && 
              payload.new.user_id === userId && 
              payload.new.status === 'matched' && 
              payload.new.room_id
            ) {
              isRedirectingRef.current = true;
              router.push(`/room/${payload.new.room_id}`);
              return;
            }

            // Refetch data only if still on this page
            await fetchAvailableRequests(userId);
            await fetchActiveRequests(userId);
          } catch (err) {
            console.error('Realtime update error:', err);
          }
        }
      )
      .subscribe();

    requestSubscriptionRef.current = channel;
  };

  const fetchActiveRequests = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('quick_connect_requests')
        .select(`
          id,
          user_id,
          status,
          expires_at,
          created_at,
          room_id,
          requester_profile:profiles!user_id(full_name, avatar_url)
        `)
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const request = data?.[0];
      if (request) {
        // Handle matched status with room redirect
        if (request.status === 'matched' && request.room_id) {
          isRedirectingRef.current = true;
          router.push(`/room/${request.room_id}`);
          return;
        }
        
        // Only set active request if it's available
        if (request.status === 'available') {
          // Format with profile
          const formattedRequest = {
            ...request,
            user: request.requester_profile?.[0] || { full_name: 'Anonymous', avatar_url: null }
          };
          setActiveRequest(formattedRequest);
          return;
        }
      }
      
      setActiveRequest(null);
    } catch (err) {
      console.error('Error fetching active requests:', err);
      throw err;
    }
  };

  const fetchAvailableRequests = async (currentUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('quick_connect_requests')
        .select(`
          id,
          created_at,
          user_id,
          requester_profile:profiles!user_id(
            full_name,
            avatar_url
          )
        `)
        .eq('status', 'available')
        .neq('user_id', currentUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const formattedRequests = (data || []).map(req => ({
        ...req,
        // Use explicitly named join to avoid PGREST201 error
        user: req.requester_profile?.[0] || {
          full_name: 'Anonymous',
          avatar_url: null
        }
      }));
      
      setAvailableRequests(formattedRequests);
    } catch (err) {
      console.error('Error fetching available requests:', err);
      throw err;
    }
  };

  const postRequest = async () => {
    if (!user || activeRequest || isPostingRequest || isRedirectingRef.current) return;
    
    setIsPostingRequest(true);
    setError(null);
    
    try {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('quick_connect_requests')
        .insert({
          user_id: user.id,
          status: 'available',
          expires_at: expiresAt
        });

      if (error) throw error;
      
      // Optimistically update UI
      setActiveRequest({
        id: Date.now().toString(),
        user_id: user.id,
        status: 'available',
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        user: {
          full_name: user.full_name,
          avatar_url: user.avatar_url
        }
      });
      
      // Refresh the subscription to include this new request
      setupRealtimeSubscription(user.id);
    } catch (err) {
      console.error('Failed to post request:', err);
      setError('Failed to create connection request. Please try again.');
    } finally {
      setIsPostingRequest(false);
    }
  };

  const acceptRequest = async (requestId: string) => {
    if (!user || isRedirectingRef.current) return;
  
    try {
      // Generate unique room ID
      const roomId = `quick-connect-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      // First, verify the request exists and is available
      const { data: existingRequest, error: verifyError } = await supabase
        .from('quick_connect_requests')
        .select('*')
        .eq('id', requestId)
        .eq('status', 'available')
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (verifyError) {
        throw new Error(`Request verification failed: ${verifyError.message}`);
      }
      
      if (!existingRequest) {
        throw new Error('Request not found or no longer available');
      }
      
      // Update the request to matched status with room ID and acceptor ID
      // ONLY using columns that exist in your schema:
      // id, user_id, status, expires_at, created_at, room_id, acceptor_id
      const { error } = await supabase
        .from('quick_connect_requests')
        .update({
          status: 'matched',
          room_id: roomId,
          acceptor_id: user.id // 👈 Record who accepted the request
        })
        .eq('id', requestId)
        .eq('status', 'available');
      
      if (error) {
        console.error('Supabase update error:', error);
        throw new Error(`Supabase update failed: ${error.message}`);
      }
      
      console.log('Request successfully updated, redirecting to room:', roomId);
      
      // Redirect to room immediately
      isRedirectingRef.current = true;
      router.push(`/room/${roomId}`);
      
    } catch (err) {
      console.error('Failed to accept request:', err);
      setError('Failed to accept request. Please try again.');
    }
    
    // 🚀 SCALABILITY NOTE:
    // For future multi-participant rooms or group calls, consider:
    // 1. Creating a dedicated `room_participants` table with:
    //    - room_id (text)
    //    - user_id (uuid)
    //    - role (text: 'host', 'participant')
    //    - joined_at (timestamptz)
    // 2. Using a separate `rooms` table to manage room metadata
    // 3. Implementing WebRTC signaling server for efficient peer connections
    // This current implementation assumes 1:1 connections only.
  };

  const cancelRequest = async () => {
    if (!activeRequest || isRedirectingRef.current) return;
    
    try {
      const { error } = await supabase
        .from('quick_connect_requests')
        .update({ status: 'completed' })
        .eq('id', activeRequest.id);

      if (error) throw error;
      
      setActiveRequest(null);
    } catch (err) {
      console.error('Failed to cancel request:', err);
      setError('Failed to cancel request. Please try again.');
    }
  };

  const timeAgo = (timestamp: string) => {
    const now = new Date();
    const posted = new Date(timestamp);
    const diff = Math.floor((now.getTime() - posted.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-stone-600">Finding connections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100 p-4">
      {error && (
        <div className="fixed top-4 right-4 max-w-sm p-4 bg-red-100 text-red-700 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-800">Connect Now</h1>
            <p className="text-stone-600 mt-2">
              Post a request when you need to talk, or accept someone else&apos;s request to connect immediately.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-stone-600 hover:text-stone-900"
          >
            <X size={28} />
          </button>
        </div>

        {/* Active Request Section */}
        {activeRequest ? (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 mb-8 animate-fade-in">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center border-2 border-amber-300 flex-shrink-0">
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt={user.full_name} 
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-amber-800 font-bold text-lg">
                        {user.full_name?.charAt(0) || <User size={20} />}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-stone-800">Your request is active</h2>
                    <p className="text-stone-600">Waiting for someone to connect with you</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-amber-700 bg-amber-100 rounded-full px-3 py-1 w-fit mt-2">
                  <Clock size={16} />
                  <span className="text-sm font-medium">
                    Expires in {Math.ceil((new Date(activeRequest.expires_at).getTime() - Date.now()) / 60000)} minutes
                  </span>
                </div>
              </div>
              
              <button
                onClick={cancelRequest}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-full font-medium transition-colors"
              >
                Cancel Request
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 p-8 mb-8 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center border-2 border-amber-300 mx-auto mb-6">
              <MessageCircle className="text-amber-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-stone-800 mb-3">I need to talk</h2>
            <p className="text-stone-600 mb-6 max-w-md mx-auto">
              Post a request to connect with someone from the community who&apos;s available to listen right now. Your request will be visible to others for 10 minutes.
            </p>
            <button
              onClick={postRequest}
              disabled={isPostingRequest || isRedirectingRef.current}
              className={`${
                isPostingRequest || isRedirectingRef.current
                  ? 'bg-amber-300 cursor-not-allowed' 
                  : 'bg-amber-500 hover:bg-amber-600'
              } text-white font-bold py-3 px-8 rounded-full flex items-center justify-center gap-2 mx-auto transition-colors shadow-md`}
            >
              {isPostingRequest ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating request...
                </>
              ) : (
                <>
                  <Phone size={20} />
                  Post Request
                </>
              )}
            </button>
          </div>
        )}

        {/* Available Requests Section */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-8 animate-fade-in">
          <div className="p-5 border-b border-stone-100 bg-stone-50">
            <h2 className="text-xl font-bold text-stone-800">Available Connections</h2>
            <p className="text-stone-600 mt-1">
              {availableRequests.length > 0 
                ? 'Someone in the community needs to talk right now' 
                : 'No active requests at the moment. Check back later or post your own request.'}
            </p>
          </div>
          
          {availableRequests.length > 0 ? (
            <div className="divide-y divide-stone-100">
              {availableRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="p-5 hover:bg-amber-50 transition-colors cursor-pointer group"
                  onClick={() => !isRedirectingRef.current && acceptRequest(request.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-amber-100 flex-shrink-0 flex items-center justify-center border border-amber-200 overflow-hidden mt-1">
                        {request.user.avatar_url ? (
                          <img 
                            src={request.user.avatar_url} 
                            alt={request.user.full_name} 
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <span className="text-amber-800 font-medium">
                            {request.user.full_name?.charAt(0) || <User size={20} />}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-stone-800">{request.user.full_name}</h3>
                        <p className="text-stone-600 text-sm mt-0.5">Needs to talk • {timeAgo(request.created_at)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="bg-amber-100 text-amber-800 rounded-full px-3 py-1 text-sm font-medium hidden group-hover:block">
                        Accept Request
                      </div>
                      <Phone className="text-amber-500 ml-3 group-hover:scale-110 transition-transform" size={24} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-stone-500">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                  <MessageCircle className="text-stone-400" size={24} />
                </div>
              </div>
              <p>No one is requesting a connection right now</p>
            </div>
          )}
        </div>

        {/* How it Works Section */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 animate-fade-in">
          <h2 className="text-xl font-bold text-stone-800 mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <Phone className="text-amber-600" size={24} />
              </div>
              <h3 className="font-medium text-stone-800">Post Request</h3>
              <p className="text-stone-600 mt-1 text-sm">Click &quot;I need to talk&quot; to let others know you&apos;re available</p>
            </div>
            
            <div className="text-center p-4 border-l border-stone-200 md:border-l-0 md:border-t md:border-stone-200">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <User className="text-amber-600" size={24} />
              </div>
              <h3 className="font-medium text-stone-800">Get Matched</h3>
              <p className="text-stone-600 mt-1 text-sm">When someone accepts your request, you&apos;ll both be connected instantly</p>
            </div>
            
            <div className="text-center p-4 border-l border-stone-200 md:border-l-0">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <Clock className="text-amber-600" size={24} />
              </div>
              <h3 className="font-medium text-stone-800">10 Minute Window</h3>
              <p className="text-stone-600 mt-1 text-sm">Requests automatically expire after 10 minutes to keep connections fresh</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}