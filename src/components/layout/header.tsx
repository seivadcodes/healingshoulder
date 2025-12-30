// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import { Home, User, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';

export default function Header() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [initials, setInitials] = useState('U');
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (user) {
      let name = '';
      if (user.user_metadata?.full_name) {
        name = user.user_metadata.full_name;
      } else if (user.email) {
        name = user.email.split('@')[0];
      }

      const computedInitials = name
        .split(' ')
        .map((n) => n[0]?.toUpperCase() || '')
        .join('')
        .substring(0, 2) || 'U';

      setInitials(computedInitials);
    } else {
      setInitials('U');
    }
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    setIsMenuOpen(false);
  };

  // If still loading, show nothing (or a spinner if needed)
  if (loading) {
    return null; // 👈 Removed skeleton — shows blank header until loaded
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
          backgroundColor: 'rgba(30, 58, 138, 0.95)', // #1e3a8a (blue-800) — matches footer
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
            onMouseEnter={(e) => (e.currentTarget.style.color = '#bfdbfe')} // blue-300
            onMouseLeave={(e) => (e.currentTarget.style.color = 'white')}
            aria-label="Back to Home"
          >
            <Home size={20} color="white" />
            <span style={{ fontWeight: 500 }}>Healing Shoulder</span>
          </Link>

          {user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '9999px',
                  backgroundColor: '#60a5fa', // blue-400
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
                aria-label="User menu"
              >
                {initials}
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

      {/* Optional: Click-away overlay for mobile or full-screen dismiss */}
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