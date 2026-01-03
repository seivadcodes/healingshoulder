﻿'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Phone, X, MessageCircle, Clock, Users, User } from 'lucide-react';

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
  groupButton: {
    background: '#3b82f6',
    color: '#fff',
  },
  disabledButton: {
    background: '#fbbf24',
    cursor: 'not-allowed',
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
  groupRequestCard: {
    background: '#dbeafe',
    border: '1px solid #93c5fd',
    borderRadius: '0.75rem',
    padding: '1.5rem',
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
  const [activeOneOnOne, setActiveOneOnOne] = useState<any>(null);
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const [availableOneOnOne, setAvailableOneOnOne] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const [isPostingOneOnOne, setIsPostingOneOnOne] = useState(false);
  const [isPostingGroup, setIsPostingGroup] = useState(false);
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchAllData = async (userId: string) => {
      try {
        await fetchAvailableOneOnOne(userId);
        await fetchAvailableGroups(userId);
        await fetchActiveOneOnOne(userId);
        await fetchActiveGroup(userId);
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    const startPolling = (userId: string) => {
      if (pollInterval) return;
      const poll = () => {
        if (!isRedirectingRef.current && !document.hidden && isMounted) {
          fetchAllData(userId);
        }
      };
      pollInterval = setInterval(poll, 8000);
      poll();
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
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // === ONE-ON-ONE LOGIC ===
  const fetchActiveOneOnOne = async (userId: string) => {
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
        setActiveOneOnOne(null);
        return;
      }
      if (request.status === 'matched' && request.room_id) {
        isRedirectingRef.current = true;
        router.push(`/room/${request.room_id}`);
        return;
      }
      if (request.status !== 'available') {
        setActiveOneOnOne(null);
        return;
      }
      setActiveOneOnOne({
        ...request,
        user: { full_name: user?.full_name || 'Anonymous', avatar_url: user?.avatar_url || null },
      });
    } catch (err) {
      console.error('Error fetching active 1:1:', err);
    }
  };

  const fetchAvailableOneOnOne = async (currentUserId: string) => {
    try {
      const { data: requests, error: reqError } = await supabase
        .from('quick_connect_requests')
        .select('id, created_at, user_id')
        .eq('status', 'available')
        .neq('user_id', currentUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      if (reqError) throw reqError;
      const userIds = requests.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const formatted = requests.map((req) => ({
        ...req,
        type: 'one-on-one',
        user: profileMap.get(req.user_id) || { full_name: 'Anonymous', avatar_url: null },
      }));
      setAvailableOneOnOne(formatted);
    } catch (err) {
      console.error('Error fetching available 1:1:', err);
    }
  };

  const postOneOnOne = async () => {
    if (!user || activeOneOnOne || activeGroup || isPostingOneOnOne || isRedirectingRef.current) return;
    setIsPostingOneOnOne(true);
    setError(null);
    try {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('quick_connect_requests')
        .insert({
          user_id: user.id,
          status: 'available',
          expires_at: expiresAt,
        });
      if (error) throw error;
      setActiveOneOnOne({
        id: Date.now().toString(),
        user_id: user.id,
        status: 'available',
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        user: { full_name: user.full_name, avatar_url: user.avatar_url },
      });
    } catch (err) {
      console.error('Failed to post 1:1 request:', err);
      setError('Failed to create one-on-one request.');
    } finally {
      setIsPostingOneOnOne(false);
    }
  };

  const cancelOneOnOne = async () => {
    if (!activeOneOnOne || isRedirectingRef.current) return;
    try {
      const { error, data } = await supabase
        .from('quick_connect_requests')
        .update({ status: 'completed' })
        .eq('id', activeOneOnOne.id)
        .eq('status', 'available')
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        setActiveOneOnOne(null);
        setError('One-on-one request was already accepted or expired.');
        return;
      }
      setActiveOneOnOne(null);
    } catch (err) {
      console.error('Failed to cancel 1:1:', err);
      setError('Failed to cancel one-on-one request.');
    }
  };

  // === GROUP LOGIC ===
  const fetchActiveGroup = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('quick_group_requests')
        .select('id, user_id, status, expires_at, created_at, room_id')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const request = data?.[0];
      if (!request) {
        setActiveGroup(null);
        return;
      }
      if (request.status === 'matched' && request.room_id) {
        isRedirectingRef.current = true;
        router.push(`/room/${request.room_id}`);
        return;
      }
      if (request.status !== 'available') {
        setActiveGroup(null);
        return;
      }
      setActiveGroup({
        ...request,
        user: { full_name: user?.full_name || 'Anonymous', avatar_url: user?.avatar_url || null },
      });
    } catch (err) {
      console.error('Error fetching active group:', err);
    }
  };

  const fetchAvailableGroups = async (currentUserId: string) => {
    try {
      const { data: requests, error: reqError } = await supabase
        .from('quick_group_requests')
        .select('id, created_at, user_id')
        .eq('status', 'available')
        .neq('user_id', currentUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      if (reqError) throw reqError;
      const userIds = requests.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const formatted = requests.map((req) => ({
        ...req,
        type: 'group',
        user: profileMap.get(req.user_id) || { full_name: 'Anonymous', avatar_url: null },
      }));
      setAvailableGroups(formatted);
    } catch (err) {
      console.error('Error fetching available groups:', err);
    }
  };

  const postGroup = async () => {
    if (!user || activeOneOnOne || activeGroup || isPostingGroup || isRedirectingRef.current) return;
    setIsPostingGroup(true);
    setError(null);
    try {
      const roomId = `group-call-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Insert group request WITH room_id
      const { error: insertErr } = await supabase
        .from('quick_group_requests')
        .insert({
          user_id: user.id,
          status: 'available',
          expires_at: expiresAt,
          room_id: roomId,
        });

      if (insertErr) throw insertErr;

      // Add host to room_participants
      const { error: participantErr } = await supabase
        .from('room_participants')
        .insert({
          room_id: roomId,
          user_id: user.id,
          role: 'host',
        });

      if (participantErr) throw participantErr;

      // ✅ REDIRECT HOST IMMEDIATELY — like one-on-one
      isRedirectingRef.current = true;
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error('Failed to post group request:', err);
      setError('Failed to create group call request.');
    } finally {
      setIsPostingGroup(false);
    }
  };

  const cancelGroup = async () => {
    if (!activeGroup || isRedirectingRef.current) return;
    try {
      const { error, data } = await supabase
        .from('quick_group_requests')
        .update({ status: 'completed' })
        .eq('id', activeGroup.id)
        .eq('status', 'available')
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        setActiveGroup(null);
        setError('Group request was already accepted or expired.');
        return;
      }
      setActiveGroup(null);
    } catch (err) {
      console.error('Failed to cancel group:', err);
      setError('Failed to cancel group request.');
    }
  };

  const acceptOneOnOne = async (requestId: string) => {
    if (!user || isRedirectingRef.current) return;
    try {
      const roomId = `quick-connect-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const { data: existing } = await supabase
        .from('quick_connect_requests')
        .select('*')
        .eq('id', requestId)
        .eq('status', 'available')
        .gt('expires_at', new Date().toISOString())
        .single();
      if (!existing) {
        setError('One-on-one request not found or expired.');
        return;
      }

      const { error: updateErr } = await supabase
        .from('quick_connect_requests')
        .update({
          status: 'matched',
          room_id: roomId,
          acceptor_id: user.id,
        })
        .eq('id', requestId)
        .eq('status', 'available');

      if (updateErr) throw updateErr;

      await supabase.from('room_participants').upsert([
        { room_id: roomId, user_id: existing.user_id, role: 'participant' },
        { room_id: roomId, user_id: user.id, role: 'participant' }
      ], { onConflict: 'room_id,user_id' });

      isRedirectingRef.current = true;
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error('Failed to accept 1:1:', err);
      setError('Failed to accept one-on-one request.');
    }
  };

  const acceptGroup = async (requestId: string) => {
    if (!user || isRedirectingRef.current) return;
    try {
      const { data: existing } = await supabase
        .from('quick_group_requests')
        .select('user_id, room_id, status')
        .eq('id', requestId)
        .eq('status', 'available')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!existing) {
        setError('Group request not found or expired.');
        return;
      }

      let roomId = existing.room_id;
      if (!roomId) {
        roomId = `group-call-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const { error: updateErr } = await supabase
          .from('quick_group_requests')
          .update({ status: 'matched', room_id: roomId })
          .eq('id', requestId)
          .eq('status', 'available');
        if (updateErr) throw updateErr;
      }

      await supabase.from('room_participants').upsert(
        { room_id: roomId, user_id: user.id, role: 'participant' },
        { onConflict: 'room_id,user_id' }
      );

      await supabase.from('room_participants').upsert(
        { room_id: roomId, user_id: existing.user_id, role: 'host' },
        { onConflict: 'room_id,user_id' }
      );

      isRedirectingRef.current = true;
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error('Failed to accept group:', err);
      setError('Failed to join group call.');
    }
  };

const timeAgo = (timestamp: string) => {
  const now = new Date();
  const posted = new Date(timestamp);
  const diffSeconds = Math.floor((now.getTime() - posted.getTime()) / 1000);

  if (diffSeconds < 60) {
    return 'now';
  }
  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.floor(diffSeconds / 3600);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
};

  if (isLoading) {
    return (
      <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <p style={{ color: '#78716c' }}>Connecting...</p>
      </div>
    );
  }

  const allRequests = [...availableOneOnOne, ...availableGroups].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div style={styles.container}>
      {error && (
        <div
          style={{
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
          }}
        >
          {error}
        </div>
      )}
      <div style={styles.maxWidth}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Connect Now</h1>
            <p style={styles.subtitle}>
              Post a one-on-one or group request when you need to talk — or join someone else’s.
            </p>
          </div>
        </div>

        {/* One-on-One Request */}
        {activeOneOnOne ? (
          <div style={{ ...styles.requestCard, ...styles.sectionGap }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={styles.userAvatar}>
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '9999px', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#92400e', fontWeight: '700', fontSize: '1.125rem' }}>
                        {user?.full_name?.charAt(0) || '👤'}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 style={{ fontWeight: '700', color: '#1c1917' }}>Your 1:1 request is active</h2>
                    <p style={{ color: '#78716c' }}>Waiting for someone to connect with you</p>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#fef3c7',
                    color: '#92400e',
                    borderRadius: '9999px',
                    padding: '0.25rem 0.75rem',
                    width: 'fit-content',
                    marginTop: '0.5rem',
                  }}
                >
                  <Clock size={16} />
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                    Expires in {Math.ceil((new Date(activeOneOnOne.expires_at).getTime() - Date.now()) / 60000)} min
                  </span>
                </div>
              </div>
              <button
                onClick={cancelOneOnOne}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#e5e5e5',
                  color: '#1c1917',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ ...styles.card, ...styles.sectionGap }}>
            <div style={{ ...styles.userAvatar, width: '4rem', height: '4rem', margin: '0 auto 1.5rem' }}>
              <MessageCircle size={32} style={{ color: '#d97706' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1c1917', marginBottom: '0.75rem' }}>
              Need to Talk 1:1?
            </h2>
            <p style={{ color: '#78716c', marginBottom: '1.5rem', maxWidth: '32rem', margin: '0 auto' }}>
              Post a request to connect with someone who’s available to listen right now.
            </p>
            <button
              onClick={postOneOnOne}
              disabled={isPostingOneOnOne || activeGroup || isRedirectingRef.current}
              style={{
                ...styles.button,
                ...(isPostingOneOnOne || activeGroup || isRedirectingRef.current ? styles.disabledButton : {}),
                margin: '0 auto',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
            >
              {isPostingOneOnOne ? 'Creating...' : <><Phone size={20} /> Post 1:1 Request</>}
            </button>
          </div>
        )}

        {/* Group Request */}
        {activeGroup ? (
          <div style={{ ...styles.groupRequestCard, ...styles.sectionGap }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={styles.userAvatar}>
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '9999px', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#2563eb', fontWeight: '700', fontSize: '1.125rem' }}>
                        {user?.full_name?.charAt(0) || '👥'}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 style={{ fontWeight: '700', color: '#1c1917' }}>Your group call is active</h2>
                    <p style={{ color: '#1e40af' }}>Waiting for others to join your group</p>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#dbeafe',
                    color: '#1e40af',
                    borderRadius: '9999px',
                    padding: '0.25rem 0.75rem',
                    width: 'fit-content',
                    marginTop: '0.5rem',
                  }}
                >
                  <Clock size={16} />
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                    Expires in {Math.ceil((new Date(activeGroup.expires_at).getTime() - Date.now()) / 60000)} min
                  </span>
                </div>
              </div>
              <button
                onClick={cancelGroup}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dbeafe',
                  color: '#1e40af',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ ...styles.card, ...styles.sectionGap }}>
            <div style={{ ...styles.userAvatar, width: '4rem', height: '4rem', margin: '0 auto 1.5rem' }}>
              <Users size={32} style={{ color: '#3b82f6' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1c1917', marginBottom: '0.75rem' }}>
              Start a Group Call?
            </h2>
            <p style={{ color: '#78716c', marginBottom: '1.5rem', maxWidth: '32rem', margin: '0 auto' }}>
              Invite others to join a supportive group conversation. Anyone can join while it’s active.
            </p>
            <button
              onClick={postGroup}
              disabled={isPostingGroup || activeOneOnOne || isRedirectingRef.current}
              style={{
                ...styles.button,
                ...styles.groupButton,
                ...(isPostingGroup || activeOneOnOne || isRedirectingRef.current ? styles.disabledButton : {}),
                margin: '0 auto',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
            >
              {isPostingGroup ? 'Creating...' : <><Users size={20} /> Request Group Call</>}
            </button>
          </div>
        )}

        {/* Available Requests */}
        <div style={{ ...styles.card, ...styles.sectionGap, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #f4f4f5', background: '#fafafa' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1c1917' }}>Available Connections</h2>
            <p style={{ color: '#78716c', marginTop: '0.25rem' }}>
              {allRequests.length > 0
                ? 'Join a one-on-one chat or a group call'
                : 'No active requests right now. Be the first to post one!'}
            </p>
          </div>
          {allRequests.length > 0 ? (
            <div>
              {allRequests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => !isRedirectingRef.current && (request.type === 'group' ? acceptGroup(request.id) : acceptOneOnOne(request.id))}
                  style={{ padding: '1.25rem', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = request.type === 'group' ? '#dbeafe' : '#fffbeb')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={styles.avatarPlaceholder}>
                        {request.user.avatar_url ? (
                          <img src={request.user.avatar_url} alt={request.user.full_name} style={{ width: '100%', height: '100%', borderRadius: '9999px', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ color: request.type === 'group' ? '#2563eb' : '#92400e', fontWeight: '600' }}>
                            {request.user.full_name?.charAt(0) || (request.type === 'group' ? '👥' : '👤')}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 style={{ fontWeight: '600', color: '#1c1917' }}>
                          {request.user.full_name} {request.type === 'group' ? ' (Group)' : ''}
                        </h3>
                        <p style={{ color: '#78716c', fontSize: '0.875rem', marginTop: '0.125rem' }}>
                          {request.type === 'group' ? 'Group call open' : 'Needs to talk'} • {timeAgo(request.created_at)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: '1rem' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          !isRedirectingRef.current && (request.type === 'group' ? acceptGroup(request.id) : acceptOneOnOne(request.id));
                        }}
                        style={{
                          background: request.type === 'group' ? '#3b82f6' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '9999px',
                          padding: '0.375rem 1rem',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = request.type === 'group' ? '#2563eb' : '#059669')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = request.type === 'group' ? '#3b82f6' : '#10b981')
                        }
                      >
                        <Phone size={16} />
                        Join
                      </button>
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1c1917', marginBottom: '1rem' }}>How It Works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '1.5rem' }}>
            <div style={styles.gridItem}>
              <div style={{ ...styles.avatarPlaceholder, width: '3rem', height: '3rem', margin: '0 auto 0.75rem' }}>
                <Phone size={24} />
              </div>
              <h3 style={{ fontWeight: '600', color: '#1c1917' }}>1:1 Request</h3>
              <p style={{ color: '#78716c', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Post a private request to talk one-on-one with someone supportive.
              </p>
            </div>
            <div style={styles.gridItem}>
              <div style={{ ...styles.avatarPlaceholder, width: '3rem', height: '3rem', margin: '0 auto 0.75rem' }}>
                <Users size={24} />
              </div>
              <h3 style={{ fontWeight: '600', color: '#1c1917' }}>Group Call</h3>
              <p style={{ color: '#78716c', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Start or join an open group conversation on grief or healing.
              </p>
            </div>
            <div style={styles.gridItem}>
              <div style={{ ...styles.avatarPlaceholder, width: '3rem', height: '3rem', margin: '0 auto 0.75rem' }}>
                <Clock size={24} />
              </div>
              <h3 style={{ fontWeight: '600', color: '#1c1917' }}>10-Min Window</h3>
              <p style={{ color: '#78716c', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Requests auto-expire after 10 minutes to keep the space fresh and responsive.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}