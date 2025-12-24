// src/app/connect/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  CardFooter
} from '@/components/ui/card';
import Button from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Added missing component
import { useAuth } from '@/hooks/useAuth';

import { 
  Users, 
  MessageCircle, 
  UsersIcon, 
  Mic, 
  Bell, 
  Plus, 
  Loader2,
  Heart,
  Settings,
  Clock,
  X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';


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

type RequestType = 'one_on_one' | 'group';

interface SupportRequest {
  id: string;
  user_id: string; // Fixed from requester_id → user_id
  grief_type: GriefType;
  request_type: RequestType;
  description: string;
  status: 'pending' | 'matched' | 'completed' | 'cancelled';
  created_at: string;
  matched_at?: string;
  session_id?: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
  requester_name?: string;
}

interface Session {
  id: string;
  session_type: RequestType;
  status: 'pending' | 'active' | 'ended';
  grief_types: GriefType[];
  host_id: string;
  title: string;
}

export default function ConnectPage() {
 const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [incomingRequests, setIncomingRequests] = useState<SupportRequest[]>([]);
  const [isPostingRequest, setIsPostingRequest] = useState(false);
  const [showPostRequestModal, setShowPostRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>('one_on_one');
  const [griefType, setGriefType] = useState<GriefType | ''>('');
  const [requestDescription, setRequestDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);

// 🔒 1. Show loading while auth system initializes
if (authLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-amber-500" />
        <p className="text-stone-600">Loading your space...</p>
      </div>
    </div>
  );
}

// 🔒 2. Redirect to login if not authenticated
if (!user) {
  router.push('/auth');
  return null;
}
 

  useEffect(() => {
  if (!user) return; // user guaranteed non-null due to guard, but safe

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        // If profile doesn't exist, optionally create one or redirect to onboarding
        console.warn('Profile not found. You may need to create one.');
        setProfile({ id: user.id, full_name: null, grief_types: [], accepts_calls: true });
        return;
      }

      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load your profile. Please reload.');
    }
  };

  fetchProfile();
}, [user]); // Re-run if user changes (e.g., after sign-in)
useEffect(() => {
  if (!user) return; // user guaranteed non-null due to guard, but safe

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        // If profile doesn't exist, optionally create one or redirect to onboarding
        console.warn('Profile not found. You may need to create one.');
        setProfile({ id: user.id, full_name: null, grief_types: [], accepts_calls: true });
        return;
      }

      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load your profile. Please reload.');
    }
  };

  fetchProfile();
}, [user]); // Re-run if user changes (e.g., after sign-in)

// 🔑 2. Fetch online count (independent of profile)
useEffect(() => {
  const fetchOnlineCount = async () => {
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('accepts_calls', true);

      if (error) throw error;
      setOnlineCount(count || 0);
    } catch (err) {
      console.error('Error fetching online count:', err);
      setOnlineCount(50); // fallback
    }
  };

  fetchOnlineCount();
  const interval = setInterval(fetchOnlineCount, 30000);
  return () => clearInterval(interval);
}, []);

// 🔑 3. Fetch & subscribe to incoming support requests
useEffect(() => {
  if (!user || !profile || !profile.grief_types?.length) {
    // If no grief types, no relevant requests → clear list
    setIncomingRequests([]);
    return;
  }

  const fetchRequests = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('support_requests')
        .select(`
          *,
          profiles:user_id ( full_name )
        `)
        .in('grief_type', profile.grief_types)
        .eq('status', 'pending')
        .neq('user_id', user.id) // ← now safe: user.id exists
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedRequests = (data || []).map(req => ({
        ...req,
        requester_name: req.profiles?.full_name || 'Someone',
      }));

      setIncomingRequests(formattedRequests);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Failed to load support requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  fetchRequests();

  // 🔁 Real-time subscription
  const channel = supabase
    .channel('support-requests')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_requests',
        filter: 'status=eq.pending'
      },
      (payload) => {
        const newRequest = payload.new as SupportRequest;
        if (
          profile.grief_types?.includes(newRequest.grief_type) &&
          newRequest.user_id !== user.id
        ) {
          setIncomingRequests(prev => {
            if (prev.some(req => req.id === newRequest.id)) return prev;
            return [{ ...newRequest, requester_name: 'Someone' }, ...prev];
          });
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_requests',
        filter: 'status=in.(matched,completed,cancelled)'
      },
      (payload) => {
        const updatedRequest = payload.new as SupportRequest;
        setIncomingRequests(prev => prev.filter(req => req.id !== updatedRequest.id));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user, profile]); // Only re-run when user or profile changes

  const createLiveKitRoom = async (sessionId: string, sessionType: RequestType): Promise<string> => {
    try {
      // Get LiveKit token with appropriate permissions
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          roomName: sessionId,
          isHost: true,
          sessionType
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get LiveKit token: ${response.statusText}`);
      }

      const { url, token } = await response.json();
      if (!url || !token) {
        throw new Error('Missing LiveKit connection details');
      }

      return sessionId;
    } catch (error) {
      console.error('Error creating LiveKit room:', error);
      throw error;
    }
  };

  const createSupportSession = async (requestType: RequestType, griefType: GriefType): Promise<Session> => {
    const sessionId = `session-${uuidv4()}`;
    const sessionType = requestType;
    const title = requestType === 'one_on_one' 
      ? `One-on-One Support` 
      : `Group Support Circle`;
    
    // Create session in database
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        id: sessionId,
        session_type: sessionType,
        title: title,
        host_id: user!.id,
        grief_types: [griefType],
        status: 'pending',
        participant_limit: requestType === 'one_on_one' ? 2 : 8,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create session');

    return data as Session;
  };

  const acceptRequest = async (request: SupportRequest) => {
    if (!user || acceptingRequestId === request.id) return;
    
    setAcceptingRequestId(request.id);
    setError(null);

    try {
      // Update request status to matched
      const { error: updateError } = await supabase
        .from('support_requests')
        .update({ 
          status: 'matched',
          matched_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .select()
        .single();

      if (updateError) throw updateError;

      let session;
      
      // If request doesn't have a session yet, create one
      if (!request.session_id) {
        session = await createSupportSession(request.request_type, request.grief_type);
        
        // Update the request with the new session ID
        const { error: sessionUpdateError } = await supabase
          .from('support_requests')
          .update({ session_id: session.id })
          .eq('id', request.id);
          
        if (sessionUpdateError) throw sessionUpdateError;
      } else {
        // Get existing session details
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', request.session_id)
          .single();
          
        if (sessionError) throw sessionError;
        session = sessionData;
      }

      // Add both users as participants to the session
      const participantRecords = [
        { session_id: session.id, user_id: user.id, joined_at: new Date().toISOString() },
        { session_id: session.id, user_id: request.user_id, joined_at: new Date().toISOString() } // Fixed requester_id → user_id
      ];
      
      const { error: participantError } = await supabase
        .from('session_participants')
        .upsert(participantRecords);
        
      if (participantError) throw participantError;

      // Create LiveKit room if it doesn't exist yet or if session is pending
      if (session.status === 'pending') {
        await createLiveKitRoom(session.id, session.session_type as RequestType);
        
        // Update session status to active
        const { error: statusError } = await supabase
          .from('sessions')
          .update({ status: 'active' })
          .eq('id', session.id);
          
        if (statusError) throw statusError;
      }

      // Redirect to call room after short delay to allow UI update
      setTimeout(() => {
        router.push(`/call/${session.id}`);
      }, 500);

    } catch (err) {
      console.error('Error accepting request:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept request. Please try again.');
    } finally {
      setAcceptingRequestId(null);
    }
  };

  const postSupportRequest = async () => {
    if (!user || !griefType || !requestDescription.trim() || isPostingRequest) return;
    
    setIsPostingRequest(true);
    setError(null);

    try {
      const requestId = uuidv4();
      const requestTypeValue = requestType as RequestType;
      
      // Create a session first for this request
      const session = await createSupportSession(requestTypeValue, griefType);
      
      // Create the support request
      const { error } = await supabase
        .from('support_requests')
        .insert({
          id: requestId,
          user_id: user.id, // Fixed field name
          grief_type: griefType,
          request_type: requestTypeValue,
          description: requestDescription.trim(),
          status: 'pending',
          session_id: session.id,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      
      // Add requester as first participant in the session
      const { error: participantError } = await supabase
        .from('session_participants')
        .insert({
          session_id: session.id,
          user_id: user.id,
          joined_at: new Date().toISOString()
        });
        
      if (participantError) throw participantError;

      setShowPostRequestModal(false);
      setRequestDescription('');
      setGriefType('');
      
      // Show success message
      setError('Your support request has been posted! You\'ll be notified when someone accepts.');

    } catch (err) {
      console.error('Error posting request:', err);
      setError(err instanceof Error ? err.message : 'Failed to post your request. Please try again.');
    } finally {
      setIsPostingRequest(false);
    }
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

  const quickActions = [
    {
      id: 'one-on-one',
      title: 'Talk One-on-One',
      description: 'Get matched instantly with someone who\'s been there.',
      icon: <MessageCircle className="h-6 w-6 text-primary" />,
      href: '/connect/one-on-one',
    },
    {
      id: 'group-call',
      title: 'Join a Group Call',
      description: 'Share and listen in a supportive, real-time circle.',
      icon: <UsersIcon className="h-6 w-6 text-primary" />,
      href: '/connect/group-call',
    },
    {
      id: 'live-rooms',
      title: 'Live Chat Rooms',
      description: 'Drop into topic-based conversations happening now.',
      icon: <Mic className="h-6 w-6 text-primary" />,
      href: '/connect/rooms',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-amber-500" />
          <p className="text-stone-600">Finding people who understand...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-stone-800">
            You Are Not Alone
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto">
            Press a button—someone who understands is always online. And sometimes, someone is already asking for <span className="italic">you</span>.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="inline-flex items-center gap-2 bg-green-100 px-4 py-2 rounded-full">
              <Users className="h-4 w-4 text-green-700" />
              <span className="font-medium text-green-800">{onlineCount.toLocaleString()} people online now</span>
            </div>
            
            <Button 
              onClick={() => setShowPostRequestModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Ask for Support
            </Button>
          </div>
        </div>

        {error && (
          <div className={`p-4 rounded-lg text-sm font-medium ${
            error.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {/* Incoming Requests */}
        {incomingRequests.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Bell className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-semibold text-stone-800">Someone Needs You</h2>
            </div>
            <div className="space-y-4">
              {incomingRequests.map((req) => {
                const isAccepting = acceptingRequestId === req.id;
                
                return (
                  <Card key={req.id} className="border-l-4 border-amber-500 bg-amber-50/50">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-stone-800 mb-2">
                            <span className="text-amber-700">{req.requester_name}</span> is looking for someone who:
                          </p>
                          <p className="text-sm bg-white p-3 rounded-lg border border-amber-100 mb-3 italic text-stone-700">
                            &ldquo;{req.description}&rdquo;
                          </p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs">
                              <Heart className="h-3 w-3 mr-1" />
                              {griefTypeLabels[req.grief_type as GriefType]}
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-stone-100 text-stone-800 text-xs">
                              {req.request_type === 'one_on_one' ? 'One-on-One' : 'Group'}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mb-3">
                            <span className="font-medium text-stone-700">Why you're a great match:</span> You've shared about {griefTypeLabels[req.grief_type as GriefType].toLowerCase()} in your profile.
                          </p>
                        </div>
                        <div className="flex-shrink-0 ml-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Just now
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2 border-t border-amber-100">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setIncomingRequests(prev => prev.filter(r => r.id !== req.id));
                          }}
                          className="text-stone-700 border-stone-300 hover:bg-stone-100"
                        >
                          Not Now
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => acceptRequest(req)}
                          disabled={isAccepting}
                          className="bg-amber-500 hover:bg-amber-600 text-white min-w-[120px]"
                        >
                          {isAccepting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Connecting...
                            </>
                          ) : (
                            'Accept Request'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Quick Connect */}
        <section>
          <h2 className="text-2xl font-semibold text-center mb-8 text-stone-800">Or Start a Conversation</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickActions.map((action) => (
              <Card key={action.id} className="hover:shadow-md transition-shadow border-stone-200">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="p-2 bg-amber-100 rounded-lg">{action.icon}</div>
                  <div>
                    <CardTitle className="text-lg text-stone-800">{action.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-stone-600 text-sm mb-4">
                    {action.description}
                  </p>
                  <Link href={action.href} className="block w-full">
                    <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                      Connect Now
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Post Request Modal */}
        {showPostRequestModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
              <div className="flex justify-between items-center p-5 border-b border-stone-200">
                <h2 className="text-xl font-semibold text-stone-800">Ask for Support</h2>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowPostRequestModal(false)}
                  className="text-stone-500 hover:text-stone-700 hover:bg-stone-100"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="p-5 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Type of support
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRequestType('one_on_one')}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        requestType === 'one_on_one'
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-stone-300 hover:border-amber-300'
                      }`}
                    >
                      <div className="font-medium text-stone-800 mb-1 flex items-center">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        One-on-One
                      </div>
                      <p className="text-xs text-stone-600">Private conversation with one person</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestType('group')}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        requestType === 'group'
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-stone-300 hover:border-amber-300'
                      }`}
                    >
                      <div className="font-medium text-stone-800 mb-1 flex items-center">
                        <UsersIcon className="h-4 w-4 mr-2" />
                        Group
                      </div>
                      <p className="text-xs text-stone-600">Share with multiple people</p>
                    </button>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="grief-type" className="block text-sm font-medium text-stone-700 mb-2">
                    Related to which experience?
                  </label>
                  <select
                    id="grief-type"
                    value={griefType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGriefType(e.target.value as GriefType)} // Fixed event typing
                    className="w-full p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="">Select a grief experience</option>
                    {(Object.keys(griefTypeLabels) as GriefType[]).map((type) => (
                      <option key={type} value={type}>
                        {griefTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
  <label htmlFor="description" className="block text-sm font-medium text-stone-700 mb-2">
    What would help right now?
  </label>
  <textarea
    id="description"
    value={requestDescription}
    onChange={(e) => setRequestDescription(e.target.value)}
    placeholder={
      requestType === 'one_on_one'
        ? "I'm looking for someone who's also lost a parent to talk with today..."
        : "I'd like to join a group to share about coping with holidays after loss..."
    }
    className="min-h-[100px] w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
  />
  <p className="text-xs text-stone-500 mt-1">
    Be as specific or general as you're comfortable with. This helps us match you with the right person.
  </p>
</div>
                
                <div className="flex justify-end gap-3 pt-2 border-t border-stone-200">
                  <Button
                    variant="outline"
                    onClick={() => setShowPostRequestModal(false)}
                    className="border-stone-300 text-stone-700 hover:bg-stone-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={postSupportRequest}
                    disabled={!griefType || !requestDescription.trim() || isPostingRequest}
                    className="bg-amber-500 hover:bg-amber-600 text-white min-w-[120px]"
                  >
                    {isPostingRequest ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Posting...
                      </>
                    ) : (
                      'Post Request'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}