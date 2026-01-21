'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AddMemoryModal from '@/components/angels/AddMemoryModal';
import HeartsAndComments from '@/components/angels/HeartsAndComments';

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
  profile_id: string;
  name: string;
  relationship?: string | null;
  photo_url?: string | null;
  birth_date?: string | null;
  death_date?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
  tribute?: string | null;
  grief_type: GriefType;
  is_private: boolean;
  allow_comments: boolean;
}

interface AngelMemory {
  id: string;
  photo_url: string;
  caption?: string | null;
  profile_id: string;
}

// Edit Memory Modal Component
interface EditMemoryModalProps {
  memory: AngelMemory;
  angelId: string;
  onClose: () => void;
  onSaved: () => void;
}

const EditMemoryModal = ({ memory, angelId, onClose, onSaved }: EditMemoryModalProps) => {
  const [caption, setCaption] = useState(memory.caption || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (memory.photo_url) {
      const url = getAngelMediaUrl(memory.photo_url);
      setPreviewUrl(url);
    }
  }, [memory.photo_url]);

  const getAngelMediaUrl = (photoUrl: string | null) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();

      let photoUrl = memory.photo_url;
      
      // Handle new photo upload
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${memory.profile_id}/memories/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('angels-media')
          .upload(fileName, photoFile, { upsert: false });

        if (uploadError) throw uploadError;
        
        photoUrl = fileName;
      }

      const { error: updateError } = await supabase
        .from('angel_memories')
        .update({
          caption: caption || null,
          photo_url: photoUrl,
        })
        .eq('id', memory.id);

      if (updateError) throw updateError;

      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error('Failed to update memory:', err);
      setError('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this memory? This action cannot be undone.')) {
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      
      // Delete the memory
      const { error: memoryError } = await supabase
        .from('angel_memories')
        .delete()
        .eq('id', memory.id);

      if (memoryError) throw memoryError;

      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error('Failed to delete memory:', err);
      setError('Could not delete memory. Please try again.');
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
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '1.75rem',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>Edit Memory</h3>
          <button
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '1.5rem', 
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            &times;
          </button>
        </div>

        {error && (
          <div style={{ 
            background: '#fef2f2', 
            color: '#dc2626', 
            padding: '0.75rem', 
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {previewUrl && (
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <div style={{ 
                width: '200px', 
                height: '200px', 
                borderRadius: '12px', 
                overflow: 'hidden',
                border: '1px solid #e2e8f0'
              }}>
                <Image
                  src={previewUrl}
                  alt="Memory"
                  width={200}
                  height={200}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                  unoptimized
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155' }}>
              Caption (optional)
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Add a caption for this memory..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '1rem',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155' }}>
              Change Photo (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPhotoFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                }
              }}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div style={{ 
            borderTop: '1px solid #e2e8f0', 
            paddingTop: '1rem',
            marginTop: '1rem'
          }}>
            <button
              type="button"
              onClick={handleDelete}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Delete Memory
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Angel Modal Component (unchanged from original)
interface EditAngelModalProps {
  angel: Angel;
  onClose: () => void;
  onSaved: (updatedAngel: Angel) => void;
}

const EditAngelModal = ({ angel, onClose, onSaved }: EditAngelModalProps) => {
  const [formData, setFormData] = useState({
    name: angel.name,
    relationship: angel.relationship || '',
    griefType: angel.grief_type,
    tribute: angel.tribute || '',
    sunrise: angel.sunrise || '',
    sunset: angel.sunset || '',
    isPrivate: angel.is_private,
    allowComments: angel.allow_comments,
  });
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (angel.photo_url) {
      const url = getAngelMediaUrl(angel.photo_url);
      setPreviewUrl(url);
    }
  }, [angel.photo_url]);

  const getAngelMediaUrl = (photoUrl: string | null) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();

      let photoUrl = angel.photo_url;
      
      // Handle new photo upload
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${angel.profile_id}/angels/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('angels-media')
          .upload(fileName, photoFile, { upsert: false });

        if (uploadError) throw uploadError;
        
        photoUrl = fileName;
      }

      const { data, error: updateError } = await supabase
        .from('angels')
        .update({
          name: formData.name,
          relationship: formData.relationship || null,
          grief_type: formData.griefType,
          tribute: formData.tribute || null,
          photo_url: photoUrl,
          is_private: formData.isPrivate,
          allow_comments: formData.allowComments,
          sunrise: formData.sunrise || null,
          sunset: formData.sunset || null,
        })
        .eq('id', angel.id)
        .select()
        .single();

      if (updateError) throw updateError;

      onSaved(data);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to update angel:', err);
      setError('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this memorial? This action cannot be undone.')) {
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      
      // Delete associated memories first
      const { error: memoriesError } = await supabase
        .from('angel_memories')
        .delete()
        .eq('angel_id', angel.id);

      if (memoriesError) throw memoriesError;

      // Delete the angel
      const { error: angelError } = await supabase
        .from('angels')
        .delete()
        .eq('id', angel.id);

      if (angelError) throw angelError;

      // Redirect to profile page
      window.location.href = `/profile/${angel.profile_id}`;
    } catch (err: unknown) {
      console.error('Failed to delete angel:', err);
      setError('Could not delete memorial. Please try again.');
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
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '1.75rem',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>Edit Memorial</h3>
          <button
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '1.5rem', 
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            &times;
          </button>
        </div>

        {error && (
          <div style={{ 
            background: '#fef2f2', 
            color: '#dc2626', 
            padding: '0.75rem', 
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155' }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155' }}>
              Relationship
            </label>
            <input
              type="text"
              value={formData.relationship}
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
              placeholder="e.g., Mother, Best friend"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155' }}>
              Sunrise (optional)
            </label>
            <input
              type="date"
              value={formData.sunrise}
              onChange={(e) => setFormData({ ...formData, sunrise: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155' }}>
              Sunset (optional)
            </label>
            <input
              type="date"
              value={formData.sunset}
              onChange={(e) => setFormData({ ...formData, sunset: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155' }}>
              Grief Type *
            </label>
            <select
              value={formData.griefType}
              onChange={(e) => setFormData({ ...formData, griefType: e.target.value as GriefType })}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '1rem',
                background: 'white',
              }}
            >
              {(Object.entries(griefLabels) as [GriefType, string][]).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155' }}>
              Tribute (optional)
            </label>
            <textarea
              value={formData.tribute}
              onChange={(e) => setFormData({ ...formData, tribute: e.target.value })}
              rows={3}
              placeholder="Share a few words in tribute..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '1rem',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155' }}>
              Photo
            </label>
            {previewUrl && (
              <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ 
                  width: '120px', 
                  height: '120px', 
                  borderRadius: '50%', 
                  overflow: 'hidden',
                  marginBottom: '0.5rem'
                }}>
                  <Image
                    src={previewUrl}
                    alt="Current"
                    width={120}
                    height={120}
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPreviewUrl(null);
                    setFormData({ ...formData }); // Trigger re-render
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#64748b',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Remove Photo
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPhotoFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                }
              }}
              style={{ width: '100%' }}
            />
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
              Upload a new photo or keep the current one
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={formData.isPrivate}
                onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
              />
              <span style={{ color: '#334155' }}>Keep this memorial private</span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={formData.allowComments}
                onChange={(e) => setFormData({ ...formData, allowComments: e.target.checked })}
              />
              <span style={{ color: '#334155' }}>Allow kind words from others</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div style={{ 
            borderTop: '1px solid #e2e8f0', 
            paddingTop: '1rem',
            marginTop: '1rem'
          }}>
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Delete Memorial
            </button>
          </div>
        </form>

        {deleteConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '90%',
            }}>
              <h4 style={{ margin: '0 0 1rem', color: '#1e293b' }}>
                Delete Memorial?
              </h4>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                Are you sure you want to delete this memorial? This action cannot be undone and will remove all memories and comments associated with it.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Component
export default function AngelDetailPage() {
  const params = useParams<{ id: string }>();
  const [angel, setAngel] = useState<Angel | null>(null);
  const [memories, setMemories] = useState<AngelMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMemoryModalOpen, setIsAddMemoryModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [expandedMemories, setExpandedMemories] = useState<Set<string>>(new Set());
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserProfileId(user.id);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchAngelAndMemories = async () => {
      const { id } = params;

      if (!id || typeof id !== 'string') {
        setError('Invalid memorial ID.');
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        const { data: angelData, error: angelError } = await supabase
          .from('angels')
          .select('*')
          .eq('id', id)
          .single();

        if (angelError) throw angelError;

        const { data: memoryData, error: memoryError } = await supabase
          .from('angel_memories')
          .select('id, photo_url, caption, profile_id')
          .eq('angel_id', id)
          .order('created_at', { ascending: false });

        if (memoryError) {
          console.warn('Failed to load memories:', memoryError);
        }

        setAngel(angelData);
        setMemories(memoryData || []);
      } catch (err: unknown) {
        console.error('Failed to load angel:', err);
        setError('Memorial not found or access denied.');
      } finally {
        setLoading(false);
      }
    };

    fetchAngelAndMemories();
  }, [params.id]);

  const refetchMemories = async () => {
    if (!angel) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('angel_memories')
      .select('id, photo_url, caption, profile_id')
      .eq('angel_id', angel.id)
      .order('created_at', { ascending: false });
    setMemories(data || []);
  };

  const getAngelMediaUrl = (photoUrl: string | null) => {
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

  const toggleExpand = (memoryId: string) => {
    setExpandedMemories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memoryId)) {
        newSet.delete(memoryId);
      } else {
        newSet.add(memoryId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading memorial...
      </div>
    );
  }

  if (error || !angel) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
        {error}
      </div>
    );
  }

  const isOwner = currentUserProfileId === angel.profile_id;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '4.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Link
          href={`/profile/${angel.profile_id}`}
          style={{
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '0.95rem',
            fontWeight: '600',
          }}
        >
          ← Back to profile
        </Link>
        
        {isOwner && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            style={{
              background: 'none',
              border: '1px solid #3b82f6',
              color: '#3b82f6',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>✏️</span> Edit Memorial
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Memorial Info */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              position: 'relative',
            }}
          >
            {isOwner && angel.is_private && (
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#fef3c7',
                color: '#92400e',
                padding: '0.25rem 0.75rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}>
                <span>🔒</span> Private
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              {angel.photo_url ? (
                <div style={{ width: '130px', height: '130px', borderRadius: '50%', overflow: 'hidden' }}>
                  <Image
                    src={getAngelMediaUrl(angel.photo_url)!}
                    alt={angel.name}
                    width={130}
                    height={130}
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: '130px',
                    height: '130px',
                    borderRadius: '50%',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '3rem',
                    color: '#64748b',
                  }}
                >
                  {angel.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <h1 style={{ margin: '0 0 0.25rem', fontSize: '2rem', color: '#1e293b' }}>
                  {angel.name}
                </h1>
                {angel.relationship && (
                  <p style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: '#64748b' }}>
                    {angel.relationship}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: '1rem', color: '#94a3b8' }}>
                  {griefLabels[angel.grief_type]}
                </p>
              </div>
            </div>

            {angel.tribute && (
             <div style={{ marginTop: '1.75rem', padding: '1.25rem', background: '#f9fafb', borderRadius: '10px' }}>
    <blockquote
  style={{
    margin: 0,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 1.7,
    fontSize: '1.05rem',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    hyphens: 'auto',
  }}
>
  &ldquo;{angel.tribute}&rdquo;
</blockquote>
  </div>
            )}

            {(angel.sunrise || angel.sunset) && (
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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

            {!angel.is_private && (
              <HeartsAndComments
                itemId={angel.id}
                itemType="angel"
                allowComments={angel.allow_comments}
                styleOverrides={{ 
                  marginTop: '1.5rem',
                  padding: '0.5rem',
                  borderRadius: '8px'
                }}
              />
            )}
          </div>
        </div>

        {/* Gallery & Add Button */}
        <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {isOwner && (
            <button
              onClick={() => setIsAddMemoryModalOpen(true)}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <span>➕</span> Add Memory
            </button>
          )}

          {memories.length > 0 ? (
            <div
              style={{
                background: '#fff',
                borderRadius: '12px',
                padding: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                border: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#1e293b' }}>
                Shared Memories
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {memories.map((memory) => {
                  const memoryUrl = getAngelMediaUrl(memory.photo_url);
                  const isMemoryOwner = currentUserProfileId === memory.profile_id;
                  const isExpanded = expandedMemories.has(memory.id);
                  const shouldShowReadMore = memory.caption && memory.caption.split(' ').length > 25;
                  
                  return (
                    <div
                      key={memory.id}
                      style={{
                        background: '#f9fafb',
                        borderRadius: '10px',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        position: 'relative',
                      }}
                    >
                      {isMemoryOwner && (
                        <button
                          onClick={() => setEditingMemoryId(memory.id)}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(255,255,255,0.8)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 10,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                          aria-label="Edit memory"
                        >
                          ✏️
                        </button>
                      )}
                      
                      <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                        {memoryUrl && (
                          <Image
                            src={memoryUrl}
                            alt={`Memory for ${angel.name}`}
                            width={280}
                            height={280}
                            style={{
                              borderRadius: '8px',
                              objectFit: 'contain',
                              width: '100%',
                              aspectRatio: '1',
                            }}
                            unoptimized
                          />
                        )}
                      </div>

                      {memory.caption && (
  <div style={{ marginTop: '8px', position: 'relative' }}>
    <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155',  overflowWrap: 'break-word', lineHeight: 1.5 }}>
      {isExpanded
        ? memory.caption
        : memory.caption.length > 120
          ? memory.caption.substring(0, 120) + '...'
          : memory.caption}
    </p>
    {memory.caption.length > 120 && !isExpanded && (
      <button
        onClick={() => toggleExpand(memory.id)}
        style={{
          background: 'none',
          border: 'none',
          color: '#3b82f6',
          fontWeight: '500',
          fontSize: '0.85rem',
          cursor: 'pointer',
          marginTop: '4px',
        }}
      >
        Read more
      </button>
    )}
  </div>
)}
                      <HeartsAndComments
                        itemId={memory.id}
                        itemType="memory"
                        allowComments={true}
                        styleOverrides={{
                          marginTop: '16px',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center',
                color: '#94a3b8',
              }}
            >
              {isOwner ? (
                <>
                  <p style={{ margin: '0 0 1rem' }}>No shared memories yet.</p>
                  <button
                    onClick={() => setIsAddMemoryModalOpen(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Add First Memory
                  </button>
                </>
              ) : (
                'No shared memories yet.'
              )}
            </div>
          )}
        </div>
      </div>

      {isAddMemoryModalOpen && angel && (
        <AddMemoryModal
          angelId={angel.id}
          angelName={angel.name}
          onClose={() => setIsAddMemoryModalOpen(false)}
          onMemoryAdded={refetchMemories}
        />
      )}

      {isEditModalOpen && angel && (
        <EditAngelModal
          angel={angel}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={(updatedAngel) => {
            setAngel(updatedAngel);
            setIsEditModalOpen(false);
          }}
        />
      )}

      {editingMemoryId && (
        <EditMemoryModal
          memory={memories.find(m => m.id === editingMemoryId)!}
          angelId={angel.id}
          onClose={() => setEditingMemoryId(null)}
          onSaved={refetchMemories}
        />
      )}
    </div>
  );
}