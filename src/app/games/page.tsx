// src/app/games/page.tsx
'use client';

import Link from 'next/link';
import { Gamepad2, Flower } from 'lucide-react';
import { useState, useEffect } from 'react';

// Mock live player counts — replace later with useOnlineUsers or realtime.ts
const mockGames = [
  {
    id: 'memory-garden',
    title: 'Memory Garden',
    description: 'Plant a digital flower in quiet remembrance. Watch others bloom alongside you.',
    icon: <Flower className="w-6 h-6" />,
    href: '/games/memory-garden',
    players: 7,
  },
  {
    id: 'story-stones',
    title: 'Story Stones',
    description: 'Place symbolic stones in a shared river. Read or leave gentle memories.',
    icon: <span className="text-xl">🪨</span>,
    href: '#', // placeholder
    players: 3,
  },
  {
    id: 'breathing-together',
    title: 'Breathing Together',
    description: 'Synchronize your breath with others in real time. Calm your nervous system.',
    icon: <span className="text-xl">🌬️</span>,
    href: '#',
    players: 12,
  },
  {
    id: 'hope-journal',
    title: 'Hope Journal',
    description: 'Write or read short, hopeful entries. Optional anonymity, always kindness.',
    icon: <span className="text-xl">📖</span>,
    href: '#',
    players: 5,
  },
];

export default function GamesPage() {
  const [games, setGames] = useState(mockGames);

  // Simulate live player count fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setGames((prev) =>
        prev.map((game) => ({
          ...game,
          players: Math.max(1, game.players + Math.floor(Math.random() * 3) - 1),
        }))
      );
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 p-4 pb-24">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Gamepad2 className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h1 className="text-2xl md:text-3xl font-medium text-stone-800">Play Together</h1>
          <p className="text-stone-600 mt-2">
            Therapeutic games for grief, connection, and quiet presence. No pressure. No performance.
          </p>
        </div>

        {/* Game List */}
        <div className="space-y-4">
          {games.map((game) => (
            <Link key={game.id} href={game.href} legacyBehavior>
              <a className="block">
                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-amber-600">{game.icon}</div>
                      <div>
                        <h3 className="font-semibold text-stone-800">{game.title}</h3>
                        <p className="text-sm text-stone-600 mt-1">{game.description}</p>
                      </div>
                    </div>
                    <span className="flex items-center text-xs font-medium bg-green-100 text-green-800 px-2 py-1 rounded-full whitespace-nowrap">
                      🟢 {game.players} playing
                    </span>
                  </div>
                </div>
              </a>
            </Link>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-10 text-center text-sm text-stone-500">
          <p>New therapeutic games launch monthly. All are optional, anonymous, and designed with care.</p>
        </div>
      </div>
    </div>
  );
}