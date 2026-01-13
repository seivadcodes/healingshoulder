// src/components/layout/FooterNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  UserPlus,
  Users,
  BookOpen,
  Calendar,
  Home,
} from 'lucide-react';

const baseNavItems = [
  { name: 'Connect', href: '/connect', icon: UserPlus },
  { name: 'Communities', href: '/communities', icon: Users },
  { name: 'Resources', href: '/resources', icon: BookOpen },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
];

export default function FooterNav() {
  const pathname = usePathname();

  // Dark blue background for footer
  const darkBlue = '#1e3a8a'; // Tailwind blue-800

  const footerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: darkBlue,
    backdropFilter: 'blur(8px)',
  };

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
    height: '3.5rem',
    padding: '0 0.5rem',
  };

  const navContainerStyleMd: React.CSSProperties = {
    padding: '0 1rem',
  };

  const linkBaseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 500,
    transition: 'color 0.2s ease',
    padding: '0.25rem 0',
    color: 'white',
  };

  // Determine dashboard/home item dynamically
  const isOnDashboard = pathname === '/dashboard';
  const dashboardItem = {
    name: isOnDashboard ? 'Home' : 'Dashboard',
    href: isOnDashboard ? '/' : '/dashboard',
    icon: Home,
  };

  // Insert dashboard as first item
  const navItems = [dashboardItem, ...baseNavItems];

  const isMd = false; // You may later replace this with a real media query hook if needed

  return (
    <footer style={isMd ? { ...footerStyle, ...footerStyleMd } : footerStyle}>
      <div style={isMd ? { ...navContainerStyle, ...navContainerStyleMd } : navContainerStyle}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            (item.href === '/' && pathname === '/') ||
            (item.href === '/dashboard' && pathname === '/dashboard');

          return (
            <Link
              key={item.name}
              href={item.href}
              style={linkBaseStyle}
              onMouseEnter={(e) => {
                if (!isActive) {
                  const icon = e.currentTarget.querySelector('svg');
                  if (icon) icon.style.color = '#1f2937'; // dark gray on hover
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  const icon = e.currentTarget.querySelector('svg');
                  if (icon) icon.style.color = '#000000'; // back to black
                }
              }}
              aria-label={item.name}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  marginBottom: '0.25rem',
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={3}
                  style={{
                    fill: isActive ? 'currentColor' : 'transparent',
                    color: isActive ? '#3b82f6' : '#000000',
                  }}
                />
              </div>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </footer>
  );
}