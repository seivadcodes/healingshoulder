// src/app/profile/[id]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { GriefType } from '@/app/dashboard/useDashboardLogic';
import { useAuth } from '@/hooks/useAuth';
import { useCall } from '@/context/CallContext';
import Image from 'next/image';
import Angels from './angels';
import SendMessageOverlay from '@/components/modals/SendMessageOverlay';

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

interface Profile {
  id: string;
  full_name: string | null;
  grief_types: GriefType[];
  country: string | null;
  avatar_url: string | null;
  about?: string | null;
}

interface Post {
  id: string;
  userId: string;
  text: string;
  mediaUrl: string | null;
  mediaUrls?: string[];
  griefTypes: GriefType[];
  createdAt: Date;
  likes: number;
  isLiked: boolean;
  commentsCount: number;
  isAnonymous: boolean;
  user?: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
    isAnonymous: boolean;
  };
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { startCall } = useCall();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'angels'>('posts');
  const [showMessageOverlay, setShowMessageOverlay] = useState(false);

  const checkScreenSize = useCallback(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 768);
    }
  }, []);

  useEffect(() => {
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [checkScreenSize]);

  useEffect(() => {
    if (!id) return;

    const supabase = createClient();

    const fetchProfileAndPosts = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();

        if (profileError || !profileData) {
          setError('Profile not found');
          return;
        }

        // ✅ Correctly proxy main profile avatar
        const avatarProxyUrl = profileData.avatar_url
          ? `/api/media/avatars/${profileData.avatar_url}`
          : null;

        setProfile({
          ...profileData,
          avatar_url: avatarProxyUrl,
        });

        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select(`
            *,
            profiles: user_id (
              id,
              full_name,
              avatar_url,
              is_anonymous
            )
          `)
          .eq('user_id', id)
          .eq('is_anonymous', false)
          .order('created_at', { ascending: false });

        if (postError) {
          console.error('Failed to load posts:', postError);
        }

        // ✅ FIXED: Use /api/media/avatars/... for post author avatars
        const mappedPosts = (postData || []).map((p) => {
          const userAvatar = p.profiles?.avatar_url
            ? `/api/media/avatars/${p.profiles.avatar_url}` // ✅ CORRECT PATH
            : null;

          return {
            id: p.id,
            userId: p.user_id,
            text: p.text,
            mediaUrl: p.media_url || null,
            mediaUrls: p.media_urls || undefined,
            griefTypes: p.grief_types as GriefType[],
            createdAt: new Date(p.created_at),
            likes: p.likes_count || 0,
            isLiked: false,
            commentsCount: p.comments_count || 0,
            isAnonymous: false,
            user: p.profiles
              ? {
                  id: p.profiles.id,
                  fullName: p.profiles.full_name,
                  avatarUrl: userAvatar, // ✅ Now a valid proxied URL
                  isAnonymous: p.profiles.is_anonymous ?? false,
                }
              : undefined,
          };
        });

        setPosts(mappedPosts);
      } catch (err) {
        console.error('Profile fetch failed:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndPosts();
  }, [id, user]);

  const handleCall = async () => {
    if (!profile?.id || !profile.full_name) return;
    await startCall(
      profile.id,
      profile.full_name || 'Anonymous',
      'audio',
      profile.id,
      profile.id
    );
  };

  const handleMessage = () => {
    if (!profile?.id) return;
    setShowMessageOverlay(true);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1rem', color: '#444' }}>
        Loading profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1rem', color: '#d32f2f' }}>
        {error || 'Profile not found'}
      </div>
    );
  }

  const name = profile.full_name || 'Anonymous';
  const firstName = profile.full_name ? profile.full_name.split(' ')[0] : 'Them';
  const types = Array.isArray(profile.grief_types) ? profile.grief_types : [];
  const countryName = profile.country
    ? new Intl.DisplayNames(['en'], { type: 'region' }).of(profile.country) || profile.country
    : null;

  const isOwner = user?.id === profile.id;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '2rem auto', fontFamily: 'system-ui' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: profile.avatar_url ? 'transparent' : '#f1f5f9',
            margin: '0 auto 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            color: '#475569',
            fontWeight: 'bold',
            overflow: 'hidden',
          }}
        >
          {profile.avatar_url ? (
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden' }}>
              <img
                src={profile.avatar_url}
                alt={name}
                width={72}
                height={72}
                style={{ objectFit: 'cover', borderRadius: '50%' }}
                loading="lazy"
              />
            </div>
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>

        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
          {name}
        </h1>

        {countryName && (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#64748b' }}>
            From {countryName}
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

        {profile.about && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155', lineHeight: 1.5 }}>
              {profile.about}
            </p>
          </div>
        )}

        {!isOwner && (
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
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
        )}

        <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '1rem' }}>
          A space to share and be heard.
        </p>
      </div>

      {isMobile ? (
        <div style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1rem',
              marginBottom: '1.5rem',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '0.5rem',
            }}
          >
            <button
              onClick={() => setActiveTab('posts')}
              style={{
                background: 'none',
                border: 'none',
                fontWeight: activeTab === 'posts' ? 'bold' : 'normal',
                color: activeTab === 'posts' ? '#1e293b' : '#64748b',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
              }}
            >
              Shared Moments
            </button>
            <button
              onClick={() => setActiveTab('angels')}
              style={{
                background: 'none',
                border: 'none',
                fontWeight: activeTab === 'angels' ? 'bold' : 'normal',
                color: activeTab === 'angels' ? '#1e293b' : '#64748b',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
              }}
            >
              Loved Ones
            </button>
          </div>

          {activeTab === 'posts' ? (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
                Shared Moments
              </h2>
              {posts.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b' }}>No public posts yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      isOwner={isOwner}
                      canDelete={isOwner}
                      showAuthor={true}
                      context="profile"
                      onPostDeleted={() => {
                        setPosts((prev) => prev.filter((p) => p.id !== post.id));
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#1e293b' }}>
                Loved Ones Remembered
              </h3>
              <Angels profileId={id} isOwner={isOwner} />
            </div>
          )}
        </div>
      ) : (
        <div className="desktop-content">
          <div className="posts-column">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Shared Moments
            </h2>
            {posts.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b' }}>No public posts yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isOwner={isOwner}
                    canDelete={isOwner}
                    showAuthor={true}
                    context="profile"
                    onPostDeleted={() => {
                      setPosts((prev) => prev.filter((p) => p.id !== post.id));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="angels-column">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#1e293b' }}>
              Loved Ones Remembered
            </h3>
            <Angels profileId={id} isOwner={isOwner} />
          </div>
        </div>
      )}

      {showMessageOverlay && profile && (
        <SendMessageOverlay
          isOpen={true}
          targetUserId={profile.id}
          targetName={profile.full_name || 'Anonymous'}
          onClose={() => setShowMessageOverlay(false)}
        />
      )}

      <style jsx>{`
        .desktop-content {
          display: flex;
          gap: 2rem;
          width: 100%;
        }
        .posts-column {
          width: 60%;
          min-width: 0;
        }
        .angels-column {
          width: 40%;
          min-width: 0;
        }

        @media (max-width: 767px) {
          .desktop-content {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}