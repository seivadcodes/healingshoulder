// src/app/connect/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  CardFooter
} from '@/components/ui/card';
import Button from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { PostgrestError } from '@supabase/supabase-js';

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
  X,
  CheckCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase';

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
  user_id: string;
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
  const supabase = createClient();
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
  const [matchedRequests, setMatchedRequests] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
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
  }, [user]);

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
        setOnlineCount(50);
      }
    };

    fetchOnlineCount();
    const interval = setInterval(fetchOnlineCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) {
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
          .eq('status', 'pending')
          .neq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Supabase Error] Failed to fetch support_requests:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          throw error;
        }

        const formattedRequests = (data || []).map(req => ({
          ...req,
          requester_name: req.profiles?.full_name || 'Someone',
        }));

        setIncomingRequests(formattedRequests);
      } catch (err) {
        console.error('[ConnectPage] Error in fetchRequests catch block:', err);

        let errorMessage = 'Failed to load support requests. Please try again.';

        if (err && typeof err === 'object') {
          const maybeError = err as Partial<PostgrestError>;
          if (maybeError.code) {
            const code = maybeError.code;
            const message = maybeError.message || 'Unknown database error';
            const details = maybeError.details ? ` Details: ${maybeError.details}` : '';
            const hint = maybeError.hint ? ` Hint: ${maybeError.hint}` : '';
            errorMessage = `[${code}] ${message}${details}${hint}`;
            console.error('[ConnectPage] Supabase PostgREST Error:', { code, message, details, hint });
          } else if ('message' in err && typeof err.message === 'string') {
            errorMessage = err.message;
          } else {
            errorMessage = 'We’re having trouble connecting right now. Please refresh or check your network.';
          }
        } else {
          errorMessage = 'Unexpected error: ' + String(err);
        }

        setError(errorMessage);
        setIncomingRequests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();

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
          if (newRequest.user_id !== user.id) {
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
          filter: `status=in.(matched,completed,cancelled),user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedRequest = payload.new as SupportRequest;
          if (updatedRequest.status === 'matched' && updatedRequest.session_id) {
            setMatchedRequests(prev => ({
              ...prev,
              [updatedRequest.id]: true
            }));
            
            // Show toast notification to requester
            setError(`✅ Your request has been accepted! Redirecting to call...`);
            
            // Auto-redirect after 3 seconds
            setTimeout(() => {
              router.push(`/call/${updatedRequest.session_id}`);
            }, 3000);
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
  }, [user, router]);

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

  if (!user) {
    router.push('/auth');
    return null;
  }

  const createSupportSession = async (requestType: RequestType, griefType: GriefType): Promise<Session> => {
    const sessionId = uuidv4();
    const sessionType = requestType;
    const title = requestType === 'one_on_one' 
      ? `One-on-One Support` 
      : `Group Support Circle`;
    
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

    if (request.user_id === user.id) {
      setError('You cannot accept your own support request.');
      return;
    }

    setAcceptingRequestId(request.id);
    setError(null);

    try {
      console.log('[acceptRequest] Accepting request:', request.id);

      const { error: updateError } = await supabase
        .from('support_requests')
        .update({ 
          status: 'matched',
          matched_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('[acceptRequest] Failed to update request:', updateError);
        throw new Error(`Failed to update request: ${updateError.message}`);
      }

      let session: Session;

      if (!request.session_id) {
        console.log('[acceptRequest] Creating new session...');
        session = await createSupportSession(request.request_type, request.grief_type);
        
        const { error: linkError } = await supabase
          .from('support_requests')
          .update({ session_id: session.id })
          .eq('id', request.id);

        if (linkError) throw linkError;
      } else {
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', request.session_id)
          .single();

        if (sessionError) throw sessionError;
        session = sessionData;
      }

      const participantRecords = [
        { session_id: session.id, user_id: user.id, joined_at: new Date().toISOString() },
        { session_id: session.id, user_id: request.user_id, joined_at: new Date().toISOString() }
      ];
      
      const { error: participantError } = await supabase
        .from('session_participants')
        .upsert(participantRecords);

      if (participantError) throw participantError;

      // Notify requester via real-time update (handled by their subscription)
      // Redirect acceptor immediately
      router.push(`/call/${session.id}`);
    } catch (err) {
      console.error('[acceptRequest] Error:', err);
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
      
      const session = await createSupportSession(requestTypeValue, griefType);
      
      const { error } = await supabase
        .from('support_requests')
        .insert({
          id: requestId,
          user_id: user.id,
          grief_type: griefType,
          request_type: requestTypeValue,
          description: requestDescription.trim(),
          status: 'pending',
          session_id: session.id,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      
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
      
      setError('Your support request has been posted! You\'ll be notified when someone accepts.');

      // Redirect to call page after 5 seconds to show pending state
      setTimeout(() => {
        router.push(`/call/${session.id}`);
      }, 5000);
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
      type: 'one_on_one' as RequestType,
    },
    {
      id: 'group-call',
      title: 'Join a Group Call',
      description: 'Share and listen in a supportive, real-time circle.',
      icon: <UsersIcon className="h-6 w-6 text-primary" />,
      type: 'group' as RequestType,
    },
    {
      id: 'live-rooms',
      title: 'Live Chat Rooms',
      description: 'Drop into topic-based conversations happening now.',
      icon: <Mic className="h-6 w-6 text-primary" />,
      href: '/connect/rooms',
    },
  ] satisfies Array<{
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    type?: RequestType;
    href?: string;
  }>;

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
            error.includes('success') || error.includes('✅') 
              ? 'bg-green-50 text-green-700' 
              : 'bg-red-50 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {Object.values(matchedRequests).some(v => v) && (
          <div className="bg-green-50 p-4 rounded-lg text-green-700 text-center">
            <CheckCircle className="h-5 w-5 text-green-500 inline-block mr-2" />
            <span>Your call is being set up! You'll be connected shortly...</span>
          </div>
        )}

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
                  {'href' in action && action.href ? (
                    <Link href={action.href} className="block w-full">
                      <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                        Connect Now
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={() => {
                        if ('type' in action && action.type) {
                          setRequestType(action.type);
                          setGriefType('');
                          setRequestDescription('');
                          setShowPostRequestModal(true);
                        }
                      }}
                    >
                      Connect Now
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

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
                    onChange={(e) => setGriefType(e.target.value as GriefType)}
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