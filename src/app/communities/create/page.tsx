// src/app/communities/create/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Users, ArrowLeft, Image as ImageIcon, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// Grief types with inline-friendly gradient strings
const GRIEF_TYPES = [
  { id: 'parent', label: 'Loss of a Parent', gradient: 'linear-gradient(135deg, #fed7aa, #fdba74)' },
  { id: 'child', label: 'Loss of a Child', gradient: 'linear-gradient(135deg, #ddd6fe, #c4b5fd)' },
  { id: 'spouse', label: 'Grieving a Partner', gradient: 'linear-gradient(135deg, #fce7f3, #fbcfe8)' },
  { id: 'sibling', label: 'Loss of a Sibling', gradient: 'linear-gradient(135deg, #a7f3d0, #67e8f9)' },
  { id: 'friend', label: 'Loss of a Friend', gradient: 'linear-gradient(135deg, #bfdbfe, #a5b4fc)' },
  { id: 'pet', label: 'Pet Loss', gradient: 'linear-gradient(135deg, #fef08a, #fde047)' },
  { id: 'miscarriage', label: 'Pregnancy or Infant Loss', gradient: 'linear-gradient(135deg, #fbcfe8, #f9a8d4)' },
  { id: 'caregiver', label: 'Caregiver Grief', gradient: 'linear-gradient(135deg, #e5e7eb, #fde68a)' },
  { id: 'suicide', label: 'Suicide Loss', gradient: 'linear-gradient(135deg, #ddd6fe, #ddd6fe)' },
  { id: 'other', label: 'Other Loss', gradient: 'linear-gradient(135deg, #e5e7eb, #d1d5db)' }
];

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionChecked && !user) {
      const currentPath = window.location.pathname;
      router.push(`/auth?redirectTo=${encodeURIComponent(currentPath)}`);
    }
  }, [user, sessionChecked, router]);

  if (!sessionChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            height: '2rem',
            width: '2rem',
            borderRadius: '9999px',
            border: '4px solid transparent',
            borderTopColor: '#f59e0b',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }}></div>
          <p style={{ color: '#78716c' }}>Verifying your session...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) return null;

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

    setIsSubmitting(true);
    setError(null);
    setUploadError(null);

    try {
      const communityId = generateSlug(name);
      
      const { data: existingCommunity, error: checkError } = await supabase
        .from('communities')
        .select('id')
        .eq('id', communityId)
        .maybeSingle();

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

      if (fileToUpload) {
        try {
          const fileExt = fileToUpload.name.split('.').pop();
          const fileName = `${communityId}/banner.${fileExt || 'jpg'}`;
          
          const { error: uploadError } = await supabase.storage
            .from('communities')
            .upload(fileName, fileToUpload, { upsert: true });

          if (uploadError) throw uploadError;
        } catch (uploadErr: any) {
          console.error('Banner upload failed:', uploadErr);
          setUploadError('Banner upload failed, but your community was created successfully. You can add a banner later in community settings.');
        }
      }

      router.push(`/communities/${communityId}`);
    } catch (err: any) {
      console.error('Community creation error:', err);
      setError(err.message || 'Failed to create community. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
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
    reader.onloadend = () => setPreviewImage(reader.result as string);
    reader.onerror = () => setError('Failed to load image preview. Please try a different image.');
    reader.readAsDataURL(file);
  };

  const removeBanner = () => {
    setPreviewImage(null);
    setFileToUpload(null);
    setError(null);
  };

  const currentGradient = GRIEF_TYPES.find(t => t.id === griefType)?.gradient || GRIEF_TYPES[0].gradient;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #fffbeb, #f5f5f4, #f4f4f5)',
        padding: '1rem 1rem 3rem',
        paddingTop: window.innerWidth >= 768 ? '1.5rem' : '5rem',
      }}
    >
      <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            color: '#92400e',
            marginBottom: '1.5rem',
            fontSize: '0.95rem',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#78350f')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#92400e')}
        >
          <ArrowLeft size={16} style={{ marginRight: '0.25rem' }} />
          Back to Communities
        </button>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '9999px',
              background: currentGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <Users size={28} style={{ color: 'white' }} />
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1c1917', marginBottom: '0.5rem' }}>
            Create Your Community
          </h1>
          <p style={{ color: '#44403c' }}>
            Start a safe space where others who share your grief journey can find connection.
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            border: '1px solid #e5e5e5',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Banner Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#44403c' }}>
                Community Banner (optional)
              </label>
              <div style={{ position: 'relative' }}>
                {previewImage ? (
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        border: '2px solid #e5e5e5',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div style={{ height: '12rem', width: '100%', backgroundColor: '#f5f5f4' }}>
                        <img
                          src={previewImage}
                          alt="Community banner preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={() => setPreviewImage(null)}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBanner();
                      }}
                      style={{
                        position: 'absolute',
                        top: '-0.5rem',
                        right: '-0.5rem',
                        background: '#f59e0b',
                        color: 'white',
                        borderRadius: '9999px',
                        width: '1.75rem',
                        height: '1.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#d97706')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#f59e0b')}
                      title="Remove banner"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      border: '2px dashed #d6d3d1',
                      borderRadius: '0.5rem',
                      padding: '1.5rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#f59e0b')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#d6d3d1')}
                  >
                    <div
                      style={{
                        width: '4rem',
                        height: '4rem',
                        borderRadius: '9999px',
                        backgroundColor: '#fef3c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.75rem',
                      }}
                    >
                      <ImageIcon size={32} style={{ color: '#d97706' }} />
                    </div>
                    <p style={{ color: '#1c1917', fontWeight: '600', marginBottom: '0.25rem' }}>
                      Upload a banner image
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#78716c' }}>
                      Recommended: 1200x300px (16:9 ratio), max 5MB
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
            </div>

            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="name" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#44403c' }}>
                Community Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Loss of a Parent"
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: '1px solid #d6d3d1',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#f59e0b')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#d6d3d1')}
                maxLength={60}
              />
              <p style={{ fontSize: '0.75rem', color: '#78716c' }}>
                This will be used in the community URL: healingshoulder.com/communities/
                <span style={{ fontWeight: '600' }}>{generateSlug(name) || 'your-community'}</span>
              </p>
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="description" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#44403c' }}>
                Description <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your community in 1-2 sentences..."
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: '1px solid #d6d3d1',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  minHeight: '6rem',
                  resize: 'vertical',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#f59e0b')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#d6d3d1')}
                maxLength={250}
              />
              <p style={{ fontSize: '0.75rem', color: '#78716c' }}>
                {description.length}/250 characters
              </p>
            </div>

            {/* Grief Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#44403c' }}>
                Primary Grief Type <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth >= 640 ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                {GRIEF_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setGriefType(type.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: griefType === type.id ? '2px solid #f59e0b' : '1px solid #d6d3d1',
                      background: griefType === type.id ? type.gradient : '#f5f5f4',
                      color: griefType === type.id ? 'white' : '#1c1917',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: '0.75rem',
                        height: '0.75rem',
                        borderRadius: '50%',
                        background: type.gradient,
                        marginRight: '0.75rem',
                      }}
                    ></div>
                    <span style={{ fontWeight: '600' }}>{type.label}</span>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#78716c' }}>
                This helps match your community with others experiencing similar loss
              </p>
            </div>

            {/* Errors */}
            {error && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            {uploadError && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fffbeb', color: '#92400e', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                {uploadError}
              </div>
            )}

            {/* Submit */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid #e5e5e5', marginTop: '0.5rem' }}>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim() || !description.trim()}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: isSubmitting || !name.trim() || !description.trim() ? '#d6d3d1' : '#f59e0b',
                  color: 'white',
                  fontWeight: '600',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: isSubmitting || !name.trim() || !description.trim() ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting && name.trim() && description.trim()) {
                    e.currentTarget.style.backgroundColor = '#d97706';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting && name.trim() && description.trim()) {
                    e.currentTarget.style.backgroundColor = '#f59e0b';
                  }
                }}
              >
                {isSubmitting ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div
                      style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        borderRadius: '50%',
                        border: '2px solid transparent',
                        borderTopColor: 'white',
                        animation: 'spin 1s linear infinite',
                        marginRight: '0.5rem',
                      }}
                    ></div>
                    Creating Community...
                  </div>
                ) : (
                  'Create Community'
                )}
              </button>
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#78716c', marginTop: '0.75rem' }}>
                By creating this community, you agree to moderate it with care and compassion. 
                You can add co-moderators later.
              </p>
            </div>
          </form>
        </div>

        {/* Guidelines */}
        <div
          style={{
            marginTop: '2rem',
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            border: '1px solid #e5e5e5',
            padding: '1.25rem',
          }}
        >
          <h3 style={{ fontWeight: '600', color: '#1c1917', marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
            <span style={{ width: '0.25rem', height: '0.25rem', borderRadius: '50%', backgroundColor: '#f59e0b', marginRight: '0.5rem' }}></span>
            Community Guidelines
          </h3>
          <ul style={{ color: '#44403c', fontSize: '0.875rem', lineHeight: '1.5' }}>
            <li style={{ marginTop: '0.25rem' }}>• Your community should have a clear focus on a specific grief experience</li>
            <li style={{ marginTop: '0.25rem' }}>• You are responsible for creating a safe, inclusive space</li>
            <li style={{ marginTop: '0.25rem' }}>• Surviving Death Loss staff may reach out to help you moderate as your community grows</li>
            <li style={{ marginTop: '0.25rem' }}>• Communities that become inactive or harmful may be archived by staff</li>
          </ul>
        </div>
      </div>
    </div>
  );
}