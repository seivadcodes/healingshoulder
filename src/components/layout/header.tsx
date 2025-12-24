'use client';

import Link from 'next/link';
import { Home, User, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useClientAuth } from '@/hooks/useClientAuth';
import { useState } from 'react';

export default function Header() {
  const pathname = usePathname();
  const { user, logout: handleLogout } = useClientAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const logout = () => {
    handleLogout();
    setIsMenuOpen(false);
  };

  const initials = user
    ? user.name
        .split(' ')
        .map((n: string) => n[0]) // ✅ Fixed implicit any
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : 'U';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-amber-50/90 backdrop-blur-sm border-b border-stone-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-stone-800 hover:text-amber-700 transition-colors"
            aria-label="Back to Home"
          >
            <Home size={20} />
            <span className="font-medium">Healing Shoulder</span>
          </Link>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-medium text-sm"
                aria-label="User menu"
              >
                {initials}
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-stone-200 rounded-lg shadow-lg py-1 z-50">
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 flex items-center gap-2"
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
              className="flex items-center gap-1 text-stone-700 hover:text-amber-700 text-sm font-medium"
            >
              <User size={18} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </header>

      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}
    </>
  );
}