// src/app/profile/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { GriefType } from '@/app/dashboard/useDashboardLogic';
import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';

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
}

// 🔧 FIXED: `user` is now optional (`?`) and can be `undefined` (not `null`)
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
  user?: { // 👈 changed from `| null` to optional (`?`) → allows `undefined`
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
    isAnonymous: boolean;
  };
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
 
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  if (!id) return;

  const supabase = createClient(); // ✅ Moved inside useEffect

  const fetchProfileAndPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError || !profileData) {
        setError('Profile not found');
        return;
      }

      setProfile(profileData);

      // Fetch posts
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

      const mappedPosts = (postData || []).map((p) => ({
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
              avatarUrl: p.profiles.avatar_url,
              isAnonymous: p.profiles.is_anonymous ?? false,
            }
          : undefined,
      }));

      setPosts(mappedPosts);
    } catch (err) {
      console.error('Profile fetch failed:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  fetchProfileAndPosts();
}, [id, user]); // ✅ Now safe — no missing deps

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
  
  const types = Array.isArray(profile.grief_types) ? profile.grief_types : [];
  const countryName = profile.country
    ? new Intl.DisplayNames(['en'], { type: 'region' }).of(profile.country) || profile.country
    : null;

  const isOwner = user?.id === profile.id;

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '2rem auto', fontFamily: 'system-ui' }}>
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
  <div style={{ width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden' }}>
    <Image
      src={profile.avatar_url}
      alt={name}
      width={72}
      height={72}
      style={{ objectFit: 'cover' }}
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

        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.25rem' }}>
          A space to share and be heard.
        </p>
      </div>

      {/* Posts Section */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
          Shared Moments
        </h2>

        {posts.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#64748b' }}>
            No public posts yet.
          </p>
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
    </div>
  );
}