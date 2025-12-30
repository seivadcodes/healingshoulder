// src/components/layout/FooterNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  UserPlus,
  Users,
  BookOpen,
  Calendar,
  Gamepad2,
} from 'lucide-react';

const navItems = [
  { name: 'Connect', href: '/connect', icon: UserPlus },
  { name: 'Communities', href: '/communities', icon: Users },
  { name: 'Resources', href: '/resources', icon: BookOpen },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
  //{ name: 'Games', href: '/games', icon: Gamepad2 },
];

export default function FooterNav() {
  const pathname = usePathname();

  // Base styles
  const footerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    borderTop: '1px solid #e5e7eb', // matches Tailwind's border-gray-200
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(8px)',
  };

  // Override for medium screens and up (md:static, etc.)
  const footerStyleMd: React.CSSProperties = {
    position: 'static',
    borderTop: 'none',
    backgroundColor: 'transparent',
    backdropFilter: 'none',
  };

  const navContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '3.5rem', // 14 * 0.25rem = 3.5rem (since 1rem = 16px, 14px * 4 = 56px = 3.5rem)
    padding: '0 0.5rem', // px-2
  };

  const navContainerStyleMd: React.CSSProperties = {
    padding: '0 1rem', // md:px-4
  };

  const linkBaseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem', // text-xs
    fontWeight: 500, // font-medium
    transition: 'color 0.2s ease',
  };

  const activeLinkStyle: React.CSSProperties = {
    color: '#3b82f6', // text-primary (Tailwind default blue-500)
  };

  const inactiveLinkStyle: React.CSSProperties = {
    color: '#9ca3af', // text-muted-foreground (Tailwind gray-400)
  };

  const hoverLinkStyle: React.CSSProperties = {
    color: '#1f2937', // text-foreground (Tailwind gray-900)
  };

  // Determine if we should apply desktop overrides (you'd normally use a hook or media query for this;
  // since inline styles don't support responsive modifiers directly, we’ll keep mobile-first and note that
  // in real usage you might want a proper responsive solution—e.g., using a resize observer or CSS-in-JS media queries.
  // For now, we’ll assume mobile view unless you handle responsiveness elsewhere.

  const isMd = false; // You could replace this with a responsive hook if needed

  return (
    <footer style={isMd ? { ...footerStyle, ...footerStyleMd } : footerStyle}>
      <div style={isMd ? { ...navContainerStyle, ...navContainerStyleMd } : navContainerStyle}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              style={{
                ...linkBaseStyle,
                ...(isActive ? activeLinkStyle : { ...inactiveLinkStyle }),
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.target as HTMLElement).style.color = hoverLinkStyle.color as string;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.target as HTMLElement).style.color = inactiveLinkStyle.color as string;
                }
              }}
              aria-label={item.name}
            >
              <Icon
                size={18}
                style={{
                  fill: isActive ? 'currentColor' : 'transparent',
                }}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </footer>
  );
}