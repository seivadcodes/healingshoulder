'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { CommentsSection } from './CommentsSection';

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

export interface Post {
  id: string;
  userId: string;
  text: string;
  mediaUrl?: string | null;
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

// ─── STYLES ────────────────────────────────────────
const baseColors = {
  primary: '#f59e0b',
  secondary: '#1e293b',
  accent: '#16a34a',
  background: '#fffbeb',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: { primary: '#1e293b', secondary: '#64748b', muted: '#94a3b8' },
} as const;

const spacing = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
} as const;

const borderRadius = {
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

const griefGradients = {
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
} as const;

const defaultGradient = griefGradients.parent;

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
  onPostDeleted?: () => void;
  showAuthor?: boolean;
  context?: 'profile' | 'community' | 'feed';
}

// ─── COMPONENT ────────────────────────────────────
export function PostCard({
  post,
  isOwner = false,
  canDelete = false,
  readonly = false,
  onPostDeleted,
  showAuthor = true,
  context = 'feed',
}: PostCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const { user: currentUser } = useAuth();

  // Only keep delete loading state
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Media gallery
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const mediaUrls = useMemo(() => {
    if (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) {
      return post.mediaUrls.filter(Boolean);
    }
    if (post.mediaUrl) {
      return [post.mediaUrl];
    }
    return [];
  }, [post.mediaUrl, post.mediaUrls]);

  const hasMedia = mediaUrls.length > 0;

  const gradient = useMemo(() => {
    if (!post.griefTypes || post.griefTypes.length === 0) return defaultGradient;
    return griefGradients[post.griefTypes[0]] || defaultGradient;
  }, [post.griefTypes]);

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
                  unoptimized
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
        {(canDelete || isOwner || (currentUser?.id === post.userId)) && !readonly && (
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
      {hasMedia && (
        <div style={{ marginBottom: spacing.lg }}>
          <div
            style={{
              borderRadius: borderRadius.md,
              overflow: 'hidden',
              border: `1px solid ${baseColors.border}`,
              position: 'relative',
            }}
          >
            {/* Navigation & counter */}
            {mediaUrls.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentMediaIndex(prev => prev === 0 ? mediaUrls.length - 1 : prev - 1)}
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
                    zIndex: 10,
                  }}
                  aria-label="Previous"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentMediaIndex(prev => prev === mediaUrls.length - 1 ? 0 : prev + 1)}
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
                    zIndex: 10,
                  }}
                  aria-label="Next"
                >
                  →
                </button>
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    zIndex: 10,
                  }}
                >
                  {currentMediaIndex + 1} / {mediaUrls.length}
                </div>
              </>
            )}

            {/* Main media */}
            {/\.(mp4|webm|mov)$/i.test(mediaUrls[currentMediaIndex]) ? (
              <video
                src={mediaUrls[currentMediaIndex]}
                controls
                style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
              />
            ) : (
              <Image
                src={mediaUrls[currentMediaIndex]}
                alt={`Post media ${currentMediaIndex + 1}`}
                width={800}
                height={400}
                style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain' }}
                unoptimized
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
            )}
          </div>

          {/* Thumbnails */}
          {mediaUrls.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginTop: '8px',
                overflowX: 'auto',
                padding: '4px 0',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {mediaUrls.map((url, index) => (
                <div
                  key={index}
                  onClick={() => setCurrentMediaIndex(index)}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    opacity: currentMediaIndex === index ? 1 : 0.6,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {/\.(mp4|webm|mov)$/i.test(url) ? (
                    <div
                      style={{
                        width: '60px',
                        height: '60px',
                        background: '#333',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '14px',
                      }}
                    >
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
                        border: currentMediaIndex === index ? `2px solid ${baseColors.primary}` : 'none',
                      }}
                      unoptimized
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

      {/* 💬 COMMENTS — kept as requested */}
      <div id={`comments-${post.id}`} style={{ marginTop: spacing.lg }}>
        <CommentsSection
          parentId={post.id}
          parentType={context === 'profile' ? 'post' : 'story'}
          currentUser={{
            id: currentUser?.id || '',
            fullName:
              currentUser?.user_metadata?.full_name ||
              currentUser?.email?.split('@')[0] ||
              'Anonymous',
            avatarUrl: currentUser?.user_metadata?.avatar_url || null,
            isAnonymous: false,
          }}
        />
      </div>

      {/* Global CSS */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}