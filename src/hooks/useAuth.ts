// src/hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';

// Helper to ensure profile exists and has full_name
async function ensureProfileExists(user: User) {
  if (!user?.id) return;

  const supabase = createClient();

  const { data: existing, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  // If profile doesn't exist, create it
  if (fetchError?.code === 'PGRST116') {
    // Derive full_name: use user_metadata if available, else fallback
    const fullName =
      (user.user_metadata as any)?.full_name ||
      user.email?.split('@')[0] ||
      'Friend';

    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        created_at: new Date().toISOString(),
      });

    if (insertError && insertError.code !== '23505') {
      console.error('Failed to create profile:', insertError);
    }
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const router = useRouter();

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  // 👇 Accept fullName during sign-up
  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }, // 👈 stored in auth.users.user_metadata
          emailRedirectTo: typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined,
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
    setUser(null);
    router.push('/auth');
  }, [router]);

  useEffect(() => {
    let isSubscribed = true;
    const supabase = createClient();

    const clearStaleSession = () => {
      try {
        if (typeof window !== 'undefined') {
          Object.keys(localStorage).forEach((key) => {
            if (
              key.startsWith('supabase.auth.token') ||
              key.startsWith('supabase.session') ||
              key.startsWith('sb-')
            ) {
              localStorage.removeItem(key);
            }
          });
        }
      } catch (e) {
        console.warn('Unable to clear stale session data:', e);
      }
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error);
        if (isSubscribed) {
          setLoading(false);
          setSessionChecked(true);
        }
        return;
      }

      if (isSubscribed && session?.user) {
        ensureProfileExists(session.user);
        setUser(session.user);
      } else if (isSubscribed) {
        setUser(null);
      }

      if (isSubscribed) {
        setLoading(false);
        setSessionChecked(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isSubscribed) return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          if (isSubscribed) {
            setLoading(false);
            setSessionChecked(true);
          }
          const currentPath = window.location.pathname;
          if (
            !currentPath.startsWith('/auth') &&
            !currentPath.startsWith('/onboarding')
          ) {
            router.push('/auth');
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            ensureProfileExists(session.user);
            setUser(session.user);
          }
          if (isSubscribed) {
            setLoading(false);
            setSessionChecked(true);
          }
        } else if (event === 'USER_UPDATED') {
          if (session?.user) {
            setUser(session.user);
          }
        }

        if (isSubscribed) {
          setLoading(false);
          setSessionChecked(true);
        }
      }
    );

    clearStaleSession();

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return {
    user,
    loading,
    sessionChecked,
    signIn,
    signUp,
    signOut,
  };
}