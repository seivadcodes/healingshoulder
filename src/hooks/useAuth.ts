// src/hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, options?: { data?: Record<string, any> }) => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: options?.data, // ✅ 'data' is a valid key
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + '/connect' : undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    []
  );

  const signOut = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (isSubscribed) {
        setUser(data.session?.user || null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isSubscribed) {
        setUser(session?.user || null);
        setLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, signIn, signUp, signOut };
}