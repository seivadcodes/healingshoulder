// src/app/schedule/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Clock, Calendar } from 'lucide-react';

// Types
type EventType = 'Community Circle' | 'Workshop' | 'Author Talk' | 'Ritual' | 'Drop-in Room';

interface Event {
  id: number;
  title: string;
  type: EventType;
  description: string;
  host?: string;
  attendees: number;
  isLive: boolean;
  isAlwaysOpen?: boolean;
  startTime?: Date; // only for scheduled events
  duration?: number; // in minutes
}

// Mock data — diverse, human, real-time
const mockEvents: Event[] = [
  // ─── LIVE NOW ───────────────────────────────
  {
    id: 1,
    title: "Loss of a Child — Open Circle",
    type: "Community Circle",
    description: "A safe space to share, listen, or just be. No pressure to speak.",
    host: "Maya R.",
    attendees: 12,
    isLive: true,
  },
  {
    id: 2,
    title: "Breathwork for Acute Grief",
    type: "Workshop",
    description: "Guided session to move through overwhelming moments.",
    host: "Dr. Lena T.",
    attendees: 24,
    isLive: true,
  },

  // ─── STARTING SOON ──────────────────────────
  {
    id: 3,
    title: "When the Holidays Hurt",
    type: "Community Circle",
    description: "Preparing for family gatherings while grieving.",
    host: "James L.",
    attendees: 8,
    isLive: false,
    startTime: new Date(Date.now() + 10 * 60000), // in 10 min
    duration: 60,
  },
  {
    id: 4,
    title: "From 'Grief Is Love' — Author Chat",
    type: "Author Talk",
    description: "Conversation with Marisa Renee Lee on transforming grief into action.",
    host: "Marisa R. L.",
    attendees: 34,
    isLive: false,
    startTime: new Date(Date.now() + 25 * 60000), // in 25 min
    duration: 45,
  },

  // ─── ALWAYS OPEN ────────────────────────────
  {
    id: 5,
    title: "Grief Lounge — Always Open",
    type: "Drop-in Room",
    description: "Quiet space to sit with others who understand. Come as you are.",
    attendees: 7,
    isLive: true,
    isAlwaysOpen: true,
  },
  {
    id: 6,
    title: "Night Watch — For Late-Night Grief",
    type: "Drop-in Room",
    description: "For those awake at 3 a.m. with a heart full of love and loss.",
    attendees: 3,
    isLive: true,
    isAlwaysOpen: true,
  },
];

// Type color map (for badge background/text)
const typeColorMap: Record<EventType, { bg: string; text: string }> = {
  'Community Circle': { bg: '#fef3c7', text: '#92400e' },
  'Workshop': { bg: '#dbeafe', text: '#1e40af' },
  'Author Talk': { bg: '#fce7f3', text: '#be185d' },
  'Ritual': { bg: '#ede9fe', text: '#7c3aed' },
  'Drop-in Room': { bg: '#f5f5f4', text: '#44403c' },
};

// Helpers
const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const minutesUntil = (future: Date) => {
  return Math.ceil((future.getTime() - Date.now()) / 60000);
};

export default function SchedulePage() {
  const [liveEvents, setLiveEvents] = useState<Event[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [alwaysOpen, setAlwaysOpen] = useState<Event[]>([]);

  useEffect(() => {
    setLiveEvents(mockEvents.filter(e => e.isLive && !e.isAlwaysOpen));
    setAlwaysOpen(mockEvents.filter(e => e.isAlwaysOpen));
    setUpcomingEvents(
      mockEvents.filter(e => !e.isLive && !e.isAlwaysOpen && e.startTime && minutesUntil(e.startTime) <= 30)
    );
  }, []);

  const renderEventCard = (event: Event) => {
    const isUpcoming = event.startTime && !event.isLive;
    const startsIn = isUpcoming ? minutesUntil(event.startTime!) : null;
    const badgeStyle = typeColorMap[event.type];

    const joinButtonStyle = {
      width: '100%',
      padding: '0.5rem',
      borderRadius: '0.5rem',
      fontWeight: '600' as const,
      transition: 'background-color 0.2s',
      cursor: 'pointer',
      ...(event.isLive || event.isAlwaysOpen
        ? { backgroundColor: '#f59e0b', color: 'white' }
        : { backgroundColor: '#f5f5f4', color: '#44403c' }),
    };

    return (
      <div
        key={event.id}
        style={{
          backgroundColor: 'white',
          border: '1px solid #e5e5e5',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          transition: 'box-shadow 0.2s',
          borderRadius: '0.5rem',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)')}
      >
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <h3 style={{ fontWeight: '600', color: '#1c1917', fontSize: '1rem' }}>{event.title}</h3>
            <span
              style={{
                backgroundColor: badgeStyle.bg,
                color: badgeStyle.text,
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                borderRadius: '9999px',
                fontWeight: '500',
              }}
            >
              {event.type}
            </span>
          </div>
          <p style={{ color: '#44403c', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{event.description}</p>

          {event.host && (
            <p style={{ color: '#78716c', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Hosted by {event.host}</p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', color: '#78716c', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            <Users size={12} style={{ marginRight: '0.25rem' }} />
            {event.attendees} {event.attendees === 1 ? 'person' : 'people'} inside
          </div>

          {isUpcoming && (
            <div style={{ display: 'flex', alignItems: 'center', color: '#78716c', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
              <Clock size={12} style={{ marginRight: '0.25rem' }} />
              Starts at {formatTime(event.startTime!)} ({startsIn} min)
            </div>
          )}

          <button
            onClick={() => alert(`Joining: ${event.title}`)}
            style={joinButtonStyle}
            onMouseEnter={(e) => {
              if (event.isLive || event.isAlwaysOpen) {
                e.currentTarget.style.backgroundColor = '#d97706';
              } else {
                e.currentTarget.style.backgroundColor = '#e5e5e4';
              }
            }}
            onMouseLeave={(e) => {
              if (event.isLive || event.isAlwaysOpen) {
                e.currentTarget.style.backgroundColor = '#f59e0b';
              } else {
                e.currentTarget.style.backgroundColor = '#f5f5f4';
              }
            }}
          >
            {event.isLive || event.isAlwaysOpen ? 'Join Now' : `Join in ${startsIn} min`}
          </button>
        </div>
      </div>
    );
  };

  // Common section header style
  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '896px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '9999px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
            }}
          >
            <Calendar size={20} />
          </div>
          <h1 style={{ fontSize: '1.875rem', fontFamily: 'serif', fontWeight: '700', color: '#1c1917', marginBottom: '0.5rem' }}>
            Gather With Others
          </h1>
          <p style={{ color: '#44403c', maxWidth: '42rem', margin: '0 auto' }}>
            Real conversations happening now — and always a quiet space waiting for you.
          </p>
        </div>

        {/* Live Now */}
        {liveEvents.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <h2 style={sectionHeaderStyle}>
              <span
                style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  backgroundColor: '#ef4444',
                  borderRadius: '50%',
                  marginRight: '0.5rem',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
              ></span>
              Live Now
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {liveEvents.map(renderEventCard)}
            </div>
          </section>
        )}

        {/* Always Open */}
        {alwaysOpen.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <h2 style={sectionHeaderStyle}>
              <span style={{ width: '2rem', height: '1px', backgroundColor: '#a8a29e', marginRight: '0.75rem' }}></span>
              Always Open
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {alwaysOpen.map(renderEventCard)}
            </div>
          </section>
        )}

        {/* Starting Soon */}
        {upcomingEvents.length > 0 && (
          <section>
            <h2 style={sectionHeaderStyle}>
              <Clock size={16} style={{ marginRight: '0.5rem', color: '#78716c' }} />
              Starting Soon
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {upcomingEvents.map(renderEventCard)}
            </div>
          </section>
        )}

        {/* Empty State */}
        {liveEvents.length === 0 && alwaysOpen.length === 0 && upcomingEvents.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '3rem', paddingBottom: '3rem' }}>
            <p style={{ color: '#44403c', marginBottom: '1rem' }}>No scheduled events right now.</p>
            <button
              onClick={() => alert('Create a group call')}
              style={{
                color: '#d97706',
                fontWeight: '500',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Start a group call →
            </button>
          </div>
        )}

        {/* Footer CTA */}
        <footer style={{ marginTop: '3rem', textAlign: 'center', color: '#78716c', fontSize: '0.875rem' }}>
          <p>All spaces are held with care. Come as you are.</p>
          <button
            onClick={() => alert('Create your own event')}
            style={{
              color: '#d97706',
              fontWeight: '500',
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginTop: '0.25rem',
            }}
          >
            Host a circle
          </button>
        </footer>
      </div>

      {/* Define pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}