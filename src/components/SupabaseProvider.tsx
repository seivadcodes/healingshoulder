// components/SupabaseProvider.tsx
'use client';

import { createContext, useContext, useState } from 'react';
import { createClient } from '@/lib/supabase'; // ✅ reuse your validated client
import type { Database } from '@/types/supabase';

const SupabaseContext = createContext<ReturnType<typeof createClient> | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const client = useContext(SupabaseContext);
  if (!client) throw new Error('useSupabase must be used within SupabaseProvider');
  return client;
};