// src/app/schedule/create/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const GRIEF_TYPES = [
  'loss_of_parent',
  'loss_of_child',
  'loss_of_spouse',
  'loss_of_sibling',
  'loss_of_friend',
  'suicide_loss',
  'pet_loss',
  'miscarriage',
  'anticipatory_grief',
  'other',
];

// Helper to format Date to local YYYY-MM-DDTHH:mm (for datetime-local input)
const formatDateToLocalInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function CreateEventPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hostName, setHostName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [selectedGriefTypes, setSelectedGriefTypes] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  // Initialize user & defaults
  useEffect(() => {
    const init = async () => {
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (authError || !session?.user) {
        router.push('/auth');
        return;
      }

      setUserId(session.user.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) {
        router.push('/setup-profile');
        return;
      }

      setHostName(profile.full_name || 'Host');

      // ✅ FIXED: Set default start time to LOCAL time +30 min
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      setStartTime(formatDateToLocalInput(now));
    };

    init();
  }, [supabase, router]);

  const toggleGriefType = (type: string) => {
    setSelectedGriefTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB.');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image (jpg, png, etc.).');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (file: File, eventId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${eventId}.${fileExt}`;
    const filePath = `event-images/${fileName}`;

    const { error } = await supabase.storage
      .from('event-images')
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error('Image upload error:', error);
      throw new Error('Failed to upload event image.');
    }

    const { data } = supabase.storage.from('event-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    const cleanHostName = hostName.trim();
    const hasValidTime = startTime && !isNaN(new Date(startTime).getTime());

    if (!cleanTitle || !cleanHostName || !hasValidTime || selectedGriefTypes.length === 0) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!userId) {
      setError('User not authenticated.');
      return;
    }

    setLoading(true);

    try {
      // ✅ Now: startTime is a LOCAL time string (e.g., "2026-01-02T19:12")
      // new Date(startTime) interprets it as LOCAL → then .toISOString() converts to UTC
      const localDateTime = new Date(startTime);
      const utcISO = localDateTime.toISOString();

      const { data, error: insertError } = await supabase
        .from('events')
        .insert({
          title: cleanTitle,
          description: description.trim() || null,
          host_id: userId,
          host_name: cleanHostName,
          start_time: utcISO,
          duration: duration,
          grief_types: selectedGriefTypes,
          is_recurring: isRecurring,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error('Event creation failed.');

      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, data.id);
      }

      if (imageUrl) {
        const { error: updateError } = await supabase
          .from('events')
          .update({ image_url: imageUrl })
          .eq('id', data.id);

        if (updateError) {
          console.warn('Failed to update image URL:', updateError);
        }
      }

      setSuccess(true);
      setTimeout(() => router.push('/schedule'), 1500);
    } catch (err: any) {
      console.error('Event creation error:', err);
      setError(err.message || 'Unable to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Helper: format grief type label
  const formatGriefType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #ffffff, #f9fafb, #f5f5f5)',
        padding: '1rem',
        paddingBottom: '6rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '32rem' }}>
        <button
          onClick={() => router.back()}
          style={{
            color: '#4b5563',
            fontSize: '0.875rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ← Back to schedule
        </button>

        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', marginBottom: '1.5rem' }}>
          Create a New Event
        </h1>

        {error && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              color: '#047857',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            Event created! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Image Upload */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
              Event Image (optional)
            </label>
            <div
              onClick={triggerFileInput}
              style={{
                border: '2px dashed #d1d5db',
                borderRadius: '0.75rem',
                padding: '1rem',
                textAlign: 'center' as const,
                cursor: 'pointer',
                backgroundColor: '#ffffff',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    maxHeight: '10rem',
                    borderRadius: '0.5rem',
                    objectFit: 'cover',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                  }}
                />
              ) : (
                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  <p>Click to upload an image (max 5MB)</p>
                  <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: '#9ca3af' }}>
                    JPG, PNG, or GIF
                  </p>
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
          </div>

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
              Event Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
              placeholder="e.g., Evening Grief Circle"
              required
            />
          </div>

          {/* Host Name */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
              Host Name *
            </label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
              placeholder="e.g., Maria or Grief Support Team"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
              placeholder="What will happen? Who is it for?"
            />
          </div>

          {/* Start Time */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
              Start Time (your local time) *
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
              required
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Saved in UTC — shown in each user’s local time.
            </p>
          </div>

          {/* Duration */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
              Duration (minutes) *
            </label>
            <input
              type="number"
              min="10"
              max="240"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Grief Types */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
              Grief Type(s) *
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {GRIEF_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleGriefType(type)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    border: selectedGriefTypes.includes(type)
                      ? '1px solid #3b82f6'
                      : '1px solid #d1d5db',
                    borderRadius: '9999px',
                    backgroundColor: selectedGriefTypes.includes(type)
                      ? '#eff6ff'
                      : '#f3f4f6',
                    color: selectedGriefTypes.includes(type) ? '#1d4ed8' : '#374151',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {formatGriefType(type)}
                </button>
              ))}
            </div>
            {selectedGriefTypes.length === 0 && (
              <p style={{ color: '#ef4444', fontSize: '0.75rem' }}>
                Please select at least one grief type.
              </p>
            )}
          </div>

          {/* Recurring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              style={{
                width: '1rem',
                height: '1rem',
                accentColor: '#3b82f6',
              }}
            />
            <label htmlFor="recurring" style={{ color: '#374151', fontSize: '0.875rem' }}>
              This is a recurring event
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              backgroundColor: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              fontWeight: '600',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              marginTop: '0.5rem',
            }}
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
}