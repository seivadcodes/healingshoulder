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
    icon: <Flower size={24} style={{ color: '#d97706' }} />,
    href: '/games/memory-garden',
    players: 7,
  },
  {
    id: 'story-stones',
    title: 'Story Stones',
    description: 'Place symbolic stones in a shared river. Read or leave gentle memories.',
    icon: <span style={{ fontSize: '1.25rem' }}>🪨</span>,
    href: '#',
    players: 3,
  },
  {
    id: 'breathing-together',
    title: 'Breathing Together',
    description: 'Synchronize your breath with others in real time. Calm your nervous system.',
    icon: <span style={{ fontSize: '1.25rem' }}>🌬️</span>,
    href: '#',
    players: 12,
  },
  {
    id: 'hope-journal',
    title: 'Hope Journal',
    description: 'Write or read short, hopeful entries. Optional anonymity, always kindness.',
    icon: <span style={{ fontSize: '1.25rem' }}>📖</span>,
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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        background: 'linear-gradient(to bottom, #fffbeb, #f5f5f4, #f4f4f5)',
        padding: '1rem',
        paddingBottom: '6rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '480px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ margin: '0 auto 0.75rem', width: '2.5rem', height: '2.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Gamepad2 size={40} color="#d97706" />
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '500', color: '#1c1917', marginBottom: '0.5rem' }}>
            Play Together
          </h1>
          <p style={{ color: '#44403c', fontSize: '1rem' }}>
            Therapeutic games for grief, connection, and quiet presence. No pressure. No performance.
          </p>
        </div>

        {/* Game List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {games.map((game) => (
            <Link key={game.id} href={game.href} legacyBehavior passHref>
              <a
                style={{
                  display: 'block',
                  padding: '1rem',
                  backgroundColor: 'white',
                  borderRadius: '0.75rem',
                  border: '1px solid #e5e5e5',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ marginTop: '0.125rem' }}>{game.icon}</div>
                    <div>
                      <h3 style={{ fontWeight: '600', color: '#1c1917', fontSize: '1rem' }}>{game.title}</h3>
                      <p style={{ color: '#44403c', fontSize: '0.875rem', marginTop: '0.25rem' }}>{game.description}</p>
                    </div>
                  </div>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      backgroundColor: '#dcfce7',
                      color: '#047857',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      whiteSpace: 'nowrap',
                      gap: '0.25rem',
                    }}
                  >
                    <span style={{ width: '0.5rem', height: '0.5rem', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
                    {game.players} playing
                  </span>
                </div>
              </a>
            </Link>
          ))}
        </div>

        {/* Footer Note */}
        <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#78716c' }}>
          <p>New therapeutic games launch monthly. All are optional, anonymous, and designed with care.</p>
        </div>
      </div>
    </div>
  );
}