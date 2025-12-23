// src/hooks/useQuickConnect.ts
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createSession } from '@/lib/matching';

export function useQuickConnect() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const connect = async () => {
    setIsLoading(true);
    
    try {
      // Simulate matching delay (2–5 seconds)
      const delay = 2000 + Math.random() * 3000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      // Create a mock session (in real app, this would come from backend)
      const session = await createSession();
      
      // Navigate to the live session
      router.push(`/call/${session.id}`);
    } catch (error) {
      console.error('Quick connect failed:', error);
      alert('Unable to connect right now. Please try again.');
      setIsLoading(false);
    }
  };

  return { connect, isLoading };
}