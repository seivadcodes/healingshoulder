// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import { Home, User, LogOut, Phone, X, MessageSquare, Bell } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

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
  const [unreadNotifications, setUnreadNotifications] = useState(0); // For future notification bell
  const menuRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => createClient(), []);

  // Fetch profile when user is available
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

  useEffect(() => {
  if (!user?.id) {
    setUnreadMessages(0);
    setIsUnreadLoading(false);
    return;
  }

  const fetchUnreadCount = async () => {
    try {
      // 👇 THIS IS THE LINE THAT NEEDS CHANGING (line 77)
      const { data, error } = await supabase
        .rpc('get_total_unread_messages', { target_user_id: user.id }); // ✅ CORRECT PARAM NAME
      
      if (error) throw error;
      setUnreadMessages(data?.total_unread || 0);
    } catch (err) {
      console.error('Error fetching unread messages:', err);
      setUnreadMessages(0);
    } finally {
      setIsUnreadLoading(false);
    }
  };

  fetchUnreadCount();
    
    // Set up real-time updates for unread count
    const channel = supabase
      .channel(`user:${user.id}:messages`)
      .on('broadcast', { event: 'unread_count_update' }, (payload) => {
        setUnreadMessages(payload.payload.count || 0);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase]);

  // 🔔 Listen for incoming call invitations
  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;
    const channel = supabase
      .channel(`user:${userId}`)
      .on('broadcast', { event: 'call_invitation' }, (payload) => {
        const { caller_id, caller_name, room_id } = payload.payload;
        setIncomingCall({ caller_id, caller_name, room_id });
        setShowCallBanner(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Compute user initials safely
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
    await signOut();
    setIsMenuOpen(false);
  };

  // 📞 Handle call actions
  const handleAcceptCall = async () => {
    if (!incomingCall || !user?.id) return;

    // Optional: mark as accepted in DB
    await supabase
      .from('call_notifications')
      .insert({
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

    // Mark as declined
    await supabase
      .from('call_notifications')
      .insert({
        recipient_id: user.id,
        caller_id: incomingCall.caller_id,
        room_id: incomingCall.room_id,
        status: 'declined',
      });

    // Notify caller (optional but recommended)
    const channel = supabase.channel(`user:${incomingCall.caller_id}`);
    await channel.send({
      type: 'broadcast',
      event: 'call_declined',
      payload: { by: user.id },
    });

    setShowCallBanner(false);
  };

  // Don't render while auth state is loading
  if (authLoading) {
    return null;
  }

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: 'rgba(30, 58, 138, 0.95)', // #1e3a8a
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
              {/* Messages Icon with Unread Badge */}
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
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Messages"
              >
                <MessageSquare size={20} color="white" />
                
                {/* Unread messages badge */}
                {!isUnreadLoading && unreadMessages > 0 && (
                  <div style={{
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
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}>
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </div>
                )}
              </Link>

              {/* Notification Bell Icon (placeholder for future logic) */}
              <button
                onClick={() => {
                  // TODO: Add notification dropdown logic here later
                  console.log('Notifications clicked - add logic later');
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
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Notifications"
              >
                <Bell size={20} color="white" />
                
                {/* Notification badge - placeholder for future implementation */}
                {unreadNotifications > 0 && (
                  <div style={{
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
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}>
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
                    <Link
                      href="/notifications"
                      style={{
                        display: 'block',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        color: '#3f3f46',
                        textDecoration: 'none',
                      }}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Notifications
                    </Link>
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

      {/* 🔔 Incoming Call Notification Banner */}
      {user && showCallBanner && incomingCall && (
        <div
          style={{
            position: 'fixed',
            top: '4rem', // directly below header
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
            backgroundColor: 'transparent',
          }}
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}
    </>
  );
}