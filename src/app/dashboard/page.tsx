// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Heart,
  MessageCircle,
  Users,
  Edit,
  Send,
  Camera,
  X,
  Settings,
  ToggleLeft,
  User,
  MapPin,
  Globe,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// --- Types ---
type GriefType =
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

const griefTypeLabels: Record<GriefType, string> = {
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

interface UserProfile {
  griefTypes: GriefType[];
  avatarUrl?: string;
}

interface UserPreferences {
  acceptsCalls: boolean;
  acceptFromGenders?: ('male' | 'female' | 'nonbinary' | 'any')[];
  acceptFromCountries?: string[];
  acceptFromLanguages?: string[];
  isAnonymous: boolean;
}

interface Post {
  id: string;
  text: string;
  mediaUrls?: string[];
  griefTypes: GriefType[];
  createdAt: Date;
  likes: number;
}

// --- Component ---
export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    acceptsCalls: true,
    acceptFromGenders: ['any'],
    acceptFromCountries: [],
    acceptFromLanguages: [],
    isAnonymous: true,
  });
  const [showGriefSetup, setShowGriefSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGriefTypes, setSelectedGriefTypes] = useState<GriefType[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [onlineCount, setOnlineCount] = useState(87);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch real user profile from Supabase ---
  useEffect(() => {
    let isSubscribed = true; // prevent state update on unmounted component

    const fetchProfile = async () => {
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (!isSubscribed) return;
      if (authError || !session?.user) {
        console.error('Auth error or no session:', authError);
        router.push('/auth');
        setIsLoading(false);
        return;
      }

      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!isSubscribed) return;
      if (dbError) {
        console.warn('No profile found. Showing grief setup.');
        if (isSubscribed) {
          setShowGriefSetup(true);
          setIsLoading(false);
        }
        return;
      }

      // Map Supabase row → UI state
      const griefTypes = (data.grief_types || []) as GriefType[];
      setProfile({
        griefTypes,
        avatarUrl: data.avatar_url || undefined,
      });

      setPreferences({
        acceptsCalls: data.accepts_calls ?? true,
        acceptFromGenders: data.accept_from_genders || ['any'],
        acceptFromCountries: data.accept_from_countries || [],
        acceptFromLanguages: data.accept_from_languages || [],
        isAnonymous: data.is_anonymous ?? true,
      });

      if (griefTypes.length === 0) {
        setShowGriefSetup(true);
      }

      setIsLoading(false);
    };

    fetchProfile();

    return () => {
      isSubscribed = false;
    };
  }, [router]);

  // --- Fetch posts after profile loads ---
  useEffect(() => {
    if (!profile || isLoading) return;

    const loadPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to fetch posts:', error);
        return;
      }

      const mapped = data.map((p) => ({
        id: p.id,
        text: p.text,
        mediaUrls: p.media_urls || undefined,
        griefTypes: p.grief_types as GriefType[],
        createdAt: new Date(p.created_at),
        likes: p.likes_count || 0,
      }));

      setPosts(mapped);
    };

    loadPosts();
  }, [profile, isLoading]);

  // --- Simulate online count (replace later with real-time) ---
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount((prev) => Math.max(10, prev + (Math.random() > 0.5 ? 1 : -1)));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const toggleGriefType = (type: GriefType) => {
    setSelectedGriefTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const saveProfileToDB = async (updates: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      updated_at: new Date().toISOString(),
      ...updates,
    });

    if (error) {
      console.error('Profile save error:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const handleSaveGriefTypes = async () => {
    if (selectedGriefTypes.length === 0) {
      alert('Please select at least one type of loss.');
      return;
    }
    await saveProfileToDB({ grief_types: selectedGriefTypes });
    setProfile((prev) => ({ ...prev!, griefTypes: selectedGriefTypes }));
    setShowGriefSetup(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPreviews = Array.from(files).map((file) => URL.createObjectURL(file));
    setMediaPreviews((prev) => [...prev, ...newPreviews].slice(0, 4));
  };

  const removeMedia = (index: number) => {
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePostSubmit = async () => {
    if (!newPostText.trim() || !profile) return;
    setIsSubmitting(true);

    let mediaUrls: string[] = [];
    const files = fileInputRef.current?.files;
    if (files && files.length > 0) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uploadPromises = Array.from(files).map(async (file) => {
          const path = `posts/${session?.user.id}/${Date.now()}-${file.name}`;
          const { error } = await supabase.storage.from('posts').upload(path, file);
          if (error) throw error;
          const { data } = supabase.storage.from('posts').getPublicUrl(path);
          return data.publicUrl;
        });
        mediaUrls = await Promise.all(uploadPromises);
      } catch (err) {
        console.error('Media upload failed:', err);
        alert('Failed to upload media. Post saved without images.');
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('posts').insert({
      user_id: session?.user.id,
      text: newPostText.trim(),
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      grief_types: profile.griefTypes,
      is_anonymous: preferences.isAnonymous,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Post creation error:', error);
      alert('Failed to share post. Please try again.');
      setIsSubmitting(false);
      return;
    }

    // Optimistic UI update
    const newPost: Post = {
      id: `post-${Date.now()}`,
      text: newPostText,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      griefTypes: [...profile.griefTypes],
      createdAt: new Date(),
      likes: 0,
    };
    setPosts([newPost, ...posts]);

    setNewPostText('');
    setMediaPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsSubmitting(false);
  };

  const toggleAcceptsCalls = async () => {
    const newValue = !preferences.acceptsCalls;
    setPreferences((prev) => ({ ...prev, acceptsCalls: newValue }));
    await saveProfileToDB({ accepts_calls: newValue });
  };

  const toggleAnonymity = async () => {
    const newValue = !preferences.isAnonymous;
    setPreferences((prev) => ({ ...prev, isAnonymous: newValue }));
    await saveProfileToDB({ is_anonymous: newValue });
  };

  // ——— LOADING ———
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-600">Loading your space...</p>
      </div>
    );
  }

  // ——— GRIEF SETUP MODAL ———
  if (showGriefSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 p-4 flex flex-col items-center justify-start">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-medium text-stone-800 text-center mb-2">
            What losses are you carrying?
          </h1>
          <p className="text-stone-600 text-center mb-6">
            You can choose more than one. This helps us connect you with the right people.
          </p>
          <div className="space-y-3 mb-6">
            {(Object.keys(griefTypeLabels) as GriefType[]).map((type) => (
              <button
                key={type}
                onClick={() => toggleGriefType(type)}
                className={`w-full text-left p-4 rounded-lg border transition ${
                  selectedGriefTypes.includes(type)
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-stone-200 bg-white text-stone-800'
                }`}
              >
                {griefTypeLabels[type]}
                {selectedGriefTypes.includes(type) && (
                  <span className="ml-2 text-amber-600">✓</span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={handleSaveGriefTypes}
            disabled={selectedGriefTypes.length === 0}
            className={`w-full py-3 rounded-full font-medium ${
              selectedGriefTypes.length > 0
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            Save & Continue
          </button>
          <p className="text-center text-xs text-stone-500 mt-4">
            You can edit this anytime in Settings.
          </p>
        </div>
      </div>
    );
  }

  // ——— SETTINGS ———
  if (showSettings) {
    return (
      <div className="min-h-screen bg-stone-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-stone-800">Settings</h2>
            <button
              onClick={() => setShowSettings(false)}
              className="text-stone-500 hover:text-stone-700"
            >
              ✕
            </button>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-stone-800 mb-2">Your Grief Context</h3>
            <p className="text-sm text-stone-600 mb-2">
              {profile?.griefTypes.map((t) => griefTypeLabels[t]).join(', ') || 'Not set'}
            </p>
            <button
              onClick={() => {
                setSelectedGriefTypes(profile?.griefTypes || []);
                setShowGriefSetup(true);
                setShowSettings(false);
              }}
              className="text-amber-600 text-sm hover:underline"
            >
              Edit grief types
            </button>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer" onClick={toggleAcceptsCalls}>
              <ToggleLeft
                className={`w-10 h-5 rounded-full p-1 ${
                  preferences.acceptsCalls
                    ? 'bg-amber-500 text-white'
                    : 'bg-stone-300 text-stone-500'
                }`}
              />
              <span className="text-stone-800">
                {preferences.acceptsCalls ? 'Accepting calls' : 'Not accepting calls'}
              </span>
            </label>
            <p className="text-xs text-stone-500 mt-1">
              When off, you won’t appear in matches.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-stone-800 mb-2">Who can connect with you?</h3>
            <div className="space-y-2 text-sm text-stone-600">
              <div className="flex items-center gap-2">
                <User size={14} className="text-stone-500" />
                <span>Any gender</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-stone-500" />
                <span>Any country</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-stone-500" />
                <span>Any language</span>
              </div>
            </div>
            <p className="text-xs text-stone-500 mt-2">Advanced filters coming soon.</p>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 text-stone-800 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.isAnonymous}
                onChange={toggleAnonymity}
                className="form-checkbox h-4 w-4 text-amber-600 rounded"
              />
              <span>Post and call anonymously</span>
            </label>
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className="w-full py-3 bg-stone-800 text-white rounded-lg font-medium"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ——— MAIN DASHBOARD ———
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 p-4 md:p-6 pb-24 pt-6 md:pt-[120px]">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-stone-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-sm font-medium text-stone-600 mb-1">Your grief context</h2>
              <div className="flex flex-wrap gap-2">
                {profile?.griefTypes.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-sm px-3 py-1.5 rounded-full"
                  >
                    <Heart size={12} />
                    {griefTypeLabels[type]}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 text-stone-600 hover:text-stone-900 rounded-full hover:bg-stone-200"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
          <button
            onClick={() => setShowGriefSetup(true)}
            className="mt-3 text-xs text-amber-600 hover:underline flex items-center gap-1"
          >
            <Edit size={12} />
            Edit or add another loss
          </button>
        </div>

        <div className="text-center">
          <p className="text-stone-600">Your grief is seen here.</p>
          <div className="mt-2 inline-flex items-center gap-2 bg-green-100 px-4 py-1.5 rounded-full text-sm font-medium text-green-800">
            <Heart size={14} className="text-green-600" />
            {onlineCount} people online now
          </div>
        </div>

        <section className="bg-white p-4 rounded-xl border border-stone-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={18} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="What’s in your heart today?"
                className="w-full p-2 text-stone-800 placeholder-stone-500 focus:outline-none resize-none"
                rows={3}
                disabled={isSubmitting}
              />

              {mediaPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {mediaPreviews.map((url, i) => (
                    <div key={i} className="relative w-16 h-16">
                      <img
                        src={url}
                        alt="Preview"
                        className="w-full h-full object-cover rounded"
                      />
                      <button
                        onClick={() => removeMedia(i)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center mt-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-stone-600 hover:text-amber-600 text-sm"
                  disabled={isSubmitting}
                >
                  <Camera size={14} />
                  Photo/Video
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                />
                <button
                  onClick={handlePostSubmit}
                  disabled={!newPostText.trim() || isSubmitting}
                  className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium ${
                    newPostText.trim() && !isSubmitting
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'Sharing...' : 'Share'}
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-stone-800 mb-3">In Your Communities</h2>
          {posts.length === 0 ? (
            <p className="text-stone-500 text-sm">No posts yet. Be the first to share.</p>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="bg-white p-4 rounded-lg border border-stone-200">
                  <p className="text-stone-800 mb-2">{post.text}</p>
                  {post.mediaUrls && (
                    <div className="flex gap-2 mt-2">
                      {post.mediaUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="Post media"
                          className="w-20 h-20 object-cover rounded"
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs text-stone-500 mt-3">
                    <span>
                      {post.griefTypes.map((t) => griefTypeLabels[t]).join(', ')} •{' '}
                      {preferences.isAnonymous ? 'anonymous' : 'you'}
                    </span>
                    <button className="flex items-center gap-1 text-stone-500 hover:text-amber-600">
                      <Heart size={14} /> {post.likes}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-semibold text-stone-800 mb-4">Get Support Now</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/connect')}
              className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-stone-200 bg-white hover:border-amber-400 transition"
            >
              <MessageCircle className="text-amber-600 mb-2" size={24} />
              <span className="font-medium">Talk Now</span>
            </button>
            <button
              onClick={() => router.push('/communities')}
              className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-stone-200 bg-white hover:border-amber-400 transition"
            >
              <Users className="text-amber-600 mb-2" size={24} />
              <span className="font-medium">Your Communities</span>
            </button>
          </div>
        </section>

        <div className="text-center pt-6 border-t border-stone-200 mt-6">
          <p className="text-stone-600 text-sm">You belong here.</p>
        </div>
      </div>
    </div>
  );
}