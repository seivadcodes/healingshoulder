// src/app/layout.tsx
'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/header';
import FooterNav from '@/components/layout/FooterNav';
import { SupabaseProvider } from '@/components/SupabaseProvider';

import { useAuth } from '@/hooks/useAuth';
import { ReactNode, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';

// ✅ Call system
import { CallProvider } from '@/context/CallContext';
import CallOverlay from '@/components/calling/CallOverlay';

const inter = Inter({ subsets: ['latin'] });

export function LayoutContent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  // Don't render CallProvider if not logged in
  if (!user) {
    return (
      <>
        <Header />
        <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">{children}</main>
        <FooterNav />
      </>
    );
  }

  // Validate user.id before passing to CallProvider
  if (!user.id || typeof user.id !== 'string' || user.id.trim() === '') {
    console.error('Layout: Invalid user.id — skipping CallProvider', user.id);
    return (
      <>
        <Header />
        <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">{children}</main>
        <FooterNav />
      </>
    );
  }

  // ✅ Only render CallProvider when we have a valid user
  return (
    <CallProvider userId={user.id} fullName={user.user_metadata?.full_name || 'Anonymous'}>
      <Toaster />
      <CallOverlay />
      {/* Optional: keep SignalingProvider only if it does non-call work */}
      {/* <SignalingProvider currentUserId={user.id} /> */}
      <Header />
      <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">{children}</main>
      <FooterNav />
    </CallProvider>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${inter.className} flex flex-col h-full bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 text-stone-900`}
        suppressHydrationWarning
      >
        <SupabaseProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <LayoutContent>{children}</LayoutContent>
          </Suspense>
        </SupabaseProvider>
      </body>
    </html>
  );
}