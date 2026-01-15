// components/CommentsSection.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { Heart, Send, X } from 'lucide-react';
import Image from 'next/image';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count: number;
  is_anonymous: boolean;
  user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface CommentsSectionProps {
  parentId: string; // ID of the post/story/memory being commented on
  parentType: 'post' | 'story' | 'memory'; // Type of parent content
  currentUser: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    isAnonymous: boolean;
  };
}

export function CommentsSection({ 
  parentId, 
  parentType, 
  currentUser 
}: CommentsSectionProps) {
  const supabase = createClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load comments on mount
  useEffect(() => {
    loadComments();
    
    // Realtime subscription
    const channel = supabase
      .channel(`comments-${parentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `parent_id=eq.${parentId}`
        },
        (payload) => {
          setComments(prev => [payload.new as Comment, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `parent_id=eq.${parentId}`
        },
        (payload) => {
          setComments(prev => prev.filter(c => c.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentId]);

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:profiles!user_id (
          full_name,
          avatar_url
        )
      `)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load comments:', error);
      setError('Failed to load comments');
      return;
    }

    setComments(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          id: uuidv4(),
          parent_id: parentId,
          parent_type: parentType,
          user_id: currentUser.id,
          content: newComment.trim(),
          is_anonymous: currentUser.isAnonymous,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      setNewComment('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) {
      console.error('Comment submission failed:', err);
      setError('Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    // Optimistic update
    setComments(prev => 
      prev.map(c => 
        c.id === commentId 
          ? { ...c, likes_count: c.likes_count + 1 } 
          : c
      )
    );

    try {
      await supabase.rpc('increment_comment_likes', { comment_id: commentId });
    } catch (err) {
      console.error('Like failed:', err);
      // Revert optimistic update on failure
      setComments(prev => 
        prev.map(c => 
          c.id === commentId 
            ? { ...c, likes_count: c.likes_count - 1 } 
            : c
        )
      );
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
      </h3>
      
      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            {currentUser.avatarUrl ? (
              <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-200">
                <Image 
                  src={currentUser.avatarUrl} 
                  alt="Your avatar" 
                  width={32} 
                  height={32}
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center border border-amber-200">
                <span className="text-amber-800 font-medium text-sm">
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex-grow">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => {
                setNewComment(e.target.value);
                // Auto-resize textarea
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              placeholder="Share your thoughts..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              rows={1}
              disabled={isSubmitting}
            />
            
            {error && (
              <div className="mt-2 text-red-600 text-sm">{error}</div>
            )}
            
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!newComment.trim() || isSubmitting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                  newComment.trim() && !isSubmitting
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Posting...
                  </>
                ) : (
                  <>
                    Post
                    <Send size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
      
      {/* Comments List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div className="flex-shrink-0">
              {comment.is_anonymous ? (
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center border border-amber-200">
                  <span className="text-amber-800 font-medium text-sm">A</span>
                </div>
              ) : comment.user?.avatar_url ? (
                <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-200">
                  <Image 
                    src={comment.user.avatar_url} 
                    alt={comment.user.full_name} 
                    width={32} 
                    height={32}
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center border border-amber-200">
                  <span className="text-amber-800 font-medium text-sm">
                    {comment.user?.full_name?.charAt(0).toUpperCase() || 'C'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex-grow">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">
                      {comment.is_anonymous ? 'Anonymous' : comment.user?.full_name || 'Community Member'}
                    </span>
                    {comment.is_anonymous && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        Anonymous
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTime(comment.created_at)}
                  </span>
                </div>
                
                <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
              </div>
              
              <div className="flex items-center gap-2 mt-2 ml-1">
                <button
                  onClick={() => handleLike(comment.id)}
                  className="flex items-center gap-1 text-gray-500 hover:text-rose-500 transition-colors"
                >
                  <Heart size={16} className="fill-current" />
                  <span>{comment.likes_count || 0}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {comments.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            No comments yet. Be the first to share your thoughts.
          </div>
        )}
      </div>
    </div>
  );
}