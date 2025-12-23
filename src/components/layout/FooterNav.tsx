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
  { name: 'Games', href: '/games', icon: Gamepad2 },
];

export default function FooterNav() {
  const pathname = usePathname();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/80 backdrop-blur-sm md:static md:border-t-0">
      <div className="flex items-center justify-around h-14 px-2 md:px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label={item.name}
            >
              <Icon
                size={18}
                className={isActive ? 'fill-current' : 'fill-transparent'}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </footer>
  );
}