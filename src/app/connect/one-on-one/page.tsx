// src/app/auth/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AuthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redirect authenticated users away from auth page
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard'); // or wherever you want authenticated users to go
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Handle sign-in or sign-up via your useAuth hook
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  // Only render UI if not authenticated
  if (user) {
    return null; // or redirect (handled above)
  }

  return (
    <div>
      <h1>{authMode === 'sign-in' ? 'Sign In' : 'Sign Up'}</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit">
          {authMode === 'sign-in' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
      <button onClick={() => setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')}>
        {authMode === 'sign-in' ? 'Need an account?' : 'Already have one?'}
      </button>
    </div>
  );
}