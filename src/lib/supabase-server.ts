import { SupabaseClient, createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Use a different name for the imported createClient to avoid conflict
// Then define your own createClient
export const createClient = (): SupabaseClient => {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Cookie: cookieStore.toString(),
      },
    },
  });
};