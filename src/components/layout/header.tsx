// src/components/layout/header.tsx
'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  // Only show header on non-homepage routes
  if (pathname === '/') return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-amber-50/90 backdrop-blur-sm border-b border-stone-200 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center">
        <Link
          href="/"
          className="flex items-center gap-2 text-stone-800 hover:text-amber-700 transition-colors"
          aria-label="Back to Home"
        >
          <Home size={20} />
          <span className="font-medium">Healing Shoulder</span>
        </Link>
      </div>
    </header>
  );
}