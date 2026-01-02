﻿// app/events/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

type Event = {
  id: string;
  title: string;
  description: string | null;
  host_name: string | null;
  start_time: string;
  duration: number;
  max_attendees: number | null;
  image_url: string | null;
};

type Reservation = {
  event_id: string;
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        // Optional: redirect to login, or show "sign in to reserve"
        console.warn('User not signed in');
      }

      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, description, host_name, start_time, duration, max_attendees, image_url')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        setEvents([]);
      } else {
        setEvents(eventsData || []);
      }

      // Fetch total attendee counts per event
      const { data: countData, error: countError } = await supabase
        .from('reservations')
        .select('event_id')
        .in('event_id', (eventsData || []).map(e => e.id));

      if (!countError && countData) {
        const counts: Record<string, number> = {};
        countData.forEach((r: { event_id: string }) => {
          counts[r.event_id] = (counts[r.event_id] || 0) + 1;
        });
        setAttendeeCounts(counts);
      }

      // Fetch user's reservations
      if (user) {
        const { data: myRes, error: resError } = await supabase
          .from('reservations')
          .select('event_id')
          .eq('user_id', user.id);

        if (!resError) {
          setReservations(myRes || []);
        }
      }

      setLoading(false);
    };

    init();
  }, [supabase]);

  // Helper: is user reserved for this event?
  const isReserved = (eventId: string) => {
    return reservations.some(r => r.event_id === eventId);
  };

  const handleReserve = async (eventId: string) => {
    if (!user) {
      alert('Please sign in to reserve a spot.');
      return;
    }

    const { error } = await supabase
      .from('reservations')
      .insert({ event_id: eventId, user_id: user.id });

    if (error) {
      console.error('Reservation failed:', error.message);
      alert('Failed to reserve. You may have already reserved or the event is full.');
    } else {
      // Optimistically update UI
      setReservations(prev => [...prev, { event_id: eventId }]);
      setAttendeeCounts(prev => ({
        ...prev,
        [eventId]: (prev[eventId] || 0) + 1,
      }));
    }
  };

  const handleUnreserve = async (eventId: string) => {
    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user!.id);

    if (error) {
      console.error('Unreserve failed:', error);
      alert('Failed to cancel reservation.');
    } else {
      // Optimistically update UI
      setReservations(prev => prev.filter(r => r.event_id !== eventId));
      setAttendeeCounts(prev => ({
        ...prev,
        [eventId]: Math.max(0, (prev[eventId] || 1) - 1),
      }));
    }
  };

  if (loading) {
    return <div className="p-6">Loading events...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upcoming Events</h1>

      {events.length === 0 ? (
        <p>No upcoming events.</p>
      ) : (
        <div className="space-y-6">
          {events.map((event) => {
            const startTime = new Date(event.start_time);
            const formattedDate = startTime.toLocaleDateString();
            const formattedTime = startTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const currentAttendees = attendeeCounts[event.id] || 0;
            const isFull = !!(event.max_attendees && currentAttendees >= event.max_attendees);
            const reserved = isReserved(event.id);

            return (
              <div key={event.id} className="border rounded-lg p-5 bg-white shadow-sm">
                {event.image_url && (
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-40 object-cover rounded-md mb-4"
                  />
                )}
                <h2 className="text-xl font-semibold">{event.title}</h2>
                <p className="text-gray-600 mt-1">{event.description}</p>
                <p className="text-sm text-gray-500 mt-2">
                  🕒 {formattedDate} at {formattedTime}
                </p>
                {event.host_name && (
                  <p className="text-sm text-gray-500">🎤 Host: {event.host_name}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  👥 {currentAttendees} / {event.max_attendees ?? '∞'} attending
                </p>

                <div className="mt-4">
                  {reserved ? (
                    <button
                      onClick={() => handleUnreserve(event.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Cancel Reservation
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReserve(event.id)}
                      disabled={!user || isFull}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        !user
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : isFull
                          ? 'bg-yellow-400 text-gray-700 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                    >
                      {isFull ? 'Event Full' : user ? 'Reserve Spot' : 'Sign In to Reserve'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}