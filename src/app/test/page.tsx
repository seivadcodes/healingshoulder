'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { PostCard } from '@/components/PostCard';
import { Camera } from 'lucide-react';

// Match your actual DB schema
interface DbPost {
  id: string;
  user_id: string;
  text: string;
  media_urls: string[];
  grief_types: string[];
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_anonymous: boolean;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_anonymous: boolean;
}

// Shape expected by PostCard
interface DisplayPost {
  id: string;
  userId: string;
  text: string;
  mediaUrl?: string;
  mediaUrls: string[];
  griefTypes: ('parent' | 'child' | 'spouse' | 'sibling' | 'friend' | 'pet' | 'miscarriage' | 'caregiver' | 'suicide' | 'other')[];
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

export default function TestPostsPage() {
  const [displayPosts, setDisplayPosts] = useState<DisplayPost[]>([]);
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  // Fetch all posts from `posts` table + enrich with user profiles
  const fetchPosts = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/auth');
        return;
      }

      // 1. Fetch posts
      const { data: posts, error: postError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postError) throw postError;

      if (posts.length === 0) {
        setDisplayPosts([]);
        setLoading(false);
        return;
      }

      // 2. Get unique user IDs
      const userIds = [...new Set(posts.map((p: DbPost) => p.user_id))];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_anonymous')
        .in('id', userIds);

      if (profileError) throw profileError;

      const profileMap = new Map<string, Profile>();
      profiles.forEach((p) => profileMap.set(p.id, p));

      // 3. Transform for PostCard
      const transformed: DisplayPost[] = posts.map((post) => {
        const profile = profileMap.get(post.user_id) || {
          id: post.user_id,
          full_name: 'Anonymous',
          avatar_url: null,
          is_anonymous: true,
        };

        const validGriefTypes = [
          'parent', 'child', 'spouse', 'sibling', 'friend',
          'pet', 'miscarriage', 'caregiver', 'suicide', 'other'
        ] as const;

        const griefTypes = post.grief_types
          .filter(t => validGriefTypes.includes(t as any))
          .map(t => t as any) || ['other'];

        const mediaUrls = Array.isArray(post.media_urls)
          ? post.media_urls.map(url => `/api/media/posts/${url}`) // 👈 assumes proxy route
          : [];

        return {
          id: post.id,
          userId: post.user_id,
          text: post.text,
          mediaUrl: mediaUrls[0],
          mediaUrls,
          griefTypes,
          createdAt: new Date(post.created_at),
          likes: post.likes_count || 0,
          isLiked: false, // would require join on likes
          commentsCount: post.comments_count || 0,
          isAnonymous: post.is_anonymous || profile.is_anonymous,
          user: {
            id: profile.id,
            fullName: profile.is_anonymous ? null : profile.full_name,
            avatarUrl: profile.is_anonymous ? null : profile.avatar_url,
            isAnonymous: profile.is_anonymous,
          },
        };
      });

      setDisplayPosts(transformed);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      alert('Failed to load posts. Check console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const uploadMedia = async (files: File[]) => {
    const urls: string[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${timestamp}_${i}.${ext}`;
      const filePath = `public/${fileName}`;

      const { error } = await supabase.storage
        .from('posts') // your bucket
        .upload(filePath, file, { upsert: false });

      if (error) throw error;

      urls.push(fileName); // store path only (e.g., "public/12345_0.jpg")
    }
    return urls;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth');
      return;
    }

    if (!content.trim() && mediaFiles.length === 0) return;

    setSubmitting(true);
    try {
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        mediaUrls = await uploadMedia(mediaFiles);
      }

      const { data: newPost, error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: session.user.id,
          text: content.trim(),
          media_urls: mediaUrls,
          grief_types: ['other'],
          is_anonymous: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Refetch all posts to include the new one (simplest & reliable)
      await fetchPosts();

      setContent('');
      setMediaFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Post submit error:', err);
      alert('Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setMediaFiles(files.slice(0, 4));
  };

  const removeMedia = () => {
    setMediaFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) {
    return <div className="p-6">Loading posts...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Real Posts Test</h1>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="border rounded-xl p-4 space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a post..."
          className="w-full min-h-[100px] p-3 border rounded-lg"
        />
        {mediaFiles.length > 0 && (
          <div>
            <p className="text-sm text-gray-600">
              {mediaFiles.map((f, i) => f.name).join(', ')}
              <button type="button" onClick={removeMedia} className="ml-2 text-red-500 underline">
                Remove
              </button>
            </p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <label className="px-3 py-2 bg-gray-100 rounded cursor-pointer text-sm">
            <Camera size={14} className="inline mr-1" />
            Add Media
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className={`px-4 py-2 rounded font-medium ${
              submitting ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>

      {/* Feed */}
      <div className="space-y-6">
        {displayPosts.length === 0 ? (
          <p>No posts yet.</p>
        ) : (
          displayPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              context="feed"
              showAuthor={true}
              canDelete={false}
            />
          ))
        )}
      </div>
    </div>
  );
}