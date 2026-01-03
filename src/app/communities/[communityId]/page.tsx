// src/app/communities/[communityId]/page.tsx
'use client';
import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Users,
  Heart,
  MessageCircle,
  LogIn,
  LogOut,
  Settings,
  UserPlus,
  ImageIcon,
  Trash2,
  X,
  Loader2,
  Upload,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as Hearts from '@/lib/comments-hearts/heartsLogic';

// --- Types (unchanged) ---
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

interface CommentNode {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  post_id: string;
  parent_comment_id: string | null;
  replies: CommentNode[];
  reply_count: number;
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
const spacing = { sm: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.25rem', '2xl': '1.5rem' };
const borderRadius = { md: '0.5rem', lg: '0.75rem', xl: '1rem', full: '9999px' };
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
const spinnerStyle: React.CSSProperties = {
  height: '3rem',
  width: '3rem',
  borderRadius: borderRadius.full,
  border: `4px solid ${baseColors.primary}`,
  borderTopColor: 'transparent',
  animation: 'spin 1s linear infinite',
  margin: '0 auto 1rem',
};

// --- Component ---
export default function CommunityDetailPage() {
  const params = useParams();
  const communityId = params.communityId as string;
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'moderator' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState<File | null>(null);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [likeLoading, setLikeLoading] = useState<Record<string, boolean>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [addingComment, setAddingComment] = useState<Record<string, boolean>>({});
  // By default, show all comment sections expanded but only show the latest comment
  const [expandedPosts, setExpandedPosts] = useState<string[]>([]);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [replyingToComment, setReplyingToComment] = useState<Record<string, boolean>>({});
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [addingReply, setAddingReply] = useState<Record<string, boolean>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  // By default, don't show all comments - only the latest one
  const [showAllComments, setShowAllComments] = useState<Record<string, boolean>>({});

  const formatRecentActivity = (dateString: string): string => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return days === 1 ? '1 day ago' : `${days} days ago`;
    }
    const weeks = Math.floor(days / 7);
    if (weeks < 4) {
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    const months = Math.floor(days / 30);
    if (months < 12) {
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    const years = Math.floor(days / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  };

  const isUserOnline = (lastOnline: string | null): boolean => {
    if (!lastOnline) return false;
    const lastOnlineDate = new Date(lastOnline);
    const now = new Date();
    return now.getTime() - lastOnlineDate.getTime() < 5 * 60 * 1000;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!communityId) return;
      try {
        setLoading(true);
        setError(null);
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

        const { count, error: countError } = await supabase
          .from('community_members')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', communityId);

        if (countError) throw new Error(`Failed to count members: ${countError.message}`);

        const communityWithPhoto = {
          ...communityData,
          cover_photo_url: coverPhotoUrl,
          member_count: count || 0,
        };

        setCommunity(communityWithPhoto);

        if (user) {
          const { data: memberData } = await supabase
            .from('community_members')
            .select('role')
            .eq('community_id', communityId)
            .eq('user_id', user.id)
            .single();

          if (memberData) {
            setIsMember(true);
            setUserRole(memberData.role);
          } else {
            setIsMember(false);
            setUserRole(null);
          }
        } else {
          setIsMember(false);
          setUserRole(null);
        }

        const { data: membersData, error: membersError } = await supabase
          .from('community_members')
          .select(`
            role,
            joined_at,
            user_id,
            user:profiles!left (
              full_name,
              avatar_url,
              last_online
            )
          `)
          .eq('community_id', communityId)
          .order('joined_at', { ascending: true });

        if (membersError) throw membersError;

        const formattedMembers = membersData.map((member) => {
          const profile = Array.isArray(member.user) ? member.user[0] ?? null : member.user;
          return {
            user_id: member.user_id,
            username: profile?.full_name || 'Anonymous',
            avatar_url: profile?.avatar_url || null,
            last_online: profile?.last_online || null,
            is_online: isUserOnline(profile?.last_online || null),
            role: member.role,
            joined_at: member.joined_at,
          };
        });

        setMembers(formattedMembers);

        const { data: postData, error: postError } = await supabase
          .from('community_posts')
          .select(`
            id,
            content,
            created_at,
            community_id,
            media_url,
            likes_count,
            comments_count,
            user_id
          `)
          .eq('community_id', communityId)
          .order('created_at', { ascending: false });

        if (postError) throw postError;

        const userIds = [...new Set(postData.map((post) => post.user_id))];

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, is_anonymous')
          .in('id', userIds);

        if (profilesError) console.warn('Error fetching profiles for posts:', profilesError);

        const profilesMap = new Map();
        profilesData?.forEach((profile) => {
          profilesMap.set(profile.id, profile);
        });

        let postsWithLikes = postData.map((post) => {
          const userProfile = profilesMap.get(post.user_id) || {};
          const isAnonymous = userProfile.is_anonymous || false;
          return {
            id: post.id,
            content: post.content,
            media_url: post.media_url,
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

        if (user) {
          const likeStatusPromises = postsWithLikes.map(async (post) => {
            try {
              const isLiked = await Hearts.checkIfLiked(post.id, user.id, 'community_posts');
              return { postId: post.id, isLiked };
            } catch (error) {
              console.error('Error checking like status:', error);
              return { postId: post.id, isLiked: false };
            }
          });

          const likeStatusResults = await Promise.all(likeStatusPromises);
          postsWithLikes = postsWithLikes.map((post) => {
            const likeStatus = likeStatusResults.find((status) => status.postId === post.id);
            return likeStatus ? { ...post, is_liked: likeStatus.isLiked } : post;
          });
        }

        setPosts(postsWithLikes);
        
        // Initialize expandedPosts with all post IDs to show comment sections by default
        if (postData.length > 0) {
          setExpandedPosts(postData.map(post => post.id));
          
          // Fetch the latest comment for each post
          const fetchLatestCommentsPromises = postData.map(async (post) => {
            const { data: latestComments, error: commentsError } = await supabase
              .from('community_post_comments_with_profiles')
              .select('*')
              .eq('post_id', post.id)
              .order('created_at', { ascending: false })
              .limit(1);

            if (commentsError) {
              console.error(`Error fetching latest comment for post ${post.id}:`, commentsError);
              return { postId: post.id, comments: [] };
            }

            if (latestComments && latestComments.length > 0) {
              const formattedComment = {
                id: latestComments[0].id,
                content: latestComments[0].content,
                created_at: latestComments[0].created_at,
                user_id: latestComments[0].user_id,
                username: latestComments[0].is_anonymous ? 'Anonymous' : latestComments[0].username || 'Anonymous',
                avatar_url: latestComments[0].is_anonymous ? null : latestComments[0].avatar_url || null,
                post_id: latestComments[0].post_id,
                parent_comment_id: (latestComments[0].parent_comment_id ?? null) as string | null,
                replies: [],
                reply_count: 0,
              };
              return { postId: post.id, comments: [formattedComment] };
            }
            
            return { postId: post.id, comments: [] };
          });

          const latestCommentsResults = await Promise.all(fetchLatestCommentsPromises);
          
          // Update comments state with latest comments
          const initialComments: Record<string, Comment[]> = {};
          latestCommentsResults.forEach(({ postId, comments }) => {
            initialComments[postId] = comments;
          });
          
          setComments(initialComments);
        }
      } catch (err: any) {
        console.error('Error fetching community:', err);
        setError(err.message || 'Failed to load community data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [communityId, user, supabase]);

  // In your page component, add this once:
  useEffect(() => {
    // Only run on client
    if (typeof document !== 'undefined') {
      const existing = document.getElementById('global-spin-styles');
      if (!existing) {
        const style = document.createElement('style');
        style.id = 'global-spin-styles';
        style.innerHTML = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        `;
        document.head.appendChild(style);
      }
    }
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
      const { error } = await supabase
        .from('community_members')
        .insert({
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

  const createPostWithMedia = async (content: string, file: File | null, userId: string) => {
    if (!community) throw new Error('Community not loaded');

    try {
      const { data: postData, error: postError } = await supabase
        .from('community_posts')
        .insert({
          community_id: communityId,
          user_id: userId,
          content: content.trim(),
          created_at: new Date().toISOString(),
          media_url: file ? 'uploading' : null,
        })
        .select(`
          id,
          content,
          created_at,
          community_id,
          media_url,
          user_id
        `)
        .single();

      if (postError) throw postError;

      let mediaUrl = null;
      if (file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
        if (!allowedTypes.includes(file.type)) throw new Error('Unsupported file type');
        
        const maxSize = file.type.startsWith('video/') ? 15 : 5;
        if (file.size > maxSize * 1024 * 1024) throw new Error(`File must be less than ${maxSize}MB`);

        const fileExt = file.name.split('.').pop();
        const fileName = `${communityId}/posts/${postData.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('communities')
          .upload(fileName, file, { upsert: true, contentType: file.type });

        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('communities').getPublicUrl(fileName);
        mediaUrl = data.publicUrl;
        
        if (mediaUrl) {
          await supabase.from('community_posts').update({ media_url: mediaUrl }).eq('id', postData.id);
        }
      }

      const { data: userData } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', userId)
        .single();

      return {
        id: postData.id,
        content: postData.content,
        media_url: mediaUrl,
        created_at: postData.created_at,
        user_id: postData.user_id,
        username: userData?.full_name || 'Anonymous',
        avatar_url: userData?.avatar_url || null,
        community_id: postData.community_id,
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
      };
    } catch (error: any) {
      console.error('Post creation failed:', error);
      if (error.message?.includes('media')) {
        await supabase.from('community_posts').delete().eq('id', error.postId);
      }
      throw error;
    }
  };

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !community || (!newPostContent.trim() && !newPostMedia)) return;
    setError(null);
    try {
      const newPost = await createPostWithMedia(newPostContent.trim(), newPostMedia, user.id);
      setPosts((prev) => [newPost, ...prev]);
      setNewPostContent('');
      setNewPostMedia(null);
      toast.success('Post created successfully!');
    } catch (err: any) {
      console.error('Error creating post:', err);
      setError(err.message || 'Failed to create post');
      toast.error('Failed to create post');
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!user) {
      toast.error('Please sign in to like posts');
      return;
    }

    setLikeLoading((prev) => ({ ...prev, [postId]: true }));

    try {
      const result = await Hearts.toggleLike(postId, user.id, 'community_posts');
      setPosts((prevPosts) =>
        prevPosts.map((post) => (post.id === postId ? { ...post, is_liked: result.isLiked, likes_count: result.likesCount } : post))
      );
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    } finally {
      setLikeLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const fetchComments = async (postId: string) => {
    if (!postId) return;
    setCommentLoading((prev) => ({ ...prev, [postId]: true }));

    try {
      const { data: allComments, error: commentsError } = await supabase
        .from('community_post_comments_with_profiles')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      const formattedComments = allComments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user_id: comment.user_id,
        username: comment.is_anonymous ? 'Anonymous' : comment.username || 'Anonymous',
        avatar_url: comment.is_anonymous ? null : comment.avatar_url || null,
        post_id: comment.post_id,
        parent_comment_id: (comment.parent_comment_id ?? null) as string | null,
      }));

      const buildCommentTree = (comments: Comment[], parentId: string | null = null): CommentNode[] => {
        return comments
          .filter((comment) => comment.parent_comment_id === parentId)
          .map((comment): CommentNode => {
            const replies = buildCommentTree(comments, comment.id);
            return {
              ...comment,
              parent_comment_id: comment.parent_comment_id ?? null,
              replies,
              reply_count: replies.length,
            };
          });
      };

      const nestedComments = buildCommentTree(formattedComments);
      setComments((prev) => ({ ...prev, [postId]: nestedComments }));
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setCommentLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const addComment = async (postId: string, content: string) => {
    if (!user || !content.trim() || !postId) return;
    setAddingComment((prev) => ({ ...prev, [postId]: true }));

    try {
      const { data: insertData, error: insertError } = await supabase
        .from('community_post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim(),
          created_at: new Date().toISOString(),
          parent_comment_id: null,
        })
        .select('id, content, created_at, post_id, user_id')
        .single();

      if (insertError) throw insertError;

      const { data: commentWithProfile, error: profileError } = await supabase
        .from('community_post_comments_with_profiles')
        .select('*')
        .eq('id', insertData.id)
        .single();

      if (profileError) throw profileError;

      const newComment: CommentNode = {
        id: commentWithProfile.id,
        content: commentWithProfile.content,
        created_at: commentWithProfile.created_at,
        user_id: commentWithProfile.user_id,
        username: commentWithProfile.is_anonymous ? 'Anonymous' : commentWithProfile.username || 'Anonymous',
        avatar_url: commentWithProfile.is_anonymous ? null : commentWithProfile.avatar_url || null,
        post_id: commentWithProfile.post_id,
        parent_comment_id: null,
        replies: [],
        reply_count: 0,
      };

      setComments((prev) => ({ ...prev, [postId]: [newComment, ...(prev[postId] || [])] }));

      // Update comment count
      const { data: currentPost, error: postError } = await supabase
        .from('community_posts')
        .select('comments_count')
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      const newCommentCount = (currentPost.comments_count || 0) + 1;
      await supabase.from('community_posts').update({ comments_count: newCommentCount }).eq('id', postId);

      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, comments_count: newCommentCount } : post))
      );

      setNewCommentContent((prev) => ({ ...prev, [postId]: '' }));
      toast.success('Comment added successfully');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setAddingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const addReply = async (postId: string, parentCommentId: string, content: string) => {
    if (!user || !content.trim() || !postId || !parentCommentId) return;
    setAddingReply((prev) => ({ ...prev, [parentCommentId]: true }));

    try {
      const { data: insertData, error: insertError } = await supabase
        .from('community_post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim(),
          created_at: new Date().toISOString(),
          parent_comment_id: parentCommentId,
        })
        .select('id, content, created_at, post_id, user_id, parent_comment_id')
        .single();

      if (insertError) throw insertError;

      const { data: replyWithProfile, error: profileError } = await supabase
        .from('community_post_comments_with_profiles')
        .select('*')
        .eq('id', insertData.id)
        .single();

      if (profileError) throw profileError;

      const newReply = {
        id: replyWithProfile.id,
        content: replyWithProfile.content,
        created_at: replyWithProfile.created_at,
        user_id: replyWithProfile.user_id,
        username: replyWithProfile.is_anonymous ? 'Anonymous' : replyWithProfile.username || 'Anonymous',
        avatar_url: replyWithProfile.is_anonymous ? null : replyWithProfile.avatar_url || null,
        post_id: replyWithProfile.post_id,
        parent_comment_id: replyWithProfile.parent_comment_id,
        replies: [],
        reply_count: 0,
      };

      const updateCommentsState = (comments: Comment[]): Comment[] => {
        return comments.map((comment) => {
          if (comment.id === parentCommentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newReply],
              reply_count: (comment.reply_count || 0) + 1,
            };
          }
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: updateCommentsState(comment.replies),
            };
          }
          return comment;
        });
      };

      setComments((prev) => ({ ...prev, [postId]: updateCommentsState(prev[postId] || []) }));

      // Update comment count
      const { data: currentPost, error: postError } = await supabase
        .from('community_posts')
        .select('comments_count')
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      const newCommentCount = (currentPost.comments_count || 0) + 1;
      await supabase.from('community_posts').update({ comments_count: newCommentCount }).eq('id', postId);

      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, comments_count: newCommentCount } : post))
      );

      setReplyContent((prev) => ({ ...prev, [parentCommentId]: '' }));
      setReplyingToComment((prev) => ({ ...prev, [parentCommentId]: false }));
      toast.success('Reply added successfully');
    } catch (error: any) {
      console.error('Error adding reply:', error);
      toast.error('Failed to add reply');
    } finally {
      setAddingReply((prev) => ({ ...prev, [parentCommentId]: false }));
    }
  };

  const deleteComment = async (commentId: string, postId: string, isReply = false) => {
    const deletingId = isReply ? commentId : commentId;
    
    if (isReply) {
      setDeletingReplyId(commentId);
    } else {
      setDeletingCommentId(commentId);
    }

    try {
      const { data: allComments, error: allCommentsError } = await supabase
        .from('community_post_comments')
        .select('id, parent_comment_id')
        .eq('post_id', postId);

      if (allCommentsError) throw allCommentsError;

      const getDescendantIds = (parentId: string): string[] => {
        const directChildren = allComments.filter((c) => c.parent_comment_id === parentId);
        return [...directChildren.map((c) => c.id), ...directChildren.flatMap((c) => getDescendantIds(c.id))];
      };

      const descendantIds = getDescendantIds(commentId);
      const totalCommentsToDelete = 1 + descendantIds.length;

      const { error: deleteError } = await supabase
        .from('community_post_comments')
        .delete()
        .in('id', [commentId, ...descendantIds]);

      if (deleteError) throw deleteError;

      // Update comment count
      const { data: currentPost, error: postError } = await supabase
        .from('community_posts')
        .select('comments_count')
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      const newCommentCount = Math.max(0, (currentPost.comments_count || 0) - totalCommentsToDelete);
      await supabase.from('community_posts').update({ comments_count: newCommentCount }).eq('id', postId);

      // Update local state
      const removeCommentAndDescendants = (comments: Comment[]): Comment[] => {
        return comments.filter((comment) => {
          if (comment.id === commentId) return false;
          if (comment.replies && comment.replies.length > 0) {
            comment.replies = removeCommentAndDescendants(comment.replies);
            comment.reply_count = comment.replies.length;
          }
          return true;
        });
      };

      setComments((prev) => ({ ...prev, [postId]: removeCommentAndDescendants(prev[postId] || []) }));
      
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, comments_count: newCommentCount } : post))
      );

      // Close expanded replies if needed
      if (expandedComments[commentId]) {
        setExpandedComments((prev) => {
          const newExpanded = { ...prev };
          delete newExpanded[commentId];
          return newExpanded;
        });
      }

      toast.success(isReply ? 'Reply deleted successfully' : 'Comment and all replies deleted successfully');
    } catch (error: any) {
      console.error(isReply ? 'Error deleting reply:' : 'Error deleting comment:', error);
      toast.error(`Failed to delete ${isReply ? 'reply' : 'comment'}`);
    } finally {
      if (isReply) {
        setDeletingReplyId(null);
      } else {
        setDeletingCommentId(null);
      }
    }
  };

  const toggleComments = (postId: string) => {
    // Toggle showing all comments for this post
    setShowAllComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
    
    // Ensure we have all comments loaded when expanding
    if (!showAllComments[postId] && (!comments[postId] || comments[postId].length < 2)) {
      fetchComments(postId);
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedComments((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const toggleReplyForm = (commentId: string) => {
    setReplyingToComment((prev) => {
      const newReplyingState = !prev[commentId];
      if (newReplyingState) {
        setReplyContent((contentPrev) => ({ ...contentPrev, [commentId]: '' }));
      }
      return { ...prev, [commentId]: newReplyingState };
    });
  };

  const toggleShowAllComments = (postId: string) => {
    setShowAllComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
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
    } catch (error: any) {
      console.error('Banner update failed:', error);
      setBannerUploadError(error.message || 'Failed to update banner');
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
      setComments((prev) => {
        const newComments = { ...prev };
        delete newComments[postId];
        return newComments;
      });
      
      toast.success('Post deleted successfully');
    } catch (error: any) {
      console.error('Post deletion failed:', error);
      toast.error(error.message || 'Failed to delete post');
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
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload JPG, PNG, GIF, MP4 or MOV files.');
      return;
    }
    
    const maxSize = file.type.startsWith('video/') ? 15 : 5;
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File must be less than ${maxSize}MB`);
      return;
    }
    
    setNewPostMedia(file);
    setError(null);
  };

  const removePostMedia = () => {
    setNewPostMedia(null);
    setError(null);
  };

  // --- UI Rendering (with inline styles) ---
  if (loading) {
    return (
      <div style={pageContainer}>
        <div style={centerStyle}>
          <div style={spinnerStyle}></div>
          <p style={{ color: baseColors.text.secondary }}>Loading community...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
            The community you're looking for doesn't exist.
          </p>
          <button onClick={() => router.push('/communities')} style={buttonStyle(baseColors.primary)}>
            Browse Communities
          </button>
        </div>
      </div>
    );
  }

  const gradient = griefGradients[community.grief_type] || defaultGradient;
  const isAdmin = userRole === 'admin';
  const isModerator = userRole === 'moderator' || isAdmin;
  const authUsername = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anonymous';

  const renderCommentPreview = (comment: Comment) => {
  return (
    <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md }}>
      <div
        style={{
          width: '2rem',
          height: '2rem',
          borderRadius: borderRadius.full,
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'white',
        }}
      >
        {comment.avatar_url ? (
          <img
            src={comment.avatar_url}
            alt={comment.username}
            style={{ width: '100%', height: '100%', borderRadius: borderRadius.full, objectFit: 'cover' }}
          />
        ) : (
          comment.username[0]?.toUpperCase() || 'U'
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            background: '#f8fafc',
            borderRadius: borderRadius.md,
            padding: spacing.md,
          }}
        >
          <h4 style={{ fontWeight: 600, color: baseColors.text.primary, fontSize: '0.875rem' }}>{comment.username}</h4>
          <p style={{ color: baseColors.text.muted, fontSize: '0.75rem', marginTop: '0.125rem' }}>
            {formatRecentActivity(comment.created_at)}
          </p>
          <p style={{ color: baseColors.text.primary, fontSize: '0.875rem', marginTop: spacing.sm, whiteSpace: 'pre-line' }}>
            {comment.content}
          </p>
        </div>
      </div>
    </div>
  );
};

  const renderComment = (comment: Comment, postId: string, depth = 0) => {
    const isNested = depth > 0;
    return (
      <div key={comment.id} style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md, marginLeft: isNested ? spacing.xl : 0 }}>
        <div
          style={{
            width: '2rem',
            height: '2rem',
            borderRadius: borderRadius.full,
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'white',
          }}
        >
          {comment.avatar_url ? (
            <img
              src={comment.avatar_url}
              alt={comment.username}
              style={{ width: '100%', height: '100%', borderRadius: borderRadius.full, objectFit: 'cover' }}
            />
          ) : (
            comment.username[0]?.toUpperCase() || 'U'
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              background: isNested ? baseColors.border : '#f8fafc',
              borderRadius: borderRadius.md,
              padding: spacing.md,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ fontWeight: 600, color: baseColors.text.primary, fontSize: '0.875rem' }}>{comment.username}</h4>
                <p style={{ color: baseColors.text.muted, fontSize: '0.75rem', marginTop: '0.125rem' }}>
                  {formatRecentActivity(comment.created_at)}
                </p>
              </div>
              {(comment.user_id === user?.id || isModerator) && (
                <button
                  onClick={async () => {
                    if (
                      window.confirm(
                        'Are you sure you want to delete this comment? This will also delete all replies to this comment.'
                      )
                    ) {
                      await deleteComment(comment.id, postId, false);
                    }
                  }}
                  disabled={deletingCommentId === comment.id || deletingReplyId === comment.id}
                  style={{
                    color: baseColors.text.muted,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: deletingCommentId === comment.id || deletingReplyId === comment.id ? 0.5 : 1,
                  }}
                >
                  {(deletingCommentId === comment.id || deletingReplyId === comment.id) ? (
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              )}
            </div>
            <p style={{ color: baseColors.text.primary, fontSize: '0.875rem', marginTop: spacing.sm, whiteSpace: 'pre-line' }}>
              {comment.content}
            </p>
            {user && (
              <div style={{ marginTop: spacing.sm, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <button
                  onClick={() => toggleReplyForm(comment.id)}
                  style={{
                    color: baseColors.primary,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <CornerDownLeft size={12} />
                  Reply
                </button>
                {comment.reply_count && comment.reply_count > 0 && (
                  <button
                    onClick={() => toggleReplies(comment.id)}
                    style={{
                      color: baseColors.text.muted,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {expandedComments[comment.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
                  </button>
                )}
              </div>
            )}
            {replyingToComment[comment.id] && user && (
              <div style={{ marginTop: spacing.md, marginLeft: spacing.md, paddingLeft: spacing.md, borderLeft: `2px solid ${baseColors.border}` }}>
                <div style={{ display: 'flex', gap: spacing.sm }}>
                  <input
                    type="text"
                    value={replyContent[comment.id] || ''}
                    onChange={(e) => setReplyContent((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                    placeholder="Write a reply..."
                    style={{
                      flex: 1,
                      padding: `${spacing.sm} ${spacing.md}`,
                      border: `1px solid ${baseColors.border}`,
                      borderRadius: borderRadius.md,
                      fontSize: '0.875rem',
                    }}
                  />
                  <button
                    onClick={() => addReply(postId, comment.id, replyContent[comment.id] || '')}
                    disabled={addingReply[comment.id] || !replyContent[comment.id]?.trim()}
                    style={{
                      ...buttonStyle(
                        replyContent[comment.id]?.trim() ? baseColors.primary : '#e2e8f0',
                        replyContent[comment.id]?.trim() ? 'white' : baseColors.text.muted
                      ),
                      padding: `${spacing.sm} ${spacing.md}`,
                      fontSize: '0.875rem',
                      opacity: addingReply[comment.id] || !replyContent[comment.id]?.trim() ? 0.7 : 1,
                    }}
                  >
                    {addingReply[comment.id] ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Reply'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {expandedComments[comment.id] && comment.replies && comment.replies.length > 0 && (
            <div style={{ marginTop: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {comment.replies.map((reply) => renderComment(reply, postId, depth + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={pageContainer}>
      {/* Banner */}
      <div
        style={{
          position: 'relative',
          height: '12rem',
          overflow: 'hidden',
          marginBottom: spacing['2xl'],
          borderRadius: borderRadius.md,
        }}
      >
        <img
          src={
            community.cover_photo_url ||
            `https://via.placeholder.com/1200x300/fcd34d-f97316?text=${encodeURIComponent(community.name)}`
          }
          alt={community.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
            onClick={() => setBannerModalOpen(true)}
            style={{
              position: 'absolute',
              bottom: spacing.lg,
              right: spacing.lg,
              ...outlineButtonStyle,
              background: 'rgba(0,0,0,0.3)',
              color: 'white',
              backdropFilter: 'blur(4px)',
              fontSize: '0.875rem',
            }}
          >
            <ImageIcon size={18} />
            Edit Banner
          </button>
        )}
      </div>

      <div style={{ maxWidth: '1152px', margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing['2xl'] }}>
        {/* Main Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
          {/* Community Header */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.lg }}>
                <div
                  style={{
                    width: '4rem',
                    height: '4rem',
                    borderRadius: borderRadius.md,
                    background: gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Users size={32} color="white" />
                </div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {user ? (
                  <button onClick={handleMembership} style={buttonStyle(isMember ? '#ef4444' : baseColors.primary)}>
                    {isMember ? <><LogOut size={18} /> Leave Community</> : <><LogIn size={18} /> Join Community</>}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(`/auth?redirectTo=/communities/${communityId}`)}
                    style={buttonStyle(baseColors.primary)}
                  >
                    <LogIn size={18} /> Sign in to Join
                  </button>
                )}
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
            <div style={cardStyle}>
              <form onSubmit={handleCreatePost}>
                <div style={{ display: 'flex', gap: spacing.md }}>
                  <div
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: borderRadius.full,
                      background: gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                    }}
                  >
                    {user?.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt={authUsername}
                        style={{ width: '100%', height: '100%', borderRadius: borderRadius.full, objectFit: 'cover' }}
                      />
                    ) : (
                      authUsername[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder={`What's on your mind, ${authUsername}? Share your thoughts, memories, or questions with the community...`}
                      style={{
                        width: '100%',
                        padding: `${spacing.sm} ${spacing.md}`,
                        border: `1px solid ${baseColors.border}`,
                        borderRadius: borderRadius.md,
                        minHeight: '100px',
                        maxHeight: '200px',
                        resize: 'vertical',
                        fontSize: '0.875rem',
                      }}
                      maxLength={500}
                    />
                    {newPostMedia && (
                      <div style={{ marginTop: spacing.md, padding: spacing.md, background: '#f8fafc', borderRadius: borderRadius.md, position: 'relative' }}>
                        <button
                          type="button"
                          onClick={removePostMedia}
                          style={{
                            position: 'absolute',
                            top: '-0.5rem',
                            right: '-0.5rem',
                            background: '#ef4444',
                            color: 'white',
                            borderRadius: borderRadius.full,
                            width: '1.25rem',
                            height: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          title="Remove media"
                        >
                          <X size={12} />
                        </button>
                        {newPostMedia.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(newPostMedia)}
                            alt="Post preview"
                            style={{ maxHeight: '16rem', width: '100%', objectFit: 'contain', borderRadius: borderRadius.md }}
                          />
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: spacing.lg,
                              background: '#f1f5f9',
                              borderRadius: borderRadius.md,
                            }}
                          >
                            <div style={{ color: baseColors.primary, marginBottom: spacing.sm }}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="2.5rem" height="2.5rem">
                                <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v11.5c0 1.243 1.007 2.25 2.25 2.25h11.5a2.25 2.25 0 002.25-2.25V4.25A2.25 2.25 0 0015.75 2H4.25zm11.5 1.5a.75.75 0 01.75.75V8h-4.5a.75.75 0 010-1.5h3.75V4.75a.75.75 0 01.75-.75z" clipRule="evenodd" />
                                <path fillRule="evenodd" d="M6 4.5a.75.75 0 01.75.75v3.5l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06l1.72 1.72V5.25A.75.75 0 016 4.5z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <p style={{ fontWeight: 600, color: baseColors.text.primary, marginBottom: spacing.sm, fontSize: '0.875rem' }}>
                              {newPostMedia.name}
                            </p>
                            <p style={{ color: baseColors.text.muted, fontSize: '0.75rem' }}>{Math.round(newPostMedia.size / 1024)}KB</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                        <label style={{ display: 'flex', alignItems: 'center', color: baseColors.primary, cursor: 'pointer', fontSize: '0.875rem' }}>
                          <Upload size={18} style={{ marginRight: '0.25rem' }} />
                          <span>Add media</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            style={{ display: 'none' }}
                            onChange={handlePostMediaSelect}
                          />
                        </label>
                        <span style={{ color: baseColors.text.muted, fontSize: '0.75rem' }}>{newPostContent.length}/500</span>
                      </div>
                      <button
                        type="submit"
                        disabled={uploadingMedia || (!newPostContent.trim() && !newPostMedia)}
                        style={{
                          ...buttonStyle(baseColors.primary),
                          padding: `${spacing.sm} ${spacing.md}`,
                          fontSize: '0.875rem',
                          opacity: uploadingMedia || (!newPostContent.trim() && !newPostMedia) ? 0.7 : 1,
                        }}
                      >
                        {uploadingMedia ? (
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '0.25rem' }} />
                            Uploading...
                          </span>
                        ) : (
                          'Share'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
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
              posts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    ...cardStyle,
                    marginBottom: spacing['2xl'],
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', gap: spacing.md }}>
                    <div
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: borderRadius.full,
                        background: gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    >
                      {post.avatar_url ? (
                        <img
                          src={post.avatar_url}
                          alt={post.username}
                          style={{ width: '100%', height: '100%', borderRadius: borderRadius.full, objectFit: 'cover' }}
                        />
                      ) : (
                        post.username[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
                        <div>
                          <h3 style={{ fontWeight: 600, color: baseColors.text.primary }}>{post.username}</h3>
                          <p style={{ color: baseColors.text.muted, fontSize: '0.75rem' }}>
                            {formatRecentActivity(post.created_at)}
                          </p>
                        </div>
                        {(isModerator || post.user_id === user?.id) && (
                          <button
                            onClick={() => deletePost(post.id)}
                            disabled={deletingPostId === post.id}
                            style={{
                              color: baseColors.text.muted,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              opacity: deletingPostId === post.id ? 0.5 : 1,
                            }}
                          >
                            {deletingPostId === post.id ? (
                              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <Trash2 size={18} />
                            )}
                          </button>
                        )}
                      </div>
                      <p style={{ color: baseColors.text.primary, whiteSpace: 'pre-line', marginBottom: spacing.lg }}>
                        {post.content}
                      </p>
                      {post.media_url && (
                        <div style={{ marginBottom: spacing.lg, maxHeight: '24rem', overflow: 'hidden', borderRadius: borderRadius.md }}>
                          {post.media_url.includes('video') ? (
                            <video
                              src={post.media_url}
                              controls
                              style={{ width: '100%', height: 'auto', maxHeight: '24rem', objectFit: 'contain' }}
                              onError={(e) => {
                                (e.target as HTMLVideoElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <img
                              src={post.media_url}
                              alt="Post media"
                              style={{ width: '100%', height: 'auto', maxHeight: '24rem', objectFit: 'contain', borderRadius: borderRadius.md }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.lg,
                          color: baseColors.text.muted,
                          paddingTop: spacing.md,
                          borderTop: `1px solid ${baseColors.border}`,
                          fontSize: '0.875rem',
                        }}
                      >
                        <button
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: post.is_liked ? baseColors.primary : baseColors.text.muted,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleToggleLike(post.id)}
                          disabled={likeLoading[post.id] || !user}
                        >
                          {likeLoading[post.id] ? (
                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Heart size={16} style={{ fill: post.is_liked ? 'currentColor' : 'none' }} />
                          )}
                          {post.likes_count}
                        </button>
                        <button
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: baseColors.text.muted,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          onClick={() => toggleComments(post.id)}
                          disabled={commentLoading[post.id]}
                        >
                          {commentLoading[post.id] && showAllComments[post.id] ? (
                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <MessageCircle size={16} />
                          )}
                          {post.comments_count}
                        </button>
                      </div>

                      {/* Comments Section - Always visible, but shows different content based on state */}
                      <div style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTop: `1px solid ${baseColors.border}` }}>
                        {commentLoading[post.id] && showAllComments[post.id] ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: spacing.lg }}>
                            <div style={{ ...spinnerStyle, height: '1.5rem', width: '1.5rem', borderWidth: '2px' }}></div>
                          </div>
                        ) : comments[post.id]?.length === 0 ? (
                          <p style={{ color: baseColors.text.muted, textAlign: 'center', padding: spacing.md }}>
                            No comments yet. Be the first to comment!
                          </p>
                        ) : (
                          <>
                            {/* Show only the latest comment when not expanded */}
                           {!showAllComments[post.id] && comments[post.id] && comments[post.id].length > 0 && (
  renderCommentPreview(comments[post.id][0])
)}
                            
                            {/* Show all comments when expanded */}
                            {showAllComments[post.id] && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, maxHeight: '600px', overflowY: 'auto' }}>
                                {comments[post.id]?.map((comment) => (
                                  <div key={comment.id}>{renderComment(comment, post.id, 0)}</div>
                                ))}
                              </div>
                            )}
                            
                            {/* Toggle button - only show if there are multiple comments */}
                            {comments[post.id] && comments[post.id].length > 1 && (
                              <button
                                onClick={() => toggleComments(post.id)}
                                style={{
                                  color: baseColors.primary,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  marginTop: spacing.sm,
                                }}
                              >
                                {showAllComments[post.id] ? (
                                  <>
                                    <ChevronUp size={16} />
                                    Show less comments
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={16} />
                                    View all {comments[post.id].length} comments
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Comment input box - always visible */}
                      {user && (
                        <div style={{ marginTop: spacing.lg, display: 'flex', gap: spacing.md }}>
                          <div
                            style={{
                              width: '2rem',
                              height: '2rem',
                              borderRadius: borderRadius.full,
                              background: gradient,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          >
                            {user?.user_metadata?.avatar_url ? (
                              <img
                                src={user.user_metadata.avatar_url}
                                alt={authUsername}
                                style={{ width: '100%', height: '100%', borderRadius: borderRadius.full, objectFit: 'cover' }}
                              />
                            ) : (
                              authUsername[0]?.toUpperCase() || 'U'
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                addComment(post.id, newCommentContent[post.id] || '');
                              }}
                            >
                              <div style={{ display: 'flex', gap: spacing.sm }}>
                                <input
                                  type="text"
                                  value={newCommentContent[post.id] || ''}
                                  onChange={(e) => setNewCommentContent((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                  placeholder="Write a comment..."
                                  style={{
                                    flex: 1,
                                    padding: `${spacing.sm} ${spacing.md}`,
                                    border: `1px solid ${baseColors.border}`,
                                    borderRadius: borderRadius.md,
                                    fontSize: '0.875rem',
                                  }}
                                />
                                <button
                                  type="submit"
                                  disabled={addingComment[post.id] || !newCommentContent[post.id]?.trim()}
                                  style={{
                                    ...buttonStyle(
                                      newCommentContent[post.id]?.trim() ? baseColors.primary : '#e2e8f0',
                                      newCommentContent[post.id]?.trim() ? 'white' : baseColors.text.muted
                                    ),
                                    padding: `${spacing.sm} ${spacing.md}`,
                                    fontSize: '0.875rem',
                                    opacity: addingComment[post.id] || !newCommentContent[post.id]?.trim() ? 0.7 : 1,
                                  }}
                                >
                                  {addingComment[post.id] ? (
                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                  ) : (
                                    'Comment'
                                  )}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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
              {isMember && (
                <button
                  style={{ ...outlineButtonStyle, fontSize: '0.875rem', padding: `${spacing.sm} ${spacing.sm}` }}
                  onClick={() => toast('Member invite functionality coming soon!')}
                >
                  <UserPlus size={16} style={{ marginRight: '0.25rem' }} />
                  Invite
                </button>
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
                          <img
                            src={member.avatar_url}
                            alt={member.username}
                            style={{ width: '100%', height: '100%', borderRadius: borderRadius.full, objectFit: 'cover' }}
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
                      <p style={{ fontWeight: 600, color: baseColors.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {member.username}
                      </p>
                      <p style={{ color: baseColors.text.muted, fontSize: '0.75rem' }}>Joined {formatRecentActivity(member.joined_at)}</p>
                    </div>
                  </div>
                  {member.role !== 'member' && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: `${spacing.sm} ${spacing.sm}`,
                        borderRadius: borderRadius.full,
                        background: member.role === 'admin' ? '#fef3c7' : '#ede9fe',
                        color: member.role === 'admin' ? '#d97706' : '#7c3aed',
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
              <li>• No unsolicited advice - ask before offering support</li>
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
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: baseColors.text.primary }}>Update Community Banner</h3>
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
                    <img
                      src={bannerPreview}
                      alt="Banner preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
                      <span style={{ fontSize: '0.75rem', color: baseColors.text.muted }}>Recommended: 1200x300px, max 5MB</span>
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

      {/* Animation */}
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