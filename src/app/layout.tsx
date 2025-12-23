// src/app/layout.tsx
import FooterNav from '@/components/layout/FooterNav';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900"> {/* 👈 Add this */}
        <div className="min-h-screen pb-16 md:pb-0">
          {children}
        </div>
        <FooterNav />
      </body>
    </html>
  );
}