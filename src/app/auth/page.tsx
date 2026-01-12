'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const EMAIL_STORAGE_KEY = 'auth.email';

type CountryInfo = {
  country: string; // e.g., "KE", "US", "GB"
};

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const router = useRouter();

  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userCountry, setUserCountry] = useState<string | null>(null);

  // Redirect if authenticated
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Detect returning user via saved email
  useEffect(() => {
    if (loading) return;
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem(EMAIL_STORAGE_KEY);
      if (savedEmail && savedEmail.includes('@')) {
        setEmail(savedEmail);
        setAuthMode('sign-in');
      }
    }
  }, [loading]);

  // Fetch user's country on mount (non-blocking)
  useEffect(() => {
    const fetchCountry = async () => {
      try {
        const res = await fetch('/api/country');
        if (!res.ok) throw new Error('Failed to fetch country');
        const data: CountryInfo = await res.json();
        setUserCountry(data.country);
      } catch {
  console.warn('Could not detect country, proceeding without it');
}
    };

    fetchCountry();
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (typeof window !== 'undefined' && value.includes('@')) {
      localStorage.setItem(EMAIL_STORAGE_KEY, value);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (authMode === 'sign-in') {
        await signIn(email, password);
      } else {
        if (!fullName.trim()) {
          throw new Error('Please enter your name.');
        }
        await signUp(email, password, fullName.trim(), userCountry);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please try again.');
      }
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1.1rem' }}>
        Checking your session...
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        {authMode === 'sign-in' ? 'Welcome Back' : 'Create Your Account'}
      </h1>

      {error && (
        <div
          style={{
            color: 'red',
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: '#ffebee',
            borderRadius: '4px',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {authMode === 'sign-up' && (
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '1rem',
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="Email"
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '1rem',
            }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (6+ characters)"
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '1rem',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.9 : 1,
            fontSize: '1rem',
            fontWeight: '600',
            transition: 'background-color 0.2s',
          }}
        >
          {submitting
            ? 'Processing...'
            : authMode === 'sign-in'
            ? 'Sign In'
            : 'Create Account'}
        </button>
      </form>

      <button
        type="button"
        onClick={() =>
          setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')
        }
        style={{
          marginTop: '1.25rem',
          background: 'none',
          border: 'none',
          color: '#4f46e5',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: '500',
        }}
      >
        {authMode === 'sign-in'
          ? "Don't have an account? Sign up"
          : 'Already have an account? Sign in'}
      </button>
      
      {authMode === 'sign-up' && (
        <p style={{ 
          marginTop: '1rem', 
          fontSize: '0.85rem', 
          color: '#666',
          fontStyle: 'italic'
        }}>
          We detect your country to personalize your experience 
        </p>
      )}
    </div>
  );
}