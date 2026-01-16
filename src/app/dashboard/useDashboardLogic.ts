'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase';
import { usePresence } from '@/hooks/usePresence';

export type GriefType =
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

export interface ProfileUpdate {
  grief_types?: GriefType[];
  accepts_calls?: boolean;
  accepts_video_calls?: boolean;
  accept_from_genders?: ('male' | 'female' | 'nonbinary' | 'any')[];
  accept_from_countries?: string[];
  accept_from_languages?: string[];
  is_anonymous?: boolean;
  full_name?: string;
  avatar_url?: string;
  about?: string;
  // Add other writable profile fields as needed
}

export interface UserProfile {
  id: string;
  griefTypes: GriefType[];
  avatarUrl?: string;
  fullName: string;      // Added full name
  email?: string;
  about?: string;       // Added email for fallback
}

export interface UserPreferences {
  acceptsCalls: boolean;
  acceptsVideoCalls: boolean;
  acceptFromGenders?: ('male' | 'female' | 'nonbinary' | 'any')[];
  acceptFromCountries?: string[];
  acceptFromLanguages?: string[];
  isAnonymous: boolean;
}

export interface Post {
  id: string;
  userId: string;
  text: string;
  mediaUrls?: string[];
  griefTypes: GriefType[];
  createdAt: Date;
  likes: number;
  commentsCount: number;
  isLiked: boolean;
  isAnonymous: boolean;
  user?: {
    id: string;                    // ✅ added
    fullName: string | null;       // ✅ allow null
    avatarUrl: string | null;      // ✅ keep
    isAnonymous: boolean;          // ✅ added
  };
}
export interface DashboardUIProps {
  profile: UserProfile | null;
  preferences: UserPreferences;
  showGriefSetup: boolean;
  showSettings: boolean;
  selectedGriefTypes: GriefType[];
  newPostText: string;
  mediaFiles: File[];
  mediaPreviews: string[];
  posts: Post[];
  onlineCount: number;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Callbacks
  toggleGriefType: (type: GriefType) => void;
  handleSaveGriefTypes: () => Promise<void>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeMedia: (index: number) => void;
  handlePostSubmit: () => Promise<void>;
  toggleAcceptsCalls: () => Promise<void>;
  toggleAcceptsVideoCalls: () => Promise<void>;
  toggleAnonymity: () => Promise<void>;
  updateFullName: (firstName: string, lastName: string) => Promise<void>;
  updateAvatar: (file: File) => Promise<void>;
  // New function
  setShowSettings: (show: boolean) => void;
  setShowGriefSetup: (show: boolean) => void;
  setNewPostText: (text: string) => void;
  onConnectClick: () => void;
  onCommunitiesClick: () => void;

  aboutText: string;
  setAboutText: (text: string) => void;
  isEditingAbout: boolean;
  setIsEditingAbout: (editing: boolean) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  saveAbout: () => Promise<void>;
}


export function useDashboardLogic(): DashboardUIProps {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);


  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    acceptsCalls: true,
    acceptsVideoCalls: false,
    acceptFromGenders: ['any'],
    acceptFromCountries: [],
    acceptFromLanguages: [],
    isAnonymous: false,
  });
  const [showGriefSetup, setShowGriefSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGriefTypes, setSelectedGriefTypes] = useState<GriefType[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [onlineCount, setOnlineCount] = useState(0); // ✅ always a number
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aboutText, setAboutText] = useState('');
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  usePresence(profile?.id ?? null);
  useEffect(() => {
    const init = async () => {
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (authError || !session?.user) {
        router.push('/auth');
        return;
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError || !data) {
        console.warn('No profile found for user:', session.user.id);
        router.push('/auth');
        return;
      }

      setProfile({
        id: data.id,
        griefTypes: data.grief_types || [],
        avatarUrl: data.avatar_url,
        fullName: data.full_name || session.user.email?.split('@')[0] || 'Friend',
        email: session.user.email || data.email,
        about: data.about || '',
      });

       setAboutText(data.about || '');

      setPreferences({
        acceptsCalls: data.accepts_calls ?? true,
        acceptsVideoCalls: data.accepts_video_calls ?? false,
        acceptFromGenders: data.accept_from_genders || ['any'],
        acceptFromCountries: data.accept_from_countries || [],
        acceptFromLanguages: data.accept_from_languages || [],
        isAnonymous: data.is_anonymous ?? false,
      });

      if ((data.grief_types?.length || 0) === 0) {
        setShowGriefSetup(true);
      }

      setIsLoading(false);
    };

    init();
  }, [router, supabase]); // ✅ Add `supabase` here

  // Add this useEffect — place it after your "loadPosts" useEffect
  useEffect(() => {
    if (isLoading) return;

    const fetchOnlineCount = async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', new Date(Date.now() - 60_000).toISOString());

      setOnlineCount(error ? 0 : count ?? 0); // ✅ always a number
    };

    fetchOnlineCount();
    const interval = setInterval(fetchOnlineCount, 30_000);
    return () => clearInterval(interval);
  }, [isLoading, supabase]);

  useEffect(() => {
    if (!profile || isLoading) return;

    const loadPosts = async () => {
      const { data, error } = await supabase
  .from('posts')
 .select(`
  *,
  comments_count,
  profiles: user_id (
    full_name,
    avatar_url
  )
`)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to fetch your posts:', error);
        setError('Failed to load your posts. Please try again later.');
        return;
      }

  const mapped = data.map((p) => ({
  id: p.id,
  userId: p.user_id,
  text: p.text,
  mediaUrls: p.media_urls || undefined,
  griefTypes: p.grief_types as GriefType[],
  createdAt: new Date(p.created_at),
  likes: p.likes_count || 0,
  commentsCount: p.comments_count || 0,
  isLiked: false, // ✅ safe default — PostCard will sync real value
  isAnonymous: p.is_anonymous,
  user: p.profiles ? {
  id: p.profiles.id,
  fullName: p.profiles.full_name || null,
  avatarUrl: p.profiles.avatar_url,
  isAnonymous: p.profiles.is_anonymous ?? false,
} : undefined
}));

      setPosts(mapped);
    };

    loadPosts();
  }, [profile, isLoading, supabase]);

  useEffect(() => {
    return () => {
      mediaPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [mediaPreviews]);

  const toggleGriefType = (type: GriefType) => {
    setSelectedGriefTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const saveProfileToDB = async (updates: ProfileUpdate) => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      router.push('/auth');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        updated_at: new Date().toISOString(),
        ...updates,
      })
      .select();

    if (error) {
      console.error('Profile save error:', error);
      throw new Error('Failed to save settings.');
    }
  };

  const handleSaveGriefTypes = async () => {
    if (selectedGriefTypes.length === 0) {
      setError('Please select at least one type of loss.');
      return;
    }

    try {
      await saveProfileToDB({ grief_types: selectedGriefTypes });

      setProfile(prev => prev ? {
        ...prev,
        griefTypes: selectedGriefTypes
      } : null);

      setShowGriefSetup(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save grief types.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).slice(0, 4 - mediaFiles.length);
    setMediaFiles(prev => [...prev, ...validFiles]);

    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setMediaPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePostSubmit = async () => {
    if (!newPostText.trim() || !profile) return;
    setIsSubmitting(true);
    setError(null);

    let mediaUrls: string[] = [];

    try {
      if (mediaFiles.length > 0) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
          throw new Error('Authentication required');
        }

        const uploadPromises = mediaFiles.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          const filePath = `posts/${session.user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('posts')
            .upload(filePath, file, {
              upsert: false,
              contentType: file.type
            });

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from('posts')
            .getPublicUrl(filePath);

          return publicUrlData.publicUrl;
        });

        mediaUrls = await Promise.all(uploadPromises);
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('Authentication required');
      }

      const { error: postError } = await supabase
        .from('posts')
        .insert({
          id: uuidv4(),
          user_id: session.user.id,
          text: newPostText.trim(),
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          grief_types: profile.griefTypes,
          is_anonymous: preferences.isAnonymous,
          created_at: new Date().toISOString(),
        });

      if (postError) throw postError;

      const { data: newPostData, error: fetchError } = await supabase
  .from('posts')
  .select(`
  *,
  comments_count,
  profiles: user_id (
    full_name,
    avatar_url
  )
`)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) throw fetchError;

 const newPost: Post = {
  id: newPostData.id,
  userId: newPostData.user_id,
  text: newPostData.text,
  mediaUrls: newPostData.media_urls || undefined,
  griefTypes: newPostData.grief_types as GriefType[],
  createdAt: new Date(newPostData.created_at),
  likes: newPostData.likes_count || 0,
  commentsCount: newPostData.comments_count || 0,
  isLiked: false, // ✅ new posts aren't liked yet
  isAnonymous: newPostData.is_anonymous,
  user: newPostData.profiles ? {
  id: newPostData.profiles.id,
  fullName: newPostData.profiles.full_name,
  avatarUrl: newPostData.profiles.avatar_url,
  isAnonymous: newPostData.profiles.is_anonymous ?? false,
} : undefined
};

      setPosts(prev => [newPost, ...prev]);

      setNewPostText('');
      setMediaFiles([]);
      setMediaPreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      console.error('Post creation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to share post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAcceptsCalls = async () => {
    try {
      const newValue = !preferences.acceptsCalls;
      setPreferences((prev) => ({ ...prev, acceptsCalls: newValue }));
      await saveProfileToDB({ accepts_calls: newValue });
    } catch (err) {
      console.error('Failed to update call preference:', err);
      setError('Failed to update settings. Please try again.');
    }
  };

  const toggleAcceptsVideoCalls = async () => {
    try {
      const newValue = !preferences.acceptsVideoCalls;
      setPreferences((prev) => ({ ...prev, acceptsVideoCalls: newValue }));
      await saveProfileToDB({ accepts_video_calls: newValue });
    } catch (err) {
      console.error('Failed to update video call preference:', err);
      setError('Failed to update settings. Please try again.');
    }
  };

  const toggleAnonymity = async () => {
    try {
      const newValue = !preferences.isAnonymous;
      setPreferences((prev) => ({ ...prev, isAnonymous: newValue }));
      await saveProfileToDB({ is_anonymous: newValue });
    } catch (err) {
      console.error('Failed to update anonymity preference:', err);
      setError('Failed to update settings. Please try again.');
    }
  };

  // New function to update full name
  const updateFullName = async (firstName: string, lastName: string) => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    if (!firstName.trim()) {
      throw new Error('First name is required');
    }

    try {
      // Update in database
      await saveProfileToDB({ full_name: fullName });

      // Update local state
      setProfile(prev => prev ? {
        ...prev,
        fullName
      } : null);

      setError(null);

    } catch (err) {
      console.error('Name update failed:', err);
      throw new Error('Failed to update name. Please try again.');
    }
  };

  const updateAvatar = async (file: File) => {
    if (!profile) throw new Error('Profile not loaded');

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `avatars/${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      // ✅ CORRECT
      // ✅ Correct
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = data.publicUrl;

      // 3. Save URL to profile in DB
      await saveProfileToDB({ avatar_url: avatarUrl });

      // 4. Update local profile state
      setProfile((prev) => (prev ? { ...prev, avatarUrl } : null));
      setError(null);
    } catch (err) {
      console.error('Avatar upload failed:', err);
      throw new Error('Failed to update profile picture. Please try again.');
    }
  };

  const saveAbout = async () => {
  if (!profile) return;
  try {
    await saveProfileToDB({ about: aboutText });
    setProfile(prev => prev ? { ...prev, about: aboutText } : null);
    setIsEditingAbout(false);
    setError(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to save about.');
  }
};
  const onConnectClick = () => {
    router.push('/connect');
  };

  const onCommunitiesClick = () => {
    router.push('/communities');
  };

  return {
  profile,
  preferences,
  showGriefSetup,
  showSettings,
  selectedGriefTypes,
  newPostText,
  mediaFiles,
  mediaPreviews,
  posts,
  onlineCount,
  isLoading,
  isSubmitting,
  error,
  fileInputRef,

  // About section
  aboutText,
  setAboutText,
  isEditingAbout,
  setIsEditingAbout,
  isExpanded,
  setIsExpanded,
  saveAbout,

  // Callbacks
  toggleGriefType,
  handleSaveGriefTypes,
  handleFileChange,
  removeMedia,
  handlePostSubmit,
  toggleAcceptsCalls,
  toggleAcceptsVideoCalls,
  toggleAnonymity,
  updateFullName,
  updateAvatar,
  setShowSettings,
  setShowGriefSetup,
  setNewPostText,
  onConnectClick,
  onCommunitiesClick,
};
}