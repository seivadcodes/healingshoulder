// src/lib/supabase/auth.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Reuse the same client everywhere — ensures session persistence
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Optional: Stronger typing (uncomment if you want better autocompletion)
// import type { SignUpWithPasswordCredentials } from '@supabase/supabase-js';

export { supabase };

export const auth = {
  /**
   * Register a new user
   */
  async signUp(
    email: string,
    password: string,
    options?: {
      data?: Record<string, any>;
      emailRedirectTo?: string;
    }
  ) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options, // ← now correctly inside the single config object
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign in existing user with email + password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign out current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current session (use on client)
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Get current user (requires active session)
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },
};