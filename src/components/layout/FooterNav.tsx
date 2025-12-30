// src/components/ResourceCard.tsx
'use client';

import Link from 'next/link';
import { Users, Dot, BookOpen } from 'lucide-react';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

export type ResourceType = 'Guide' | 'Story' | 'Video' | 'Tool' | 'Book';

interface ResourceCardProps {
  id: number;
  title: string;
  excerpt: string;
  type: ResourceType;
  featured?: boolean;
  author?: string;
  liveViewers?: number;
  communitySource?: string;
  sharedAgo?: string;
}

const actionTextMap: Record<ResourceType, string> = {
  Guide: 'Read more',
  Story: 'Read story',
  Video: 'Watch now',
  Tool: 'Download tool',
  Book: 'Read excerpt',
};

const typeColorMap: Record<ResourceType, { bg: string; text: string }> = {
  Guide: { bg: '#dbeafe', text: '#1e40af' },
  Story: { bg: '#fef3c7', text: '#92400e' },
  Video: { bg: '#ede9fe', text: '#7c3aed' },
  Tool: { bg: '#dcfce7', text: '#047857' },
  Book: { bg: '#fce7f3', text: '#be185d' },
};

export default function ResourceCard({
  id,
  title,
  excerpt,
  type,
  featured = false,
  author,
  liveViewers,
  communitySource,
  sharedAgo,
}: ResourceCardProps) {
  // Base card style
  const baseCardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: 0,
    borderRadius: '0.5rem',
    transition: 'box-shadow 0.2s ease',
    border: featured ? 'none' : '1px solid #e5e5e5',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    position: 'relative',
  };

  // Featured: add left accent border
  const cardStyle: React.CSSProperties = featured
    ? { ...baseCardStyle, borderLeft: '4px solid #f59e0b' }
    : baseCardStyle;

  const badgeStyle = typeColorMap[type];

  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = featured
          ? '0 4px 8px rgba(0,0,0,0.1)'
          : '0 4px 6px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
      }}
    >
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1c1917', lineHeight: '1.3' }}>{title}</h3>
          <span
            style={{
              backgroundColor: badgeStyle.bg,
              color: badgeStyle.text,
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              borderRadius: '9999px',
              fontWeight: '500',
            }}
          >
            {type}
          </span>
        </div>
        <p style={{ color: '#44403c', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{excerpt}</p>

        {/* Author (for books) */}
        {author && (
          <p style={{ color: '#78716c', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center' }}>
            <BookOpen
              size={12}
              style={{
                marginRight: '0.25rem',
                strokeWidth: 2.5,
              }}
            />
            {author}
          </p>
        )}

        {/* Community or live info */}
        {(liveViewers || communitySource) && (
          <div style={{ color: '#78716c', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center' }}>
            {liveViewers ? (
              <>
                <Dot size={12} style={{ color: '#ef4444', fill: '#ef4444', marginRight: '0.25rem' }} />
                {liveViewers} watching now
              </>
            ) : communitySource ? (
              <>
                <Users
                  size={12}
                  style={{
                    marginRight: '0.25rem',
                    strokeWidth: 2.5,
                  }}
                />
                Shared in <span style={{ fontWeight: '600', marginLeft: '0.25rem' }}>{communitySource}</span> • {sharedAgo}
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer with link */}
      <div style={{ padding: '0 1rem 0.75rem 1rem' }}>
        <Link href={`/resources/${id}`} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <span
            style={{
              color: '#d97706',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#92400e')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#d97706')}
          >
            {actionTextMap[type]}
          </span>
          <ArrowRightIcon
            style={{
              marginLeft: '0.25rem',
              width: '1rem',
              height: '1rem',
              strokeWidth: 2.5,
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(2px)';
              (e.currentTarget as SVGElement).style.strokeWidth = '3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              (e.currentTarget as SVGElement).style.strokeWidth = '2.5';
            }}
          />
        </Link>
      </div>
    </div>
  );
}