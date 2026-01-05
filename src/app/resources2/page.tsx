// src/app/resources/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { BookOpen, Tag, AlertTriangle, ExternalLink } from 'lucide-react';

type ResourceType = 'Story' | 'Guide' | 'Tool' | 'Video' | 'Book';

interface Resource {
  id: string;
  title: string;
  excerpt: string;
  type: ResourceType;
  category: string;
  tags: string[];
  content_warnings: string[];
  community_source: string | null;
  book_author: string | null;
  book_quote: string | null;
  external_url: string | null;
  created_at: string;
  user_id: string;
}

const CATEGORIES: Record<ResourceType, string> = {
  Story: 'Personal Stories',
  Guide: 'Guidance',
  Tool: 'Tools',
  Video: 'Videos',
  Book: 'Books',
};

export default function ResourcesPage() {
  const supabase = createClient();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResources = async () => {
      const { data, error: supabaseError } = await supabase
        .from('resources')
        .select('*')
        .eq('status', 'approved') // Only show approved resources
        .order('created_at', { ascending: false });

      if (supabaseError) {
        console.error('Error fetching resources:', supabaseError);
        setError('Failed to load resources.');
      } else {
        setResources(data as Resource[]);
      }
      setLoading(false);
    };

    fetchResources();
  }, [supabase]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', padding: '1.5rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: '#44403c' }}>Loading resources...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', padding: '1.5rem 1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', backgroundColor: '#fee2e2', padding: '1rem', borderRadius: '0.5rem' }}>
          <p style={{ color: '#b91c1c' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', padding: '1.5rem 1rem' }}>
      <div style={{ maxWidth: '768px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '9999px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
            }}
          >
            <BookOpen size={18} />
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1c1917' }}>
            Grief Resources
          </h1>
          <p style={{ color: '#44403c', marginTop: '0.5rem' }}>
            Shared by community members. All submissions are reviewed for care and clarity.
          </p>
        </div>

        {resources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <p style={{ color: '#6b7280' }}>No resources available yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {resources.map((resource) => (
              <div
                key={resource.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  borderLeft: '4px solid #f59e0b',
                }}
              >
                {/* Type badge */}
                <div style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                    }}
                  >
                    {CATEGORIES[resource.type]}
                  </span>
                </div>

                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1c1917', marginBottom: '0.5rem' }}>
                  {resource.title}
                </h2>

                {/* Book-specific display */}
                {resource.type === 'Book' && resource.book_author && (
                  <p style={{ marginBottom: '0.5rem', color: '#6b7280', fontStyle: 'italic' }}>
                    by {resource.book_author}
                  </p>
                )}

                {/* Excerpt or book quote */}
                <p style={{ color: '#374151', marginBottom: '1rem' }}>
                  {resource.type === 'Book' && resource.book_quote
                    ? `"${resource.book_quote}"`
                    : resource.excerpt}
                </p>

                {/* Community source */}
                {resource.community_source && (
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                    Shared in: <strong>{resource.community_source}</strong>
                  </p>
                )}

                {/* Tags */}
                {resource.tags.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                      <Tag size={14} style={{ color: '#92400e' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e' }}>Tags</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {resource.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '0.125rem 0.5rem',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Warnings */}
                {resource.content_warnings.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                      <AlertTriangle size={14} style={{ color: '#7e22ce' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#7e22ce' }}>Content Warnings</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {resource.content_warnings.map((warning) => (
                        <span
                          key={warning}
                          style={{
                            padding: '0.125rem 0.5rem',
                            backgroundColor: '#f3e8ff',
                            color: '#7e22ce',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                          }}
                        >
                          {warning}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* External link */}
                {resource.external_url && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <Link
                      href={resource.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        color: '#d97706',
                        fontWeight: '600',
                        textDecoration: 'none',
                      }}
                    >
                      View Resource
                      <ExternalLink size={14} />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link
            href="/submit-resource"
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              backgroundColor: '#f59e0b',
              color: 'white',
              borderRadius: '0.5rem',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            Share Your Own Resource
          </Link>
        </div>
      </div>
    </div>
  );
}