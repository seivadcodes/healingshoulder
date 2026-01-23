'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/client';
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
  other_loss_description?: string | null;
}

export interface UserProfile {
  id: string;
  griefTypes: GriefType[];
  avatarUrl: string | null;
  fullName: string;
  email?: string;
  about?: string;
  otherLossDescription: string | null;
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
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
    isAnonymous: boolean;
  };
}

export interface DashboardUIProps {
  profile: UserProfile | null;
  preferences: UserPreferences;
  showGriefSetup: boolean;
  showSettings: boolean;
  selectedGriefTypes: GriefType[];
  posts: Post[];
  onlineCount: number;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Callbacks
  toggleGriefType: (type: GriefType) => void;
  handleSaveGriefTypes: () => Promise<void>;
  // ✅ Updated signature for PostComposer
  handlePostSubmit: (text: string, mediaFiles: File[], isAnonymous: boolean) => Promise<void>;
  toggleAcceptsCalls: () => Promise<void>;
  toggleAcceptsVideoCalls: () => Promise<void>;
  toggleAnonymity: () => Promise<void>;
  updateFullName: (firstName: string, lastName: string) => Promise<void>;
  updateAvatar: (file: File) => Promise<void>;
  setShowSettings: (show: boolean) => void;
  setShowGriefSetup: (show: boolean) => void;
  onConnectClick: () => void;
  onCommunitiesClick: () => void;

  // About & Other Loss
  aboutText: string;
  setAboutText: (text: string) => void;
  isEditingAbout: boolean;
  setIsEditingAbout: (editing: boolean) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  saveAbout: () => Promise<void>;
  otherLossText: string;
  setOtherLossText: (text: string) => void;
}

export function useDashboardLogic(): DashboardUIProps {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

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
  const [posts, setPosts] = useState<Post[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aboutText, setAboutText] = useState('');
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [otherLossText, setOtherLossText] = useState('');

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

      const avatarUrl = data.avatar_url ? `/api/media/avatars/${data.avatar_url}` : null;

      setProfile({
        id: data.id,
        griefTypes: data.grief_types || [],
        avatarUrl,
        fullName: data.full_name || session.user.email?.split('@')[0] || 'Friend',
        email: session.user.email || data.email,
        about: data.about || '',
        otherLossDescription: data.other_loss_description || null,
      });

      setOtherLossText(data.other_loss_description ?? '');
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
  }, [router, supabase]);

  useEffect(() => {
    if (isLoading) return;

    const fetchOnlineCount = async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', new Date(Date.now() - 60_000).toISOString());

      setOnlineCount(error ? 0 : count ?? 0);
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
            id,
            full_name,
            avatar_url,
            is_anonymous
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

      const mapped = data.map((p) => {
        const mediaUrls = (Array.isArray(p.media_urls) ? p.media_urls : []) as string[];
        const proxiedMediaUrls = mediaUrls.map((path: string) => `/api/media/posts/${path}`);

        const avatarUrl = p.profiles?.is_anonymous
          ? null
          : p.profiles?.avatar_url
            ? `/api/media/avatars/${p.profiles.avatar_url}`
            : null;

        return {
          id: p.id,
          userId: p.user_id,
          text: p.text,
          mediaUrls: proxiedMediaUrls,
          griefTypes: p.grief_types as GriefType[],
          createdAt: new Date(p.created_at),
          likes: p.likes_count || 0,
          commentsCount: p.comments_count || 0,
          isLiked: false,
          isAnonymous: p.is_anonymous || p.profiles?.is_anonymous,
          user: p.profiles
            ? {
                id: p.profiles.id,
                fullName: p.profiles.is_anonymous ? null : p.profiles.full_name,
                avatarUrl,
                isAnonymous: p.profiles.is_anonymous ?? false,
              }
            : undefined,
        };
      });

      setPosts(mapped);
    };

    loadPosts();
  }, [profile, isLoading, supabase]);

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
      const updates: ProfileUpdate = { grief_types: selectedGriefTypes };

      if (selectedGriefTypes.includes('other')) {
        updates.other_loss_description = otherLossText.trim() || null;
      } else {
        updates.other_loss_description = null;
      }

      await saveProfileToDB(updates);

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              griefTypes: selectedGriefTypes,
              otherLossDescription: selectedGriefTypes.includes('other') ? otherLossText : null,
            }
          : null
      );

      setShowGriefSetup(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save grief types.');
    }
  };

  // ✅ FIXED: Accepts arguments from PostComposer
  const handlePostSubmit = async (
    text: string,
    mediaFiles: File[],
    isAnonymous: boolean
  ) => {
    if (!text.trim() || !profile) return;

    setIsSubmitting(true);
    setError(null);
    let mediaUrls: string[] = [];

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('Authentication required');
      }

      if (mediaFiles.length > 0) {
        const uploadPromises = mediaFiles.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          const filePath = `posts/${session.user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('posts')
            .upload(filePath, file, {
              upsert: false,
              contentType: file.type,
            });

          if (uploadError) throw uploadError;
          return filePath;
        });

        mediaUrls = await Promise.all(uploadPromises);
      }

      const postId = uuidv4();
      const { error: postError } = await supabase
        .from('posts')
        .insert({
          id: postId,
          user_id: session.user.id,
          text: text.trim(),
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          grief_types: profile.griefTypes,
          is_anonymous: isAnonymous,
          created_at: new Date().toISOString(),
        });

      if (postError) throw postError;

      const newPost: Post = {
        id: postId,
        userId: session.user.id,
        text: text.trim(),
        mediaUrls: mediaUrls.map((path) => `/api/media/posts/${path}`),
        griefTypes: profile.griefTypes,
        createdAt: new Date(),
        likes: 0,
        commentsCount: 0,
        isLiked: false,
        isAnonymous,
        user: {
          id: profile!.id,
          fullName: isAnonymous ? null : profile!.fullName,
          avatarUrl: isAnonymous ? null : profile!.avatarUrl,
          isAnonymous,
        },
      };

      setPosts((prev) => [newPost, ...prev]);
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

  const updateFullName = async (firstName: string, lastName: string) => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!firstName.trim()) {
      throw new Error('First name is required');
    }

    try {
      await saveProfileToDB({ full_name: fullName });
      setProfile((prev) => (prev ? { ...prev, fullName } : null));
      setError(null);
    } catch (err) {
      console.error('Name update failed:', err);
      throw new Error('Failed to update name. Please try again.');
    }
  };

  const updateAvatar = async (file: File) => {
    if (!profile) throw new Error('Profile not loaded');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      await saveProfileToDB({ avatar_url: filePath });

      const proxyUrl = `/api/media/avatars/${filePath}`;
      setProfile((prev) => (prev ? { ...prev, avatarUrl: proxyUrl } : null));
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
      setProfile((prev) => (prev ? { ...prev, about: aboutText } : null));
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
    posts,
    onlineCount,
    isLoading,
    isSubmitting,
    error,

    // About & Other Loss
    aboutText,
    setAboutText,
    isEditingAbout,
    setIsEditingAbout,
    isExpanded,
    setIsExpanded,
    saveAbout,
    otherLossText,
    setOtherLossText,

    // Callbacks
    toggleGriefType,
    handleSaveGriefTypes,
    handlePostSubmit,
    toggleAcceptsCalls,
    toggleAcceptsVideoCalls,
    toggleAnonymity,
    updateFullName,
    updateAvatar,
    setShowSettings,
    setShowGriefSetup,
    onConnectClick,
    onCommunitiesClick,
  };
}