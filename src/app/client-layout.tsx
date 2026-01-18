// src/app/client-layout.tsx
'use client';

import { ReactNode, useEffect, useRef } from 'react';
import Header from '@/components/layout/header';
import FooterNav from '@/components/layout/FooterNav';
import { Toaster } from 'react-hot-toast';
import { CallProvider } from '@/context/CallContext';
import CallOverlay from '@/components/calling/CallOverlay';
import type { User } from '@supabase/supabase-js';

export default function ClientLayout({
  children,
  user,
}: {
  children: ReactNode;
  user: User | null;
}) {
  const hasUpdatedCountry = useRef(false);

  useEffect(() => {
    if (
      user?.id &&
      typeof user.id === 'string' &&
      user.id.trim() !== '' &&
      !hasUpdatedCountry.current
    ) {
      hasUpdatedCountry.current = true;
      fetch('/api/update-user-country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
        credentials: 'include',
      }).catch(err => {
        console.warn('Failed to auto-update country:', err);
      });
    }
  }, [user?.id]);

  if (!user) {
    return (
      <>
        <Header />
        <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">{children}</main>
        <FooterNav />
      </>
    );
  }

  if (!user.id || typeof user.id !== 'string' || user.id.trim() === '') {
    console.error('ClientLayout: Invalid user.id', user.id);
    return (
      <>
        <Header />
        <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">{children}</main>
        <FooterNav />
      </>
    );
  }

  return (
    <CallProvider userId={user.id} fullName={user.user_metadata?.full_name || 'Anonymous'}>
      <Toaster />
      <CallOverlay />
      <Header />
      <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">{children}</main>
      <FooterNav />
    </CallProvider>
  );
}