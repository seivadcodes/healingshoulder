// src/hooks/useClientAuth.ts
'use client';

import { useState, useEffect } from 'react';
import { createClient, type AuthResponse, type Session } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useClientAuth() {
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isSubscribed = true;

    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (isSubscribed) {
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
        setLoading(false);
      }
    };

    fetchUser();

    // Correct subscription setup
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session: Session | null) => {
        if (isSubscribed) {
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
      }
    );

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return { user, logout, loading };
}