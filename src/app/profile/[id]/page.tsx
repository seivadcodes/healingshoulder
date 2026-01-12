'use client';

import { useEffect, useState, useCallback, useMemo, } from 'react';
import { useParams } from 'next/navigation';
import { useCall } from '@/context/CallContext';
import SendMessageOverlay from '@/components/modals/SendMessageOverlay';

interface Profile {
  id: string;
  full_name: string | null;
  grief_types: string[];
  country: string | null;
}

const griefLabels: Record<string, string> = {
  parent: 'Loss of a Parent',
  child: 'Loss of a Child',
  spouse: 'Grieving a Partner',
  sibling: 'Loss of a Sibling',
  friend: 'Loss of a Friend',
  pet: 'Pet Loss',
  miscarriage: 'Pregnancy or Infant Loss',
  caregiver: 'Caregiver Grief',
  suicide: 'Suicide Loss',
  other: 'Other Loss',
};

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  
  const { startCall } = useCall();

  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMessageOverlay, setShowMessageOverlay] = useState(false);

  const isValidId = useMemo(() => {
    return id && typeof id === 'string' && id.trim() !== '';
  }, [id]);

  const fetchProfile = useCallback(async () => {
    if (!isValidId) {
      setLoading(false);
      setData(null);
      setError('Invalid profile ID');
      return;
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing Supabase env vars');
      setLoading(false);
      setData(null);
      setError('Server configuration error');
      return;
    }

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`,
        {
          headers: {
            apiKey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Profile not found');
      }

      const profiles: Profile[] = await response.json();
      const profile = profiles[0] || null;

      setData(profile);
      if (!profile) {
        setError('Profile not found');
      }
    } catch (err) {
      console.error('Profile fetch failed:', err);
      setData(null);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [id, isValidId]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);
    fetchProfile();
  }, [fetchProfile]);

  const handleCall = async () => {
    if (!data?.id) return;
    await startCall(
      data.id,
      data.full_name || 'Anonymous',
      'audio',
      data.id,
      data.id
    );
  };

  const handleMessage = () => {
    if (!data?.id) return;
    setShowMessageOverlay(true);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1rem', color: '#444' }}>
        Loading profile...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1rem', color: '#d32f2f' }}>
        {error || 'Profile not found'}
      </div>
    );
  }

  const name = data.full_name || 'Anonymous';
  const firstName = data.full_name ? data.full_name.split(' ')[0] : 'Them';
  const types = Array.isArray(data.grief_types) ? data.grief_types : [];
  const country = data.country;

  return (
    <div style={{ padding: '1rem', maxWidth: '500px', margin: '2rem auto', fontFamily: 'system-ui' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: '#f1f5f9',
            margin: '0 auto 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            color: '#475569',
            fontWeight: 'bold',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>

        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
          {name}
        </h1>

        {country && (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#64748b' }}>
            From {country}
          </p>
        )}

        {types.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
            {types.map((t) => (
              <span
                key={t}
                style={{
                  background: '#fffbeb',
                  color: '#92400e',
                  fontSize: '0.85rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  border: '1px solid #fde68a',
                }}
              >
                {griefLabels[t] || t}
              </span>
            ))}
          </div>
        )}

        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.25rem' }}>
          A space to share and be heard.
        </p>

        {/* Dual Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleCall}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.25rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              minWidth: '120px',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
          >
            📞 Call
          </button>

          <button
            onClick={handleMessage}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.25rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              minWidth: '120px',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
          >
            💬 Message {firstName}
          </button>
        </div>
      </div>
      
      {/* Message Overlay */}
      {showMessageOverlay && (
        <SendMessageOverlay
          isOpen={true}
          targetUserId={data.id}
          targetName={data.full_name || 'Anonymous'}
          onClose={() => setShowMessageOverlay(false)}
        />
      )}
    </div>
  );
}