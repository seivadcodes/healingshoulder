// src/app/modresources/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

type Resource = {
  id: string;
  title: string;
  excerpt: string;
  type: string;
  tags: string[];
  content_warnings: string[];
  book_author?: string;
  book_quote?: string;
  external_url?: string;
  community_source?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export default function ModResourcesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPending = async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
      } else {
        setResources(data || []);
      }
      setLoading(false);
    };

    fetchPending();
  }, [supabase]);

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from('resources')
      .update({ status: 'approved' })
      .eq('id', id);

    if (!error) {
      setResources(resources.filter(r => r.id !== id));
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from('resources')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (!error) {
      setResources(resources.filter(r => r.id !== id));
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Moderate Resources</h1>

      {resources.length === 0 ? (
        <p>No pending resources.</p>
      ) : (
        resources.map((res) => (
          <div key={res.id} style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem', borderRadius: '0.5rem' }}>
            <h3 style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{res.title}</h3>
            <p style={{ fontSize: '0.875rem', color: '#555', marginBottom: '0.5rem' }}>{res.excerpt}</p>
            <p style={{ fontSize: '0.875rem', color: '#777' }}><strong>Type:</strong> {res.type}</p>
            {res.tags.length > 0 && (
              <p style={{ fontSize: '0.875rem', color: '#777' }}>
                <strong>Tags:</strong> {res.tags.join(', ')}
              </p>
            )}
            {res.content_warnings.length > 0 && (
              <p style={{ fontSize: '0.875rem', color: '#777' }}>
                <strong>Warnings:</strong> {res.content_warnings.join(', ')}
              </p>
            )}
            {res.book_author && (
              <p style={{ fontSize: '0.875rem', color: '#777' }}>
                <strong>Author:</strong> {res.book_author}
              </p>
            )}
            {res.external_url && (
              <p style={{ fontSize: '0.875rem', color: '#777' }}>
                <strong>Link:</strong> <a href={res.external_url} target="_blank" rel="noopener noreferrer">{res.external_url}</a>
              </p>
            )}
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => handleApprove(res.id)}
                style={{
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                }}
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(res.id)}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                }}
              >
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}