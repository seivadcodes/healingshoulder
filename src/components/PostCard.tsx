// src/components/PostCard.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  Heart,
  MessageCircle,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

// ─── TYPES ────────────────────────────────────────
export type GriefType =
  | 'parent'
  | 'child'
  | 'spouse'
  | 'sibling'
  | 'friend'
  | 'pet'
  | 'miscarriage'
  | 'caregiver'
  | 'suicide'
  | 'other';

export interface PostAuthor {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  isAnonymous?: boolean;
}

interface RawComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  is_anonymous: boolean;
  username?: string | null;
  avatar_url?: string | null;
  post_id: string;
  parent_comment_id: string | null;
}

export interface CommentNode {
  id: string;
  content: string;
  createdAt: Date;
  userId: string;
  username: string;
  avatarUrl: string | null;
  postId: string;
  parentCommentId: string | null;
  replies: CommentNode[];
  replyCount: number;
}

export interface Post {
  id: string;
  userId: string;
  text: string;
  mediaUrl?: string | null;
  mediaUrls?: string[];
  griefTypes?: GriefType[];
  createdAt: Date;
  likes: number;
  isLiked?: boolean;
  commentsCount: number;
  isAnonymous: boolean;
  user?: PostAuthor;
}

// ─── HELPER: Time formatting ───────────────────────
function formatRecentActivity(date: Date | string): string {
  const now = new Date();
  const created = new Date(date);
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
}

// ─── STYLES ───────────────────────────────────────
const baseColors = {
  primary: '#f59e0b',
  secondary: '#1e293b',
  accent: '#16a34a',
  background: '#fffbeb',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: { primary: '#1e293b', secondary: '#64748b', muted: '#94a3b8' },
};

const spacing = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
};

const borderRadius = {
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
};

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

const cardStyle: React.CSSProperties = {
  background: baseColors.surface,
  borderRadius: borderRadius.lg,
  border: `1px solid ${baseColors.border}`,
  padding: spacing.xl,
  paddingBottom: '6rem',
  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
  marginBottom: spacing.md,
};

// ─── PROPS ────────────────────────────────────────
export interface PostCardProps {
  post: Post;
  isOwner?: boolean;
  canDelete?: boolean;
  readonly?: boolean;
  onDelete?: () => void;
  showAuthor?: boolean;
  context?: 'profile' | 'community' | 'feed';
  onPostDeleted?: () => void;
}
interface FlattenedComment {
  id: string;
  content: string;
  createdAt: Date;
  userId: string;
  username: string;
  avatarUrl: string | null;
  postId: string;
  parentCommentId: string | null;
}
// ─── COMPONENT ────────────────────────────────────
export function PostCard({
  post,
  isOwner = false,
  canDelete = false,
  readonly = false,

  showAuthor = true,
  context = 'feed',
  onPostDeleted,
}: PostCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const { user: currentUser } = useAuth();

  // Like state
  const [likesCount, setLikesCount] = useState(post.likes);
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Comment state
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [replyingToComment, setReplyingToComment] = useState<Record<string, boolean>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [showAllComments, setShowAllComments] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  const [addingReply, setAddingReply] = useState<Record<string, boolean>>({});
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [authUsername, setAuthUsername] = useState('');
  const [isModerator, setIsModerator] = useState(false);
  const [latestCommentPreview, setLatestCommentPreview] = useState<CommentNode | null>(null);
  const [initialCountLoaded, setInitialCountLoaded] = useState(false);
  // Add this with your other useState declarations
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  // Get all media URLs in a unified array
  const allMediaUrls = useMemo(() => {
    if (post.mediaUrls && post.mediaUrls.length > 0) {
      return post.mediaUrls.filter(url => url); // Filter out any empty/null URLs
    }
    return post.mediaUrl ? [post.mediaUrl] : [];
  }, [post.mediaUrl, post.mediaUrls]);


  // Gradient for avatar
  const gradient = useMemo(() => {
    if (!post.griefTypes || post.griefTypes.length === 0) return defaultGradient;
    return griefGradients[post.griefTypes[0]] || defaultGradient;
  }, [post.griefTypes]);

  // Auth & moderator setup
  useEffect(() => {
    if (currentUser) {
      setAuthUsername(
        currentUser.user_metadata?.full_name ||
        currentUser.email?.split('@')[0] ||
        'Anonymous'
      );
      setIsModerator(post.userId === currentUser.id);
    }
  }, [currentUser, post.userId]);

  // 🔁 Fetch real comment count on mount
  useEffect(() => {
    const fetchRealCommentCount = async () => {
      const commentTable = context === 'profile' ? 'post_comments' : 'community_post_comments';
      const { count, error } = await supabase
        .from(commentTable)
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      if (!error && count !== null) {
        setCommentsCount(count);
      }
      setInitialCountLoaded(true); // ✅ critical for stable UI
    };
    fetchRealCommentCount();
  }, [post.id, context, supabase]);

  // 🔁 Fetch comments when "View all" clicked
  const fetchComments = useCallback(async () => {
    if (!post.id || !showAllComments) return;

    setCommentLoading(true);
    try {
      const commentView =
        context === 'profile'
          ? 'post_comments_with_profiles'
          : 'community_post_comments_with_profiles';

      const { data: allComments, error: commentsError } = await supabase
        .from(commentView)
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      const formattedComments = allComments.map((comment: RawComment) => ({
        id: comment.id,
        content: comment.content,
        createdAt: new Date(comment.created_at),
        userId: comment.user_id,
        username: comment.is_anonymous ? 'Anonymous' : comment.username || 'Anonymous',
        avatarUrl: comment.is_anonymous ? null : comment.avatar_url || null,
        postId: comment.post_id,
        parentCommentId: comment.parent_comment_id ?? null,
      }));

      const buildCommentTree = (
        comments: FlattenedComment[],
        parentId: string | null = null
      ): CommentNode[] => {
        return comments
          .filter((comment) => comment.parentCommentId === parentId)
          .map((comment): CommentNode => {
            const replies = buildCommentTree(comments, comment.id);
            return {
              ...comment,
              replies,
              replyCount: replies.length,
            };
          });
      };

      const nestedComments = buildCommentTree(formattedComments);
      setComments(nestedComments);

      // ✅ Do NOT refetch comment count here — it’s already synced via real-time listener
      // The count is accurate thanks to the separate `useEffect` with Supabase channel

    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setCommentLoading(false);
    }
  }, [post.id, showAllComments, supabase, context]);
  // 🔁 Fetch latest comment preview ONLY if we know there's at least one comment
  useEffect(() => {
    const fetchLatestComment = async () => {
      if (!post.id || commentsCount === 0) {
        setLatestCommentPreview(null);
        return;
      }

      const commentView =
        context === 'profile'
          ? 'post_comments_with_profiles'
          : 'community_post_comments_with_profiles';

      const { data, error } = await supabase
        .from(commentView)
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data?.[0]) {
        const raw = data[0];
        const comment: CommentNode = {
          id: raw.id,
          content: raw.content,
          createdAt: new Date(raw.created_at),
          userId: raw.user_id,
          username: raw.is_anonymous ? 'Anonymous' : raw.username || 'Anonymous',
          avatarUrl: raw.is_anonymous ? null : raw.avatar_url || null,
          postId: raw.post_id,
          parentCommentId: raw.parent_comment_id ?? null,
          replies: [],
          replyCount: 0,
        };
        setLatestCommentPreview(comment);
      } else {
        setLatestCommentPreview(null);
      }
    };

    fetchLatestComment();
  }, [post.id, context, supabase, commentsCount]); // ✅ depend on commentsCount all those errors are caused by me pasting this

  // 🔁 Real-time comment count updates
  useEffect(() => {
    if (!post.id) return;
    const channel = supabase
      .channel(`post-comments-${post.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: context === 'profile' ? 'post_comments' : 'community_post_comments',
          filter: `post_id=eq.${post.id}`,
        },
        () => {
          const commentTable = context === 'profile' ? 'post_comments' : 'community_post_comments';
          supabase
            .from(commentTable)
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id)
            .then(({ count, error }) => {
              if (!error && count !== null) {
                setCommentsCount(count);
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id, supabase, context]);

  // 🔁 Like count & status (from your simplified version, enhanced)
  useEffect(() => {
    if (!post.id) return;

    const fetchLikeData = async () => {
      const { count, error: countError } = await supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      if (!countError && count !== null) {
        setLikesCount(count);
      }

      if (currentUser) {
        const { data, error: likeError } = await supabase
          .from('post_likes')
          .select('*')
          .eq('post_id', post.id)
          .eq('user_id', currentUser.id)
          .single();

        setIsLiked(!!data && !likeError);
      }
    };

    fetchLikeData();
  }, [post.id, currentUser, supabase]);

  useEffect(() => {
    if (!post.id) return;

    const channel = supabase
      .channel(`post-likes-${post.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes',
          filter: `post_id=eq.${post.id}`,
        },
        () => {
          supabase
            .from('post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id)
            .then(({ count, error }) => {
              if (!error && count !== null) {
                setLikesCount(count);
              }
            });

          if (currentUser) {
            supabase
              .from('post_likes')
              .select('*')
              .eq('post_id', post.id)
              .eq('user_id', currentUser.id)
              .single()
              .then(({ data, error }) => {
                setIsLiked(!!data && !error);
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id, currentUser, supabase]);

  // ─── Handlers ─────────────────────────────────────

  const handleToggleLike = async () => {
    if (readonly || !currentUser) {
      if (!currentUser) toast.error('Please sign in to like posts');
      return;
    }

    setLikeLoading(true);
    try {
      if (isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUser.id);
        setLikesCount((c) => Math.max(0, c - 1));
        setIsLiked(false);
        toast.success('Like removed');
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: post.id, user_id: currentUser.id });
        setLikesCount((c) => c + 1);
        setIsLiked(true);
        toast.success('Post liked!');
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      toast.error('Failed to update like');
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || !onPostDeleted) return;
    if (!confirm('Are you sure you want to delete this post?')) return;

    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      onPostDeleted();
      toast.success('Post deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete post');
    } finally {
      setDeleteLoading(false);
    }
  };

  const addComment = async () => {
    if (!currentUser || !newCommentContent.trim() || readonly) return;
    setIsCommenting(true);
    try {
      const commentTable = context === 'profile' ? 'post_comments' : 'community_post_comments';
      const { data: insertData, error: insertError } = await supabase
        .from(commentTable)
        .insert({
          post_id: post.id,
          user_id: currentUser.id,
          content: newCommentContent.trim(),
          parent_comment_id: null,
        })
        .select('id, content, created_at, post_id, user_id')
        .single();

      if (insertError) throw insertError;

      const commentView =
        context === 'profile'
          ? 'post_comments_with_profiles'
          : 'community_post_comments_with_profiles';
      const { data: commentWithProfile, error: profileError } = await supabase
        .from(commentView)
        .select('*')
        .eq('id', insertData.id)
        .single();

      if (profileError) throw profileError;

      const newComment: CommentNode = {
        id: commentWithProfile.id,
        content: commentWithProfile.content,
        createdAt: new Date(commentWithProfile.created_at),
        userId: commentWithProfile.user_id,
        username: commentWithProfile.is_anonymous
          ? 'Anonymous'
          : commentWithProfile.username || 'Anonymous',
        avatarUrl: commentWithProfile.is_anonymous
          ? null
          : commentWithProfile.avatar_url || null,
        postId: commentWithProfile.post_id,
        parentCommentId: null,
        replies: [],
        replyCount: 0,
      };

      if (showAllComments) {
        setComments((prev) => [...prev, newComment]);
      }
      setCommentsCount((prev) => prev + 1);
      setNewCommentContent('');
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsCommenting(false);
    }
  };

  const addReply = async (parentCommentId: string) => {
    if (!currentUser || !replyContent[parentCommentId]?.trim() || readonly) return;
    setAddingReply((prev) => ({ ...prev, [parentCommentId]: true }));
    try {
      const commentTable = context === 'profile' ? 'post_comments' : 'community_post_comments';
      const { data: insertData, error: insertError } = await supabase
        .from(commentTable)
        .insert({
          post_id: post.id,
          user_id: currentUser.id,
          content: replyContent[parentCommentId].trim(),
          parent_comment_id: parentCommentId,
        })
        .select('id, content, created_at, post_id, user_id, parent_comment_id')
        .single();

      if (insertError) throw insertError;

      const commentView =
        context === 'profile'
          ? 'post_comments_with_profiles'
          : 'community_post_comments_with_profiles';
      const { data: replyWithProfile, error: profileError } = await supabase
        .from(commentView)
        .select('*')
        .eq('id', insertData.id)
        .single();

      if (profileError) throw profileError;

      const newReply: CommentNode = {
        id: replyWithProfile.id,
        content: replyWithProfile.content,
        createdAt: new Date(replyWithProfile.created_at),
        userId: replyWithProfile.user_id,
        username: replyWithProfile.is_anonymous
          ? 'Anonymous'
          : replyWithProfile.username || 'Anonymous',
        avatarUrl: replyWithProfile.is_anonymous
          ? null
          : replyWithProfile.avatar_url || null,
        postId: replyWithProfile.post_id,
        parentCommentId: replyWithProfile.parent_comment_id || null,
        replies: [],
        replyCount: 0,
      };

      const updateCommentsState = (comments: CommentNode[]): CommentNode[] => {
        return comments.map((comment) => {
          if (comment.id === parentCommentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newReply],
              replyCount: (comment.replyCount || 0) + 1,
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

      setComments((prev) => (prev ? updateCommentsState(prev) : [newReply]));
      setCommentsCount((prev) => prev + 1);
      setReplyContent((prev) => ({ ...prev, [parentCommentId]: '' }));
      setReplyingToComment((prev) => ({ ...prev, [parentCommentId]: false }));
      toast.success('Reply added successfully');
    } catch (error) {
      console.error('Error adding reply:', error);
      toast.error('Failed to add reply');
    } finally {
      setAddingReply((prev) => ({ ...prev, [parentCommentId]: false }));
    }
  };

  const deleteComment = async (commentId: string, isReply = false) => {
    if (readonly) return;
    if (isReply) {
      setDeletingReplyId(commentId);
    } else {
      setDeletingCommentId(commentId);
    }
    try {
      const commentTable = context === 'profile' ? 'post_comments' : 'community_post_comments';
      const { data: allComments, error: allCommentsError } = await supabase
        .from(commentTable)
        .select('id, parent_comment_id')
        .eq('post_id', post.id);
      if (allCommentsError) throw allCommentsError;

      const getDescendantIds = (parentId: string): string[] => {
        const directChildren = allComments.filter(
          (c: { id: string; parent_comment_id: string | null }) =>
            c.parent_comment_id === parentId
        );
        return [
          ...directChildren.map((c: { id: string }) => c.id),
          ...directChildren.flatMap((c: { id: string }) => getDescendantIds(c.id)),
        ];
      };

      const descendantIds = getDescendantIds(commentId);
      const totalCommentsToDelete = 1 + descendantIds.length;

      const { error: deleteError } = await supabase
        .from(commentTable)
        .delete()
        .in('id', [commentId, ...descendantIds]);
      if (deleteError) throw deleteError;

      const removeCommentAndDescendants = (comments: CommentNode[]): CommentNode[] => {
        return comments.filter((comment) => {
          if (comment.id === commentId) return false;
          if (comment.replies && comment.replies.length > 0) {
            comment.replies = removeCommentAndDescendants(comment.replies);
            comment.replyCount = comment.replies.length;
          }
          return true;
        });
      };

      setComments((prev) => (prev ? removeCommentAndDescendants(prev) : []));
      setCommentsCount((prev) => Math.max(0, prev - totalCommentsToDelete));
      if (expandedComments[commentId]) {
        setExpandedComments((prev) => {
          const newExpanded = { ...prev };
          delete newExpanded[commentId];
          return newExpanded;
        });
      }
      toast.success(
        isReply
          ? 'Reply deleted successfully'
          : 'Comment and all replies deleted successfully'
      );
    } catch (error: unknown) {
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

  // ─── UI Helpers ───────────────────────────────────

  const toggleReplies = (commentId: string) => {
    setExpandedComments((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const toggleReplyForm = (commentId: string) => {
    setReplyingToComment((prev) => {
      const newReplyingState = !prev[commentId];
      if (newReplyingState) {
        setReplyContent((prevContent) => ({ ...prevContent, [commentId]: '' }));
      }
      return { ...prev, [commentId]: newReplyingState };
    });
  };

  const toggleComments = () => {
    const newShowAll = !showAllComments;
    setShowAllComments(newShowAll);
    if (newShowAll && comments.length === 0) {
      fetchComments(); // 👈 add this
    }
  };

  const renderCommentPreview = (comment: CommentNode) => {
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
          {comment.avatarUrl ? (
            <Image
              src={comment.avatarUrl}
              alt={comment.username}
              width={32}
              height={32}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: borderRadius.full,
                objectFit: 'cover',
              }}
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
            <h4 style={{ fontWeight: 600, color: baseColors.text.primary, fontSize: '0.875rem' }}>
              {comment.username}
            </h4>
            <p style={{ color: baseColors.text.muted, fontSize: '0.75rem', marginTop: '0.125rem' }}>
              {formatRecentActivity(comment.createdAt)}
            </p>
            <p
              style={{
                color: baseColors.text.primary,
                fontSize: '0.875rem',
                marginTop: spacing.sm,
                whiteSpace: 'pre-line',
              }}
            >
              {comment.content}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderComment = (comment: CommentNode, depth = 0) => {
    const isNested = depth > 0;
    const isCommentOwner = currentUser?.id === comment.userId;
    const canDeleteComment = isCommentOwner || isModerator;

    return (
      <div
        key={comment.id}
        style={{
          display: 'flex',
          gap: spacing.md,
          marginBottom: spacing.md,
          marginLeft: isNested ? spacing.xl : 0,
        }}
      >
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
          {comment.avatarUrl ? (
            <Image
              src={comment.avatarUrl}
              alt={comment.username}
              width={32}
              height={32}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: borderRadius.full,
                objectFit: 'cover',
              }}
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
                <h4 style={{ fontWeight: 600, color: baseColors.text.primary, fontSize: '0.875rem' }}>
                  {comment.username}
                </h4>
                <p style={{ color: baseColors.text.muted, fontSize: '0.75rem', marginTop: '0.125rem' }}>
                  {formatRecentActivity(comment.createdAt)}
                </p>
              </div>
              {canDeleteComment && (
                <button
                  onClick={async () => {
                    if (
                      window.confirm(
                        'Are you sure you want to delete this comment? This will also delete all replies.'
                      )
                    ) {
                      await deleteComment(comment.id, false);
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
            <p
              style={{
                color: baseColors.text.primary,
                fontSize: '0.875rem',
                marginTop: spacing.sm,
                whiteSpace: 'pre-line',
              }}
            >
              {comment.content}
            </p>
            {currentUser && !readonly && (
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
                {comment.replyCount > 0 && (
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
                    {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
                  </button>
                )}
              </div>
            )}
            {/* Reply form */}
            {replyingToComment[comment.id] && currentUser && !readonly && (
              <div
                style={{
                  marginTop: spacing.md,
                  marginLeft: spacing.md,
                  paddingLeft: spacing.md,
                  borderLeft: `2px solid ${baseColors.border}`,
                }}
              >
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
                    onClick={() => addReply(comment.id)}
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
                    {addingReply[comment.id] ? (
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      'Reply'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Nested replies */}
          {expandedComments[comment.id] &&
            comment.replies &&
            comment.replies.length > 0 && (
              <div style={{ marginTop: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                {comment.replies.map((reply) => renderComment(reply, depth + 1))}
              </div>
            )}
        </div>
      </div>
    );
  };

  // ─── Author & Media ───────────────────────────────

  const displayAuthor = useMemo(() => {
    if (post.isAnonymous) {
      return { name: 'Anonymous', avatar: null };
    }
    if (post.user) {
      return {
        name: post.user.fullName || 'Someone',
        avatar: post.user.avatarUrl,
      };
    }
    return { name: 'Someone', avatar: null };
  }, [post]);

  const hasMedia = post.mediaUrl || (post.mediaUrls && post.mediaUrls.length > 0);


  // ─── RENDER ───────────────────────────────────────

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
        {showAuthor && (
          <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
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
              {displayAuthor.avatar ? (
                <Image
                  src={displayAuthor.avatar}
                  alt={displayAuthor.name}
                  width={40}
                  height={40}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: borderRadius.full,
                    objectFit: 'cover',
                  }}
                />
              ) : (
                displayAuthor.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h3 style={{ fontWeight: 600, color: baseColors.text.primary, fontSize: '0.95rem' }}>
                {displayAuthor.name}
              </h3>
              <p style={{ color: baseColors.text.muted, fontSize: '0.75rem' }}>
                {formatRecentActivity(post.createdAt)}
              </p>
            </div>
          </div>
        )}
        {(canDelete || isOwner || isModerator) && !readonly && (
          <button
            onClick={handleDelete}
            disabled={deleteLoading}
            style={{
              color: baseColors.text.muted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              opacity: deleteLoading ? 0.5 : 1,
            }}
          >
            {deleteLoading ? (
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Trash2 size={18} />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <p
        style={{
          color: baseColors.text.primary,
          whiteSpace: 'pre-line',
          marginBottom: spacing.lg,
          lineHeight: 1.5,
        }}
      >
        {post.text}
      </p>

      {/* Media Gallery */}
      {hasMedia && allMediaUrls.length > 0 && (
        <div style={{ marginBottom: spacing.lg }}>
          {/* Main media display */}
          <div style={{
            borderRadius: borderRadius.md,
            overflow: 'hidden',
            border: `1px solid ${baseColors.border}`,
            position: 'relative'
          }}>
            {/* Navigation buttons (only if multiple items) */}
            {allMediaUrls.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentMediaIndex(prev =>
                    prev === 0 ? allMediaUrls.length - 1 : prev - 1
                  )}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    zIndex: 10
                  }}
                  aria-label="Previous media"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentMediaIndex(prev =>
                    prev === allMediaUrls.length - 1 ? 0 : prev + 1
                  )}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    zIndex: 10
                  }}
                  aria-label="Next media"
                >
                  →
                </button>

                {/* Counter */}
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  zIndex: 10
                }}>
                  {currentMediaIndex + 1} / {allMediaUrls.length}
                </div>
              </>
            )}

            {/* Render current media */}
            {/\.(mp4|webm|mov)$/i.test(allMediaUrls[currentMediaIndex]) ? (
              <video
                src={allMediaUrls[currentMediaIndex]}
                controls
                style={{
                  width: '100%',
                  maxHeight: '400px',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Image
                src={allMediaUrls[currentMediaIndex]}
                alt={`Post media ${currentMediaIndex + 1}`}
                width={800}
                height={400}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '400px',
                  objectFit: 'contain',
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
            )}
          </div>

          {/* Thumbnails for multiple items */}
          {allMediaUrls.length > 1 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '8px',
              overflowX: 'auto',
              padding: '4px 0',
              WebkitOverflowScrolling: 'touch'
            }}>
              {allMediaUrls.map((url, index) => (
                <div
                  key={index}
                  onClick={() => setCurrentMediaIndex(index)}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    opacity: currentMediaIndex === index ? 1 : 0.6,
                    transition: 'opacity 0.2s'
                  }}
                >
                  {/\.(mp4|webm|mov)$/i.test(url) ? (
                    <div style={{
                      width: '60px',
                      height: '60px',
                      background: '#333',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      ▶
                    </div>
                  ) : (
                    <Image
                      src={url}
                      alt={`Thumbnail ${index + 1}`}
                      width={60}
                      height={60}
                      style={{
                        width: '60px',
                        height: '60px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: currentMediaIndex === index ? `2px solid ${baseColors.primary}` : 'none'
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Actions */}
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
            color: isLiked ? baseColors.primary : baseColors.text.muted,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={handleToggleLike}
          disabled={likeLoading || readonly}
        >
          {likeLoading ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Heart size={16} style={{ fill: isLiked ? 'currentColor' : 'none' }} />
          )}
          {likesCount}
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
          onClick={toggleComments}
          disabled={commentLoading}
        >
          {commentLoading && showAllComments ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <MessageCircle size={16} />
          )}
          {commentsCount}
        </button>
      </div>

      {/* Comments Section */}
      <div
        style={{
          marginTop: spacing.lg,
          paddingTop: spacing.lg,
          borderTop: `1px solid ${baseColors.border}`,
          display:
            initialCountLoaded && (showAllComments || commentsCount > 0)
              ? 'block'
              : 'none',
        }}
      >
        {commentLoading && showAllComments && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: spacing.lg }}>
            <div
              style={{
                height: '1.5rem',
                width: '1.5rem',
                borderRadius: borderRadius.full,
                border: `2px solid ${baseColors.primary}`,
                borderTopColor: 'transparent',
                animation: 'spin 1s linear infinite',
                margin: '0 auto',
              }}
            ></div>
          </div>
        )}

        {/* Preview: Show only the latest comment when not expanded */}
        {!commentLoading && !showAllComments && latestCommentPreview && (
          <div>{renderCommentPreview(latestCommentPreview)}</div>
        )}

        {/* Empty state when expanded */}
        {!commentLoading && showAllComments && comments.length === 0 && commentsCount === 0 && (
          <p style={{ color: baseColors.text.muted, textAlign: 'center', padding: spacing.md }}>
            No comments yet. Be the first to comment!
          </p>
        )}

        {/* Full comment tree when expanded */}
        {showAllComments &&
          comments.map((comment) => (
            <div key={comment.id}>{renderComment(comment, 0)}</div>
          ))}

        {/* Toggle button */}
        {commentsCount > 0 && (
          <button
            onClick={toggleComments}
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
            {showAllComments ? (
              <>
                <ChevronUp size={16} />
                Show less comments
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                View all {commentsCount} comments
              </>
            )}
          </button>
        )}
      </div>

      {/* Comment Input */}
      {currentUser && !readonly && (
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
            {currentUser?.user_metadata?.avatar_url ? (
              <Image
                src={currentUser.user_metadata.avatar_url}
                alt={authUsername}
                width={32}
                height={32}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: borderRadius.full,
                  objectFit: 'cover',
                }}
              />
            ) : (
              authUsername.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: spacing.sm }}>
              <input
                type="text"
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                placeholder="Write a comment..."
                style={{
                  flex: 1,
                  padding: `${spacing.sm} ${spacing.md}`,
                  border: `1px solid ${baseColors.border}`,
                  borderRadius: borderRadius.md,
                  fontSize: '0.875rem',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    addComment();
                  }
                }}
              />
              <button
                onClick={addComment}
                disabled={isCommenting || !newCommentContent.trim()}
                style={{
                  ...buttonStyle(
                    newCommentContent.trim() ? baseColors.primary : '#e2e8f0',
                    newCommentContent.trim() ? 'white' : baseColors.text.muted
                  ),
                  padding: `${spacing.sm} ${spacing.md}`,
                  fontSize: '0.875rem',
                  opacity: isCommenting || !newCommentContent.trim() ? 0.7 : 1,
                }}
              >
                {isCommenting ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  'Comment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS */}
      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}