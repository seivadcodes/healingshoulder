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
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      setStartTime(now.toISOString().slice(0, 16));
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
      const localDateTime = new Date(startTime);
      const utcISO = localDateTime.toISOString();

      // Create event first
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

      // Update with image URL if available
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => router.back()}
          className="text-gray-600 text-sm mb-4 flex items-center"
        >
          ← Back to schedule
        </button>

        <h1 className="text-2xl font-bold text-gray-800 mb-6">Create a New Event</h1>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}
        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4">
            Event created! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Image Upload */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Event Image (optional)
            </label>
            <div
              onClick={triggerFileInput}
              className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="mx-auto max-h-40 rounded-lg object-cover"
                />
              ) : (
                <div className="text-gray-500">
                  <p>Click to upload an image (max 5MB)</p>
                  <p className="text-xs mt-1">JPG, PNG, or GIF</p>
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Event Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g., Evening Grief Circle"
              required
            />
          </div>

          {/* Host Name */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Host Name *</label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g., Maria or Grief Support Team"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="What will happen? Who is it for?"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Start Time (your local time) *
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Saved in UTC — shown in each user’s local time.
            </p>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Duration (minutes) *</label>
            <input
              type="number"
              min="10"
              max="240"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Grief Types */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Grief Type(s) *</label>
            <div className="flex flex-wrap gap-2">
              {GRIEF_TYPES.map((type) => {
                const label = type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleGriefType(type)}
                    className={`px-3 py-2 text-sm rounded-full border transition ${
                      selectedGriefTypes.includes(type)
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {selectedGriefTypes.length === 0 && (
              <p className="text-red-600 text-sm mt-1">Please select at least one grief type.</p>
            )}
          </div>

          {/* Recurring */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="recurring" className="ml-2 text-gray-700">
              This is a recurring event
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
}