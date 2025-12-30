﻿'use client';

import Link from 'next/link';
import { Home, User, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';

export default function Header() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [initials, setInitials] = useState('U');

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

  if (loading) {
    return (
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: 'rgba(253, 230, 138, 0.9)', // amber-50/90 approx
          backdropFilter: 'blur(4px)',
          borderBottom: '1px solid #e2e2e2', // stone-200
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            maxWidth: '48rem', // ~2xl
            margin: '0 auto',
            padding: '0.75rem 1rem', // py-3 px-4
          }}
        >
          <div
            style={{
              height: '1.5rem',
              width: '8rem',
              backgroundColor: '#e2e2e2',
              borderRadius: '0.25rem',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          ></div>
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </header>
    );
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
          backgroundColor: 'rgba(253, 230, 138, 0.9)',
          backdropFilter: 'blur(4px)',
          borderBottom: '1px solid #e2e2e2',
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
              color: '#1c1917', // stone-800
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#b45309')} // amber-700
            onMouseLeave={(e) => (e.currentTarget.style.color = '#1c1917')}
            aria-label="Back to Home"
          >
            <Home size={20} />
            <span style={{ fontWeight: 500 }}>Healing Shoulder</span>
          </Link>

          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '9999px',
                  backgroundColor: '#d97706', // amber-500
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 500,
                  fontSize: '0.875rem', // text-sm
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
                      color: '#3f3f46', // stone-700
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
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f4f4f5')} // stone-100
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
                color: '#3f3f46', // stone-700
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#b45309')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#3f3f46')}
            >
              <User size={18} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </header>

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