// src/app/call/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSession } from '@/lib/matching';

export default function CallSession() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const sess = await getSession(id);
        if (!sess) throw new Error('Session not found');
        setSession(sess);
      } catch (e) {
        console.error(e);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex flex-col items-center justify-center p-6">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-amber-500 rounded-full mx-auto mb-4 animate-bounce"></div>
          <p className="text-stone-600">Connecting securely...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex flex-col p-4 pt-12">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header / Peer Info */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-100 to-stone-200 border border-stone-300 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🫂</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-800">
            You’re talking with {session.peer.name}
          </h1>
          <p className="text-stone-600 mt-2 text-sm">{session.peer.background}</p>
          <p className="text-xs text-stone-500 mt-1">{session.peer.responseTime}</p>
        </div>

        {/* Message Area */}
        <div className="bg-white/70 backdrop-blur-sm border border-stone-200 rounded-xl p-4 mb-6 h-64 flex flex-col justify-end">
          <div className="text-stone-500 text-sm italic text-center">
            This is a safe space. Speak from the heart.
          </div>
        </div>

        {/* Input + End Call */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Type your message... (coming soon)"
            className="flex-1 px-4 py-3 rounded-full border border-stone-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            disabled
          />
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-stone-800 text-white rounded-full font-medium hover:bg-stone-700 active:scale-95 transition transform"
          >
            End
          </button>
        </div>

        {/* Privacy Note */}
        <p className="text-xs text-center text-stone-500 mt-6">
          All conversations are private and never recorded.
        </p>
      </div>
    </div>
  );
}