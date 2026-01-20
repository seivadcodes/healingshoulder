// src/app/communities/create/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Button from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Users, ArrowLeft, Image, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const GRIEF_TYPES = [
  { id: 'parent', label: 'Loss of a Parent', gradient: 'linear-gradient(to bottom right, #fde68a, #f97316)' },
  { id: 'child', label: 'Loss of a Child', gradient: 'linear-gradient(to bottom right, #e9d5ff, #8b5cf6)' },
  { id: 'spouse', label: 'Grieving a Partner', gradient: 'linear-gradient(to bottom right, #fecdd3, #ec4899)' },
  { id: 'sibling', label: 'Loss of a Sibling', gradient: 'linear-gradient(to bottom right, #a7f3d0, #06b6d4)' },
  { id: 'friend', label: 'Loss of a Friend', gradient: 'linear-gradient(to bottom right, #bfdbfe, #6366f1)' },
  { id: 'pet', label: 'Pet Loss', gradient: 'linear-gradient(to bottom right, #fef3c7, #f59e0b)' },
  { id: 'miscarriage', label: 'Pregnancy or Infant Loss', gradient: 'linear-gradient(to bottom right, #fbcfe8, #f472b6)' },
  { id: 'caregiver', label: 'Caregiver Grief', gradient: 'linear-gradient(to bottom right, #e5e7eb, #f59e0b)' },
  { id: 'suicide', label: 'Suicide Loss', gradient: 'linear-gradient(to bottom right, #ddd6fe, #a78bfa)' },
  { id: 'other', label: 'Other Loss', gradient: 'linear-gradient(to bottom right, #e5e7eb, #d6d3d1)' }
];

const baseStyles = {
  minHScreen: { minHeight: '100vh' },
  flexCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  textCenter: { textAlign: 'center' as const },
  mxAuto: { margin: '0 auto' },
  mb4: { marginBottom: '1rem' },
  mb6: { marginBottom: '1.5rem' },
  mt8: { marginTop: '2rem' },
  pt20: { paddingTop: '5rem' },
  pt6: { paddingTop: '1.5rem' },
  p4: { padding: '1rem' },
  p6: { padding: '1.5rem' },
  maxW2xl: { maxWidth: '42rem' },
  roundedXl: { borderRadius: '0.75rem' },
  border: { border: '1px solid' },
  shadowSm: { boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
  spaceY6: { display: 'flex', flexDirection: 'column' as const, gap: '1.5rem' },
  spaceY2: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  spaceY3: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  block: { display: 'block' },
  fontMedium: { fontWeight: 500 as const },
  textSm: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  textXs: { fontSize: '0.75rem', lineHeight: '1rem' },
  cursorPointer: { cursor: 'pointer' },
  transitionColors: { transition: 'color 0.2s' },
  hoverTextAmber800: { ':hover': { color: '#92400e' } },
  textAmber700: { color: '#b45309' },
  textSton800: { color: '#1f2937' },
  textSton700: { color: '#374151' },
  textSton600: { color: '#4b5563' },
  textSton500: { color: '#6b7280' },
  textRed500: { color: '#ef4444' },
  bgWhite: { backgroundColor: '#fff' },
  bgAmber50: { backgroundColor: '#fffbeb' },
  bgAmber100: { backgroundColor: '#fef3c7' },
  bgRed50: { backgroundColor: '#fef2f2' },
  bgAmber500: { backgroundColor: '#f59e0b' },
  bgAmber600: { backgroundColor: '#d97706' },
  borderSton200: { borderColor: '#e5e7eb' },
  borderSton300: { borderColor: '#d1d5db' },
  borderAmber400: { borderColor: '#fbbf24' },
  borderAmber500: { borderColor: '#f59e0b' },
  focusRingAmber500: { outline: '2px solid #f59e0b', outlineOffset: '2px' },
  roundedLg: { borderRadius: '0.5rem' },
  roundedFull: { borderRadius: '9999px' },
  h4: { height: '1rem' },
  w4: { width: '1rem' },
  h5: { height: '1.25rem' },
  w5: { width: '1.25rem' },
  h7: { height: '1.75rem' },
  w7: { width: '1.75rem' },
  h8: { height: '2rem' },
  w8: { width: '2rem' },
  h14: { height: '3.5rem' },
  w14: { width: '3.5rem' },
  p1_5: { padding: '0.375rem' },
  p3: { padding: '0.75rem' },
  px4: { paddingLeft: '1rem', paddingRight: '1rem' },
  py2: { paddingTop: '0.5rem', paddingBottom: '0.5rem' },
  py3: { paddingTop: '0.75rem', paddingBottom: '0.75rem' },
  minH100: { minHeight: '100px' },
  h48: { height: '12rem' },
  wFull: { width: '100%' },
  objectCover: { objectFit: 'cover' as const },
  absolute: { position: 'absolute' as const },
  inset0: { top: 0, right: 0, bottom: 0, left: 0 },
  opacity0: { opacity: 0 },
  opacity100: { opacity: 1 },
  pointerEventsNone: { pointerEvents: 'none' as const },
  flex: { display: 'flex' },
  itemsCenter: { alignItems: 'center' },
  justifyCenter: { justifyContent: 'center' },
  group: { position: 'relative' },
  animateSpin: { animation: 'spin 1s linear infinite' },
  '@keyframes spin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' }
  }
};

export default function CreateCommunityPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [griefType, setGriefType] = useState(GRIEF_TYPES[0].id);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { user, sessionChecked } = useAuth();
  const [otherLossDescription, setOtherLossDescription] = useState('');

  useEffect(() => {
    if (sessionChecked && !user) {
      const currentPath = window.location.pathname;
      router.push(`/auth?redirectTo=${encodeURIComponent(currentPath)}`);
    }
  }, [user, sessionChecked, router]);

  if (!sessionChecked) {
    return (
      <div style={{ ...baseStyles.minHScreen, ...baseStyles.flexCenter }}>
        <div style={baseStyles.textCenter}>
          <div
            style={{
              height: '2rem',
              width: '2rem',
              animation: 'spin 1s linear infinite',
              borderRadius: '9999px',
              border: '4px solid #f59e0b',
              borderTopColor: 'transparent',
              margin: '0 auto 1rem'
            }}
          ></div>
          <p style={baseStyles.textSton600}>Verifying your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !description.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (name.length < 3) {
      setError('Community name must be at least 3 characters long');
      return;
    }

    if (description.length < 10) {
      setError('Please provide a more detailed description');
      return;
    }

    if (!user) {
      setError('Session expired. Please log in again to create a community.');
      router.push('/auth?redirectTo=/communities/create');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setUploadError(null);

    try {
      const communityId = generateSlug(name);

      const { data: existingCommunity, error: checkError }  = await supabase
        .from('communities')
        .select('id')
        .eq('id', communityId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking for existing community:', checkError);
        setError('Unable to verify community availability. Please try again.');
        return;
      }

      if (existingCommunity) {
        setError('A community with this name already exists. Please choose a different name.');
        setIsSubmitting(false);
        return;
      }

      const { error: communityError } = await supabase
  .from('communities')
  .insert({
    id: communityId,
    name: name.trim(),
    description: description.trim(),
    grief_type: griefType,
    other_loss_description: griefType === 'other' ? otherLossDescription.trim() || null : null,
    member_count: 0,
    online_count: 0,
    created_at: new Date().toISOString()
  });

      if (communityError) throw communityError;

      const { error: memberError } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: user.id,
          joined_at: new Date().toISOString(),
          role: 'admin'
        });

      if (memberError) throw memberError;

      
let savedBannerPath: string | null = null;

if (fileToUpload) {
  try {
    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${communityId}/banner.${fileExt || 'jpg'}`;

    const { error: uploadError } = await supabase.storage
      .from('communities')
      .upload(fileName, fileToUpload, { upsert: true });

    if (uploadError) throw uploadError;

    // ✅ Save the path to the database
   savedBannerPath = `communities/${fileName}`; // e.g., "communities/loss-of-parent/banner.jpg"
  } catch (uploadErr: unknown) {
    console.error('Banner upload failed:', uploadErr);
    setUploadError('Banner upload failed, but your community was created. You can add a banner later.');
  }
}

// ✅ Update the community record to include cover_photo_url
const { error: updateError } = await supabase
  .from('communities')
  .update({ cover_photo_url: savedBannerPath })
  .eq('id', communityId);

if (updateError) {
  console.warn('Failed to save banner path:', updateError);
  // Optional: show a toast, but don't block community creation
}

      router.push(`/communities/${communityId}`);
    } catch (err: unknown) {
      console.error('Community creation error:', err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to create community. Please try again.');
      } else {
        setError('Failed to create community. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, GIF, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setFileToUpload(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to load image preview. Please try a different image.');
    };
    reader.readAsDataURL(file);
  };

  const removeBanner = () => {
    setPreviewImage(null);
    setFileToUpload(null);
    setError(null);
  };

  // Helper to merge styles
  const mergeStyles = (...styles: React.CSSProperties[]): React.CSSProperties => {
    return Object.assign({}, ...styles);
  };

  return (
    <div
      style={{
        ...baseStyles.minHScreen,
        background: 'linear-gradient(to bottom, #fef3c7, #f5f5f4, #f3f4f6)',
        padding: '1rem',
        paddingTop: '5rem'
      }}
    >
      <div style={{ ...baseStyles.maxW2xl, ...baseStyles.mxAuto }}>
        <button
          onClick={() => router.back()}
          style={{
            ...baseStyles.flex,
            ...baseStyles.itemsCenter,
            ...baseStyles.textAmber700,
            ...baseStyles.transitionColors,
            marginBottom: '1.5rem'
          }}
        >
          <ArrowLeft style={{ height: '1rem', width: '1rem', marginRight: '0.25rem' }} />
          <span>Back to Communities</span>
        </button>

        <div style={baseStyles.textCenter}>
          <div
            style={{
              ...baseStyles.w14,
              ...baseStyles.h14,
              ...baseStyles.roundedFull,
              background: 'linear-gradient(to bottom right, #fde68a, #f97316)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}
          >
            <Users style={{ height: '1.75rem', width: '1.75rem', color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>
            Create Your Community
          </h1>
          <p style={baseStyles.textSton600}>
            Start a safe space where others who share your grief journey can find connection.
          </p>
        </div>

        <div
          style={{
            ...baseStyles.bgWhite,
            ...baseStyles.roundedXl,
            ...baseStyles.border,
            ...baseStyles.borderSton200,
            ...baseStyles.p6,
            ...baseStyles.shadowSm
          }}
        >
          <form onSubmit={handleSubmit} style={baseStyles.spaceY6}>
            <div style={baseStyles.spaceY2}>
              <label style={{ ...baseStyles.block, ...baseStyles.textSm, ...baseStyles.fontMedium, ...baseStyles.textSton700 }}>
                Community Banner (optional)
              </label>
              <div style={{ position: 'relative' }}>
                {previewImage ? (
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        ...baseStyles.border,
                        ...baseStyles.borderSton200,
                        ...baseStyles.roundedLg,
                        overflow: 'hidden',
                        cursor: 'pointer'
                      }}
                      onClick={() => document.getElementById('banner-upload')?.click()}
                    >
                      <div style={{ ...baseStyles.h48, ...baseStyles.wFull, backgroundColor: '#f3f4f6' }}>
                        <img
                          src={previewImage}
                          alt="Community banner preview"
                          style={{ ...baseStyles.wFull, ...baseStyles.h48, ...baseStyles.objectCover }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            setPreviewImage(null);
                          }}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        ...baseStyles.absolute,
                        ...baseStyles.inset0,
                        background: 'rgba(0,0,0,0)',
                        transition: 'background 0.3s',
                        borderRadius: '0.5rem'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
                    ></div>
                    <div
                      style={{
                        ...baseStyles.absolute,
                        ...baseStyles.inset0,
                        ...baseStyles.flex,
                        ...baseStyles.itemsCenter,
                        ...baseStyles.justifyCenter,
                        opacity: 0,
                        transition: 'opacity 0.3s',
                        pointerEvents: 'none'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      <div
                        style={{
                          color: '#fff',
                          background: 'rgba(0,0,0,0.5)',
                          padding: '0.5rem 1rem',
                          borderRadius: '9999px',
                          display: 'flex',
                          alignItems: 'center',
                          fontSize: '0.875rem'
                        }}
                      >
                        <Image style={{ height: '2rem', width: '2rem', color: '#b45309' }} />
                        <span>Change banner</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBanner();
                      }}
                      style={{
                        ...baseStyles.absolute,
                        top: '-0.5rem',
                        right: '-0.5rem',
                        ...baseStyles.bgAmber500,
                        color: '#fff',
                        ...baseStyles.roundedFull,
                        ...baseStyles.p1_5,
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
                      title="Remove banner"
                    >
                      <X style={{ height: '1rem', width: '1rem' }} />
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      ...baseStyles.border,
                      borderStyle: 'dashed',
                      ...baseStyles.borderSton300,
                      ...baseStyles.roundedLg,
                      padding: '1.5rem',
                      ...baseStyles.textCenter,
                      ...baseStyles.cursorPointer
                    }}
                    onClick={() => document.getElementById('banner-upload')?.click()}
                  >
                    <div
                      style={{
                        ...baseStyles.mxAuto,
                        width: '4rem',
                        height: '4rem',
                        ...baseStyles.roundedFull,
                        ...baseStyles.bgAmber100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '0.75rem'
                      }}
                    >
                      <Image style={{ height: '2rem', width: '2rem', color: '#b45309' }} />
                    </div>
                    <p style={{ ...baseStyles.textSton700, ...baseStyles.fontMedium, marginBottom: '0.25rem' }}>
                      Upload a banner image
                    </p>
                    <p style={baseStyles.textSm}>
                      Recommended: 1200x300px (16:9 ratio), max 5MB
                    </p>
                  </div>
                )}
              </div>
              <input
                type="file"
                id="banner-upload"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
            </div>

            <div style={baseStyles.spaceY2}>
              <label style={{ ...baseStyles.block, ...baseStyles.textSm, ...baseStyles.fontMedium, ...baseStyles.textSton700 }}>
                Community Name <span style={baseStyles.textRed500}>*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Loss of a Parent"
                style={{
                  ...baseStyles.wFull,
                  ...baseStyles.px4,
                  ...baseStyles.py2,
                  ...baseStyles.border,
                  ...baseStyles.borderSton300,
                  ...baseStyles.roundedLg,
                  outline: 'none'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#f59e0b')}
                onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                maxLength={60}
              />
              
            </div>

            <div style={baseStyles.spaceY2}>
              <label style={{ ...baseStyles.block, ...baseStyles.textSm, ...baseStyles.fontMedium, ...baseStyles.textSton700 }}>
                Description <span style={baseStyles.textRed500}>*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your community in 1-2 sentences. What grief experience does it center around?"
                style={{
                  ...baseStyles.wFull,
                  ...baseStyles.px4,
                  ...baseStyles.py2,
                  ...baseStyles.border,
                  ...baseStyles.borderSton300,
                  ...baseStyles.roundedLg,
                  outline: 'none',
                  minHeight: '100px'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#f59e0b')}
                onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                maxLength={250}
              />
              <p style={baseStyles.textXs}>
                {description.length}/250 characters
              </p>
            </div>

            <div style={baseStyles.spaceY2}>
              <label style={{ ...baseStyles.block, ...baseStyles.textSm, ...baseStyles.fontMedium, ...baseStyles.textSton700 }}>
                Primary Grief Type <span style={baseStyles.textRed500}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {GRIEF_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setGriefType(type.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      ...baseStyles.p3,
                      ...baseStyles.roundedLg,
                      ...baseStyles.border,
                      textAlign: 'left' as const,
                      transition: 'all 0.2s',
                      ...(griefType === type.id
                        ? {
                            borderColor: '#fbbf24',
                            background: type.gradient,
                            color: '#fff'
                          }
                        : {
                            borderColor: '#d1d5db',
                            backgroundColor: '#fff',
                            color: '#1f2937'
                          })
                    }}
                    onMouseOver={(e) => {
                      if (griefType !== type.id) {
                        e.currentTarget.style.borderColor = '#fbbf24';
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (griefType !== type.id) {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.backgroundColor = '#fff';
                      }
                    }}
                  >
                    <div
                      style={{
                        width: '0.75rem',
                        height: '0.75rem',
                        borderRadius: '9999px',
                        background: type.gradient,
                        marginRight: '0.75rem'
                      }}
                    ></div>
                    <span style={baseStyles.fontMedium}>{type.label}</span>
                  </button>
                ))}
              </div>
              <p style={baseStyles.textXs}>
                This helps match your community with others experiencing similar loss
              </p>
            </div>

            {error && (
              <div style={{ ...baseStyles.p3, ...baseStyles.bgRed50, color: '#b91c1c', ...baseStyles.roundedLg, ...baseStyles.textSm }}>
                {error}
              </div>
            )}

            {uploadError && (
              <div style={{ ...baseStyles.p3, backgroundColor: '#fffbeb', color: '#92400e', ...baseStyles.roundedLg, ...baseStyles.textSm }}>
                {uploadError}
              </div>
            )}
{griefType === 'other' && (
  <div style={baseStyles.spaceY2}>
    <label style={{ ...baseStyles.block, ...baseStyles.textSm, ...baseStyles.fontMedium, ...baseStyles.textSton700 }}>
      Please describe this loss
    </label>
    <input
      type="text"
      value={otherLossDescription}
      onChange={(e) => setOtherLossDescription(e.target.value)}
      placeholder="e.g., Loss of a home, community, or identity..."
      style={{
        ...baseStyles.wFull,
        ...baseStyles.px4,
        ...baseStyles.py2,
        ...baseStyles.border,
        ...baseStyles.borderSton300,
        ...baseStyles.roundedLg,
        outline: 'none'
      }}
      onFocus={(e) => (e.target.style.borderColor = '#f59e0b')}
      onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
      maxLength={100}
    />
    <p style={baseStyles.textXs}>
      {otherLossDescription.length}/100 characters
    </p>
  </div>
)}
            <div style={{ ...baseStyles.pt6, ...baseStyles.border, ...baseStyles.borderSton200, borderTopWidth: '1px', borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0 }}>
              <Button
                type="submit"
                disabled={isSubmitting || !name.trim() || !description.trim()}
                style={{
                  ...baseStyles.wFull,
                  ...baseStyles.py3,
                  ...baseStyles.fontMedium,
                  backgroundColor: isSubmitting || !name.trim() || !description.trim() ? '#d1d5db' : '#f59e0b',
                  color: '#fff',
                  cursor: isSubmitting || !name.trim() || !description.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? (
                  <span style={{ ...baseStyles.flex, ...baseStyles.itemsCenter, ...baseStyles.justifyCenter }}>
                    <span
                      style={{
                        height: '1.25rem',
                        width: '1.25rem',
                        animation: 'spin 1s linear infinite',
                        borderRadius: '9999px',
                        border: '2px solid #fff',
                        borderTopColor: 'transparent',
                        marginRight: '0.5rem'
                      }}

                      
                    ></span>
                    Creating Community...
                  </span>
                ) : (
                  'Create Community'
                )}
              </Button>
              <p style={{ ...baseStyles.textCenter, ...baseStyles.textXs, ...baseStyles.textSton500, marginTop: '0.75rem' }}>
                By creating this community, you agree to moderate it with care and compassion. You can add co-moderators later.
              </p>
            </div>
          </form>
        </div>

        <div
          style={{
            ...baseStyles.mt8,
            ...baseStyles.bgWhite,
            ...baseStyles.roundedXl,
            ...baseStyles.border,
            ...baseStyles.borderSton200,
            ...baseStyles.p6
          }}
        >
          <h3 style={{ ...baseStyles.fontMedium, ...baseStyles.textSton800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                width: '0.375rem',
                height: '0.375rem',
                borderRadius: '9999px',
                backgroundColor: '#f59e0b',
                display: 'inline-block',
                marginRight: '0.5rem'
              }}
            ></span>
            Community Guidelines
          </h3>
          <ul style={{ ...baseStyles.spaceY2, ...baseStyles.textSm, ...baseStyles.textSton600, paddingLeft: '1rem' }}>
            <li>• Your community should have a clear focus on a specific grief experience</li>
            <li>• You are responsible for creating a safe, inclusive space</li>
            <li>• Healing Shoulder staff may reach out to help you moderate as your community grows</li>
            <li>• Communities that become inactive or harmful may be archived by staff</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

