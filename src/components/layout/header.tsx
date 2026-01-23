// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import {
  Home,
  User,
  LogOut,
  Phone,
  X,
  MessageSquare,
  Bell,
  Menu,
  Users,
  BookOpen,
  Calendar,
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import SuggestionModal from '@/components/modals/SuggestionModal';
import NotificationModal from '@/components/notifications/NotificationModal'; // ✅ Ensure imported

type CallInvitation = {
  caller_id: string;
  caller_name: string;
  room_id: string;
};

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
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false); // ✅ Controls modal visibility
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerMenuRef = useRef<HTMLDivElement>(null);
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
        const avatarUrl = data?.avatar_url
          ? `/api/media/avatars/${data.avatar_url}`
          : undefined;

        setProfile({
          full_name: data?.full_name,
          avatar_url: avatarUrl,
        });
      }
      setProfileLoading(false);
    };
    fetchProfile();
  }, [user, supabase]);

  const fetchAllUnreadCounts = useCallback(async () => {
    if (!user?.id) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      setIsUnreadLoading(false);
      return;
    }

    setIsUnreadLoading(true);
    try {
      const { data: convData, error: convError } = await supabase.rpc('get_user_conversations_with_unread', {
        p_user_id: user.id,
      });
      if (!convError && Array.isArray(convData)) {
        const totalUnread = convData.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
        setUnreadMessages(totalUnread);
      } else {
        setUnreadMessages(0);
      }

      const { count, error: notifError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      if (!notifError) {
        setUnreadNotifications(count || 0);
      } else {
        setUnreadNotifications(0);
      }
    } catch (err) {
      console.error('Error fetching all unread counts:', err);
      setUnreadMessages(0);
      setUnreadNotifications(0);
    } finally {
      setIsUnreadLoading(false);
    }
  }, [user?.id, supabase]);

  // Unified initial fetch + refetch on focus/visibility
  useEffect(() => {
    fetchAllUnreadCounts();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAllUnreadCounts();
      }
    };

    window.addEventListener('focus', fetchAllUnreadCounts);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', fetchAllUnreadCounts);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAllUnreadCounts]);

  // WebSocket setup
  useEffect(() => {
    if (!user?.id) return;
    if (wsRef.current) wsRef.current.close();

    const wsUrl = `wss://livekit.survivingdeathloss.site/notify?userId=${user.id}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('HeaderCode WebSocket connected');
      fetchAllUnreadCounts();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        if (data.type === 'new_message') {
          fetchAllUnreadCounts();
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

    socket.onclose = () => {};
    socket.onerror = (err) => {
      console.error('HeaderCode WebSocket error:', err);
    };

    wsRef.current = socket;
    return () => socket.close();
  }, [user?.id, fetchAllUnreadCounts]);

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close hamburger menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        hamburgerMenuRef.current &&
        !hamburgerMenuRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('button[aria-label="Open navigation menu"]')
      ) {
        setIsHamburgerMenuOpen(false);
      }
    };
    if (isHamburgerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isHamburgerMenuOpen]);

  // Listen for global unread refresh requests
  useEffect(() => {
    const handleUnreadRefresh = () => {
      if (user?.id) {
        fetchAllUnreadCounts();
      }
    };
    const handleUnreadUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const newCount = customEvent.detail;
      if (typeof newCount === 'number') {
        setUnreadMessages(newCount);
      }
    };

    window.addEventListener('unreadUpdateRequest', handleUnreadRefresh);
    window.addEventListener('unreadUpdate', handleUnreadUpdate);

    return () => {
      window.removeEventListener('unreadUpdateRequest', handleUnreadRefresh);
      window.removeEventListener('unreadUpdate', handleUnreadUpdate);
    };
  }, [user?.id, fetchAllUnreadCounts]);

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
    setIsHamburgerMenuOpen(false);
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

  // Nav items for hamburger menu — always available
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Connect', href: '/connect', icon: Users },
    { name: 'Communities', href: '/communities', icon: Users },
    { name: 'Resources', href: '/resources', icon: BookOpen },
    { name: 'Schedule', href: '/schedule', icon: Calendar },
  ];

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
          {/* Always show hamburger */}
          <button
            onClick={() => setIsHamburgerMenuOpen(true)}
            aria-label="Open navigation menu"
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Menu size={24} color="white" />
          </button>

          {/* App title */}
          <span
            style={{
              fontWeight: 400,
              color: 'white',
              fontSize: '1rem',
            }}
          >
            Surviving Death Loss
          </span>

          {/* Right side: Authed or guest actions */}
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

              {/* Notifications — opens modal */}
              <button
                onClick={() => setIsNotificationModalOpen(true)}
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

              {/* User Avatar Menu */}
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
                        setIsSuggestionModalOpen(true);
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
                      <MessageSquare size={16} />
                      Send Feedback
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

      {/* Incoming Call Banner */}
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

      {/* Profile menu overlay */}
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

      {/* Hamburger Navigation Menu */}
      {isHamburgerMenuOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 41,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
            onClick={() => setIsHamburgerMenuOpen(false)}
          ></div>
          <div
            ref={hamburgerMenuRef}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '200px',
              backgroundColor: '#1e3a8a',
              zIndex: 42,
              padding: '4rem 0 1rem',
              boxShadow: '2px 0 10px rgba(0,0,0,0.2)',
            }}
          >
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 1rem' }}>
              {navItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '0.375rem',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <IconComponent size={20} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}

      {/* ✅ Render NotificationModal when open */}
      {isNotificationModalOpen && (
        <NotificationModal
          isOpen={isNotificationModalOpen}
          onClose={() => setIsNotificationModalOpen(false)}
        />
      )}

      {/* Suggestion Modal */}
      {isSuggestionModalOpen && (
        <SuggestionModal
          isOpen={true}
          onClose={() => setIsSuggestionModalOpen(false)}
        />
      )}
    </>
  );
}
