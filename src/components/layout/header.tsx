// src/components/layout/Header.tsx
'use client';
import Link from 'next/link';
import { Home, User, LogOut, Phone, X, MessageSquare, Bell } from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import NotificationModal from '@/components/notifications/NotificationModal'; // ✅ IMPORT MODAL

type CallInvitation = {
  caller_id: string;
  caller_name: string;
  room_id: string;
};

interface ConversationItem {
  unread_count: number;
}

export default function Header() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [incomingCall, setIncomingCall] = useState<CallInvitation | null>(null);
  const [showCallBanner, setShowCallBanner] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isUnreadLoading, setIsUnreadLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false); // ✅ MODAL STATE
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Failed to load profile in header:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
      setProfileLoading(false);
    };
    fetchProfile();
  }, [user, supabase]);

  // 🔔 Fetch unread messages count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadMessages(0);
      setIsUnreadLoading(false);
      return;
    }
    setIsUnreadLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_conversations_with_unread', {
        p_user_id: user.id,
      });
      if (error) throw error;
      const conversations = (data as ConversationItem[]) || [];
      if (!Array.isArray(conversations)) {
        console.warn('Unexpected response format');
        setUnreadMessages(0);
        return;
      }
      const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      setUnreadMessages(totalUnread);
    } catch (err) {
      console.error('Error fetching unread messages:', err);
      setUnreadMessages(0);
    } finally {
      setIsUnreadLoading(false);
    }
  }, [user?.id, supabase]);

  // 🔔 Fetch unread notifications count — MUST BE DECLARED BEFORE USE
  const fetchUnreadNotifications = useCallback(async () => {
    if (!user?.id) {
      setUnreadNotifications(0);
      return;
    }
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      setUnreadNotifications(count || 0);
    } catch (err) {
      console.error('Error fetching unread notifications:', err);
      setUnreadNotifications(0);
    }
  }, [user?.id, supabase]);

  // Initial fetch + refetch on focus
  useEffect(() => {
    fetchUnreadCount();
    fetchUnreadNotifications(); // ✅ Safe now
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
        fetchUnreadNotifications();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchUnreadCount, fetchUnreadNotifications]);

  // WebSocket setup
  useEffect(() => {
    if (!user?.id) return;
    if (wsRef.current) wsRef.current.close();

    const wsUrl = `wss://livekit.survivingdeathloss.site/notify?userId=${user.id}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('HeaderCode WebSocket connected');
      setWsConnected(true);
      fetchUnreadCount();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        if (data.type === 'new_message') {
          fetchUnreadCount();
        }
        if (data.type === 'call_invitation') {
          setIncomingCall({
            caller_id: data.caller_id,
            caller_name: data.caller_name,
            room_id: data.room_id,
          });
          setShowCallBanner(true);
        }
        if (data.type === 'call_declined') {
          setShowCallBanner(false);
        }
      } catch (err) {
        console.error('HeaderCode WS message error:', err);
      }
    };

    socket.onclose = () => setWsConnected(false);
    socket.onerror = (err) => {
      console.error('HeaderCode WebSocket error:', err);
      setWsConnected(false);
    };

    wsRef.current = socket;
    return () => socket.close();
  }, [user?.id, fetchUnreadCount]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unread update listener
  useEffect(() => {
    if (!user?.id) return;
    const handleUnreadUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const newCount = customEvent.detail;
      if (typeof newCount === 'number' && newCount !== unreadMessages) {
        setUnreadMessages(newCount);
      }
    };
    window.addEventListener('unreadUpdate', handleUnreadUpdate);
    fetchUnreadCount();
    return () => window.removeEventListener('unreadUpdate', handleUnreadUpdate);
  }, [user?.id, fetchUnreadCount, unreadMessages]);

  const initials = useMemo(() => {
    if (!user) return 'U';
    const name = profile?.full_name || user.email?.split('@')[0] || 'User';
    return name
      .split(' ')
      .map((n) => n[0]?.toUpperCase() || '')
      .join('')
      .substring(0, 2) || 'U';
  }, [user, profile]);

  const handleLogout = async () => {
    if (wsRef.current) wsRef.current.close(1000, 'User logged out');
    await signOut();
    setIsMenuOpen(false);
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !user?.id) return;
    await supabase.from('call_notifications').insert({
      recipient_id: user.id,
      caller_id: incomingCall.caller_id,
      room_id: incomingCall.room_id,
      status: 'accepted',
    });
    setShowCallBanner(false);
    router.push(`/room/${incomingCall.room_id}`);
  };

  const handleDeclineCall = async () => {
    if (!incomingCall || !user?.id) return;
    await supabase.from('call_notifications').insert({
      recipient_id: user.id,
      caller_id: incomingCall.caller_id,
      room_id: incomingCall.room_id,
      status: 'declined',
    });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'call_declined', room_id: incomingCall.room_id, by: user.id }));
    }
    setShowCallBanner(false);
  };

  if (authLoading) return null;

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: 'rgba(30, 58, 138, 0.95)',
          backdropFilter: 'blur(4px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            maxWidth: '48rem',
            margin: '0 auto',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'white',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#bfdbfe')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'white')}
            aria-label="Back to Home"
          >
            <Home size={20} color="white" />
            <span style={{ fontWeight: 500 }}>Healing Shoulder</span>
          </Link>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Messages */}
              <Link
                href="/messages"
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Messages"
              >
                <MessageSquare size={20} color="white" />
                {!isUnreadLoading && unreadMessages > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      borderRadius: '9999px',
                      fontSize: '0.625rem',
                      minWidth: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      padding: '0 3px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    }}
                  >
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </div>
                )}
              </Link>

              {/* 🔔 Notification Bell — OPENS MODAL */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsNotificationModalOpen(true); // ✅ OPEN MODAL
                }}
                style={{
                  position: 'relative',
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Notifications"
              >
                <Bell size={20} color="white" />
                {unreadNotifications > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      backgroundColor: '#fbbf24',
                      color: 'white',
                      borderRadius: '9999px',
                      fontSize: '0.625rem',
                      minWidth: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      padding: '0 3px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    }}
                  >
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </div>
                )}
              </button>

              {/* User Menu */}
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    padding: 0,
                  }}
                  aria-label="User menu"
                >
                  {profileLoading ? (
                    <div
                      style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '9999px',
                        backgroundColor: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                      }}
                    >
                      {initials}
                    </div>
                  ) : profile?.avatar_url ? (
                    <Image
                      unoptimized
                      src={profile.avatar_url}
                      alt="Your avatar"
                      width={32}
                      height={32}
                      style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '9999px',
                        objectFit: 'cover',
                        border: '2px solid white',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '9999px',
                        backgroundColor: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                      }}
                    >
                      {initials}
                    </div>
                  )}
                </button>

                {isMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '2.5rem',
                      width: '12rem',
                      backgroundColor: 'white',
                      border: '1px solid #e2e2e2',
                      borderRadius: '0.5rem',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      padding: '0.25rem 0',
                      zIndex: 50,
                    }}
                  >
                    <Link
                      href="/dashboard"
                      style={{
                        display: 'block',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        color: '#3f3f46',
                        textDecoration: 'none',
                      }}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsNotificationModalOpen(true); // ✅ Also open modal from menu
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        color: '#3f3f46',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f4f4f5')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Bell size={16} />
                      Notifications
                    </button>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        color: '#3f3f46',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f4f4f5')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link
              href="/auth"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#bfdbfe')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'white')}
            >
              <User size={18} color="white" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </header>

      {/* 🔔 Incoming Call Banner */}
      {user && showCallBanner && incomingCall && (
        <div
          style={{
            position: 'fixed',
            top: '4rem',
            left: 0,
            right: 0,
            zIndex: 45,
            backgroundColor: '#1e3a8a',
            color: 'white',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            maxWidth: '48rem',
            margin: '0 auto',
            borderRadius: '0 0 0.5rem 0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Phone size={20} />
            <span>
              Incoming call from <strong>{incomingCall.caller_name}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleAcceptCall}
              style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Accept
            </button>
            <button
              onClick={handleDeclineCall}
              style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Decline
            </button>
            <button
              onClick={() => setShowCallBanner(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}

      {/* 🔔 NOTIFICATION MODAL — RENDERED AT ROOT LEVEL */}
      {isNotificationModalOpen && (
        <NotificationModal
          isOpen={true}
          onClose={() => setIsNotificationModalOpen(false)}
        />
      )}
    </>
  );
}