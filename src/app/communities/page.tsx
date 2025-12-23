// src/app/communities/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, MessageCircle, Clock, Heart } from 'lucide-react';

// Mock community data — later pulled from Supabase
const mockCommunities = [
  {
    id: 'loss-parent',
    name: 'Loss of a Parent',
    description: 'For those grieving the death of a mother or father.',
    membersOnline: 8,
    members: 240,
    recentActivity: 'Just now: “I keep expecting her to call on Sundays.”',
    avatarColors: 'from-amber-200 to-orange-300',
  },
  {
    id: 'suicide-loss',
    name: 'Survivors of Suicide Loss',
    description: 'A safe space to process grief after a death by suicide.',
    membersOnline: 5,
    members: 183,
    recentActivity: '2 min ago: Shared a journal prompt on guilt & forgiveness.',
    avatarColors: 'from-purple-200 to-indigo-300',
  },
  {
    id: 'grief-young',
    name: 'Grieving in Your 20s & 30s',
    description: 'For young adults navigating loss while building life.',
    membersOnline: 12,
    members: 310,
    recentActivity: '5 min ago: Started a thread on “grief at work”.',
    avatarColors: 'from-teal-200 to-cyan-300',
  },
  {
    id: 'miscarriage',
    name: 'Pregnancy & Infant Loss',
    description: 'Support after miscarriage, stillbirth, or infant death.',
    membersOnline: 6,
    members: 275,
    recentActivity: 'Just now: Lighting a virtual candle for baby Liam.',
    avatarColors: 'from-pink-200 to-rose-300',
  },
  {
    id: 'caregiver',
    name: 'Caregiver Grief',
    description: 'For those grieving after long illness or caregiving.',
    membersOnline: 4,
    members: 142,
    recentActivity: '10 min ago: “The silence after they’re gone is so loud.”',
    avatarColors: 'from-stone-200 to-amber-300',
  },
];

export default function CommunitiesPage() {
  const [communities] = useState(mockCommunities);
  const [totalOnline, setTotalOnline] = useState(0);

  useEffect(() => {
    const total = mockCommunities.reduce((sum, c) => sum + c.membersOnline, 0);
    setTotalOnline(total);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 p-4 md:p-6 pt-20 md:pt-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2">
            Find Your Tribe
          </h1>
          <p className="text-stone-600">
            Join a circle where your grief is understood — not explained away.
          </p>
          <div className="mt-3 inline-block px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
            🟢 {totalOnline} people in communities right now
          </div>
        </div>

        {/* Communities Grid */}
        <div className="space-y-5">
          {communities.map((community) => (
            <Link
              key={community.id}
              href={`/group/${community.id}`}
              className="block"
            >
              <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-all duration-200">
                {/* Community Header */}
                <div className="flex items-start gap-4 mb-3">
                  <div
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${community.avatarColors} flex items-center justify-center`}
                  >
                    <Users size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-stone-800">{community.name}</h2>
                    <p className="text-sm text-stone-600">{community.description}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-stone-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {community.members} members
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart size={14} className="text-green-600" />
                    {community.membersOnline} online
                  </span>
                </div>

                {/* Recent Activity */}
                <div className="flex items-start gap-2 text-sm">
                  <MessageCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-stone-700">{community.recentActivity}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="text-center text-stone-500 text-sm mt-10">
          Can’t find your group? <button className="text-amber-700 font-medium">Request a new community</button>
        </p>
      </div>
    </div>
  );
}