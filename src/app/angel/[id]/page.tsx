'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const griefLabels = {
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

interface Angel {
  id: string;
  profile_id: string;
  name: string;
  relationship?: string | null;
  photo_url?: string | null;
  birth_date?: string | null;
  death_date?: string | null;
  tribute?: string | null;
  grief_type: keyof typeof griefLabels;
  is_private: boolean;
  allow_comments: boolean;
}

export default function AngelDetailPage() {
  const params = useParams<{ id: string }>(); // ✅ Typed!
  const [angel, setAngel] = useState<Angel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAngel = async () => {
      // ✅ params.id is already available — no need for `use()`
      const { id } = params;

      if (!id || typeof id !== 'string') {
        setError('Invalid memorial ID.');
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('angels')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        setAngel(data);
      } catch (err) {
        console.error('Failed to load angel:', err);
        setError('Memorial not found or access denied.');
      } finally {
        setLoading(false);
      }
    };

    fetchAngel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]); // ✅ Safe: params.id is stable and string-like

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading memorial...
      </div>
    );
  }

  if (error || !angel) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Link
          href={`/profile/${angel.profile_id}/angels`}
          style={{
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '0.95rem',
            fontWeight: '600',
          }}
        >
          ← Back to memorials
        </Link>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '1.75rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          {angel.photo_url ? (
            <div style={{ width: '130px', height: '130px', borderRadius: '50%', overflow: 'hidden' }}>
              <Image
                src={angel.photo_url}
                alt={angel.name}
                width={130}
                height={130}
                style={{ objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div
              style={{
                width: '130px',
                height: '130px',
                borderRadius: '50%',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '3rem',
                color: '#64748b',
              }}
            >
              {angel.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 0.25rem', fontSize: '2rem', color: '#1e293b' }}>
              {angel.name}
            </h1>
            {angel.relationship && (
              <p style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: '#64748b' }}>
                {angel.relationship}
              </p>
            )}
            <p style={{ margin: 0, fontSize: '1rem', color: '#94a3b8' }}>
              {griefLabels[angel.grief_type]}
            </p>
          </div>
        </div>

        {angel.tribute && (
          <div style={{ marginTop: '1.75rem', padding: '1.25rem', background: '#f9fafb', borderRadius: '10px' }}>
            <blockquote style={{ margin: 0, fontStyle: 'italic', color: '#334155', lineHeight: 1.7, fontSize: '1.05rem' }}>
              “{angel.tribute}”
            </blockquote>
          </div>
        )}

        {(angel.birth_date || angel.death_date) && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '1rem' }}>
            {angel.birth_date && <>Born: {new Date(angel.birth_date).toLocaleDateString()}<br /></>}
            {angel.death_date && <>Died: {new Date(angel.death_date).toLocaleDateString()}</>}
          </div>
        )}

        {angel.allow_comments && (
          <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.95rem', color: '#94a3b8' }}>
            💬 Others may leave kind words in memory of {angel.name}.
          </div>
        )}
      </div>
    </div>
  );
}