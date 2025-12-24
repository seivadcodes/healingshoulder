// src/lib/supabase-server.ts
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function createSupabaseServerClient() {
  // cookies() is synchronous in Server Components
  const cookieStore = cookies();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch,
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );
}