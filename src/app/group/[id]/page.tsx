// src/app/group/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Users, MessageCircle, Clock, Heart } from 'lucide-react';

// Mock group data — keyed by ID
const MOCK_GROUPS: Record<string, any> = {
  'loss-parent': {
    id: 'loss-parent',
    name: 'Loss of a Parent',
    description: 'For those grieving the death of a mother or father.',
    membersOnline: 7,
    recentMessages: [
      { user: 'Maya', text: 'I keep expecting her to call on Sundays.' },
      { user: 'James', text: 'My dad’s favorite chair still sits empty. I can’t move it.' },
      { user: 'Elena', text: 'Today would’ve been her 70th birthday. I lit a candle.' },
    ],
  },
  'suicide-loss': {
    id: 'suicide-loss',
    name: 'Survivors of Suicide Loss',
    description: 'A safe space to process grief after a death by suicide.',
    membersOnline: 4,
    recentMessages: [
      { user: 'David', text: 'Shared a journal prompt on guilt & forgiveness.' },
      { user: 'Amina', text: '“Why” is the heaviest word I carry.' },
    ],
  },
  'grief-young': {
    id: 'grief-young',
    name: 'Grieving in Your 20s & 30s',
    description: 'For young adults navigating loss while building life.',
    membersOnline: 11,
    recentMessages: [
      { user: 'Leo', text: 'Started a thread on “grief at work”.' },
      { user: 'Nia', text: 'My friends don’t get why I’m not “over it” after a year.' },
    ],
  },
  'miscarriage': {
    id: 'miscarriage',
    name: 'Pregnancy & Infant Loss',
    description: 'Support after miscarriage, stillbirth, or infant death.',
    membersOnline: 5,
    recentMessages: [
      { user: 'Claire', text: 'Lighting a virtual candle for baby Liam.' },
      { user: 'Rosa', text: 'Today I finally said their name out loud.' },
    ],
  },
  'caregiver': {
    id: 'caregiver',
    name: 'Caregiver Grief',
    description: 'For those grieving after long illness or caregiving.',
    membersOnline: 3,
    recentMessages: [
      { user: 'Tom', text: 'The silence after they’re gone is so loud.' },
      { user: 'Grace', text: 'I miss the rhythm of our days, even the hard ones.' },
    ],
  },
};

export default function GroupSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGroup = () => {
      try {
        const g = MOCK_GROUPS[id] || MOCK_GROUPS['loss-parent'];
        setGroup(g);
        setLoading(false);
      } catch (e) {
        router.push('/communities');
      }
    };

    if (id) {
      // Simulate brief load
      const timer = setTimeout(loadGroup, 600);
      return () => clearTimeout(timer);
    }
  }, [id, router]);

  const handleJoin = () => {
    setJoined(true);
    // In real app: call API to join group session
  };

  const handleLeave = () => {
    router.push('/communities');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-amber-500 rounded-full animate-bounce mx-auto mb-4"></div>
          <p className="text-stone-600">Entering the circle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex flex-col p-4 pt-20">
      <div className="max-w-2xl mx-auto w-full">
        {/* Group Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-stone-200 border border-stone-300 flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-amber-700" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800">{group.name}</h1>
          <p className="text-stone-600 text-sm mt-1">{group.description}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
            <Heart size={14} className="text-green-600" />
            {group.membersOnline} people in the circle
          </div>
        </div>

        {/* Messages Area */}
        <div className="bg-white/70 backdrop-blur-sm border border-stone-200 rounded-xl p-4 mb-6 h-64 overflow-y-auto">
          {group.recentMessages.length > 0 ? (
            <div className="space-y-4">
              {group.recentMessages.map((msg: any, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {msg.user.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-stone-800 text-sm">{msg.user}</p>
                    <p className="text-stone-700">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-500 text-center italic">
              Be the first to share something with the circle.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!joined ? (
            <button
              onClick={handleJoin}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-full shadow transition hover:scale-[1.02] active:scale-[0.98]"
            >
              🤝 Join This Circle
            </button>
          ) : (
            <button
              onClick={() => alert('You’re now part of the conversation. Type below soon!')}
              className="flex-1 py-3 bg-stone-700 text-white font-medium rounded-full"
              disabled
            >
              You’ve Joined
            </button>
          )}
          <button
            onClick={handleLeave}
            className="px-5 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-full font-medium transition"
          >
            Leave
          </button>
        </div>

        <p className="text-xs text-center text-stone-500 mt-6">
          All circles are private, respectful, and moderated by peers who've walked this path.
        </p>
      </div>
    </div>
  );
}