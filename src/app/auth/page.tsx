// src/app/auth/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const router = useRouter();

  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (authMode === 'sign-in') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      // Redirect handled automatically by onAuthStateChange in useAuth
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Checking session...
      </div>
    );
  }

  // If user is present, they'll be redirected above — this is just a safety net
  if (user) return null;

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        {authMode === 'sign-in' ? 'Sign In' : 'Create Account'}
      </h1>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#ffebee', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.8 : 1,
          }}
        >
          {submitting ? 'Processing...' : authMode === 'sign-in' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')}
        style={{
          marginTop: '1rem',
          background: 'none',
          border: 'none',
          color: '#0070f3',
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        {authMode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
      </button>
    </div>
  );
}