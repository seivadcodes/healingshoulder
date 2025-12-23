// src/app/schedule/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

// Type colors
const typeColorMap: Record<EventType, string> = {
  'Community Circle': 'bg-amber-100 text-amber-800',
  'Workshop': 'bg-blue-100 text-blue-800',
  'Author Talk': 'bg-rose-100 text-rose-800',
  'Ritual': 'bg-purple-100 text-purple-800',
  'Drop-in Room': 'bg-stone-100 text-stone-800',
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
    // In real app: fetch from API or WebSocket
    setLiveEvents(mockEvents.filter(e => e.isLive && !e.isAlwaysOpen));
    setAlwaysOpen(mockEvents.filter(e => e.isAlwaysOpen));
    setUpcomingEvents(
      mockEvents.filter(e => !e.isLive && !e.isAlwaysOpen && e.startTime && minutesUntil(e.startTime) <= 30)
    );
  }, []);

  const renderEventCard = (event: Event) => {
    const isUpcoming = event.startTime && !event.isLive;
    const startsIn = isUpcoming ? minutesUntil(event.startTime!) : null;

    return (
      <Card key={event.id} className="bg-white border border-stone-200 shadow-sm hover:shadow transition-shadow">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-stone-800">{event.title}</h3>
            <Badge className={`${typeColorMap[event.type]} px-2 py-1 text-xs rounded-full`}>
              {event.type}
            </Badge>
          </div>
          <p className="text-stone-600 text-sm mb-3">{event.description}</p>

          {event.host && (
            <p className="text-xs text-stone-500 mb-2">Hosted by {event.host}</p>
          )}

          <div className="flex items-center text-sm text-stone-500 mb-3">
            <Users className="w-3 h-3 mr-1" />
            {event.attendees} {event.attendees === 1 ? 'person' : 'people'} inside
          </div>

          {isUpcoming && (
            <div className="flex items-center text-xs text-stone-500 mb-3">
              <Clock className="w-3 h-3 mr-1" />
              Starts at {formatTime(event.startTime!)} ({startsIn} min)
            </div>
          )}

          <button
            onClick={() => alert(`Joining: ${event.title}`)}
            className={`w-full py-2 rounded-lg font-medium transition ${
              event.isLive || event.isAlwaysOpen
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            {event.isLive || event.isAlwaysOpen ? 'Join Now' : `Join in ${startsIn} min`}
          </button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 mb-3">
            <Calendar size={20} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-800 mb-2">
            Gather With Others
          </h1>
          <p className="text-stone-600 max-w-2xl mx-auto">
            Real conversations happening now — and always a quiet space waiting for you.
          </p>
        </div>

        {/* Live Now */}
        {liveEvents.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-stone-800 mb-4 flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
              Live Now
            </h2>
            <div className="space-y-4">
              {liveEvents.map(renderEventCard)}
            </div>
          </section>
        )}

        {/* Always Open */}
        {alwaysOpen.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-stone-800 mb-4 flex items-center">
              <span className="w-8 h-px bg-stone-300 mr-3"></span>
              Always Open
            </h2>
            <div className="space-y-4">
              {alwaysOpen.map(renderEventCard)}
            </div>
          </section>
        )}

        {/* Starting Soon */}
        {upcomingEvents.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-stone-800 mb-4 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-stone-500" />
              Starting Soon
            </h2>
            <div className="space-y-4">
              {upcomingEvents.map(renderEventCard)}
            </div>
          </section>
        )}

        {/* Empty State (unlikely, but safe) */}
        {liveEvents.length === 0 && alwaysOpen.length === 0 && upcomingEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-stone-600 mb-4">No scheduled events right now.</p>
            <button
              onClick={() => alert('Create a group call')}
              className="text-amber-600 font-medium hover:underline"
            >
              Start a group call →
            </button>
          </div>
        )}

        {/* Footer CTA */}
        <footer className="mt-12 text-center text-stone-500 text-sm">
          <p>All spaces are held with care. Come as you are.</p>
          <button
            onClick={() => alert('Create your own event')}
            className="text-amber-600 hover:underline mt-1"
          >
            Host a circle
          </button>
        </footer>
      </div>
    </div>
  );
}