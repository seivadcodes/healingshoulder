'use client';

// ✅ Disable static generation to avoid build-time Supabase/client errors
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthPage() {
  const { signUp, signIn, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'signin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, {
          data: { full_name: fullName.trim() || null }
        });
      } else {
        await signIn(email, password);
      }

      router.push('/community');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div style={styles.centered}>
        Loading...
      </div>
    );
  }

  return (
    <div style={styles.centered}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </h1>
          <p style={styles.subtitle}>
            {isSignUp
              ? 'Join our community of support'
              : 'Sign in to connect with others'}
          </p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {isSignUp && (
            <div>
              <label htmlFor="fullName" style={styles.label}>
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="email" style={styles.label}>
              Email
            </label>
            <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
          </div>

          <div>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              backgroundColor: loading ? '#d19a00' : '#f59e0b',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={styles.toggle}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <a
            href={isSignUp ? '/auth?mode=signin' : '/auth?mode=signup'}
            style={styles.toggleLink}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </a>
        </div>

        <div style={styles.footer}>
          You’re never alone. This space is here for you.
        </div>
      </div>
    </div>
  );
}

const styles = {
  centered: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
    padding: '20px',
    fontFamily: 'Segoe UI, system-ui, sans-serif'
  } as React.CSSProperties,

  card: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    padding: '32px'
  } as React.CSSProperties,

  header: {
    textAlign: 'center' as const,
    marginBottom: '24px'
  },

  title: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    color: '#1f2937',
    margin: 0
  },

  subtitle: {
    color: '#6b7280',
    marginTop: '8px',
    fontSize: '14px'
  },

  errorBox: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px'
  },

  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  },

  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500' as const,
    color: '#374151',
    marginBottom: '6px'
  },

  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '16px'
  },

  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600' as const
  },

  toggle: {
    textAlign: 'center' as const,
    marginTop: '24px',
    fontSize: '14px',
    color: '#6b7280'
  },

  toggleLink: {
    color: '#f59e0b',
    textDecoration: 'underline',
    fontWeight: '600' as const,
    cursor: 'pointer'
  },

  footer: {
    textAlign: 'center' as const,
    marginTop: '16px',
    fontSize: '12px',
    color: '#9ca3af',
    fontStyle: 'italic' as const
  }
};