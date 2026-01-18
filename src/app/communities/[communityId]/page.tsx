// src/app/communities/[communityId]/page.tsx
'use client';
import { useState, useEffect, ChangeEvent, FormEvent, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ShareCommunityButton } from '@/components/ShareCommunityButton';
import Head from 'next/head';
import Link from 'next/link';
import { PostCard } from '@/components/PostCard';
import { PostComposer } from '@/components/PostComposer';
import {
  Users,
  Heart,
  MessageCircle,
  LogIn,
  LogOut,
  Settings,
  UserPlus,
  ImageIcon,
  X,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
// --- Types ---
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
interface Member {
  user_id: string;
  username: string;
  avatar_url: string | null;
  last_online: string | null;
  is_online: boolean;
  role: 'member' | 'admin' | 'moderator';
  joined_at: string;
}
interface Post {
  id: string;
  content: string;
  media_url?: string | null;
  media_urls?: string[] | null;
  created_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  community_id: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}
interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  post_id: string;
  parent_comment_id?: string | null;
  replies?: Comment[];
  reply_count?: number;
}
interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  last_online?: string | null;
  is_anonymous?: boolean;
}

interface CommunityMemberWithProfile {
  role: 'member' | 'admin' | 'moderator';
  joined_at: string;
  user_id: string;
  user: Profile[] | Profile | null;
}
interface CommunityPost {
  id: string;
  content: string;
  created_at: string;
  community_id: string;
  media_url: string | null;
  media_urls: string[] | null;
  likes_count: number;
  comments_count: number;
  user_id: string;
}

// --- Shared Styles (Inline) ---
const baseColors = {
  primary: '#f59e0b',
  secondary: '#1e293b',
  accent: '#16a34a',
  background: '#fffbeb',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: { primary: '#1e293b', secondary: '#64748b', muted: '#94a3b8' },
  status: { online: '#16a34a', offline: '#cbd5e1' },
};
const spacing = { xs: '0.25rem', sm: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.25rem', '2xl': '1.5rem' };
const borderRadius = { sm: '0.25rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', full: '9999px' };
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
const defaultGradient = griefGradients.parent;
const buttonStyle = (bg: string, color = 'white') => ({
  background: bg,
  color,
  border: 'none',
  padding: `${spacing.sm} ${spacing.lg}`,
  borderRadius: borderRadius.md,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing.sm,
  fontWeight: 600,
  transition: 'background 0.2s',
});
const outlineButtonStyle = {
  background: 'transparent',
  color: baseColors.text.primary,
  border: `1px solid ${baseColors.border}`,
  padding: `${spacing.sm} ${spacing.lg}`,
  borderRadius: borderRadius.md,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing.sm,
};
const cardStyle: React.CSSProperties = {
  background: baseColors.surface,
  borderRadius: borderRadius.lg,
  border: `1px solid ${baseColors.border}`,
  padding: spacing.xl,
  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
  marginBottom: spacing['2xl'],
};
const pageContainer: React.CSSProperties = {
  minHeight: '100vh',
  background: `linear-gradient(to bottom, ${baseColors.background}, #f5f5f1, #f0f0ee)`,
  paddingTop: '5rem',
  paddingBottom: spacing.xl,
  paddingLeft: spacing.lg,
  paddingRight: spacing.lg,
};
const centerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: spacing.lg,
};

// --- Skeleton Loader Style ---
const skeletonStyle: React.CSSProperties = {
  background: '#f1f5f9',
  borderRadius: borderRadius.lg,
  height: '200px',
  width: '100%',
  maxWidth: '800px',
  marginBottom: spacing.xl,
  position: 'relative',
  overflow: 'hidden',
};
const pulseAnimation = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
  }
`;

export default function CommunityDetailPage() {
  const params = useParams();
  const communityId = params.communityId as string;
  const router = useRouter();
  const searchParams = useSearchParams();
const targetPostId = searchParams.get('postId');
  const supabase = createClient();
  const { user } = useAuth();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'moderator' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState<File[]>([]);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const postRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [isKebabOpen, setIsKebabOpen] = useState(false);
  const kebabMenuRef = useRef<HTMLDivElement>(null);
  const [memberStatusResolved, setMemberStatusResolved] = useState(false); // 👈 NEW

  // Inject global styles once
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const existing = document.getElementById('global-pulse-styles');
      if (!existing) {
        const style = document.createElement('style');
        style.id = 'global-pulse-styles';
        style.innerHTML = pulseAnimation;
        document.head.appendChild(style);
      }
    }
  }, []);

  const handleModalPostSubmit = async (text: string, mediaFiles: File[]) => {
    if (!user || !community) {
      toast.error('You must be logged in and in a community to post.');
      return;
    }
    setIsModalSubmitting(true);
    try {
      const newPost = await createPostWithMedia(text, mediaFiles, user.id);
      setPosts((prev) => [newPost, ...prev]);
      setIsModalOpen(false);
      toast.success('Post shared with the community!');
    } catch (err) {
      console.error('Failed to create post via modal:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to share post.');
    } finally {
      setIsModalSubmitting(false);
    }
  };

  const formatRecentActivity = (dateString: string): string => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
    const years = Math.floor(days / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  };

  const isUserOnline = useCallback((lastOnline: string | null): boolean => {
    if (!lastOnline) return false;
    const lastOnlineDate = new Date(lastOnline);
    const now = new Date();
    return now.getTime() - lastOnlineDate.getTime() < 5 * 60 * 1000;
  }, []);

  // Close kebab menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (kebabMenuRef.current && !kebabMenuRef.current.contains(event.target as Node)) {
        setIsKebabOpen(false);
      }
    };
    if (isKebabOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isKebabOpen]);

  useEffect(() => {
    const fetchData = async () => {
      if (!communityId) return;
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch community data
        const { data: communityData, error: communityError } = await supabase
          .from('communities')
          .select('*')
          .eq('id', communityId)
          .single();
        if (communityError) throw new Error(`Failed to fetch community: ${communityError.message}`);
        if (!communityData) throw new Error('Community not found');

        let coverPhotoUrl = communityData.cover_photo_url;
        if (!coverPhotoUrl) {
          coverPhotoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/communities/${communityId}/banner.jpg?t=${Date.now()}`;
        }

        // 2. Count total members
        const { count, error: countError } = await supabase
          .from('community_members')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', communityId);
        if (countError) throw new Error(`Failed to count members: ${countError.message}`);

        // 3. Fetch members
        const { data: membersData, error: membersError } = await supabase
          .from('community_members')
          .select(`
            role,
            joined_at,
            user_id,
            user:profiles!left (
              id,
              full_name,
              avatar_url,
              last_online,
              is_anonymous
            )
          `)
          .eq('community_id', communityId)
          .order('joined_at', { ascending: true });
        if (membersError) throw membersError;

        // 4. Calculate online count
        const onlineCount = membersData.filter((member: CommunityMemberWithProfile) => {
          const profile = Array.isArray(member.user) ? member.user[0] ?? null : member.user;
          return isUserOnline(profile?.last_online || null);
        }).length;

        const communityWithPhoto = {
          ...communityData,
          cover_photo_url: coverPhotoUrl,
          member_count: count || 0,
          online_count: onlineCount,
        };
        setCommunity(communityWithPhoto);

        // 5. Format members
        const formattedMembers = membersData.map((member: CommunityMemberWithProfile) => {
          const profile = Array.isArray(member.user) ? member.user[0] ?? null : member.user;
          const isAnonymous = profile?.is_anonymous || false;
          return {
            user_id: member.user_id,
            username: isAnonymous ? 'Anonymous' : profile?.full_name || 'Anonymous',
            avatar_url: isAnonymous ? null : profile?.avatar_url || null,
            last_online: profile?.last_online || null,
            is_online: isUserOnline(profile?.last_online || null),
            role: member.role,
            joined_at: member.joined_at,
          };
        });
        setMembers(formattedMembers);

        // 6. Check membership status
        let isCurrentUserMember = false;
        let currentUserRole: typeof userRole = null;
        if (user) {
          const { data: memberData } = await supabase
            .from('community_members')
            .select('role')
            .eq('community_id', communityId)
            .eq('user_id', user.id)
            .single();
          if (memberData) {
            isCurrentUserMember = true;
            currentUserRole = memberData.role;
          }
        }
        setIsMember(isCurrentUserMember);
        setUserRole(currentUserRole);
        setMemberStatusResolved(true); // 👈 Critical: only now do we know member status

        // 7. Fetch posts
        const { data: postData, error: postError } = await supabase
          .from('community_posts')
          .select(`
            id,
            content,
            created_at,
            community_id,
            media_url,
            media_urls,
            likes_count,
            comments_count,
            user_id
          `)
          .eq('community_id', communityId)
          .order('created_at', { ascending: false });
        if (postError) throw postError;

        const userIds = [...new Set(postData.map((post: CommunityPost) => post.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, is_anonymous')
          .in('id', userIds);

        const profilesMap = new Map();
        profilesData?.forEach((profile: Profile) => {
          profilesMap.set(profile.id, profile);
        });

        const postsWithLikes = postData.map((post: CommunityPost) => {
          const userProfile = profilesMap.get(post.user_id) || {};
          const isAnonymous = userProfile.is_anonymous || false;
          return {
            id: post.id,
            content: post.content,
            media_url: post.media_url,
            media_urls: post.media_urls,
            created_at: post.created_at,
            user_id: post.user_id,
            username: isAnonymous ? 'Anonymous' : userProfile.full_name || 'Anonymous',
            avatar_url: isAnonymous ? null : userProfile.avatar_url || null,
            community_id: post.community_id,
            likes_count: post.likes_count || 0,
            comments_count: post.comments_count || 0,
            is_liked: false,
          };
        });

        setPosts(postsWithLikes);
      } catch (err) {
        console.error('Error fetching community:', err);
        const message = err instanceof Error ? err.message : 'Failed to load community data';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [communityId, user, supabase, isUserOnline]);

  useEffect(() => {
  if (targetPostId && posts.some((p) => p.id === targetPostId)) {
    const timer = setTimeout(() => {
      const element = postRefs.current[targetPostId];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Highlight
        element.style.transition = 'background-color 0.8s ease';
        element.style.backgroundColor = '#fff9db';
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 1000);

        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete('postId');
        router.replace(`${url.pathname}${url.search}`, { scroll: false });
      }
    }, 150);
    return () => clearTimeout(timer);
  }
}, [targetPostId, posts, router]);

  // Refresh members & online count every 30s
  useEffect(() => {
    if (!communityId) return;
    const fetchMembersAndOnlineCount = async () => {
      const { data: membersData, error } = await supabase
        .from('community_members')
        .select(`
          role,
          joined_at,
          user_id,
          user:profiles!left (id, full_name, avatar_url, last_online, is_anonymous)
        `)
        .eq('community_id', communityId);
      if (error) {
        console.error('Failed to refresh members:', error);
        return;
      }
      const formattedMembers = membersData.map((member) => {
        const profile = Array.isArray(member.user) ? member.user[0] ?? null : member.user;
        const isAnonymous = profile?.is_anonymous || false;
        return {
          user_id: member.user_id,
          username: isAnonymous ? 'Anonymous' : profile?.full_name || 'Anonymous',
          avatar_url: isAnonymous ? null : profile?.avatar_url || null,
          last_online: profile?.last_online || null,
          is_online: isUserOnline(profile?.last_online || null),
          role: member.role,
          joined_at: member.joined_at,
        };
      });
      setMembers(formattedMembers);
      const newOnlineCount = formattedMembers.filter((m) => m.is_online).length;
      setCommunity((prev) => (prev ? { ...prev, online_count: newOnlineCount } : null));
    };
    fetchMembersAndOnlineCount();
    const interval = setInterval(fetchMembersAndOnlineCount, 30_000);
    return () => clearInterval(interval);
  }, [communityId, supabase, isUserOnline]);

  // Update last_online every 45s
  useEffect(() => {
    if (!user) return;
    const updateLastOnline = async () => {
      await supabase.from('profiles').update({ last_online: new Date().toISOString() }).eq('id', user.id);
    };
    updateLastOnline();
    const interval = setInterval(updateLastOnline, 45_000);
    return () => clearInterval(interval);
  }, [user, supabase]);

  const reportComment = async (commentId: string, reason: string) => {
    if (!user || !reason.trim()) return;
    try {
      const { error } = await supabase.from('reports').insert({
        target_type: 'comment',
        target_id: commentId,
        reporter_id: user.id,
        reason: reason.trim(),
        created_at: new Date().toISOString(),
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Comment reported successfully');
      setReportingCommentId(null);
      setReportReason('');
    } catch (error) {
      console.error('Error reporting comment:', error);
      toast.error('Failed to report comment');
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMembership = async () => {
    if (!user) {
      router.push(`/auth?redirectTo=/communities/${communityId}`);
      return;
    }
    if (isMember) {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', user.id);
      if (error) {
        console.error('Error leaving community:', error);
        setError('Failed to leave community');
        return;
      }
      setIsMember(false);
      setUserRole(null);
      setCommunity((prev) => (prev ? { ...prev, member_count: prev.member_count - 1 } : null));
    } else {
      const { error } = await supabase.from('community_members').insert({
        community_id: communityId,
        user_id: user.id,
        joined_at: new Date().toISOString(),
        role: 'member',
      });
      if (error) {
        console.error('Error joining community:', error);
        setError('Failed to join community');
        return;
      }
      setIsMember(true);
      setUserRole('member');
      setCommunity((prev) => (prev ? { ...prev, member_count: prev.member_count + 1 } : null));
    }
  };

  const createPostWithMedia = async (content: string, files: File[], userId: string) => {
    if (!community) throw new Error('Community not loaded');
    let insertedPostId: string | null = null;
    try {
      const { data: postData, error: postError } = await supabase
        .from('community_posts')
        .insert({
          community_id: communityId,
          user_id: userId,
          content: content.trim(),
          created_at: new Date().toISOString(),
          media_urls: [],
        })
        .select(`
          id,
          content,
          created_at,
          community_id,
          media_urls,
          user_id
        `)
        .single();
      if (postError) throw postError;
      insertedPostId = postData.id;

      let mediaUrls: string[] = [];
      if (files.length > 0) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
        for (const file of files) {
          if (!allowedTypes.includes(file.type)) {
            throw new Error('Unsupported file type');
          }
          const maxSize = file.type.startsWith('video/') ? 15 : 5;
          if (file.size > maxSize * 1024 * 1024) {
            throw new Error(`File must be less than ${maxSize}MB`);
          }
        }

        const uploadPromises = files.map(async (file, idx) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${communityId}/posts/${postData.id}_${idx}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('communities')
            .upload(fileName, file, { upsert: true, contentType: file.type });
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('communities').getPublicUrl(fileName);
          return data.publicUrl;
        });
        mediaUrls = await Promise.all(uploadPromises);

        const { error: updateError } = await supabase
          .from('community_posts')
          .update({ media_urls: mediaUrls })
          .eq('id', postData.id);
        if (updateError) throw updateError;
      }

      const { data: userData } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, is_anonymous')
        .eq('id', userId)
        .single();
      const isAnonymous = userData?.is_anonymous || false;

      return {
        id: postData.id,
        content: postData.content,
        media_url: mediaUrls.length > 0 ? mediaUrls[0] : null,
        media_urls: mediaUrls,
        created_at: postData.created_at,
        user_id: postData.user_id,
        username: isAnonymous ? 'Anonymous' : userData?.full_name || 'Anonymous',
        avatar_url: isAnonymous ? null : userData?.avatar_url || null,
        community_id: postData.community_id,
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
      };
    } catch (error) {
      console.error('Post creation failed:', error);
      if (insertedPostId) {
        await supabase.from('community_posts').delete().eq('id', insertedPostId);
      }
      throw error;
    }
  };

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !community || (!newPostContent.trim() && newPostMedia.length === 0)) return;
    setError(null);
    setUploadingMedia(newPostMedia.length > 0);
    try {
      const newPost = await createPostWithMedia(newPostContent.trim(), newPostMedia, user.id);
      setPosts((prev) => [newPost, ...prev]);
      setNewPostContent('');
      setNewPostMedia([]);
      toast.success('Post created successfully!');
    } catch (err) {
      console.error('Error creating post:', err);
      const errorMessage =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to create post';
      setError(errorMessage);
      toast.error('Failed to create post');
    }
  };

  const updateBanner = async (file: File) => {
    if (!community) return;
    setBannerUploading(true);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed');
      if (file.size > 5 * 1024 * 1024) throw new Error('Image must be less than 5MB');
      const fileExt = file.name.split('.').pop();
      const fileName = `${communityId}/banner.${fileExt || 'jpg'}`;
      const { error: uploadError } = await supabase.storage
        .from('communities')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const newBannerUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/communities/${fileName}?t=${Date.now()}`;
      setCommunity((prev) => (prev ? { ...prev, cover_photo_url: newBannerUrl } : null));
      toast.success('Banner updated successfully!');
      setBannerModalOpen(false);
      setBannerPreview(null);
      setBannerFile(null);
    } catch (error: unknown) {
      console.error('Banner update failed:', error);
      if (error instanceof Error) {
        setBannerUploadError(error.message || 'Failed to update banner');
      } else {
        setBannerUploadError('Failed to update banner');
      }
    } finally {
      setBannerUploading(false);
    }
  };

  const deletePost = async (postId: string) => {
    setDeletingPostId(postId);
    try {
      const { error } = await supabase.from('community_posts').delete().eq('id', postId).eq('community_id', communityId);
      if (error) throw error;
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      toast.success('Post deleted successfully');
    } catch (error: unknown) {
      console.error('Post deletion failed:', error);
      if (error instanceof Error) {
        toast.error(error.message || 'Failed to delete post');
      } else {
        toast.error('Failed to delete post');
      }
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleBannerFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      setBannerUploadError('Please upload an image file (JPEG, PNG, GIF, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBannerUploadError('Image must be less than 5MB');
      return;
    }
    setBannerFile(file);
    setBannerUploadError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setBannerPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePostMediaSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (newPostMedia.length + files.length > 5) {
      setError('You can upload up to 5 files per post.');
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
    const maxSizeMB = (type: string) => (type.startsWith('video/') ? 15 : 5);
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setError('Unsupported file type. Please upload JPG, PNG, GIF, MP4 or MOV files.');
        return;
      }
      if (file.size > maxSizeMB(file.type) * 1024 * 1024) {
        setError(`File must be less than ${maxSizeMB(file.type)}MB`);
        return;
      }
    }
    setNewPostMedia((prev) => [...prev, ...files]);
    setError(null);
  };

  const removePostMedia = () => {
    setNewPostMedia([]);
    setError(null);
  };

  // --- UI Rendering ---
  if (loading) {
    return (
      <div style={pageContainer}>
        <div style={centerStyle}>
          {/* Professional Skeleton Loader */}
          <div style={{ ...skeletonStyle, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div
            style={{
              height: '24px',
              width: '200px',
              background: '#f1f5f9',
              borderRadius: borderRadius.md,
              marginTop: spacing.md,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          ></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageContainer}>
        {community && (
          <Head>
            <title>{community.name} • Healing Shoulder</title>
            <meta property="og:title" content={community.name} />
            <meta
              property="og:description"
              content={community.description?.substring(0, 160) || 'A compassionate space for shared grief and healing.'}
            />
            <meta property="og:type" content="website" />
            <meta
              property="og:url"
              content={`https://healingshoulder.site/community/${communityId}/${community.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '')}`}
            />
            <meta
              property="og:image"
              content={community.cover_photo_url || `https://healingshoulder.site/og-community-default.jpg`}
            />
            <meta name="twitter:card" content="summary_large_image" />
          </Head>
        )}
        <div
          style={{
            background: baseColors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.xl,
            maxWidth: '28rem',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            margin: '0 auto',
          }}
        >
          <Users size={48} style={{ color: baseColors.primary, margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: baseColors.text.primary, marginBottom: '0.5rem' }}>
            Error Loading Community
          </h2>
          <p style={{ color: baseColors.text.secondary, marginBottom: '1rem' }}>{error}</p>
          <button onClick={() => router.back()} style={buttonStyle(baseColors.primary)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div style={pageContainer}>
        <div
          style={{
            background: baseColors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.xl,
            maxWidth: '28rem',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            margin: '0 auto',
          }}
        >
          <Users size={48} style={{ color: baseColors.primary, margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: baseColors.text.primary, marginBottom: '0.5rem' }}>
            Community Not Found
          </h2>
          <p style={{ color: baseColors.text.secondary, marginBottom: '1rem' }}>
            The community you&apos;re looking for doesn&apos;t exist.
          </p>
          <button onClick={() => router.push('/communities')} style={buttonStyle(baseColors.primary)}>
            Browse Communities
          </button>
        </div>
      </div>
    );
  }

  // Wait until we know member status before showing anything that depends on it
  if (!memberStatusResolved) {
    return (
      <div style={pageContainer}>
        <div style={centerStyle}>
          <div style={{ ...skeletonStyle, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    );
  }

  const gradient = griefGradients[community.grief_type] || defaultGradient;
  const isAdmin = userRole === 'admin';
  const isModerator = userRole === 'moderator' || isAdmin;
  const authUsername = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anonymous';

  const transformPostForCard = (post: Post) => {
    const validGriefTypes = [
      'parent', 'child', 'spouse', 'sibling', 'friend',
      'pet', 'miscarriage', 'caregiver', 'suicide', 'other'
    ] as const;
    type GriefType = typeof validGriefTypes[number];
    const griefType = community?.grief_type;
    const griefTypes: GriefType[] =
      griefType && validGriefTypes.some(type => type === griefType)
        ? [griefType as GriefType]
        : ['other'];

    const mediaUrls = Array.isArray(post.media_urls) && post.media_urls.length > 0
      ? post.media_urls.filter(Boolean)
      : post.media_url
        ? [post.media_url]
        : [];

    return {
      id: post.id,
      userId: post.user_id,
      text: post.content,
      mediaUrl: mediaUrls[0] || undefined,
      mediaUrls,
      griefTypes,
      createdAt: new Date(post.created_at),
      likes: post.likes_count,
      isLiked: post.is_liked,
      commentsCount: post.comments_count,
      isAnonymous: post.username.toLowerCase().includes('anonymous'),
      user: {
        id: post.user_id,
        fullName: post.username.toLowerCase().includes('anonymous') ? null : post.username,
        avatarUrl: post.avatar_url,
        isAnonymous: post.username.toLowerCase().includes('anonymous'),
      },
    };
  };

  // Media gallery route — adjust as needed
  const mediaGalleryRoute = `/communities/${communityId}/media`;

  return (
    <div style={pageContainer}>
      {/* Banner — ONLY shown to non-members */}
      {!isMember && (
        <Link href={mediaGalleryRoute} passHref>
          <div
            style={{
              position: 'relative',
              height: isMobile ? '15rem' : '38rem',
              overflow: 'hidden',
              marginBottom: spacing['2xl'],
              borderRadius: borderRadius.md,
              cursor: 'pointer',
            }}
          >
            <Image
              src={
                community.cover_photo_url ||
                `https://via.placeholder.com/1200x300/fcd34d-f97316?text=${encodeURIComponent(community.name)}`
              }
              alt={community.name}
              fill
              sizes="100vw"
              style={{ objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://via.placeholder.com/1200x300/fcd34d-f97316?text=${encodeURIComponent(
                  community.name
                )}`;
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
              }}
            ></div>
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setBannerModalOpen(true);
                }}
                style={{
                  position: 'absolute',
                  bottom: spacing.lg,
                  right: spacing.lg,
                  ...outlineButtonStyle,
                  background: 'rgba(0,0,0,0.3)',
                  color: 'white',
                  backdropFilter: 'blur(4px)',
                  fontSize: '0.875rem',
                  zIndex: 2,
                }}
              >
                <ImageIcon size={18} />
                Edit Banner
              </button>
            )}
          </div>
        </Link>
      )}

      {/* Responsive container: column on mobile, row on desktop */}
      <div
        style={{
          maxWidth: '1152px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: spacing['2xl'],
        }}
      >
        {/* Main Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
          {/* Community Header */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, position: 'relative' }}>
              {/* Three-dot menu (visible only to members) */}
              {user && isMember && (
                <div
                  ref={kebabMenuRef}
                  style={{ position: 'absolute', top: spacing.sm, right: spacing.sm, zIndex: 1 }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsKebabOpen((prev) => !prev);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: spacing.xs,
                      borderRadius: borderRadius.sm,
                      color: baseColors.text.muted,
                    }}
                    aria-label="Community options"
                  >
                    <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⋯</span>
                  </button>
                  {isKebabOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: spacing.xs,
                        backgroundColor: baseColors.surface,
                        border: `1px solid ${baseColors.border}`,
                        borderRadius: borderRadius.md,
                        boxShadow:
                          '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                        minWidth: '120px',
                        zIndex: 10,
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMembership();
                          setIsKebabOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: `${spacing.sm} ${spacing.md}`,
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm,
                        }}
                      >
                        <LogOut size={16} />
                        Leave Community
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.lg }}>
                {/* Banner Thumbnail or Fallback Icon — NOW CLICKABLE */}
                <Link href={mediaGalleryRoute} passHref>
                  <div
                    style={{
                      width: '4rem',
                      height: '4rem',
                      borderRadius: borderRadius.md,
                      overflow: 'hidden',
                      flexShrink: 0,
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    {community.cover_photo_url ? (
                      <Image
                        src={community.cover_photo_url}
                        alt={`${community.name} banner`}
                        fill
                        style={{ objectFit: 'cover' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://via.placeholder.com/1200x300/fcd34d-f97316?text=${encodeURIComponent(community.name)}`;
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                        }}
                      >
                        <Users size={32} />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Community Info */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: baseColors.text.primary }}>{community.name}</h1>
                  <p style={{ color: baseColors.text.secondary, marginTop: spacing.sm }}>{community.description}</p>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: spacing.md,
                      marginTop: spacing.md,
                      fontSize: '0.875rem',
                      color: baseColors.text.muted,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Users size={16} style={{ color: baseColors.primary }} /> {community.member_count} members
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Heart size={16} style={{ color: baseColors.accent }} /> {community.online_count} online
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MessageCircle size={16} style={{ color: '#3b82f6' }} /> {posts.length} posts
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary Action Button — Join only */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {!isMember ? (
                  user ? (
                    <button onClick={handleMembership} style={buttonStyle(baseColors.primary)}>
                      <LogIn size={18} /> Join Community
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(`/auth?redirectTo=/communities/${communityId}`)}
                      style={buttonStyle(baseColors.primary)}
                    >
                      <LogIn size={18} /> Sign in to Join
                    </button>
                  )
                ) : null}
                {isAdmin && (
                  <button
                    onClick={() => toast('Community settings coming soon!')}
                    style={outlineButtonStyle}
                  >
                    <Settings size={18} /> Manage
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Create Post */}
          {isMember && (
            <div ref={composerRef}>
              <PostComposer
                onSubmit={async (text: string, mediaFiles: File[]) => {
                  if (!user) return;
                  const newPost = await createPostWithMedia(text, mediaFiles, user.id);
                  setPosts((prev) => [newPost, ...prev]);
                  toast.success('Post shared!');
                }}
                isSubmitting={uploadingMedia}
                placeholder={`What's on your mind, ${authUsername}? Share your thoughts...`}
                avatarUrl={user?.user_metadata?.avatar_url || null}
                displayName={authUsername}
                maxFiles={4}
              />
            </div>
          )}

          {/* Posts */}
<div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
  {posts.length === 0 ? (
    <div style={{ ...cardStyle, padding: '2rem', textAlign: 'center' }}>
      <MessageCircle size={48} style={{ color: baseColors.border, margin: '0 auto 1rem' }} />
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: baseColors.text.primary, marginBottom: spacing.sm }}>
        No posts yet
      </h3>
      <p style={{ color: baseColors.text.secondary, marginBottom: spacing.lg }}>
        {isMember
          ? "Be the first to share your thoughts with the community."
          : "Join this community to see and share posts."}
      </p>
      {!isMember && user && (
        <button onClick={handleMembership} style={buttonStyle(baseColors.primary)}>
          <UserPlus size={16} style={{ marginRight: '0.25rem' }} />
          Join to Participate
        </button>
      )}
    </div>
  ) : (
    posts.map((post) => {
      // Initialize ref slot for scroll-to-post
      if (!postRefs.current[post.id]) {
        postRefs.current[post.id] = null;
      }

      return (
        <div
          key={post.id}
          ref={(el) => {
            postRefs.current[post.id] = el;
          }}
        >
          <PostCard
            key={post.id}
            post={transformPostForCard(post)}
            canDelete={isModerator || post.user_id === user?.id}
            onPostDeleted={() => {
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
            }}
            context="community"
            showAuthor={true}
          />
        </div>
      );
    })
  )}
</div>s
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
          {/* Members */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: baseColors.text.primary, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <Users size={20} style={{ color: baseColors.primary }} />
                Community Members
              </h2>
              {isMember && community && (
                <ShareCommunityButton
                  communityId={community.id}
                  communityName={community.name}
                  communityDescription={community.description || ''}
                  style={{ ...outlineButtonStyle, fontSize: '0.875rem', padding: `${spacing.sm} ${spacing.sm}` }}
                />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, maxHeight: '500px', overflowY: 'auto' }}>
              {members.map((member) => (
                <div
                  key={member.user_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, minWidth: 0 }}>
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          width: '2.25rem',
                          height: '2.25rem',
                          borderRadius: borderRadius.full,
                          background: member.avatar_url ? 'transparent' : gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        {member.avatar_url ? (
                          <Image
                            src={member.avatar_url}
                            alt={member.username}
                            width={36}
                            height={36}
                            style={{ borderRadius: borderRadius.full, objectFit: 'cover' }}
                          />
                        ) : (
                          member.username[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      {member.is_online && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '0.625rem',
                            height: '0.625rem',
                            background: baseColors.accent,
                            borderRadius: borderRadius.full,
                            border: `2px solid white`,
                          }}
                        ></div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      {member.user_id && !member.username.toLowerCase().includes('anonymous') ? (
                        <Link
                          href={`/profile/${member.user_id}`}
                          style={{
                            fontWeight: 600,
                            color: baseColors.primary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textDecoration: 'none',
                          }}
                          aria-label={`View ${member.username}'s profile`}
                        >
                          {member.username}
                        </Link>
                      ) : (
                        <span
                          style={{
                            fontWeight: 600,
                            color: baseColors.text.primary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {member.username}
                        </span>
                      )}
                      <p style={{ color: baseColors.text.muted, fontSize: '0.75rem' }}>
                        Joined {formatRecentActivity(member.joined_at)}
                      </p>
                    </div>
                  </div>
                  {member.role !== 'member' && (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '0.0625rem 0.375rem',
                        borderRadius: '0.375rem',
                        background: member.role === 'admin' ? '#fef9c3' : '#ede9fe',
                        color: member.role === 'admin' ? '#92400e' : '#6d28d9',
                        border: member.role === 'admin' ? '1px solid #fde68a' : '1px solid #ddd6fe',
                        lineHeight: '1.2',
                        whiteSpace: 'nowrap',
                        alignSelf: 'center',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {member.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {members.length > 10 && (
              <button
                style={{
                  ...outlineButtonStyle,
                  width: '100%',
                  marginTop: spacing.md,
                  color: baseColors.primary,
                  justifyContent: 'center',
                }}
                onClick={() => toast('Full member list coming soon!')}
              >
                View all members ({members.length})
              </button>
            )}
          </div>

          {/* Guidelines */}
          <div style={cardStyle}>
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: baseColors.text.primary,
                marginBottom: spacing.md,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: borderRadius.full,
                  background: baseColors.primary,
                }}
              ></span>
              Our Guidelines
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, color: baseColors.text.secondary, fontSize: '0.875rem', lineHeight: 1.5 }}>
              <li>• Share from the heart, listen with compassion</li>
              <li>• Respect different grief journeys and timelines</li>
              <li>• No unsolicited advice </li>
              <li>• Keep personal details confidential</li>
              <li>• Report harmful content to moderators</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Banner Modal */}
      {bannerModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: spacing.lg,
          }}
        >
          <div
            style={{
              background: baseColors.surface,
              borderRadius: borderRadius.lg,
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                padding: spacing.xl,
                borderBottom: `1px solid ${baseColors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: baseColors.text.primary }}>
                Update Community Banner
              </h3>
              <button
                onClick={() => setBannerModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: baseColors.text.muted }}
              >
                <X size={24} />
              </button>
            </div>
            <div style={{ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
              <div
                style={{
                  border: `2px dashed ${baseColors.border}`,
                  borderRadius: borderRadius.md,
                  padding: spacing.xl,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('banner-modal-upload')?.click()}
              >
                {bannerPreview ? (
                  <div style={{ position: 'relative', height: '12rem', borderRadius: borderRadius.md, overflow: 'hidden' }}>
                    <Image
                      src={bannerPreview}
                      alt="Banner preview"
                      fill
                      sizes="(max-width: 768px) 100vw, 500px"
                      style={{ objectFit: 'contain' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '0.875rem',
                      }}
                    >
                      Click to change image
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: spacing['2xl'] }}>
                    <div
                      style={{
                        width: '3rem',
                        height: '3rem',
                        borderRadius: borderRadius.full,
                        background: '#fef3c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.5rem',
                      }}
                    >
                      <ImageIcon size={24} style={{ color: '#d97706' }} />
                    </div>
                    <p style={{ color: baseColors.text.secondary }}>
                      Upload a banner image
                      <br />
                      <span style={{ fontSize: '0.75rem', color: baseColors.text.muted }}>
                        Recommended: 1200x300px, max 5MB
                      </span>
                    </p>
                  </div>
                )}
              </div>
              <input
                type="file"
                id="banner-modal-upload"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleBannerFileSelect}
              />
              {bannerUploadError && (
                <div
                  style={{
                    padding: spacing.md,
                    background: '#fee2e2',
                    color: '#b91c1c',
                    borderRadius: borderRadius.md,
                    fontSize: '0.875rem',
                  }}
                >
                  {bannerUploadError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${baseColors.border}` }}>
                <button
                  onClick={() => setBannerModalOpen(false)}
                  style={{ ...outlineButtonStyle, color: baseColors.text.primary }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => bannerFile && updateBanner(bannerFile)}
                  disabled={!bannerFile || bannerUploading}
                  style={{
                    ...buttonStyle(baseColors.primary),
                    opacity: !bannerFile || bannerUploading ? 0.7 : 1,
                  }}
                >
                  {bannerUploading ? (
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginRight: '0.25rem' }} />
                      Uploading...
                    </span>
                  ) : (
                    'Update Banner'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Comment Modal */}
      {reportingCommentId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: spacing.lg,
          }}
        >
          <div
            style={{
              background: baseColors.surface,
              borderRadius: borderRadius.lg,
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                padding: spacing.xl,
                borderBottom: `1px solid ${baseColors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: baseColors.text.primary }}>Report Comment</h3>
              <button
                onClick={() => {
                  setReportingCommentId(null);
                  setReportReason('');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: baseColors.text.muted }}
              >
                <X size={24} />
              </button>
            </div>
            <div style={{ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
              <p style={{ color: baseColors.text.secondary }}>
                Please provide details about why you are reporting this comment. Reports help us maintain a respectful community.
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe why you're reporting this comment..."
                style={{
                  width: '100%',
                  padding: `${spacing.sm} ${spacing.md}`,
                  border: `1px solid ${baseColors.border}`,
                  borderRadius: borderRadius.md,
                  minHeight: '100px',
                  fontSize: '0.875rem',
                }}
                maxLength={500}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${baseColors.border}` }}>
                <button
                  onClick={() => {
                    setReportingCommentId(null);
                    setReportReason('');
                  }}
                  style={{ ...outlineButtonStyle, color: baseColors.text.primary }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => reportComment(reportingCommentId, reportReason)}
                  disabled={!reportReason.trim()}
                  style={{
                    ...buttonStyle(baseColors.primary),
                    opacity: !reportReason.trim() ? 0.7 : 1,
                  }}
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}