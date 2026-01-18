// src/lib/auth-server.ts
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}