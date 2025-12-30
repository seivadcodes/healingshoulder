﻿'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, MessageCircle, Heart, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import Button from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

interface Community {
  id: string;
  name: string;
  description: string;
  member_count: number;
  online_count: number;
  grief_type: string;
  created_at: string;
  cover_photo_url?: string | null;
}

// Gradient mapping by grief type
const griefGradients: Record<string, string> = {
  parent: 'linear-gradient(135deg, #fcd34d, #f97316)',
  child: 'linear-gradient(135deg, #d8b4fe, #8b5cf6)',
  spouse: 'linear-gradient(135deg, #fda4af, #ec4899)',
  sibling: 'linear-gradient(135deg, #5eead4, #06b6d4)',
  friend: 'linear-gradient(135deg, #93c5fd, #6366f1)',
  pet: 'linear-gradient(135deg, #fef08a, #f59e0b)',
  miscarriage: 'linear-gradient(135deg, #fbcfe8, #e11d48)',
  caregiver: 'linear-gradient(135deg, #e5e7eb, #f59e0b)',
  suicide: 'linear-gradient(135deg, #ddd6fe, #a78bfa)',
  other: 'linear-gradient(135deg, #e5e7eb, #9ca3af)',
};

const defaultGradient = 'linear-gradient(135deg, #fcd34d, #f97316)';

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalOnline, setTotalOnline] = useState(0);
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();

  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const { data, error } = await supabase
          .from('communities')
          .select('*')
          .order('member_count', { ascending: false });

        if (error) throw error;

        if (data) {
          const communitiesWithPhotos = data.map((community) => ({
            ...community,
            cover_photo_url: community.id
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/communities/${community.id}/banner.jpg`
              : null,
          }));

          setCommunities(communitiesWithPhotos);
          const total = communitiesWithPhotos.reduce((sum, c) => sum + c.online_count, 0);
          setTotalOnline(total);
        }
      } catch (err) {
        console.error('Error fetching communities:', err);
        setError('Failed to load communities. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCommunities();
  }, [supabase]);

  const formatRecentActivity = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMinutes = Math.floor((now.getTime() - created.getTime()) / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 2) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 120) return '1 hour ago';
    const hours = Math.floor(diffMinutes / 60);
    return `${hours} hours ago`;
  };

  const handleRequestCommunity = () => {
    if (!user) {
      router.push('/auth?redirectTo=/communities/create');
      return;
    }
    router.push('/communities/create');
  };

  // === Loading State ===
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(to bottom, #fffbeb, #f5f5f1, #f0f0ee)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              height: '3rem',
              width: '3rem',
              borderRadius: '9999px',
              border: '4px solid #f59e0b',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <p style={{ color: '#64748b' }}>Loading communities...</p>
        </div>
      </div>
    );
  }

  // === Error State ===
  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(to bottom, #fffbeb, #f5f5f1, #f0f0ee)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            maxWidth: '28rem',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ color: '#f59e0b', marginBottom: '0.75rem' }}>
            <Users size={48} style={{ margin: '0 auto' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
            Error Loading Communities
          </h2>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>{error}</p>
          <Button
            onClick={() => router.refresh()}
            style={{
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
  background: 'linear-gradient(to bottom, #fffbeb, #f5f5f1, #f0f0ee)',
  paddingTop: '5rem',
  paddingBottom: '2rem',
  paddingLeft: '1rem',
  paddingRight: '1rem',
  };

  const innerContainerStyle: React.CSSProperties = {
    maxWidth: '896px', // ~4xl
    margin: '0 auto',
  };

  return (
    <div style={containerStyle}>
      <div style={innerContainerStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '9999px',
              background: griefGradients.parent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <Users size={28} color="white" />
          </div>
          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '0.5rem',
            }}
          >
            Find Your Tribe
          </h1>
          <p style={{ color: '#64748b', maxWidth: '42rem', margin: '0 auto 1rem' }}>
            Join a circle where your grief is understood — not explained away. Share your story, read others', or simply be present.
          </p>
          <div
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              background: '#dcfce7',
              color: '#166534',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            🟢 {totalOnline} people in communities right now
          </div>
        </div>

        {/* Communities List */}
        <div style={{ marginBottom: '3rem' }}>
          {communities.map((community) => (
            <Link
              key={community.id}
              href={`/communities/${community.id}`}
              style={{
                display: 'block',
                textDecoration: 'none',
                transition: 'transform 0.15s ease-in-out',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: '0.75rem',
                  border: '1px solid #e2e8f0',
                  padding: '1.25rem',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.2s ease',
                  marginBottom: '1.25rem',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)')}
              >
                {/* Cover Photo */}
                {community.cover_photo_url && (
                  <div
                    style={{
                      height: '6rem',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      marginBottom: '1rem',
                    }}
                  >
                    <img
                      src={community.cover_photo_url}
                      alt={community.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Header Section */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      width: '3rem',
                      height: '3rem',
                      borderRadius: '9999px',
                      background: griefGradients[community.grief_type] || defaultGradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Users size={20} color="white" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h2
                      style={{
                        fontWeight: '700',
                        color: '#1e293b',
                        fontSize: '1.125rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {community.name}
                    </h2>
                    <p
                      style={{
                        color: '#64748b',
                        fontSize: '0.875rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {community.description}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Users size={14} style={{ color: '#94a3b8' }} />
                    {community.member_count.toLocaleString()} members
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Heart size={14} style={{ color: '#16a34a' }} />
                    {community.online_count} online
                  </span>
                </div>

                {/* Activity */}
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', color: '#334155' }}>
                  <MessageCircle size={16} style={{ color: '#f59e0b', marginTop: '0.125rem' }} />
                  <p>
                    {formatRecentActivity(community.created_at)}: Someone just shared a memory
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {communities.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              background: 'white',
              borderRadius: '0.75rem',
              border: '2px dashed #cbd5e1',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '9999px',
                background: '#fef3c7',
                color: '#b45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>
              No communities yet
            </h3>
            <p style={{ color: '#64748b', maxWidth: '28rem', margin: '0 auto 1.5rem' }}>
              Be the first to create a community for your grief experience. Your story matters, and others are waiting to hear it.
            </p>
            <Button
              onClick={handleRequestCommunity}
              style={{
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Plus size={16} />
              Start Your Community
            </Button>
          </div>
        )}

        {/* CTA Footer */}
        <div
          style={{
            background: 'white',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#64748b', marginBottom: '0.75rem' }}>
            Can't find a community that matches your grief experience?
          </p>
          <Button
            onClick={handleRequestCommunity}
            style={{
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Plus size={16} />
            Start a New Community
          </Button>
        </div>

        {/* Guidelines Footer */}
        <div
          style={{
            marginTop: '2rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#94a3b8',
            padding: '1rem',
            background: 'rgba(255,255,255,0.5)',
            borderRadius: '0.5rem',
          }}
        >
          <p>All communities are moderated with care. We honor every story without judgment.</p>
          <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>Your grief is valid. Your presence matters.</p>
        </div>
      </div>

      {/* Optional: define animation if not in global CSS */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}