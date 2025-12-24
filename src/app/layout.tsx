// src/app/layout.tsx
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/header';
import FooterNav from '@/components/layout/FooterNav';
import { SupabaseProvider } from '@/components/SupabaseProvider'; // ✅ Add this

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} flex flex-col h-full bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 text-stone-900`}>
        {/* Wrap everything that needs auth in SupabaseProvider */}
        <SupabaseProvider>
          <Header />
          <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-0">
            {children}
          </main>
          <FooterNav />
        </SupabaseProvider>
      </body>
    </html>
  );
}