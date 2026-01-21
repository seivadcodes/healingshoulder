'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';

const griefLabels = {
  parent: 'Loss of a Parent',
  child: 'Loss of a Child',
  spouse: 'Grieving a Partner',
  sibling: 'Loss of a Sibling',
  friend: 'Loss of a Friend',
  pet: 'Pet Loss',
  miscarriage: 'Pregnancy or Infant Loss',
  caregiver: 'Caregiver Grief',
  suicide: 'Suicide Loss',
  other: 'Other Loss',
};

type GriefType = keyof typeof griefLabels;

interface Angel {
  id: string;
  name: string;
  relationship?: string | null;
  photo_url?: string | null;
  birth_date?: string | null;
  death_date?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
  tribute?: string | null;
  grief_type: GriefType;
  other_loss_description?: string | null; // 👈 ADDED
  is_private: boolean;
  allow_comments: boolean;
}

interface AngelsProps {
  profileId: string;
  isOwner: boolean;
}

const AddAngelForm = ({
  profileId,
  onClose,
  onSaved,
}: {
  profileId: string;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [griefType, setGriefType] = useState<GriefType>('other');
  const [otherLossDescription, setOtherLossDescription] = useState(''); // 👈 ADDED
  const [tribute, setTribute] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [sunrise, setSunrise] = useState('');
  const [sunset, setSunset] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();

      let photoUrl = null;
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${profileId}/angels/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('angels-media')
          .upload(fileName, photoFile, { upsert: false });

        if (uploadError) throw uploadError;
        
        photoUrl = fileName;
      }

      const { error: insertError } = await supabase
        .from('angels')
        .insert({
          profile_id: profileId,
          name,
          relationship,
          grief_type: griefType,
          other_loss_description:
            griefType === 'other' ? (otherLossDescription.trim() || null) : null, // 👈 CONDITIONAL SAVE
          tribute,
          photo_url: photoUrl,
          is_private: isPrivate,
          allow_comments: allowComments,
          sunrise: sunrise || null,
          sunset: sunset || null,
        });

      if (insertError) throw insertError;

      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to create angel:', err);
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Remember Someone</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {error && <p style={{ color: '#d32f2f', marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
              Relationship (e.g., &quot;Mother&quot;, &quot;Best friend&quot;)
            </label>
            <input
              type="text"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
              Sunrise (optional)
            </label>
            <input
              type="date"
              value={sunrise}
              onChange={(e) => setSunrise(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
              Sunset (optional)
            </label>
            <input
              type="date"
              value={sunset}
              onChange={(e) => setSunset(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
              Grief Type *
            </label>
            <select
              value={griefType}
              onChange={(e) => setGriefType(e.target.value as GriefType)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            >
              {(Object.entries(griefLabels) as [GriefType, string][]).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 👇 CONDITIONAL INPUT FOR "OTHER" */}
          {griefType === 'other' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                Please describe this loss
              </label>
              <input
                type="text"
                value={otherLossDescription}
                onChange={(e) => setOtherLossDescription(e.target.value)}
                placeholder="e.g., Loss of a mentor, home, or community..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
              A Few Words in Tribute (optional)
            </label>
            <textarea
              value={tribute}
              onChange={(e) => setTribute(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
              Photo (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span style={{ marginLeft: '0.5rem' }}>Keep this memorial private</span>
            </label>
          </div>

          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label>
              <input
                type="checkbox"
                checked={allowComments}
                onChange={(e) => setAllowComments(e.target.checked)}
              />
              <span style={{ marginLeft: '0.5rem' }}>Allow kind words from others</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.5rem',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontWeight: '600',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.5rem',
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                opacity: saving ? 0.8 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Honor Their Memory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function Angels({ profileId, isOwner }: AngelsProps) {
  const [angels, setAngels] = useState<Angel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchAngels = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from('angels')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (!isOwner) {
      query = query.eq('is_private', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to load angels:', error);
      setAngels([]);
    } else {
      setAngels(data || []);
    }
    setLoading(false);
  }, [profileId, isOwner]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAngels();
  }, [fetchAngels]);

  if (loading) {
    return <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Loading memories...</p>;
  }

  const TRIBUTE_LIMIT = 200;

  const getAngelPhotoUrl = (photoUrl: string | null) => {
    if (!photoUrl) return null;
    if (photoUrl.startsWith('http')) {
      const urlParts = photoUrl.split('/');
      const bucketIndex = urlParts.indexOf('angels-media');
      if (bucketIndex !== -1) {
        const path = urlParts.slice(bucketIndex + 1).join('/');
        return `/api/media/angels-media/${path}`;
      }
    }
    return `/api/media/angels-media/${photoUrl}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {angels.length === 0 ? (
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', fontStyle: 'italic' }}>
          No loved ones remembered yet.
          {isOwner && ' Would you like to honor someone?'}
        </p>
      ) : (
        angels.map((angel) => {
          const shouldTruncate = angel.tribute && angel.tribute.length > TRIBUTE_LIMIT;
          const displayTribute = shouldTruncate
            ? angel.tribute!.substring(0, TRIBUTE_LIMIT) + '…'
            : angel.tribute;

          return (
            <Link
              key={angel.id}
              href={`/angel/${angel.id}`}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
              }}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  border: '1px solid #e2e8f0',
                  position: 'relative',
                  cursor: 'pointer',
                  maxWidth: '600px',
                }}
              >
                {isOwner && (
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/angel/${angel.id}`;
                    }}
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      background: '#f1f5f9',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    aria-label={`Edit memorial for ${angel.name}`}
                  >
                    <span style={{ fontSize: '0.9rem', color: '#64748b' }}>✏️</span>
                  </span>
                )}

                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0 }}>
                    {angel.photo_url ? (
                      <div style={{ width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden' }}>
                        <Image
                          src={getAngelPhotoUrl(angel.photo_url)!}
                          alt={angel.name}
                          width={96}
                          height={96}
                          style={{ objectFit: 'cover' }}
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '96px',
                          height: '96px',
                          borderRadius: '50%',
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          color: '#475569',
                          fontSize: '1.75rem',
                        }}
                      >
                        {angel.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.25rem', fontWeight: '600', color: '#1e293b', wordBreak: 'break-word' }}>
                      {angel.name}
                    </h4>
                    {angel.relationship && (
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#64748b' }}>
                        {angel.relationship}
                      </p>
                    )}

                    {/* 👇 DISPLAY CUSTOM LOSS DESCRIPTION IF APPLICABLE */}
                    {angel.grief_type === 'other' ? (
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic' }}>
                        {angel.other_loss_description || 'Other loss'}
                      </p>
                    ) : (
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#64748b' }}>
                        {griefLabels[angel.grief_type]}
                      </p>
                    )}

                    {displayTribute && (
  <p
    style={{
      margin: 0,
      fontSize: '0.95rem',
      color: '#334155',
      marginBottom: '0.75rem',
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
      hyphens: 'auto',
    }}
  >
    {displayTribute}
    {shouldTruncate && (
      <span style={{ fontWeight: '600', color: '#dc2626', marginLeft: '0.25rem' }}>
        Read more
      </span>
    )}
  </p>
)}

                    {(angel.sunrise || angel.sunset) && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {angel.sunrise && (
                          <span
                            style={{
                              background: '#f0fdf4',
                              color: '#166534',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '12px',
                              fontSize: '0.825rem',
                              fontWeight: '600',
                              border: '1px solid #bbf7d0',
                            }}
                          >
                            Sunrise: {angel.sunrise}
                          </span>
                        )}
                        {angel.sunset && (
                          <span
                            style={{
                              background: '#fdf2f8',
                              color: '#9d174d',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '12px',
                              fontSize: '0.825rem',
                              fontWeight: '600',
                              border: '1px solid #fbcfe8',
                            }}
                          >
                            Sunset: {angel.sunset}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })
      )}

      {isOwner && (
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            background: '#f0fdf4',
            color: '#166534',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          + Remember Someone
        </button>
      )}

      {showAddForm && (
        <AddAngelForm
          profileId={profileId}
          onClose={() => setShowAddForm(false)}
          onSaved={fetchAngels}
        />
      )}
    </div>
  );
}