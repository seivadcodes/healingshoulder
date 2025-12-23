// src/app/call/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSession } from '@/lib/matching';

export default function CallSession() {
  const { id } = useParams();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const sess = await getSession(id as string);
        setSession(sess);
      } catch (e) {
        router.push('/');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-primary rounded-full mx-auto mb-4 animate-bounce"></div>
          <p className="text-muted-foreground">Connecting securely...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col p-4 pt-12">
      <div className="max-w-2xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🫂</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            You’re talking with {session.peer.name}
          </h1>
          <p className="text-muted-foreground mt-2">{session.peer.background}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {session.peer.responseTime}
          </p>
        </div>

        <div className="bg-muted/30 rounded-xl p-4 mb-6 h-64 flex items-center justify-center">
          <p className="text-muted-foreground text-center">
            This is a safe space. Speak from the heart.
          </p>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 rounded-full border bg-background"
            disabled
          />
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-destructive text-destructive-foreground rounded-full font-medium"
          >
            End
          </button>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6">
          All conversations are private and never recorded.
        </p>
      </div>
    </div>
  );
}