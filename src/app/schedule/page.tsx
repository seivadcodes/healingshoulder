﻿// src/app/schedule/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Event {
  id: string;
  title: string;
  description: string | null;
  host_id: string | null;
  host_name: string | null;
  start_time: string;
  duration: number;
  grief_types: string[] | null;
  is_recurring: boolean;
  image_url: string | null;
  created_at: string;
}

export default function SchedulePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchUserDataAndEvents = async () => {
      try {
        // ✅ CORRECT DESTRUCTURING
        const { data: { session }, error: authError } = await supabase.auth.getSession();

        if (authError || !session?.user) {
          // Not logged in — still show public events
          // But don't set user
        } else {
          setUser(session.user);

          // Check if profile exists
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .single();

          if (profileError || !profile) {
            // Optional: redirect to setup if needed, but allow viewing events
          }
        }

        // Fetch upcoming events (public)
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .gte('start_time', now)
          .order('start_time', { ascending: true });

        if (error) throw error;

        setEvents(data || []);
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError('Unable to load events.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserDataAndEvents();
  }, [supabase, router]);

  const formatEventTime = (isoString: string): string => {
    const eventDate = new Date(isoString);
    return eventDate.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleCreateEvent = () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    router.push('/schedule/create');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 p-4 pb-24">
        <h1 className="text-2xl font-bold text-gray-800 mt-8 mb-6">Upcoming Events</h1>
        <div className="max-w-2xl mx-auto space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-32 bg-gray-200 rounded-lg mb-3"></div>
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mt-8 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Upcoming Events</h1>
          {user && (
            <button
              onClick={handleCreateEvent}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              + Create Event
            </button>
          )}
        </div>

        {error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center">{error}</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <p>No upcoming events right now.</p>
            <p className="mt-2">Check back soon — healing happens together.</p>
            {user && (
              <button
                onClick={handleCreateEvent}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
              >
                Be the first to host
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {events.map((event) => (
              <Link href={`/schedule/${event.id}`} key={event.id} className="block">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
                  {/* Event Image */}
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-40 object-cover rounded-t-xl"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-amber-50 to-indigo-50 rounded-t-xl flex items-center justify-center">
                      <span className="text-4xl">🕯️</span>
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="font-bold text-gray-900 text-lg">{event.title}</h2>
                        {event.description && (
                          <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                        <p className="text-gray-500 text-xs mt-2">
                          Hosted by: <span className="font-medium">{event.host_name || 'A caring friend'}</span>
                        </p>
                        {event.grief_types && event.grief_types.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {event.grief_types.slice(0, 3).map((type) => (
                              <span
                                key={type}
                                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                              >
                                {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                              </span>
                            ))}
                            {event.grief_types.length > 3 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                                +{event.grief_types.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {event.is_recurring && (
                        <span className="flex-shrink-0 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                          🔁 Recurring
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center text-sm text-gray-500">
                      <span>🗓️ {formatEventTime(event.start_time)}</span>
                      <span className="ml-3">⏱️ {event.duration} min</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-10 text-center text-sm text-gray-500">
          <p>Events are shown in your local time.</p>
        </div>
      </div>
    </div>
  );
}