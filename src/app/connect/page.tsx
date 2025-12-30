﻿'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Phone, X, MessageCircle, Clock, User } from 'lucide-react';

// Shared base styles (unchanged)
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom, #fffbeb, #f4f4f5)',
    padding: '1rem',
  },
  maxWidth: {
    maxWidth: '56rem',
    margin: '0 auto',
  },
  sectionGap: { marginBottom: '2rem' },
  card: {
    background: '#fff',
    borderRadius: '0.75rem',
    border: '1px solid #e5e5e5',
    padding: '2rem',
    textAlign: 'center' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: '700',
    color: '#1c1917',
  },
  subtitle: {
    color: '#78716c',
    marginTop: '0.5rem',
  },
  button: {
    background: '#d97706',
    color: '#fff',
    fontWeight: '600',
    padding: '0.75rem 2rem',
    borderRadius: '9999px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'background 0.2s',
  },
  disabledButton: {
    background: '#fbbf24',
    cursor: 'not-allowed',
  },
  iconButton: {
    color: '#78716c',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.75rem',
  },
  userAvatar: {
    width: '3rem',
    height: '3rem',
    borderRadius: '9999px',
    background: '#fef3c7',
    border: '2px solid #fcd34d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0 as const,
  },
  requestCard: {
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: '0.75rem',
    padding: '1.5rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1.5rem',
  },
  gridItem: {
    textAlign: 'center' as const,
    padding: '1rem',
  },
  avatarPlaceholder: {
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: '9999px',
    background: '#fef3c7',
    border: '1px solid #fcd34d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '0.25rem',
    flexShrink: 0 as const,
  },
};

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

  // Polling logic with visibility awareness
  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchAllData = async (userId: string) => {
      try {
        await fetchAvailableRequests(userId);
        await fetchActiveRequests(userId);
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    const startPolling = (userId: string) => {
      if (pollInterval) return; // already running

      const poll = () => {
        if (
          !isRedirectingRef.current &&
          !document.hidden && // only poll if tab is visible
          isMounted
        ) {
          fetchAllData(userId);
        }
      };

      pollInterval = setInterval(poll, 8000); // every 8 seconds
      poll(); // fetch immediately
    };

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/auth');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;
        
        if (isMounted) setUser(profile);

        // Start smart polling
        startPolling(session.user.id);
      } catch (err) {
        console.error('Initialization error:', err);
        if (isMounted) setError('Failed to load connection requests');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initialize();

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, []);

  const fetchActiveRequests = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('quick_connect_requests')
        .select('id, user_id, status, expires_at, created_at, room_id')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const request = data?.[0];
      if (!request) {
        setActiveRequest(null);
        return;
      }

      if (request.status === 'matched' && request.room_id) {
        isRedirectingRef.current = true;
        router.push(`/room/${request.room_id}`);
        return;
      }

      if (request.status !== 'available') {
        setActiveRequest(null);
        return;
      }

      setActiveRequest({
        ...request,
        user: {
          full_name: user?.full_name || 'Anonymous',
          avatar_url: user?.avatar_url || null
        }
      });
    } catch (err) {
      console.error('Error fetching active requests:', err);
    }
  };

  const fetchAvailableRequests = async (currentUserId: string) => {
    try {
      const { data: requests, error: reqError } = await supabase
        .from('quick_connect_requests')
        .select('id, created_at, user_id')
        .eq('status', 'available')
        .neq('user_id', currentUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (reqError) throw reqError;

      const userIds = requests.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const formattedRequests = requests.map(req => ({
        ...req,
        user: profileMap.get(req.user_id) || { full_name: 'Anonymous', avatar_url: null }
      }));

      setAvailableRequests(formattedRequests);
    } catch (err) {
      console.error('Error fetching available requests:', err);
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
      const roomId = `quick-connect-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      const { data: existingRequest } = await supabase
        .from('quick_connect_requests')
        .select('*')
        .eq('id', requestId)
        .eq('status', 'available')
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (!existingRequest) {
        setError('Request not found or no longer available');
        return;
      }
      
      const { error } = await supabase
        .from('quick_connect_requests')
        .update({
          status: 'matched',
          room_id: roomId,
          acceptor_id: user.id
        })
        .eq('id', requestId)
        .eq('status', 'available');
      
      if (error) throw error;
      
      isRedirectingRef.current = true;
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error('Failed to accept request:', err);
      setError('Failed to accept request. Please try again.');
    }
  };

const cancelRequest = async () => {
  if (!activeRequest || isRedirectingRef.current) return;

  try {
    const { error, data } = await supabase
      .from('quick_connect_requests')
      .update({ status: 'completed' })
      .eq('id', activeRequest.id)
      .eq('status', 'available') // 👈 Only cancel if still available
      .select(); // 👈 Select to see if any row was updated

    if (error) throw error;

    // If no rows were updated, it means the request was already taken or expired
    if (!data || data.length === 0) {
      // Treat as if it's no longer valid—clear it from UI
      setActiveRequest(null);
      setError('Request was already accepted or expired.');
      return;
    }

    // Success: clear the local state
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

  // ✅ Minimal loading state — no spinner
  if (isLoading) {
    return (
      <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <p style={{ color: '#78716c' }}>Connecting...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {error && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          maxWidth: '24rem',
          padding: '1rem',
          background: '#fee2e2',
          color: '#b91c1c',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          zIndex: 50,
        }}>
          {error}
        </div>
      )}

      <div style={styles.maxWidth}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Connect Now</h1>
            <p style={styles.subtitle}>
              Post a request when you need to talk, or accept someone else&apos;s request to connect immediately.
            </p>
          </div>
          
        </div>

        {/* Active Request */}
        {activeRequest ? (
          <div style={{ ...styles.requestCard, ...styles.sectionGap }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={styles.userAvatar}>
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '9999px', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#92400e', fontWeight: '700', fontSize: '1.125rem' }}>
                        {user?.full_name?.charAt(0) || <User size={20} />}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 style={{ fontWeight: '700', color: '#1c1917' }}>Your request is active</h2>
                    <p style={{ color: '#78716c' }}>Waiting for someone to connect with you</p>
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#fef3c7',
                  color: '#92400e',
                  borderRadius: '9999px',
                  padding: '0.25rem 0.75rem',
                  width: 'fit-content',
                  marginTop: '0.5rem',
                }}>
                  <Clock size={16} />
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                    Expires in {Math.ceil((new Date(activeRequest.expires_at).getTime() - Date.now()) / 60000)} minutes
                  </span>
                </div>
              </div>
              <button
                onClick={cancelRequest}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#e5e5e5',
                  color: '#1c1917',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel Request
              </button>
            </div>
          </div>
        ) : (
          <div style={{ ...styles.card, ...styles.sectionGap }}>
            <div style={{ ...styles.userAvatar, width: '4rem', height: '4rem', margin: '0 auto 1.5rem' }}>
              <MessageCircle size={32} style={{ color: '#d97706' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1c1917', marginBottom: '0.75rem' }}>
              I need to talk
            </h2>
            <p style={{ color: '#78716c', marginBottom: '1.5rem', maxWidth: '32rem', margin: '0 auto' }}>
              Post a request to connect with someone from the community who&apos;s available to listen right now. Your request will be visible to others for 10 minutes.
            </p>
            <button
              onClick={postRequest}
              disabled={isPostingRequest || isRedirectingRef.current}
              style={{
                ...styles.button,
                ...(isPostingRequest || isRedirectingRef.current ? styles.disabledButton : {}),
                margin: '0 auto',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
            >
              {isPostingRequest ? 'Creating request...' : <><Phone size={20} /> Post Request</>}
            </button>
          </div>
        )}

        {/* Available Requests */}
        <div style={{ ...styles.card, ...styles.sectionGap, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #f4f4f5', background: '#fafafa' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1c1917' }}>Available Connections</h2>
            <p style={{ color: '#78716c', marginTop: '0.25rem' }}>
              {availableRequests.length > 0
                ? 'Someone in the community needs to talk right now'
                : 'No active requests at the moment. Check back later or post your own request.'}
            </p>
          </div>

          {availableRequests.length > 0 ? (
            <div>
              {availableRequests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => !isRedirectingRef.current && acceptRequest(request.id)}
                  style={{
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fffbeb')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={styles.avatarPlaceholder}>
                        {request.user.avatar_url ? (
                          <img src={request.user.avatar_url} alt={request.user.full_name} style={{ width: '100%', height: '100%', borderRadius: '9999px', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ color: '#92400e', fontWeight: '600' }}>
                            {request.user.full_name?.charAt(0) || <User size={20} />}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 style={{ fontWeight: '600', color: '#1c1917' }}>{request.user.full_name}</h3>
                        <p style={{ color: '#78716c', fontSize: '0.875rem', marginTop: '0.125rem' }}>
                          Needs to talk • {timeAgo(request.created_at)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Phone size={24} style={{ color: '#d97706', marginLeft: '0.75rem' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#a8a29e' }}>
              <div style={{ ...styles.avatarPlaceholder, width: '3rem', height: '3rem', margin: '0 auto 1rem' }}>
                <MessageCircle size={24} style={{ color: '#d6d3d1' }} />
              </div>
              <p>No one is requesting a connection right now</p>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div style={{ ...styles.card, ...styles.sectionGap }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1c1917', marginBottom: '1rem' }}>
            How It Works
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(1, 1fr)',
            gap: '1.5rem',
            ...(typeof window !== 'undefined' && window.innerWidth >= 768 ? { gridTemplateColumns: 'repeat(3, 1fr)' } : {}),
          }}>
            {[
              { icon: <Phone size={24} />, title: 'Post Request', desc: 'Click "I need to talk" to let others know you\'re available' },
              { icon: <User size={24} />, title: 'Get Matched', desc: 'When someone accepts your request, you\'ll both be connected instantly' },
              { icon: <Clock size={24} />, title: '10 Minute Window', desc: 'Requests automatically expire after 10 minutes to keep connections fresh' }
            ].map((item, i) => (
              <div key={i} style={styles.gridItem}>
                <div style={{ ...styles.avatarPlaceholder, width: '3rem', height: '3rem', margin: '0 auto 0.75rem' }}>
                  {item.icon}
                </div>
                <h3 style={{ fontWeight: '600', color: '#1c1917' }}>{item.title}</h3>
                <p style={{ color: '#78716c', fontSize: '0.875rem', marginTop: '0.25rem' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}