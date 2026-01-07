// src/app/layout.tsx
'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/header';
import FooterNav from '@/components/layout/FooterNav';
import { SupabaseProvider } from '@/components/SupabaseProvider';
import { CallProvider } from '@/components/call/CallProvider';
import { useAuth } from '@/hooks/useAuth';
import { ReactNode, useEffect } from 'react';
import { Toaster } from 'react-hot-toast'; // 👈 Add this

const inter = Inter({ subsets: ['latin'] });

function LayoutContent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  const currentUserId = user?.id || null;

  return (
    <>
      <Toaster /> {/* 👈 Global toast container */}
      <CallProvider currentUserId={currentUserId}>
        <Header />
        <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">
          {children}
        </main>
        <FooterNav />
      </CallProvider>
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${inter.className} flex flex-col h-full bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 text-stone-900`}
        suppressHydrationWarning
      >
        <SupabaseProvider>
          <LayoutContent>{children}</LayoutContent>
        </SupabaseProvider>
      </body>
    </html>
  );
}