// src/app/communities/[communityId]/styles.ts
import type { CSSProperties } from 'react';
import { baseCard, buttonStyles, spacing, borderRadius, baseColors } from '@/lib/sharedStyles';

// Community Banner
export const bannerContainer: CSSProperties = {
  position: 'relative',
  height: '12rem',
  overflow: 'hidden',
  marginBottom: spacing['2xl'],
  borderRadius: borderRadius.md,
};

export const bannerImage: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover' as const,
};

export const bannerOverlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
};

export const editBannerButton: CSSProperties = {
  ...buttonStyles.secondary,
  position: 'absolute' as const,
  bottom: spacing.lg,
  right: spacing.lg,
  background: 'rgba(0,0,0,0.3)',
  backdropFilter: 'blur(4px)',
  color: 'white',
  fontSize: '0.875rem',
};

// Community Header
export const communityHeader: CSSProperties = {
  ...baseCard,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: spacing.lg,
};

// Create Post Form
export const postForm: CSSProperties = {
  ...baseCard,
};

export const mediaPreview: CSSProperties = {
  width: '100%',
  height: '12rem',
  objectFit: 'cover' as const,
  borderRadius: borderRadius.md,
  marginBottom: spacing.md,
};

// Post Card
export const postCard: CSSProperties = {
  ...baseCard,
  marginBottom: spacing['2xl'],
};

export const postHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: spacing.lg,
  marginBottom: spacing.md,
};

export const avatar: CSSProperties = {
  width: '3rem',
  height: '3rem',
  borderRadius: borderRadius.full,
  background: baseColors.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

// Comments
export const commentContainer: CSSProperties = {
  marginTop: spacing.xl,
  paddingLeft: spacing.lg,
  borderLeft: `2px solid ${baseColors.border}`,
};

export const replyContainer: CSSProperties = {
  marginTop: spacing.sm,
  paddingLeft: spacing.lg,
  borderLeft: `2px solid ${baseColors.border}`,
};

// Sidebar
export const sidebarSection: CSSProperties = {
  ...baseCard,
  marginBottom: spacing['2xl'],
};

// Modal
export const modalOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: spacing.lg,
};

export const modalContent: CSSProperties = {
  ...baseCard,
  width: '100%',
  maxWidth: '500px',
  maxHeight: '90vh',
  overflowY: 'auto' as const,
};

// Responsive layout
export const mainLayout = (isLargeScreen: boolean): CSSProperties => ({
  maxWidth: '1152px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: isLargeScreen ? '2fr 1fr' : '1fr',
  gap: spacing['2xl'],
});