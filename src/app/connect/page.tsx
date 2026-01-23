'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Phone, MessageCircle, Clock, Users } from 'lucide-react';
import Image from 'next/image';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  accepts_calls?: boolean;
}

interface OneOnOneRequest {
  id: string;
  user_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  room_id?: string;
  acceptor_id?: string;
  user?: UserProfile;
  context?: string | null;

}

interface GroupRequest {
  id: string;
  user_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  room_id?: string;
  user?: UserProfile;
  context?: string | null;

}

interface AvailableRequest extends OneOnOneRequest, GroupRequest {
  type: 'one-on-one' | 'group';
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom, #fffbeb, #f4f4f5)',
    padding: '3rem 1rem 1.5rem',
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeOneOnOne, setActiveOneOnOne] = useState<OneOnOneRequest | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupRequest | null>(null);
  const [availableOneOnOne, setAvailableOneOnOne] = useState<AvailableRequest[]>([]);
  const [availableGroups, setAvailableGroups] = useState<AvailableRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const [isPostingOneOnOne, setIsPostingOneOnOne] = useState(false);
  const [isPostingGroup, setIsPostingGroup] = useState(false);
  const isRedirectingRef = useRef(false);
 const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);
 

  const [showContextModal, setShowContextModal] = useState<'one-on-one' | 'group' | null>(null);
  const [tempContext, setTempContext] = useState('');

  const fetchActiveOneOnOne = useCallback(async (userId: string) => {
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
        user: { id: userId, full_name: user?.full_name || 'Anonymous', avatar_url: user?.avatar_url || null },
      });
    } catch (err) {
      console.error('Error fetching active 1:1:', err);
    }
  }, [router, supabase, user]);

  const fetchActiveGroup = useCallback(async (userId: string) => {
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
        user: { id: userId, full_name: user?.full_name || 'Anonymous', avatar_url: user?.avatar_url || null },
      });
    } catch (err) {
      console.error('Error fetching active group:', err);
    }
  }, [router, supabase, user]);

  const fetchAvailableOneOnOne = useCallback(async (currentUserId: string, acceptsCalls: boolean | null) => {
    if (acceptsCalls === false) {
      setAvailableOneOnOne([]);
      return;
    }

    try {
      const { data: requests, error: reqError } = await supabase
        .from('quick_connect_requests')
        .select('id, created_at, user_id, status, expires_at, context') // ✅ added context
        .eq('status', 'available')
        .neq('user_id', currentUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (reqError) throw reqError;

      const userIds = requests.map((r) => r.user_id);
      if (userIds.length === 0) {
        setAvailableOneOnOne([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      );

      const formatted = requests
        .map((req) => ({
          ...req,
          type: 'one-on-one' as const,
          user: profileMap.get(req.user_id) || { id: req.user_id, full_name: 'Anonymous', avatar_url: null },
        })) as AvailableRequest[];

      setAvailableOneOnOne(formatted);
    } catch (err) {
      console.error('Error fetching available 1:1:', err);
      setAvailableOneOnOne([]);
    }
  }, [supabase]);

  const fetchAvailableGroups = useCallback(async (currentUserId: string, acceptsCalls: boolean | null) => {
    if (acceptsCalls === false) {
      setAvailableGroups([]);
      return;
    }

    try {
      const { data: requests, error: reqError } = await supabase
        .from('quick_group_requests')
        .select('id, created_at, user_id, status, expires_at, context') // ✅ added context
        .eq('status', 'available')
        .neq('user_id', currentUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (reqError) throw reqError;

      const userIds = requests.map((r) => r.user_id);
      if (userIds.length === 0) {
        setAvailableGroups([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      );

      const formatted = requests
        .map((req) => ({
          ...req,
          type: 'group' as const,
          user: profileMap.get(req.user_id) || { id: req.user_id, full_name: 'Anonymous', avatar_url: null },
        })) as AvailableRequest[];

      setAvailableGroups(formatted);
    } catch (err) {
      console.error('Error fetching available groups:', err);
      setAvailableGroups([]);
    }
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchAllData = async (userId: string, acceptsCalls: boolean | null) => {
      if (acceptsCalls === false) {
        setAvailableOneOnOne([]);
        setAvailableGroups([]);
        return;
      }
      try {
        await fetchAvailableOneOnOne(userId, acceptsCalls);
        await fetchAvailableGroups(userId, acceptsCalls);
        await fetchActiveOneOnOne(userId);
        await fetchActiveGroup(userId);
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    const startPolling = (userId: string, acceptsCalls: boolean | null) => {
      if (pollInterval) return;
      const poll = () => {
        if (!isRedirectingRef.current && !document.hidden && isMounted) {
          fetchAllData(userId, acceptsCalls);
        }
      };
      pollInterval = setInterval(poll, 8000);
      poll(); // initial call
    };

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/auth');
          return;
        }

        // 🔧 Fix: remove space in 'full_name'
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, accepts_calls') // ✅ corrected
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;

        if (isMounted) {
          setUser(profile);
          startPolling(session.user.id, profile.accepts_calls ?? null);
        }
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
  }, [
    fetchActiveOneOnOne,
    fetchActiveGroup,
    fetchAvailableOneOnOne,
    fetchAvailableGroups,
    router,
    supabase
  ]);

  // === ONE-ON-ONE LOGIC ===
  const postOneOnOneWithContext = async (context: string) => {
  if (!user || activeOneOnOne || activeGroup || isPostingOneOnOne || isRedirectingRef.current) return;
  setIsPostingOneOnOne(true);
  setError(null);

  try {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('quick_connect_requests')
      .insert({
        user_id: user.id,
        status: 'available',
        expires_at: expiresAt,
        context: context.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    // ✅ Create targeted notifications for other users
    const { error: notifyError } = await supabase.rpc('create_targeted_notifications', {
      req_type: 'one_on_one',
      req_id: data.id,
    });

    if (notifyError) {
      console.warn('Non-critical: failed to create notifications:', notifyError.message);
      // Still proceed — request was created
    }
    console.log('Calling create_targeted_notifications with:', {
  req_type: 'one_on_one',
  req_id: data.id,
});

    setActiveOneOnOne({
      ...data,
      user: {
        id: user.id,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error('Failed to post 1:1 request:', err);
    setError('Failed to create one-on-one request.');
  } finally {
    setIsPostingOneOnOne(false);
  }
};

  const postGroupWithContext = async (context: string) => {
  if (!user || activeOneOnOne || activeGroup || isPostingGroup || isRedirectingRef.current) return;
  setIsPostingGroup(true);
  setError(null);

  try {
    const roomId = `group-call-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase
      .from('quick_group_requests')
      .insert({
        user_id: user.id,
        status: 'available',
        expires_at: expiresAt,
        room_id: roomId,
        context: context.trim() || null,
      });

    if (insertErr) throw insertErr;

    const { error: participantErr } = await supabase
      .from('room_participants')
      .insert({
        room_id: roomId,
        user_id: user.id,
        role: 'host',
      });

    if (participantErr) throw participantErr;

    // ✅ Create targeted notifications for other users
    // First, get the request ID (since we didn't select it above)
    const { data: reqData, error: fetchErr } = await supabase
      .from('quick_group_requests')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single();

    if (!fetchErr && reqData?.id) {
      const { error: notifyError } = await supabase.rpc('create_targeted_notifications', {
        req_type: 'group',
        req_id: reqData.id,
      });

      if (notifyError) {
        console.warn('Non-critical: failed to create group notifications:', notifyError.message);
      }
    }

    isRedirectingRef.current = true;
    router.push(`/room/${roomId}`);
  } catch (err) {
    console.error('Failed to post group request:', err);
    setError('Failed to create group call request.');
  } finally {
    setIsPostingGroup(false);
  }
};

  const cancelOneOnOne = async () => {
  if (!activeOneOnOne || isRedirectingRef.current) return;
  setActiveOneOnOne(null); // optimistic

  try {
    const { error } = await supabase
      .from('quick_connect_requests')
      .update({ status: 'completed' })
      .eq('id', activeOneOnOne.id)
      .eq('status', 'available');

    // ✅ Delete associated notifications
    if (!error) {
      await supabase
        .from('notifications')
        .delete()
        .eq('source_id', activeOneOnOne.id)
        .eq('type', 'one_on_one_request');
    }
  } catch (err) {
    console.error('Cancel 1:1 error:', err);
  }
};



  const cancelGroup = async () => {
  if (!activeGroup || isRedirectingRef.current) return;

  try {
    const { data, error } = await supabase
      .from('quick_group_requests')
      .update({ status: 'completed' })
      .eq('id', activeGroup.id)
      .eq('status', 'available')
      .select();

    if (error) throw error;

    if (data && data.length > 0) {
      // ✅ Delete notifications
      await supabase
        .from('notifications')
        .delete()
        .eq('source_id', activeGroup.id)
        .eq('type', 'group_request');
    }

    setActiveGroup(null);
  } catch (err) {
    console.error('Cancel group error:', err);
    setError('Failed to cancel group request.');
  }
};

 const acceptOneOnOne = async (requestId: string) => {
  if (!user || isRedirectingRef.current || acceptingRequestId) return;
  
  setAcceptingRequestId(requestId); // 👈 show loading on this button
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
      setAcceptingRequestId(null);
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
  } finally {
    setAcceptingRequestId(null); // 👈 reset after success or error
  }
};

const acceptGroup = async (requestId: string) => {
  if (!user || isRedirectingRef.current || acceptingRequestId) return;
  
  setAcceptingRequestId(requestId);
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
      setAcceptingRequestId(null);
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
  } finally {
    setAcceptingRequestId(null);
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
      <div style={{ ...styles.container, paddingTop: '5rem', display: 'flex', justifyContent: 'center', padding: '2rem' }}>
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
              Post a one-on-one or group request when you need to talk — or join someone else&#39;s.
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
  <Image
    src={`/api/media/avatars/${user.avatar_url}`}
    alt={user.full_name}
    width={48}
    height={48}
    className="rounded-full"
    onError={(e) => (e.currentTarget.style.display = 'none')}
  />
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
              Post a request to connect with someone who&#39;s available to listen right now.
            </p>
            <>
              <button
  onClick={() => setShowContextModal('one-on-one')}
  disabled={isPostingOneOnOne || !!activeGroup || isRedirectingRef.current}
  style={{
    ...styles.button,
    ...(isPostingOneOnOne || activeGroup || isRedirectingRef.current ? styles.disabledButton : {}),
    margin: '0 auto',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  }}
>
  <Phone size={20} /> Post 1:1 Request
</button>
            </>
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
                      <Image src={user.avatar_url} alt={user.full_name} width={48} height={48} className="rounded-full" />
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
              Invite others to join a supportive group conversation. Anyone can join while it&#39;s active.
            </p>
            <button
  onClick={() => setShowContextModal('group')}
  disabled={isPostingGroup || !!activeOneOnOne || isRedirectingRef.current}
  style={{
    ...styles.button,
    ...styles.groupButton,
    ...(isPostingGroup || activeOneOnOne || isRedirectingRef.current ? styles.disabledButton : {}),
    margin: '0 auto',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  }}
>
  <Users size={20} /> Request Group Call
</button>
          </div>
        )}

        {/* Available Requests */}
        <div style={{ ...styles.card, ...styles.sectionGap, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #f4f4f5', background: '#fafafa' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1c1917' }}>Available Requests</h2>
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
  style={{
    padding: '1.5rem',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    borderRadius: '1rem',
    background: '#fff',
    border: '1px solid #f4f4f5',
    marginBottom: '0.75rem',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'scale(1.01)';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = 'none';
  }}
>
  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
    {/* Avatar */}
    <div style={{
      width: '3rem',
      height: '3rem',
      borderRadius: '9999px',
      background: '#fef3c7',
      border: '2px solid #fcd34d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {request.user?.avatar_url ? (
  <Image
    src={`/api/media/avatars/${request.user.avatar_url}`}
    alt={request.user.full_name}
    width={48}
    height={48}
    className="rounded-full"
    onError={(e) => (e.currentTarget.style.display = 'none')}
  />
      ) : (
        <span style={{ color: '#92400e', fontWeight: '700', fontSize: '1.125rem' }}>
          {request.user?.full_name?.charAt(0) || '👤'}
        </span>
      )}
    </div>

    {/* Content */}
    <div style={{ flex: 1 }}>
      <h3 style={{
        fontWeight: '700',
        color: '#1c1917',
        fontSize: '1.125rem',
        marginBottom: '0.25rem',
      }}>
        {request.user?.full_name} {request.type === 'group' ? ' (Group)' : ''}
      </h3>

      <p style={{
        color: '#78716c',
        fontSize: '0.875rem',
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span>{request.type === 'group' ? 'Group call open' : 'Looking to talk now'}</span>
        <span>•</span>
        <span>{timeAgo(request.created_at)}</span>
      </p>

      {/* Context */}
      {request.context && (
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e5e5',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          fontSize: '0.875rem',
          color: '#57534e',
          fontStyle: 'italic',
          lineHeight: 1.5,
          marginBottom: '0.75rem',
          maxWidth: '100%',
          wordBreak: 'break-word',
        }}>
          “{request.context}”
        </div>
      )}

      {/* Join Button */}
      <button
  onClick={(e) => {
    e.stopPropagation();
    if (!isRedirectingRef.current) {
      if (request.type === 'group') {
        acceptGroup(request.id);
      } else {
        acceptOneOnOne(request.id);
      }
    }
  }}
  disabled={acceptingRequestId === request.id} // 👈 disable while loading
  style={{
    background: acceptingRequestId === request.id
      ? '#9ca3af' // grayed out
      : request.type === 'group'
        ? '#3b82f6'
        : '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '9999px',
    padding: '0.5rem 1rem',
    fontWeight: '600',
    fontSize: '0.875rem',
    cursor: acceptingRequestId === request.id ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'background 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  }}
  onMouseEnter={(e) => {
    if (acceptingRequestId !== request.id) {
      e.currentTarget.style.background = request.type === 'group' ? '#2563eb' : '#059669';
    }
  }}
  onMouseLeave={(e) => {
    if (acceptingRequestId !== request.id) {
      e.currentTarget.style.background = request.type === 'group' ? '#3b82f6' : '#10b981';
    }
  }}
>
  {acceptingRequestId === request.id ? (
    <>
      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
        <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
      </svg>
      Connecting...
    </>
  ) : (
    <>
      <Phone size={16} />
      Connect
    </>
  )}
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
                Requests auto-expire after 10 minutes.
              </p>
            </div>
          </div>
        </div>

        {/* Context Modal */}
          {showContextModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 100,
              }}
              onClick={() => setShowContextModal(null)}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  width: '90%',
                  maxWidth: '28rem',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  position: 'relative',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ fontWeight: '700', color: '#1c1917', marginBottom: '0.5rem' }}>
                  Why are you reaching out?
                </h3>
                <p style={{ color: '#78716c', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  This helps others understand what to expect. (Optional, max 280 chars)
                </p>
                <textarea
                  autoFocus
                  value={tempContext}
                  onChange={(e) => setTempContext(e.target.value.slice(0, 280))}
                  placeholder="e.g., I lost my dog yesterday and feel overwhelmed..."
                  maxLength={280}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e5e5',
                    fontSize: '0.875rem',
                    resize: 'none',
                    marginBottom: '0.75rem',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowContextModal(null)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#f4f4f5',
                      color: '#1c1917',
                      border: 'none',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
  onClick={() => {
    if (showContextModal === 'one-on-one') {
      postOneOnOneWithContext(tempContext);
    } else if (showContextModal === 'group') {
      postGroupWithContext(tempContext);
    }
    setTempContext('');
    setShowContextModal(null);
  }}
  style={{
    padding: '0.5rem 1rem',
    background: showContextModal === 'group' ? '#3b82f6' : '#d97706',
    color: '#fff',
    border: 'none',
    borderRadius: '9999px',
    cursor: 'pointer',
    fontWeight: '600',
  }}
>
  Continue
</button>
                </div>
              </div>
            </div>
          )}
      </div>

    </div>

  );
}
