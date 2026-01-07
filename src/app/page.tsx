// src/app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSession } from '@/lib/matching';

// Mock live activity feed
const mockLiveActivities = [
  { id: 1, type: 'chat', message: 'Live Now: 3 people in “Grief Support Chat” — join anonymously.', action: 'Join' },
  { id: 2, type: 'call', message: 'Someone just asked for a group call about “Coping with Holidays” — you can join.', action: 'Join Call' },
  { id: 3, type: 'community', message: 'New member joined “Friends Who Understand” community.', action: 'See Post' },
  { id: 4, type: 'event', message: 'Upcoming: “Mindfulness for Grief” workshop in 2 hours — reserve your spot.', action: 'Remind Me' },
  { id: 5, type: 'game', message: 'Game Live: “Memory Garden” — 5 players building a digital memorial together. Join?', action: 'Play' },
  { id: 6, type: 'post', message: 'Someone posted in “Loss of a Parent”: “I miss his laugh today.” — reply with a heart or share your story.', action: 'Respond' },
];

export default function HomePage() {
  const router = useRouter();
  const [onlineCount, setOnlineCount] = useState(42);
  const [isConnecting, setIsConnecting] = useState(false);
  const heartbeatRef = useRef<HTMLDivElement>(null);

  // Simulate online count fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount((prev) => {
        const fluctuation = Math.floor(Math.random() * 6) - 2;
        return Math.max(10, prev + fluctuation);
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Manual heartbeat animation via JS (since inline styles can't do keyframes easily)
 useEffect(() => {
  const startPulse = () => {
    if (!heartbeatRef.current) return;
    heartbeatRef.current.style.opacity = '0.9';
    setTimeout(() => {
      if (heartbeatRef.current) {
        heartbeatRef.current.style.opacity = '1';
      }
    }, 500);
  };

  const pulseInterval = setInterval(startPulse, 4000);
  const pingInterval = setInterval(() => {
    // Simulate ping glow by briefly changing box-shadow (optional)
  }, 2000);

  return () => {
    clearInterval(pulseInterval);
    clearInterval(pingInterval);
  };
}, []);
  const handleQuickConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const session = await createSession();
      router.push(`/call/${session.id}`);
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Unable to connect right now. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleFindTribe = () => {
    router.push('/communities');
  };

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
      }}
    >
      {/* Main Heartbeat Circle */}
      <div
        ref={heartbeatRef}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16rem',
          height: '16rem',
          borderRadius: '9999px',
          background: 'linear-gradient(135deg, #fef3c7, #e5e5e4)',
          border: '1px solid #d6d3d1',
          boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
          margin: '3rem 0',
          transition: 'all 1s ease',
          opacity: 1,
        }}
      >
        <div style={{ textAlign: 'center', padding: '0 1rem', zIndex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '500', color: '#1c1917', marginBottom: '0.5rem' }}>
            Someone is here with you.
          </h1>
          <p style={{ color: '#44403c', fontSize: '1.125rem' }}>Right now.</p>
        </div>
        {/* Optional: add subtle glow via box-shadow animation if needed — but inline can't animate easily */}
      </div>

      {/* Primary Action Buttons */}
      <div style={{ width: '100%', maxWidth: '32rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
        <button
          onClick={handleQuickConnect}
          disabled={isConnecting}
          style={{
            width: '100%',
            padding: '1rem',
            backgroundColor: isConnecting ? '#fbbf24' : '#f59e0b',
            color: isConnecting ? '#fef3c7' : 'white',
            fontWeight: '600',
            borderRadius: '0.75rem',
            border: 'none',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s, background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isConnecting) e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            if (!isConnecting) e.currentTarget.style.transform = 'scale(1)';
          }}
          onTouchStart={(e) => {
            if (!isConnecting) e.currentTarget.style.transform = 'scale(0.98)';
          }}
          onTouchEnd={(e) => {
            if (!isConnecting) e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {isConnecting ? 'Finding someone...' : '🟠 Talk Now'}
        </button>

        <button
          onClick={handleFindTribe}
          style={{
            width: '100%',
            padding: '1rem',
            backgroundColor: '#1c1917',
            color: 'white',
            fontWeight: '600',
            borderRadius: '0.75rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onTouchStart={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onTouchEnd={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          🔵 Find Your Tribe
        </button>
      </div>

      {/* Live Presence Indicator */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {/*<span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: '#dcfce7',
            color: '#047857',
            fontSize: '0.875rem',
            fontWeight: '600',
            gap: '0.25rem',
          }}
        >
          <span style={{ width: '0.5rem', height: '0.5rem', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
          {onlineCount} people online · Tap to connect
        </span>*/}
      </div>

      {/* Live Activity Feed */}
      <div style={{ width: '100%', maxWidth: '32rem' }}>
        <h2 style={{ color: '#44403c', fontWeight: '600', marginBottom: '0.75rem', textAlign: 'left' }}>
          What’s happening now
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {mockLiveActivities.map((item) => (
            <div
              key={item.id}
              onClick={() => alert(`Action: ${item.action}`)}
              style={{
                padding: '1rem',
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                border: '1px solid #e5e5e5',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)')}
            >
              <p style={{ color: '#1c1917', fontSize: '0.95rem', marginBottom: '0.5rem' }}>{item.message}</p>
              <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: '600' }}>
                {item.action} →
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Optional: global styles for pulse (if needed elsewhere) */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}