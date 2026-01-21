// src/components/modals/SuggestionModal.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';

type SuggestionCategory = 'bug' | 'feature' | 'general' | 'other';

export default function SuggestionModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const supabase = createClient();

  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [category, setCategory] = useState<SuggestionCategory>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const { error } = await supabase.from('suggestions').insert({
        user_id: user?.id || null,
        email: email || null,
        message: message.trim(),
        category,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      setSubmitStatus('success');
      setMessage('');
      setEmail(user?.email || '');
      setTimeout(() => {
        onClose();
        setSubmitStatus('idle');
      }, 1500);
    } catch (err) {
      console.error('Failed to submit suggestion:', err);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6b7280',
            padding: '0.25rem',
          }}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#1e3a8a' }}>
            Help Us Improve
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1.25rem' }}>
            Got an idea, bug report, or suggestion? We’d love to hear from you!
          </p>

          {submitStatus === 'success' ? (
            <div
              style={{
                backgroundColor: '#dcfce7',
                color: '#166534',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                textAlign: 'center',
                fontWeight: 500,
                marginBottom: '1rem',
              }}
            >
              Thank you! Your feedback has been sent.
            </div>
          ) : submitStatus === 'error' ? (
            <div
              style={{
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                textAlign: 'center',
                fontWeight: 500,
                marginBottom: '1rem',
              }}
            >
              Oops! Something went wrong. Please try again.
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="category"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
              >
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as SuggestionCategory)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#f9fafb',
                }}
              >
                <option value="general">General Feedback</option>
                <option value="feature">Feature Request</option>
                <option value="bug">Bug Report</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
              >
                Email (optional)
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#f9fafb',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="message"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
              >
                Your Message
              </label>
              <textarea
                id="message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What would you like us to improve?"
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#f9fafb',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  backgroundColor: isSubmitting || !message.trim() ? '#9ca3af' : '#1e3a8a',
                  color: 'white',
                  fontWeight: 500,
                  border: 'none',
                  cursor: isSubmitting || !message.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}