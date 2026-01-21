'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { GriefType } from '@/app/dashboard/useDashboardLogic';
import { useAuth } from '@/hooks/useAuth';
import { useCall } from '@/context/CallContext';
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
  is_anonymous: boolean;
}

interface DisplayPost {
  id: string;
  userId: string;
  text: string;
  mediaUrl?: string;
  mediaUrls: string[];
  griefTypes: GriefType[];
  createdAt: Date;
  likes: number;
  isLiked: boolean;
  commentsCount: number;
  isAnonymous: boolean;
  user: {
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
  const [posts, setPosts] = useState<DisplayPost[]>([]);
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

        // === 1. Fetch profile ===
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, grief_types, country, avatar_url, about, is_anonymous')
          .eq('id', id)
          .single();

        if (profileError || !profileData) {
          setError('Profile not found');
          return;
        }

        // ✅ Proxy avatar ONLY if NOT anonymous
        let avatarProxyUrl: string | null = null;
        if (!profileData.is_anonymous && profileData.avatar_url) {
          avatarProxyUrl = `/api/media/avatars/${profileData.avatar_url}`;
        }

        const profileWithAvatar = {
          ...profileData,
          avatar_url: avatarProxyUrl,
        };

        setProfile(profileWithAvatar);

        // === 2. Fetch posts from GLOBAL `posts` table ===
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', id)
          .eq('is_anonymous', false)
          .order('created_at', { ascending: false });

        if (postError) {
          console.error('Post fetch error:', postError);
        }

        // === 3. Transform posts for PostCard ===
        const validGriefTypes = [
          'parent', 'child', 'spouse', 'sibling', 'friend',
          'pet', 'miscarriage', 'caregiver', 'suicide', 'other'
        ] as const;

        const mappedPosts = (postData || []).map((p) => {
          const mediaUrls = Array.isArray(p.media_urls)
            ? p.media_urls.map((path: string) => `/api/media/posts/${path}`)
            : [];

          const filteredGriefTypes = (p.grief_types || [])
            .filter((t: string) => validGriefTypes.includes(t as GriefType))
            .map((t: string) => t as GriefType);

          const griefTypes = filteredGriefTypes.length > 0 ? filteredGriefTypes : ['other'];

          // ✅ PASS RAW PATH (not proxied!) — PostCard will proxy it
          const authorAvatar = !profileData.is_anonymous ? profileData.avatar_url : null;

          return {
            id: p.id,
            userId: p.user_id,
            text: p.text,
            mediaUrl: mediaUrls[0],
            mediaUrls,
            griefTypes,
            createdAt: new Date(p.created_at),
            likes: p.likes_count || 0,
            isLiked: false,
            commentsCount: p.comments_count || 0,
            isAnonymous: p.is_anonymous || profileData.is_anonymous,
            user: {
              id: p.user_id,
              fullName: profileData.is_anonymous ? null : profileData.full_name,
              avatarUrl: authorAvatar, // ← raw path like "avatars/xyz.jpg" or null
              isAnonymous: profileData.is_anonymous,
            },
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
  }, [id]);

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
    <div style={{ padding: '3.5rem', maxWidth: '1200px', margin: '2rem auto', fontFamily: 'system-ui' }}>
      {/* Profile Header */}
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
            <img
              src={profile.avatar_url}
              alt={name}
              width={72}
              height={72}
              style={{ objectFit: 'cover', borderRadius: '50%' }}
              loading="lazy"
            />
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
            >
              💬 Message {firstName}
            </button>
          </div>
        )}

       
      </div>

      {/* Tabs / Columns */}
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
              Angels
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