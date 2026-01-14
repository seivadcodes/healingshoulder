'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Phone, X } from 'lucide-react'; // Removed unused Users import
import Image from 'next/image';

// Define structured notification types for call requests
interface CallRequestNotification {
  id: string;
  type: 'one_on_one_request' | 'group_request';
  source_id: string;
  read: boolean;
  created_at: string;

  // Fetched via joins
  requester_id: string;
  requester_name: string | null;
  requester_avatar: string | null;
  context: string | null;
  expires_at: string;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function NotificationModal({ isOpen, onClose }: Props) {
  const [notifications, setNotifications] = useState<CallRequestNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session) {
          console.error('Session error:', sessionError);
          onClose();
          return;
        }

        const userId = sessionData.session.user.id;

        // Fetch unread call request notifications with full context
        const { data, error } = await supabase
          .from('notifications')
          .select(`
            id,
            type,
            source_id,
            read,
            created_at,
            one_on_one:quick_connect_requests!inner(
              user_id,
              context,
              expires_at
            ),
            group_req:quick_group_requests!inner(
              user_id,
              context,
              expires_at
            )
          `)
          .eq('user_id', userId)
          .in('type', ['one_on_one_request', 'group_request'])
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Extract unique requester IDs
        const requesterIds = data.flatMap((n) => {
          if (n.type === 'one_on_one_request' && n.one_on_one.length > 0) {
            return n.one_on_one[0].user_id;
          } else if (n.type === 'group_request' && n.group_req.length > 0) {
            return n.group_req[0].user_id;
          }
          return [];
        }).filter(Boolean) as string[];

        let profiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
        if (requesterIds.length > 0) {
          const { data: profileData, error: profileError } = await supabase // Fixed destructuring
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', requesterIds);
            
          if (profileError) throw profileError;
          
          profiles = Object.fromEntries(
            profileData.map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }])
          );
        }

        const formatted = data.map((n) => {
          const isOneOnOne = n.type === 'one_on_one_request';
          const reqArray = isOneOnOne ? n.one_on_one : n.group_req;
          const req = reqArray && reqArray.length > 0 ? reqArray[0] : null; // Handle array response
          const profile = req ? profiles[req.user_id] : null;

          return {
            id: n.id,
            type: n.type,
            source_id: n.source_id,
            read: n.read,
            created_at: n.created_at,
            requester_id: req?.user_id || '',
            requester_name: profile?.full_name || 'Anonymous',
            requester_avatar: profile?.avatar_url || null,
            context: req?.context || null,
            expires_at: req?.expires_at || '',
          };
        }).filter(n => new Date(n.expires_at) > new Date());

        setNotifications(formatted);
      } catch (err) {
        console.error('Failed to load notifications:', err);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [isOpen, onClose, supabase]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleAccept = async (notif: CallRequestNotification) => {
    markAsRead(notif.id);

    const currentUser = (await supabase.auth.getUser()).data.user;
    if (!currentUser) return;

    let roomId: string | undefined;

    if (notif.type === 'one_on_one_request') {
      // Create room and match
      roomId = `quick-connect-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const { error: updateErr } = await supabase
        .from('quick_connect_requests')
        .update({
          status: 'matched',
          room_id: roomId,
          acceptor_id: currentUser.id,
        })
        .eq('id', notif.source_id)
        .eq('status', 'available');

      if (!updateErr) {
        await supabase.from('room_participants').upsert([
          { room_id: roomId, user_id: notif.requester_id, role: 'participant' },
          { room_id: roomId, user_id: currentUser.id, role: 'participant' }
        ], { onConflict: 'room_id,user_id' });
      }
    } else {
      // Group: get or create room_id
      const { data: groupData, error: groupError } = await supabase // Fixed destructuring
        .from('quick_group_requests')
        .select('room_id')
        .eq('id', notif.source_id)
        .single();

      if (groupError) {
        console.error('Group fetch error:', groupError);
        return;
      }

      roomId = groupData?.room_id;
      if (!roomId) {
        roomId = `group-call-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        await supabase
          .from('quick_group_requests')
          .update({ room_id: roomId, status: 'matched' })
          .eq('id', notif.source_id);
      }

      if (roomId) {
        await supabase.from('room_participants').upsert(
          { room_id: roomId, user_id: currentUser.id, role: 'participant' },
          { onConflict: 'room_id,user_id' }
        );
      }
    }

    if (roomId) {
      onClose();
      router.push(`/room/${roomId}`);
    }
  };

  const handleDismiss = async (id: string) => {
    // Optional: just mark as read, or delete entirely
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const timeAgo = (dateString: string) => {
    const now = new Date();
    const posted = new Date(dateString);
    const diffSec = Math.floor((now.getTime() - posted.getTime()) / 1000);
    if (diffSec < 60) return 'now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
        zIndex: 2000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '400px',
          maxHeight: '70vh',
          overflow: 'hidden',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
            Notifications
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#64748b',
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 0', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
              No new notifications
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #f1f5f9',
                    position: 'relative',
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '20px',
                      top: '14px',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #fcd34d',
                    }}
                  >
                    {n.requester_avatar ? (
                      <Image
                        src={n.requester_avatar}
                        alt={n.requester_name || 'User'}
                        width={28}
                        height={28}
                        className="rounded-full"
                        style={{ borderRadius: '50%' }}
                      />
                    ) : (
                      <span style={{ color: '#92400e', fontWeight: 'bold', fontSize: '12px' }}>
                        {(n.requester_name || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ marginLeft: '52px' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        fontWeight: n.read ? 'normal' : '600',
                        color: n.read ? '#64748b' : '#1e293b',
                      }}
                    >
                      {n.requester_name}{' '}
                      {n.type === 'group_request' ? (
                        <span style={{ color: '#3b82f6', fontSize: '12px' }}>(Group)</span>
                      ) : null}
                    </p>

                    {n.context && (
                      <p
                        style={{
                          margin: '4px 0 8px',
                          fontSize: '13px',
                          fontStyle: 'italic',
                          color: '#475569',
                          wordBreak: 'break-word',
                        }}
                      >
                        “{n.context}”
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(n);
                        }}
                        style={{
                          background: n.type === 'group_request' ? '#3b82f6' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '9999px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Phone size={12} />
                        {n.type === 'group_request' ? 'Join' : 'Connect'}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(n.id);
                        }}
                        style={{
                          background: '#f1f5f9',
                          border: 'none',
                          borderRadius: '9999px',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#64748b',
                        }}
                        aria-label="Dismiss"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <small style={{ color: '#94a3b8', fontSize: '11px', marginTop: '6px', display: 'block' }}>
                      {timeAgo(n.created_at)}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}