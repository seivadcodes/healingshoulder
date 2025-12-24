// src/hooks/useClientAuth.ts
'use client';

import { useState, useEffect } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useClientAuth() {
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 1. Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        handleSession(session);
        setLoading(false); // ✅ Only set loading false once, after initial resolve
      }
    });

    // 2. Listen for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        if (isMounted) {
          handleSession(session);
          // ❌ Do NOT setLoading(false) here — loading is only for initial state
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };

    function handleSession(session: Session | null) {
      if (session?.user && session.user.email) {
        const name =
          session.user.user_metadata?.full_name ||
          session.user.email.split('@')[0] ||
          'User';
        setUser({
          id: session.user.id,
          email: session.user.email,
          name,
        });
      } else {
        setUser(null);
      }
    }
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    // setUser(null); // Optional: listener will handle this, but safe to keep
  };

  return { user, logout, loading };
}