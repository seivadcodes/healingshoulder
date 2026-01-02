﻿// src/app/schedule/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Loader2,
  Calendar,
  Clock,
  User,
  ChevronLeft,
} from 'lucide-react';
import { format, isPast, isWithinInterval } from 'date-fns';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  duration: number;
  host_name: string | null;
  image_url: string | null;
  grief_types: string[] | null;
  is_recurring: boolean;
  created_at: string;
  attendee_count: number;
}

export default function SchedulePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [userRSVPs, setUserRSVPs] = useState<Set<string>>(new Set());
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get user session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);

          // Fetch user's RSVPs
          const { data: rsvpData, error: rsvpError } = await supabase
            .from('event_attendees')
            .select('event_id')
            .eq('user_id', session.user.id);

          if (rsvpError) throw rsvpError;

          const rsvpSet = new Set(rsvpData.map((rsvp: any) => rsvp.event_id));
          setUserRSVPs(rsvpSet);
        }

        // Fetch events WITH attendee counts
        const { data, error: fetchError } = await supabase
          .from('events_with_attendee_count')
          .select('*')
          .order('start_time', { ascending: true });

        if (fetchError) throw fetchError;

        // Filter out past non-recurring events
        const now = new Date();
        const filteredEvents = data.filter(event =>
          event.is_recurring || !isPast(new Date(event.start_time))
        );

        setEvents(filteredEvents);
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message || 'Failed to load events.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const handleRSVP = async (eventId: string) => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    const wasAttending = userRSVPs.has(eventId);
    setRsvpLoading(true);

    try {
      if (wasAttending) {
        // Cancel RSVP
        const { error } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.id);

        if (error) throw error;

        setUserRSVPs((prev) => {
          const newSet = new Set(prev);
          newSet.delete(eventId);
          return newSet;
        });

        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, attendee_count: Math.max(0, e.attendee_count - 1) } : e
          )
        );
      } else {
        // Create RSVP
        const { error } = await supabase
          .from('event_attendees')
          .insert({ event_id: eventId, user_id: user.id });

        if (error) {
          // Handle duplicate key (already RSVP'd)
          if (error.code === '23505') {
            // Treat as success — user is already attending
            setUserRSVPs((prev) => new Set(prev).add(eventId));
            // Ensure count isn't double-incremented
            setEvents((prev) =>
              prev.map((e) =>
                e.id === eventId && e.attendee_count === 0
                  ? { ...e, attendee_count: 1 }
                  : e
              )
            );
            setRsvpLoading(false);
            return;
          }
          throw error;
        }

        setUserRSVPs((prev) => new Set(prev).add(eventId));

        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, attendee_count: e.attendee_count + 1 } : e
          )
        );
      }
    } catch (err: any) {
      console.error('RSVP error:', err);
      alert(
        `Failed to ${wasAttending ? 'cancel' : 'create'} RSVP: ${err.message || 'Unknown error'}`
      );
      // Revert optimistic update on hard failure (optional but safe)
      if (!wasAttending) {
        setUserRSVPs((prev) => {
          const newSet = new Set(prev);
          newSet.delete(eventId);
          return newSet;
        });
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, attendee_count: Math.max(0, e.attendee_count - 1) } : e
          )
        );
      } else {
        setUserRSVPs((prev) => new Set(prev).add(eventId));
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, attendee_count: e.attendee_count + 1 } : e
          )
        );
      }
    } finally {
      setRsvpLoading(false);
    }
  };

  const formatEventTime = (isoString: string): string => {
    const eventDate = new Date(isoString);
    return format(eventDate, 'PPpp');
  };

  const isEventLive = (event: Event): boolean => {
    const now = new Date();
    const startTime = new Date(event.start_time);
    const endTime = new Date(startTime.getTime() + event.duration * 60000);
    return isWithinInterval(now, { start: startTime, end: endTime });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 p-4">
        <div className="max-w-4xl mx-auto pt-8">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-4 space-y-3">
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
      <div className="text-center p-6 max-w-md">
        <div className="text-4xl mb-4">🕯️</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Failed to load events</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Try Again
        </Button>
      </div>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/" passHref>
            <Button variant="ghost" className="mr-4">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Home
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Upcoming Gatherings</h1>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">🕯️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">No upcoming events</h2>
            <p className="text-gray-600 mb-4">Check back soon for new healing gatherings</p>
            <Link href="/">
              <Button variant="outline" className="w-full">
                Explore Resources
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events.map((event) => {
              const isLive = isEventLive(event);
              const isAttending = userRSVPs.has(event.id);

              return (
                <Card
                  key={event.id}
                  className="border-0 shadow-sm overflow-hidden transition-all hover:shadow-md"
                >
                  {event.image_url ? (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-amber-50 to-indigo-50 flex items-center justify-center">
                      <span className="text-6xl">🕯️</span>
                    </div>
                  )}

                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-bold text-gray-900 line-clamp-1">
                      {event.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatEventTime(event.start_time)}
                      </span>
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {event.duration} min
                      </span>
                      {event.is_recurring && (
                        <span className="text-purple-600 flex items-center">
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Recurring
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {event.host_name && (
                      <p className="text-gray-700 flex items-center">
                        <User className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="font-medium">Hosted by:</span> {event.host_name}
                      </p>
                    )}

                    {event.description && (
                      <p className="text-gray-600 line-clamp-3">{event.description}</p>
                    )}

                    {event.grief_types && event.grief_types.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {event.grief_types.map((type) => (
                          <span
                            key={type}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                          >
                            {type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {event.attendee_count > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        {event.attendee_count}{' '}
                        {event.attendee_count === 1 ? 'person' : 'people'} attending
                      </p>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0">
                    <div className="w-full space-y-2">
                      {isLive && (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() =>
                            alert('Join live event functionality will be implemented later')
                          }
                        >
                          Join Live Gathering
                        </Button>
                      )}

                      {isAttending ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleRSVP(event.id)}
                          disabled={rsvpLoading}
                        >
                          {rsvpLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            "Withdraw RSVP"
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          className="w-full"
                          onClick={() => handleRSVP(event.id)}
                          disabled={rsvpLoading || (isLive && !isAttending)}
                        >
                          {rsvpLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            "Reserve Your Spot"
                          )}
                        </Button>
                      )}

                      {isLive && !isAttending && (
                        <p className="text-xs text-center text-gray-500 mt-1">
                          RSVP required to join live events
                        </p>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>All times shown in your local timezone</p>
          <p className="mt-1">Recurring events appear weekly at the same time</p>
        </div>
      </div>
    </div>
  );
}

// Helper component for recurring icon
const RefreshCw = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21.5 2v6h-6M2.5 22v-6h6" />
    <path d="M19.8 9.9a9.9 9.9 0 1 0-10.6 10.6" />
  </svg>
);