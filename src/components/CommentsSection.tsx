// components/CommentsSection.tsx
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { Heart, Send, MessageCircle, X, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count: number;
  is_anonymous: boolean;
  author_name: string;              
  author_avatar_url: string | null; 
  is_deleted: boolean;
  parent_comment_id: string | null;
  replies_count: number;
  is_liked: boolean;
}
interface CommentsSectionProps {
  parentId: string;
  parentType: 'post' | 'story' | 'memory';
  currentUser: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    isAnonymous: boolean;
    initialPostLikesCount?: number;
    initialPostIsLiked?: boolean;
  };
}

interface CommentThread {
  comment: Comment;
  replies: CommentThread[];
}

const MOBILE_BREAKPOINT = 768;

export function CommentsSection({
  parentId,
  parentType,
  currentUser
}: CommentsSectionProps) {
  const supabase = createClient();
  const [comments, setComments] = useState<CommentThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [newTopLevelComment, setNewTopLevelComment] = useState('');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [windowWidth, setWindowWidth] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  // Post like state
  const [postLikesCount, setPostLikesCount] = useState(0);
  const [postIsLiked, setPostIsLiked] = useState(false);
  const [isPostLikeLoading, setIsPostLikeLoading] = useState(false);

  // Sort control
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch initial post like state
  const loadPostLikeState = useCallback(async () => {
    if (!currentUser.id) {
      setPostLikesCount(0);
      setPostIsLiked(false);
      return;
    }
    try {
      const { count, error: countError } = await supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', parentId);
      if (!countError && count !== null) {
        setPostLikesCount(count);
      }

      const { data, error: likeError } = await supabase
        .from('post_likes')
        .select('*')
        .eq('post_id', parentId)
        .eq('user_id', currentUser.id)
        .single();
      setPostIsLiked(!!data && !likeError);
    } catch (err) {
      console.error('Failed to load post like state:', err);
    }
  }, [parentId, currentUser.id, supabase]);

  const checkIfUserLiked = async (commentId: string): Promise<boolean> => {
    if (!currentUser.id) return false;
    const { data, error } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', currentUser.id)
      .single();
    return !error && !!data;
  };

  const toggleCommentLike = async (commentId: string, currentlyLiked: boolean) => {
    if (!currentUser.id) return;
    if (currentlyLiked) {
      await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUser.id);
      await supabase.rpc('decrement_comment_likes', { comment_id: commentId });
    } else {
      await supabase
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: currentUser.id });
      await supabase.rpc('increment_comment_likes', { comment_id: commentId });
    }
  };

  const togglePostLike = async () => {
    if (!currentUser.id) return;
    setIsPostLikeLoading(true);
    const previousIsLiked = postIsLiked;
    const previousLikesCount = postLikesCount;

    setPostIsLiked(!previousIsLiked);
    setPostLikesCount(previousIsLiked ? Math.max(0, previousLikesCount - 1) : previousLikesCount + 1);

    try {
      if (previousIsLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', parentId)
          .eq('user_id', currentUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: parentId, user_id: currentUser.id });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Post like toggle failed:', err);
      setPostIsLiked(previousIsLiked);
      setPostLikesCount(previousLikesCount);
    } finally {
      setIsPostLikeLoading(false);
    }
  };

  const sortThreads = (threads: CommentThread[]): CommentThread[] => {
    const sorted = [...threads].sort((a, b) =>
      sortOrder === 'newest'
        ? new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime()
        : new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime()
    );
    return sorted.map(thread => ({
      ...thread,
      replies: sortRepliesRecursively(thread.replies)
    }));
  };

  const sortRepliesRecursively = (replies: CommentThread[]): CommentThread[] => {
    const sorted = [...replies].sort((a, b) =>
      sortOrder === 'newest'
        ? new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime()
        : new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime()
    );
    return sorted.map(r => ({
      ...r,
      replies: sortRepliesRecursively(r.replies)
    }));
  };

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
   const { data, error } = await supabase
  .from('comments')
  .select(`
    id,
    user_id,
    content,
    created_at,
    likes_count,
    is_anonymous,
    author_name,
    author_avatar_url,
    is_deleted,
    parent_comment_id,
    replies_count
  `)
  .eq('parent_id', parentId)
  .eq('parent_type', parentType)
  .eq('is_deleted', false)
  .order('created_at', { ascending: sortOrder === 'oldest' });

      if (error) throw error;

      const commentsWithLikes = await Promise.all(
        data.map(async (comment) => ({
          ...comment,
          is_liked: await checkIfUserLiked(comment.id)
        }))
      );

      const commentMap = new Map<string, CommentThread>();
      commentsWithLikes.forEach(comment => {
        commentMap.set(comment.id, {
          comment,
          replies: []
        });
      });

      const topLevelComments: CommentThread[] = [];
      commentsWithLikes.forEach(comment => {
        if (!comment.parent_comment_id) {
          topLevelComments.push(commentMap.get(comment.id)!);
        } else if (commentMap.has(comment.parent_comment_id)) {
          const parent = commentMap.get(comment.parent_comment_id)!;
          parent.replies.push(commentMap.get(comment.id)!);
        }
      });

      // Apply sort AFTER building tree
      const sortedComments = sortThreads(topLevelComments);
      setComments(sortedComments);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError('Failed to load comments. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [parentId, parentType, currentUser.id, sortOrder]);

  useEffect(() => {
    loadPostLikeState();
    loadComments();

    const postLikeChannel = supabase
      .channel(`post-likes-${parentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes',
          filter: `post_id=eq.${parentId}`
        },
        () => {
          loadPostLikeState();
        }
      )
      .subscribe();

    const commentChannel = supabase
      .channel(`comments-${parentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `parent_id=eq.${parentId},is_deleted=is.false`
        },
        async (payload) => {
          const newComment = payload.new as Comment;
          if (newComment.user_id !== currentUser.id) {
            handleNewComment({ ...newComment, is_liked: false });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
          filter: `parent_id=eq.${parentId}`
        },
        (payload) => {
          const updatedComment = payload.new as Comment;
          if (updatedComment.is_deleted) {
            setComments(prev => removeComment(prev, updatedComment.id));
          } else {
            setComments(prev => updateCommentInTree(prev, { ...updatedComment, is_liked: false }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postLikeChannel);
      supabase.removeChannel(commentChannel);
    };
  }, [parentId, parentType, loadComments, loadPostLikeState, currentUser.id]);

  // --- Helper functions ---
  const updateCommentInTree = (
    threads: CommentThread[],
    updated: Comment
  ): CommentThread[] => {
    return threads.map(thread => {
      if (thread.comment.id === updated.id) {
        return { ...thread, comment: updated };
      }
      return {
        ...thread,
        replies: updateCommentInTree(thread.replies, updated)
      };
    });
  };

  const removeComment = (threads: CommentThread[], id: string): CommentThread[] => {
    return threads
      .filter(thread => thread.comment.id !== id)
      .map(thread => ({
        ...thread,
        replies: removeComment(thread.replies, id)
      }));
  };

  const handleNewComment = (comment: Comment) => {
    const parentId = comment.parent_comment_id;
    if (parentId) {
      setComments(prev => updateReplies(prev, parentId, comment));
    } else {
      // Insert at correct position based on sort order
      setComments(prev => {
        const newThread = { comment, replies: [] };
        const updated = [...prev, newThread];
        if (sortOrder === 'newest') {
          updated.sort((a, b) =>
            new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime()
          );
        } else {
          updated.sort((a, b) =>
            new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime()
          );
        }
        return updated;
      });
    }
  };

  const updateReplies = (
    threads: CommentThread[],
    parentId: string,
    newReply: Comment
  ): CommentThread[] => {
    return threads.map(thread => {
      if (thread.comment.id === parentId) {
        const updatedReplies = [...thread.replies, { comment: newReply, replies: [] }];
        if (sortOrder === 'newest') {
          updatedReplies.sort((a, b) =>
            new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime()
          );
        } else {
          updatedReplies.sort((a, b) =>
            new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime()
          );
        }
        return {
          ...thread,
          comment: {
            ...thread.comment,
            replies_count: (thread.comment.replies_count || 0) + 1
          },
          replies: updatedReplies
        };
      }
      return {
        ...thread,
        replies: updateReplies(thread.replies, parentId, newReply)
      };
    });
  };

  const addTopLevelCommentOptimistically = (comment: Comment) => {
    setComments(prev => {
      const newThread = { comment: { ...comment, is_liked: false }, replies: [] };
      const updated = [...prev, newThread];
      if (sortOrder === 'newest') {
        updated.sort((a, b) =>
          new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime()
        );
      } else {
        updated.sort((a, b) =>
          new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime()
        );
      }
      return updated;
    });
  };

  const addReplyOptimistically = (parentId: string, reply: Comment) => {
    setComments(prev => addReplyToTree(prev, parentId, { ...reply, is_liked: false }));
  };

  const addReplyToTree = (
    threads: CommentThread[],
    parentId: string,
    reply: Comment
  ): CommentThread[] => {
    return threads.map(thread => {
      if (thread.comment.id === parentId) {
        const updatedReplies = [...thread.replies, { comment: { ...reply, is_liked: false }, replies: [] }];
        if (sortOrder === 'newest') {
          updatedReplies.sort((a, b) =>
            new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime()
          );
        } else {
          updatedReplies.sort((a, b) =>
            new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime()
          );
        }
        return {
          ...thread,
          comment: {
            ...thread.comment,
            replies_count: (thread.comment.replies_count || 0) + 1
          },
          replies: updatedReplies
        };
      }
      return {
        ...thread,
        replies: addReplyToTree(thread.replies, parentId, reply)
      };
    });
  };

  const removeOptimisticComment = (commentId: string, isReply = false, parentId?: string) => {
    if (isReply && parentId) {
      setComments(prev => removeReplyFromTree(prev, parentId, commentId));
    } else {
      setComments(prev => prev.filter(t => t.comment.id !== commentId));
    }
  };

  const removeReplyFromTree = (
    threads: CommentThread[],
    parentId: string,
    replyId: string
  ): CommentThread[] => {
    return threads.map(thread => {
      if (thread.comment.id === parentId) {
        return {
          ...thread,
          comment: {
            ...thread.comment,
            replies_count: Math.max(0, (thread.comment.replies_count || 0) - 1)
          },
          replies: thread.replies.filter(r => r.comment.id !== replyId)
        };
      }
      return {
        ...thread,
        replies: removeReplyFromTree(thread.replies, parentId, replyId)
      };
    });
  };

  const handleLike = async (commentId: string) => {
    let currentIsLiked = false;
    const findIsLiked = (threads: CommentThread[]): boolean => {
      for (const t of threads) {
        if (t.comment.id === commentId) {
          currentIsLiked = t.comment.is_liked;
          return true;
        }
        if (findIsLiked(t.replies)) return true;
      }
      return false;
    };
    findIsLiked(comments);
    setComments(prev => updateCommentLikeOptimistic(prev, commentId, !currentIsLiked));
    try {
      await toggleCommentLike(commentId, currentIsLiked);
      const { data: commentData, error } = await supabase
        .from('comments')
        .select('likes_count')
        .eq('id', commentId)
        .single();
      if (error) throw error;
      const newIsLiked = await checkIfUserLiked(commentId);
      setComments(prev => syncCommentLikeState(prev, commentId, newIsLiked, commentData.likes_count));
    } catch (err) {
      console.error('Like toggle failed:', err);
      setComments(prev => updateCommentLikeOptimistic(prev, commentId, currentIsLiked));
    }
  };

  const updateCommentLikeOptimistic = (
    threads: CommentThread[],
    commentId: string,
    newIsLiked: boolean
  ): CommentThread[] => {
    return threads.map(thread => {
      if (thread.comment.id === commentId) {
        const delta = newIsLiked ? 1 : -1;
        return {
          ...thread,
          comment: {
            ...thread.comment,
            likes_count: Math.max(0, thread.comment.likes_count + delta),
            is_liked: newIsLiked
          }
        };
      }
      return {
        ...thread,
        replies: updateCommentLikeOptimistic(thread.replies, commentId, newIsLiked)
      };
    });
  };

  const syncCommentLikeState = (
    threads: CommentThread[],
    commentId: string,
    isLiked: boolean,
    likesCount: number
  ): CommentThread[] => {
    return threads.map(thread => {
      if (thread.comment.id === commentId) {
        return {
          ...thread,
          comment: {
            ...thread.comment,
            is_liked: isLiked,
            likes_count: likesCount
          }
        };
      }
      return {
        ...thread,
        replies: syncCommentLikeState(thread.replies, commentId, isLiked, likesCount)
      };
    });
  };

  const handleSubmit = async (replyToCommentId?: string) => {
    const content = replyToCommentId
      ? (replyTexts[replyToCommentId] || '').trim()
      : newTopLevelComment.trim();
    if (!content || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const commentId = uuidv4();
    const now = new Date().toISOString();
    const authorName = currentUser.isAnonymous ? 'Anonymous' : currentUser.fullName;
    const authorAvatar = currentUser.isAnonymous
      ? null
      : (currentUser.avatarUrl || null);
    const newCommentObj: Comment = {
      id: commentId,
      user_id: currentUser.id,
      is_anonymous: currentUser.isAnonymous,
      author_name: authorName,
      author_avatar_url: authorAvatar,
      content,
      created_at: now,
      likes_count: 0,
      is_deleted: false,
      parent_comment_id: replyToCommentId || null,
      replies_count: 0,
      is_liked: false
    };

    if (replyToCommentId) {
      addReplyOptimistically(replyToCommentId, newCommentObj);
      setReplyTexts(prev => ({ ...prev, [replyToCommentId]: '' }));
      setActiveReplyId(null);
    } else {
      addTopLevelCommentOptimistically(newCommentObj);
      setNewTopLevelComment('');
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          id: commentId,
          parent_id: parentId,
          parent_type: parentType,
          user_id: currentUser.id,
          is_anonymous: currentUser.isAnonymous,
          author_name: authorName,
          author_avatar_url: authorAvatar,
          content,
          created_at: now,
          parent_comment_id: replyToCommentId || null
        });
      if (error) throw error;
    } catch (err) {
      console.error('Submission failed:', err);
      setError('Failed to post. Please try again.');
      removeOptimisticComment(commentId, !!replyToCommentId, replyToCommentId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleReply = (commentId: string) => {
    setActiveReplyId(activeReplyId === commentId ? null : commentId);
    if (activeReplyId !== commentId) {
      setReplyTexts(prev => ({ ...prev, [commentId]: '' }));
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const getAvatar = (comment: Comment) => {
     console.log('Rendering avatar for comment:', {
    id: comment.id,
    author_name: comment.author_name,
    author_avatar_url: comment.author_avatar_url,
    is_anonymous: comment.is_anonymous,
  });
    
    if (comment.is_anonymous) {
      return (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '9999px',
          backgroundColor: '#FEF3C7',
          border: '1px solid #FDE68A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ color: '#92400E', fontWeight: 500, fontSize: '0.875rem' }}>A</span>
        </div>
      );
    }
    if (comment.author_avatar_url) {
      return (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '9999px',
          overflow: 'hidden',
          border: '1px solid #FDE68A'
        }}>
          <Image
            src={comment.author_avatar_url}
            alt={comment.author_name}
            width={32}
            height={32}
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        </div>
      );
    }
    return (
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '9999px',
        backgroundColor: '#FEF3C7',
        border: '1px solid #FDE68A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ color: '#92400E', fontWeight: 500, fontSize: '0.875rem' }}>
          {comment.author_name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  };

  const renderComment = (thread: CommentThread, depth = 0) => {
    const { comment, replies } = thread;
    const isMobile = windowWidth < MOBILE_BREAKPOINT;
    const isReplyOpen = activeReplyId === comment.id;
    const areRepliesExpanded = expandedReplies[comment.id];
    return (
      <div key={comment.id} style={{
        marginLeft: depth > 0 ? '24px' : '0',
        position: 'relative',
        paddingBottom: '12px'
      }}>
        {depth > 0 && (
          <div style={{
            position: 'absolute',
            left: '-16px',
            top: '20px',
            bottom: '-12px',
            width: '2px',
            backgroundColor: '#E5E7EB',
            borderRadius: '9999px'
          }} />
        )}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flexShrink: 0, marginTop: '4px' }}>
            {getAvatar(comment)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              backgroundColor: '#F9FAFB',
              borderRadius: '12px',
              padding: '12px',
              border: '1px solid #E5E7EB'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontWeight: 600,
                    color: '#1F2937',
                    fontSize: '0.875rem'
                  }}>
                    {comment.author_name}
                  </span>
                  {comment.is_anonymous && (
                    <span style={{
                      fontSize: '0.75rem',
                      backgroundColor: '#FEF3C7',
                      color: '#92400E',
                      padding: '2px 6px',
                      borderRadius: '9999px',
                      fontWeight: 500
                    }}>
                      Anonymous
                    </span>
                  )}
                </div>
                <span style={{
                  color: '#6B7280',
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap'
                }}>
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              <p style={{
                color: '#374151',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                fontSize: '0.875rem'
              }}>
                {comment.content}
              </p>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '8px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => handleLike(comment.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: comment.is_liked ? '#EF4444' : '#6B7280',
                  fontSize: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Heart
                  size={14}
                  fill={comment.is_liked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                />
                <span>{comment.likes_count || 0}</span>
              </button>
              <button
                onClick={() => toggleReply(comment.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#6B7280',
                  fontSize: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <MessageCircle size={14} />
                <span>Reply</span>
              </button>
              {replies.length > 0 && (
                <button
                  onClick={() => toggleReplies(comment.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#6B7280',
                    fontSize: '0.75rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {areRepliesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span>
                </button>
              )}
            </div>
            {isReplyOpen && (
              <div style={{ marginTop: '12px', paddingLeft: '8px' }}>
                <ReplyForm
                  value={replyTexts[comment.id] || ''}
                  onChange={(val) => setReplyTexts(prev => ({ ...prev, [comment.id]: val }))}
                  onSubmit={() => handleSubmit(comment.id)}
                  isSubmitting={isSubmitting}
                  currentUser={currentUser}
                  isMobile={windowWidth < MOBILE_BREAKPOINT}
                />
              </div>
            )}
            {areRepliesExpanded && replies.length > 0 && (
              <div style={{ marginTop: '12px', borderLeft: '2px solid #E5E7EB', paddingLeft: '16px' }}>
                {replies.map(childThread => renderComment(childThread, depth + 1))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const topLevelCommentCount = comments.length;

  if (isLoading) {
    return (
      <div style={{
        marginTop: '24px',
        display: 'flex',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '3px solid #FDE68A',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  // Collapsed preview mode
  if (!isExpanded) {
    return (
      <div
        style={{
          marginTop: '24px',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(true)}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Likes */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePostLike();
              }}
              disabled={isPostLikeLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: postIsLiked ? '#EF4444' : '#3B82F6',
                background: 'none',
                border: 'none',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: 500,
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Heart
                size={16}
                fill={postIsLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
              />
              <span>{postLikesCount}</span>
            </button>
            {/* Comments */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#374151',
                background: 'none',
                border: 'none',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: 500,
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <MessageCircle size={16} />
              <span>{topLevelCommentCount}</span>
            </button>
          </div>
          {topLevelCommentCount > 0 && (
            <span style={{ color: '#F59E0B', fontSize: '0.875rem' }}>
              View all
            </span>
          )}
        </div>
        {comments.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {/* Show latest comment in preview */}
            {renderComment(comments[0], 0)}
          </div>
        )}
      </div>
    );
  }

  // Expanded view
  return (
    <div style={{ marginTop: '24px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {/* Likes */}
          <button
            onClick={togglePostLike}
            disabled={isPostLikeLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: postIsLiked ? '#EF4444' : '#3B82F6',
              background: 'none',
              border: 'none',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: 500,
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Heart
              size={16}
              fill={postIsLiked ? 'currentColor' : 'none'}
              stroke="currentColor"
            />
            <span>{postLikesCount}</span>
          </button>
          {/* Comments count */}
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#374151',
              background: 'none',
              border: 'none',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: 500,
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <MessageCircle size={16} />
            <span>{topLevelCommentCount}</span>
          </button>
        </div>

        {/* Sort Toggle */}
        <button
          onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#6B7280',
            background: 'none',
            border: 'none',
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ArrowUpDown size={14} />
          <span>{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
        </button>
      </div>

      {/* Main Comment Form */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flexShrink: 0 }}>
            {currentUser.isAnonymous ? (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '9999px',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ color: '#92400E', fontWeight: 600, fontSize: '1rem' }}>A</span>
              </div>
            ) : currentUser.avatarUrl ? (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  border: '1px solid #FDE68A'
                }}
              >
                <Image
                  src={currentUser.avatarUrl}
                  alt="Your avatar"
                  width={40}
                  height={40}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '9999px',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ color: '#92400E', fontWeight: 600, fontSize: '1rem' }}>
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              ref={textareaRef}
              value={newTopLevelComment}
              onChange={(e) => {
                setNewTopLevelComment(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Add a comment..."
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #D1D5DB',
                borderRadius: '12px',
                fontSize: '0.875rem',
                resize: 'none',
                minHeight: '48px',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#F59E0B')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#D1D5DB')}
            />
            {error && (
              <div
                style={{
                  marginTop: '8px',
                  color: '#EF4444',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <X size={14} />
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                onClick={() => handleSubmit()}
                disabled={!newTopLevelComment.trim() || isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: windowWidth < MOBILE_BREAKPOINT ? '8px' : '8px 16px',
                  backgroundColor: !newTopLevelComment.trim() || isSubmitting ? '#E5E7EB' : '#F59E0B',
                  color: !newTopLevelComment.trim() || isSubmitting ? '#9CA3AF' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: !newTopLevelComment.trim() || isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {isSubmitting ? (
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.5)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }}
                  />
                ) : windowWidth < MOBILE_BREAKPOINT ? (
                  <Send size={18} style={{ strokeWidth: 1.5 }} />
                ) : (
                  <>
                    <span>Comment</span>
                    <Send size={16} style={{ strokeWidth: 1.5 }} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Comments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {comments.map((thread) => renderComment(thread))}
        {comments.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 0',
              color: '#6B7280',
              fontSize: '0.875rem'
            }}
          >
            No comments yet. Be the first to share your thoughts!
          </div>
        )}
      </div>

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

function ReplyForm({
  onSubmit,
  value,
  onChange,
  isSubmitting,
  currentUser,
  isMobile
}: {
  onSubmit: () => void;
  value: string;
  onChange: (val: string) => void;
  isSubmitting: boolean;
  currentUser: CommentsSectionProps['currentUser'];
  isMobile: boolean;
}) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px' }}>
      <div style={{ flexShrink: 0, marginTop: '3px' }}>
        {currentUser.isAnonymous ? (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            backgroundColor: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: '#92400E', fontWeight: 600, fontSize: '0.75rem' }}>A</span>
          </div>
        ) : currentUser.avatarUrl ? (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            overflow: 'hidden'
          }}>
            <Image
              src={currentUser.avatarUrl}
              alt="Your avatar"
              width={28}
              height={28}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
        ) : (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            backgroundColor: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: '#92400E', fontWeight: 600, fontSize: '0.75rem' }}>
              {currentUser.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Write a reply..."
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            fontSize: '0.875rem',
            resize: 'none',
            minHeight: '36px',
            backgroundColor: '#F9FAFB'
          }}
        />
        <button
          type="submit"
          disabled={!value.trim() || isSubmitting}
          style={{
            position: 'absolute',
            right: '4px',
            bottom: '4px',
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            backgroundColor: !value.trim() || isSubmitting ? '#E5E7EB' : '#F59E0B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: !value.trim() || isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? (
            <div style={{
              width: '14px',
              height: '14px',
              border: '1.5px solid rgba(255,255,255,0.5)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
          ) : (
            <Send size={14} color={!value.trim() ? '#9CA3AF' : '#FFFFFF'} style={{ strokeWidth: 1.5 }} />
          )}
        </button>
      </div>
    </form>
  );
}