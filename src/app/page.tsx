// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSession } from '@/lib/matching';

// Mock live activity feed — later powered by Supabase Realtime or Pusher
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
  const [activities] = useState(mockLiveActivities);
  const [heartbeatClass, setHeartbeatClass] = useState('animate-pulse');
  const [isConnecting, setIsConnecting] = useState(false);

  // Simulate online count fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount((prev) => {
        const fluctuation = Math.floor(Math.random() * 6) - 2; // -2 to +3
        return Math.max(10, prev + fluctuation);
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Subtle breathing animation for heartbeat circle
  useEffect(() => {
    const anim = setInterval(() => {
      setHeartbeatClass('animate-pulse opacity-90');
      setTimeout(() => setHeartbeatClass('animate-pulse opacity-100'), 500);
    }, 4000);
    return () => clearInterval(anim);
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
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 p-4 md:p-6">
      {/* Main Heartbeat Circle */}
      <div
        className={`relative flex flex-col items-center justify-center w-64 h-64 md:w-80 md:h-80 rounded-full bg-gradient-to-br from-amber-100 to-stone-200 border border-stone-300 shadow-lg my-12 transition-all duration-1000 ${heartbeatClass}`}
      >
        <div className="text-center px-4 z-10">
          <h1 className="text-2xl md:text-3xl font-medium text-stone-800 mb-2">
            Someone is here with you.
          </h1>
          <p className="text-stone-600 text-lg">Right now.</p>
        </div>
        {/* Pulsing glow effect */}
        <div className="absolute inset-0 rounded-full bg-amber-200 opacity-30 animate-ping"></div>
      </div>

      {/* Primary Action Buttons */}
      <div className="w-full max-w-md space-y-4 mb-10">
        <button
          onClick={handleQuickConnect}
          disabled={isConnecting}
          className={`w-full py-4 font-semibold rounded-xl shadow-md transition transform active:scale-[0.98] ${
            isConnecting
              ? 'bg-amber-400 text-amber-100 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600 text-white hover:scale-[1.02]'
          }`}
        >
          {isConnecting ? 'Finding someone...' : '🟠 Talk Now'}
        </button>

        <button
          onClick={handleFindTribe}
          className="w-full py-4 bg-stone-800 hover:bg-stone-700 text-white font-semibold rounded-xl shadow-md transition transform hover:scale-[1.02] active:scale-[0.98]"
        >
          🔵 Find Your Tribe
        </button>
      </div>

      {/* Live Presence Indicator */}
      <div className="text-center mb-6">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          🟢 {onlineCount} people online · Tap to connect
        </span>
      </div>

      {/* Live Activity Feed */}
      <div className="w-full max-w-md">
        <h2 className="text-stone-700 font-medium mb-3 text-left">What’s happening now</h2>
        <div className="space-y-3">
          {activities.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-white rounded-lg border border-stone-200 shadow-sm hover:shadow-md transition cursor-pointer"
              onClick={() => alert(`Action: ${item.action}`)}
            >
              <p className="text-stone-800 text-sm md:text-base">{item.message}</p>
              <span className="text-xs text-amber-600 font-medium mt-2 inline-block">
                {item.action} →
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}