// src/app/layout.tsx
import { Inter } from 'next/font/google';
import './globals.css';
import { getCurrentUser } from '@/lib/auth-server';
import ClientLayout from './client-layout';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} flex flex-col h-full bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 text-stone-900`}>
        {/* ✅ Analytics must be placed directly inside <body>, before children */}
        <Analytics />
        
        <ClientLayout user={user}>{children}</ClientLayout>
      </body>
    </html>
  );
}