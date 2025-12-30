// src/lib/sharedStyles.ts
import type { CSSProperties } from 'react';

// === Core Colors & Gradients ===
export const griefGradients: Record<string, string> = {
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

export const baseColors = {
  primary: '#f59e0b',
  secondary: '#1e293b',
  accent: '#16a34a',
  background: '#fffbeb',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: {
    primary: '#1e293b',
    secondary: '#64748b',
    muted: '#94a3b8',
  },
  status: {
    online: '#16a34a',
    offline: '#cbd5e1',
  },
};

// === Spacing & Radius ===
export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
};

export const borderRadius = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
};

// === Reusable Component Styles ===
export const baseCard: CSSProperties = {
  background: baseColors.surface,
  borderRadius: borderRadius.lg,
  border: `1px solid ${baseColors.border}`,
  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
  padding: spacing.xl,
};

export const subtleCard: CSSProperties = {
  ...baseCard,
  background: 'rgba(255,255,255,0.7)',
};

export const buttonStyles = {
  primary: {
    background: baseColors.primary,
    color: 'white',
    border: 'none',
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.sm,
    fontWeight: 600,
  } as CSSProperties,
  secondary: {
    background: 'transparent',
    color: baseColors.text.primary,
    border: `1px solid ${baseColors.border}`,
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.sm,
  } as CSSProperties,
  danger: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.sm,
  } as CSSProperties,
};

export const pageContainer: CSSProperties = {
  minHeight: '100vh',
  background: `linear-gradient(to bottom, ${baseColors.background}, #f5f5f1, #f0f0ee)`,
  paddingTop: '5rem',
  paddingBottom: spacing['3xl'],
  paddingLeft: spacing.lg,
  paddingRight: spacing.lg,
};

export const centerContent: CSSProperties = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: spacing.lg,
};

export const spinner: CSSProperties = {
  height: '3rem',
  width: '3rem',
  borderRadius: borderRadius.full,
  border: `4px solid ${baseColors.primary}`,
  borderTopColor: 'transparent',
  animation: 'spin 1s linear infinite',
  margin: '0 auto 1rem',
};

// === Typography ===
export const typography = {
  h1: { fontSize: '1.875rem', fontWeight: 700, color: baseColors.text.primary } as CSSProperties,
  h2: { fontSize: '1.5rem', fontWeight: 700, color: baseColors.text.primary } as CSSProperties,
  body: { color: baseColors.text.secondary } as CSSProperties,
  muted: { color: baseColors.text.muted, fontSize: '0.875rem' } as CSSProperties,
};