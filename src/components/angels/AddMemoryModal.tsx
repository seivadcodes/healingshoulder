'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';

interface AddMemoryModalProps {
  angelId: string;
  angelName: string;
  onClose: () => void;
  onMemoryAdded: () => void;
}

const STORAGE_BUCKET = 'angels-media';

export default function AddMemoryModal({
  angelId,
  angelName,
  onClose,
  onMemoryAdded,
}: AddMemoryModalProps) {
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file (JPEG, PNG, etc.).');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select an image.');
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(false);
    try {
      const supabase = createClient();
      const fileName = `memories/${angelId}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, selectedFile);
      if (uploadError) throw uploadError;

      // ✅ Correct: store only the path (fileName), NOT public URL
      const { error: dbError } = await supabase
        .from('angel_memories')
        .insert({
          angel_id: angelId,
          profile_id: (await supabase.auth.getUser()).data.user?.id,
          photo_url: fileName, // ✅ path only
          caption: caption.trim() || null,
        });
      if (dbError) throw dbError;

      setSuccess(true);
      onMemoryAdded();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to add memory:', err);
      setError('Failed to save memory. Please try again.');
    } finally {
      setUploading(false);
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
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
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
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.5rem', color: '#1e293b' }}>
          Add a Memory for {angelName}
        </h2>
        {success ? (
          <div style={{ color: '#10b981', textAlign: 'center', padding: '1rem' }}>✅ Memory added successfully!</div>
        ) : (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="memory-image"
                style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: '#334155',
                }}
              >
                Upload Photo
              </label>
              <input
                id="memory-image"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ width: '100%' }}
              />
              {selectedFile && (
                <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="memory-caption"
                style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: '#334155',
                }}
              >
                Caption (optional)
              </label>
              <textarea
                id="memory-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Share a few words about this memory..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            {error && (
              <div style={{ color: '#d32f2f', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={uploading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedFile || uploading}
                style={{
                  padding: '0.5rem 1rem',
                  background: uploading ? '#94a8bd' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                }}
              >
                {uploading ? 'Adding...' : 'Add Memory'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}