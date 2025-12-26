// src/app/communities/[communityId]/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Users,
  Heart,
  MessageCircle,
  LogIn,
  LogOut,
  Settings,
  UserPlus,
  ImageIcon,
  Trash2,
  X,
  Loader2,
  Upload
} from 'lucide-react';
import { toast } from 'react-hot-toast';
// Import hearts logic functions
import * as Hearts from '@/lib/comments-hearts/heartsLogic';

// Types
interface Community {
  id: string;
  name: string;
  description: string;
  member_count: number;
  online_count: number;
  grief_type: string;
  created_at: string;
  cover_photo_url?: string | null;
}

interface Member {
  user_id: string;
  username: string;
  avatar_url: string | null;
  last_online: string | null;
  is_online: boolean;
  role: 'member' | 'admin' | 'moderator';
  joined_at: string;
}

interface Post {
  id: string;
  content: string;
  media_url?: string | null;
  created_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  community_id: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  post_id: string;
}

export default function CommunityDetailPage() {
  const params = useParams();
  const communityId = params.communityId as string;
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();

  // State
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'moderator' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState<File | null>(null);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [likeLoading, setLikeLoading] = useState<Record<string, boolean>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [addingComment, setAddingComment] = useState<Record<string, boolean>>({});
  const [expandedPosts, setExpandedPosts] = useState<string[]>([]);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const griefTypeGradients: Record<string, string> = {
    'parent': 'from-amber-200 to-orange-300',
    'child': 'from-purple-200 to-indigo-300',
    'spouse': 'from-rose-200 to-pink-300',
    'sibling': 'from-teal-200 to-cyan-300',
    'friend': 'from-blue-200 to-indigo-300',
    'pet': 'from-yellow-200 to-amber-300',
    'miscarriage': 'from-pink-200 to-rose-300',
    'caregiver': 'from-stone-200 to-amber-300',
    'suicide': 'from-violet-200 to-purple-300',
    'other': 'from-gray-200 to-stone-300'
  };

  // Format time since last activity
  const formatRecentActivity = (dateString: string): string => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMinutes = Math.floor((now.getTime() - created.getTime()) / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 2) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 120) return '1 hour ago';
    const hours = Math.floor(diffMinutes / 60);
    return `${hours} hours ago`;
  };

  // Check if user is online
  const isUserOnline = (lastOnline: string | null): boolean => {
    if (!lastOnline) return false;
    const lastOnlineDate = new Date(lastOnline);
    const now = new Date();
    return (now.getTime() - lastOnlineDate.getTime()) < 5 * 60 * 1000; // 5 minutes
  };

  // Toggle like for a post
  const handleToggleLike = async (postId: string) => {
    if (!user) {
      toast.error('Please sign in to like posts');
      return;
    }
    setLikeLoading(prev => ({ ...prev, [postId]: true }));
    try {
      // Inside handleToggleLike function
      const result = await Hearts.toggleLike(postId, user.id, 'community_posts');
      // Update local state
      setPosts(prevPosts => prevPosts.map(post =>
        post.id === postId
          ? { ...post, is_liked: result.isLiked, likes_count: result.likesCount }
          : post
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    } finally {
      setLikeLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Fetch comments for a post
  const fetchComments = async (postId: string) => {
    if (!postId) return;
    
    setCommentLoading(prev => ({ ...prev, [postId]: true }));
    
    try {
      const { data, error } = await supabase
        .from('community_post_comments')
        .select(`
          id,
          content,
          created_at,
          post_id,
          user_id,
          user:profiles!inner (
            full_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      const formattedComments = data.map(comment => {
        const userData = Array.isArray(comment.user) ? comment.user[0] : comment.user;
        return {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          user_id: comment.user_id,
          username: userData?.full_name || 'Anonymous',
          avatar_url: userData?.avatar_url || null,
          post_id: comment.post_id
        };
      });
      
      setComments(prev => ({
        ...prev,
        [postId]: formattedComments
      }));
      
      // Add to expanded posts
      if (!expandedPosts.includes(postId)) {
        setExpandedPosts(prev => [...prev, postId]);
      }
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setCommentLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Add a new comment to a post
  const addComment = async (postId: string, content: string) => {
    if (!user || !content.trim() || !postId) return;
    
    setAddingComment(prev => ({ ...prev, [postId]: true }));
    
    try {
      const { data, error } = await supabase
        .from('community_post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim(),
          created_at: new Date().toISOString()
        })
        .select(`
          id,
          content,
          created_at,
          post_id,
          user_id,
          user:profiles!inner (
            full_name,
            avatar_url
          )
        `)
        .single();
      
      if (error) throw error;
      
      const userData = Array.isArray(data.user) ? data.user[0] : data.user;
      const newComment = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: data.user_id,
        username: userData?.full_name || 'Anonymous',
        avatar_url: userData?.avatar_url || null,
        post_id: data.post_id
      };
      
      // Update comments state
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }));
      
      // Update posts state to increment comments_count
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, comments_count: (post.comments_count || 0) + 1 } 
          : post
      ));
      
      // Clear the input
      setNewCommentContent(prev => ({ ...prev, [postId]: '' }));
      
      toast.success('Comment added successfully');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setAddingComment(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Delete a comment
  const deleteComment = async (commentId: string, postId: string) => {
    setDeletingCommentId(commentId);
    try {
      const { error } = await supabase
        .from('community_post_comments')
        .delete()
        .eq('id', commentId);
      
      if (error) throw error;
      
      // Update comments state
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(comment => comment.id !== commentId)
      }));
      
      // Update posts state to decrement comments_count
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, comments_count: Math.max(0, (post.comments_count || 0) - 1) } 
          : post
      ));
      
      toast.success('Comment deleted successfully');
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    } finally {
      setDeletingCommentId(null);
    }
  };

  // Toggle expand/collapse comments for a post
  const toggleComments = (postId: string) => {
    if (expandedPosts.includes(postId)) {
      setExpandedPosts(prev => prev.filter(id => id !== postId));
    } else {
      if (!comments[postId]) {
        fetchComments(postId);
      } else {
        setExpandedPosts(prev => [...prev, postId]);
      }
    }
  };

  // Update community banner
  const updateBanner = async (file: File) => {
    if (!community) return;
    setBannerUploading(true);
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be less than 5MB');
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${communityId}/banner.${fileExt || 'jpg'}`;
      const { error: uploadError } = await supabase.storage
        .from('communities')
        .upload(fileName, file, {
          upsert: true
        });
      if (uploadError) throw uploadError;
      const newBannerUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/communities/${fileName}?t=${Date.now()}`;
      setCommunity(prev => prev ? {
        ...prev,
        cover_photo_url: newBannerUrl
      } : null);
      toast.success('Banner updated successfully!');
      setBannerModalOpen(false);
      setBannerPreview(null);
      setBannerFile(null);
    } catch (error: any) {
      console.error('Banner update failed:', error);
      setBannerUploadError(error.message || 'Failed to update banner');
    } finally {
      setBannerUploading(false);
    }
  };

  // Delete a post
  const deletePost = async (postId: string) => {
    setDeletingPostId(postId);
    try {
      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', postId)
        .eq('community_id', communityId);
      if (error) throw error;
      setPosts(prev => prev.filter(post => post.id !== postId));
      // Remove comments for this post as well
      setComments(prev => {
        const newComments = { ...prev };
        delete newComments[postId];
        return newComments;
      });
      toast.success('Post deleted successfully');
    } catch (error: any) {
      console.error('Post deletion failed:', error);
      toast.error(error.message || 'Failed to delete post');
    } finally {
      setDeletingPostId(null);
    }
  };

  // Upload post media
  const uploadPostMedia = async (file: File, postId: string) => {
    try {
      setUploadingMedia(true);
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Unsupported file type. Please upload JPG, PNG, GIF, MP4 or MOV files.');
      }
      const maxSize = file.type.startsWith('video/') ? 15 : 5;
      if (file.size > maxSize * 1024 * 1024) {
        throw new Error(`File must be less than ${maxSize}MB`);
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${communityId}/posts/${postId}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('communities')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type
        });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage
        .from('communities')
        .getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error: any) {
      console.error('Media upload failed:', error);
      throw error;
    } finally {
      setUploadingMedia(false);
    }
  };

  // Create post with optional media
  const createPostWithMedia = async (content: string, file: File | null, userId: string) => {
    if (!community) throw new Error('Community not loaded');
    try {
      // Create the post first
      const { data: postData, error: postError } = await supabase
        .from('community_posts')
        .insert({
          community_id: communityId,
          user_id: userId,
          content: content.trim(),
          created_at: new Date().toISOString(),
          media_url: file ? 'uploading' : null
        })
        .select(`
          id,
          content,
          created_at,
          community_id,
          media_url,
          user_id,
          user:profiles!inner (
            id,
            full_name,
            avatar_url
          )
        `)
        .single();
      if (postError) throw postError;
      let mediaUrl = null;
      // Upload media if exists
      if (file) {
        mediaUrl = await uploadPostMedia(file, postData.id);
        // Update post with media URL
        if (mediaUrl) {
          const { error: updateError } = await supabase
            .from('community_posts')
            .update({ media_url: mediaUrl })
            .eq('id', postData.id);
          if (updateError) {
            console.warn('Failed to update post with media URL:', updateError);
          }
        }
      }
      // Format the post data
      const userData = Array.isArray(postData.user) ? postData.user[0] : postData.user;
      return {
        id: postData.id,
        content: postData.content,
        created_at: postData.created_at,
        user_id: postData.user_id,
        username: userData?.full_name || 'Anonymous',
        avatar_url: userData?.avatar_url || null,
        community_id: postData.community_id,
        media_url: mediaUrl,
        likes_count: 0,
        comments_count: 0,
        is_liked: false
      };
    } catch (error: any) {
      console.error('Post creation failed:', error);
      // Clean up if post was created but media failed
      if (error.message?.includes('media')) {
        await supabase
          .from('community_posts')
          .delete()
          .eq('id', error.postId);
      }
      throw error;
    }
  };

  // Fetch community data
  useEffect(() => {
    const fetchData = async () => {
      if (!communityId) return;
      try {
        setLoading(true);
        setError(null);
        // Fetch community details
        const { data: communityData, error: communityError } = await supabase
          .from('communities')
          .select('*')
          .eq('id', communityId)
          .single();
        if (communityError) throw communityError;
        // Add cover photo URL
        const coverPhotoUrl = communityData.cover_photo_url ||
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/communities/${communityId}/banner.jpg?t=${Date.now()}`;
        const communityWithPhoto = {
          ...communityData,
          cover_photo_url: coverPhotoUrl
        };
        setCommunity(communityWithPhoto);
        // Check if user is a member
        if (user) {
          const { data: memberData } = await supabase
            .from('community_members')
            .select('role')
            .eq('community_id', communityId)
            .eq('user_id', user.id)
            .single();
          if (memberData) {
            setIsMember(true);
            setUserRole(memberData.role);
          } else {
            setIsMember(false);
            setUserRole(null);
          }
          // Check like status for all posts later
        }
        // Fetch members
        const { data: membersData, error: membersError } = await supabase
          .from('community_members')
          .select(`
            role,
            joined_at,
            user_id,
            user:profiles!inner (
              full_name,
              avatar_url,
              last_online
            )
          `)
          .eq('community_id', communityId)
          .order('joined_at', { ascending: true });
        if (membersError) throw membersError;
        const formattedMembers = membersData.map(member => {
          const profile = Array.isArray(member.user) ? member.user[0] : member.user;
          return {
            user_id: member.user_id,
            username: profile.full_name || 'Anonymous',
            avatar_url: profile.avatar_url,
            last_online: profile.last_online,
            is_online: isUserOnline(profile.last_online),
            role: member.role,
            joined_at: member.joined_at
          };
        });
        setMembers(formattedMembers);
        // Fetch posts
        const { data: postData, error: postError } = await supabase
          .from('community_posts')
          .select(`
            id,
            content,
            created_at,
            community_id,
            media_url,
            likes_count,
            comments_count,
            user_id,
            user:profiles!inner (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('community_id', communityId)
          .order('created_at', { ascending: false });
        if (postError) throw postError;
        // Check like status for each post if user is logged in
        let postsWithLikes = postData.map(post => {
          const userData = Array.isArray(post.user) ? post.user[0] : post.user;
          return {
            id: post.id,
            content: post.content,
            media_url: post.media_url,
            created_at: post.created_at,
            user_id: post.user_id,
            username: userData?.full_name || 'Anonymous',
            avatar_url: userData?.avatar_url || null,
            community_id: post.community_id,
            likes_count: post.likes_count || 0,
            comments_count: post.comments_count || 0,
            is_liked: false // Will update below if user is logged in
          };
        });
        if (user) {
          const likeStatusPromises = postsWithLikes.map(async (post) => {
            const isLiked = await Hearts.checkIfLiked(post.id, user.id, 'community_posts');
            return { postId: post.id, isLiked };
          });
          const likeStatusResults = await Promise.all(likeStatusPromises);
          postsWithLikes = postsWithLikes.map(post => {
            const likeStatus = likeStatusResults.find(status => status.postId === post.id);
            return likeStatus ? { ...post, is_liked: likeStatus.isLiked } : post;
          });
        }
        setPosts(postsWithLikes);
      } catch (err: any) {
        console.error('Error fetching community:', err);
        setError(err.message || 'Failed to load community data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [communityId, user, supabase]);

  // Handle join/leave community
  const handleMembership = async () => {
    if (!user) {
      router.push(`/auth?redirectTo=/communities/${communityId}`);
      return;
    }
    if (isMember) {
      // Leave community
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', user.id);
      if (error) {
        console.error('Error leaving community:', error);
        setError('Failed to leave community');
        return;
      }
      setIsMember(false);
      setUserRole(null);
      setCommunity(prev => prev ? { ...prev, member_count: prev.member_count - 1 } : null);
    } else {
      // Join community
      const { error } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: user.id,
          joined_at: new Date().toISOString(),
          role: 'member'
        });
      if (error) {
        console.error('Error joining community:', error);
        setError('Failed to join community');
        return;
      }
      setIsMember(true);
      setUserRole('member');
      setCommunity(prev => prev ? { ...prev, member_count: prev.member_count + 1 } : null);
    }
  };

  // Handle create post with media
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !community || (!newPostContent.trim() && !newPostMedia)) return;
    setError(null);
    try {
      const newPost = await createPostWithMedia(
        newPostContent.trim(),
        newPostMedia,
        user.id
      );
      setPosts(prev => [newPost, ...prev]);
      setNewPostContent('');
      setNewPostMedia(null);
      toast.success('Post created successfully!');
    } catch (err: any) {
      console.error('Error creating post:', err);
      setError(err.message || 'Failed to create post');
      toast.error('Failed to create post');
    }
  };

  // Handle banner file selection
  const handleBannerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      setBannerUploadError('Please upload an image file (JPEG, PNG, GIF, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBannerUploadError('Image must be less than 5MB');
      return;
    }
    setBannerFile(file);
    setBannerUploadError(null);
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setBannerPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle post media selection
  const handlePostMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload JPG, PNG, GIF, MP4 or MOV files.');
      return;
    }
    const maxSize = file.type.startsWith('video/') ? 15 : 5;
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File must be less than ${maxSize}MB`);
      return;
    }
    setNewPostMedia(file);
    setError(null);
  };

  // Remove post media
  const removePostMedia = () => {
    setNewPostMedia(null);
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-amber-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-stone-600">Loading community...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 max-w-md text-center shadow-md">
          <div className="text-amber-500 mb-3">
            <Users className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">Error Loading Community</h2>
          <p className="text-stone-600 mb-4">{error}</p>
          <Button onClick={() => router.back()} className="bg-amber-500 hover:bg-amber-600 text-white">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 max-w-md text-center shadow-md">
          <div className="text-amber-500 mb-3">
            <Users className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">Community Not Found</h2>
          <p className="text-stone-600 mb-4">The community you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/communities')} className="bg-amber-500 hover:bg-amber-600 text-white">
            Browse Communities
          </Button>
        </div>
      </div>
    );
  }

  const gradient = griefTypeGradients[community.grief_type] || 'from-amber-200 to-orange-300';
  const isAdmin = userRole === 'admin';
  const isModerator = userRole === 'moderator' || isAdmin;
  const authUsername = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anonymous';

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 pt-20 md:pt-6">
      {/* Community Banner */}
      <div className="relative h-48 md:h-64 mb-6 overflow-hidden">
        <img
          src={community.cover_photo_url || `https://via.placeholder.com/1200x300/${gradient.replace(/ /g, '')}?text=${encodeURIComponent(community.name)}`}
          alt={community.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = `https://via.placeholder.com/1200x300/${gradient.replace(/ /g, '')}?text=${encodeURIComponent(community.name)}`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        {/* Admin Edit Banner Button */}
        {isAdmin && (
          <button
            onClick={() => setBannerModalOpen(true)}
            className="absolute bottom-4 right-4 bg-black/30 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-black/40 transition-colors"
          >
            <ImageIcon size={18} />
            Edit Banner
          </button>
        )}
      </div>
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Community Header */}
            <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${gradient} flex-shrink-0 flex items-center justify-center`}>
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-stone-800">{community.name}</h1>
                    <p className="text-stone-600 mt-1">{community.description}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-stone-500">
                      <span className="flex items-center gap-1">
                        <Users size={16} className="text-amber-500" />
                        {community.member_count} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={16} className="text-green-500" />
                        {community.online_count} online now
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={16} className="text-blue-500" />
                        {posts.length} posts
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {user ? (
                    <Button
                      onClick={handleMembership}
                      className={`flex items-center gap-2 ${isMember ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'} text-white`}
                    >
                      {isMember ? (
                        <>
                          <LogOut size={18} />
                          Leave Community
                        </>
                      ) : (
                        <>
                          <LogIn size={18} />
                          Join Community
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => router.push(`/auth?redirectTo=/communities/${communityId}`)}
                      className="bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2"
                    >
                      <LogIn size={18} />
                      Sign in to Join
                    </Button>
                  )}
                  {(isAdmin) && (
                    <Button
                      onClick={() => {
                        toast('Community settings coming soon!');
                      }}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Settings size={18} />
                      Manage
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {/* Create Post */}
            {isMember && (
              <Card className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
                <form onSubmit={handleCreatePost}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex-shrink-0 flex items-center justify-center text-white font-medium">
                      {user?.user_metadata?.avatar_url ? (
                        <img
                          src={user.user_metadata.avatar_url}
                          alt={authUsername}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        authUsername[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder={`What's on your mind, ${authUsername}? Share your thoughts, memories, or questions with the community...`}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[100px] max-h-[200px] resize-y"
                        maxLength={500}
                      />
                      {newPostMedia && (
                        <div className="mt-3 p-3 bg-stone-50 rounded-lg relative">
                          <button
                            type="button"
                            onClick={removePostMedia}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm"
                            title="Remove media"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          {newPostMedia.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(newPostMedia)}
                              alt="Post preview"
                              className="max-h-64 w-full object-contain rounded-lg"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-4 bg-stone-100 rounded-lg">
                              <div className="text-amber-500 mb-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-10 h-10">
                                  <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v11.5c0 1.243 1.007 2.25 2.25 2.25h11.5a2.25 2.25 0 002.25-2.25V4.25A2.25 2.25 0 0015.75 2H4.25zm11.5 1.5a.75.75 0 01.75.75V8h-4.5a.75.75 0 010-1.5h3.75V4.75a.75.75 0 01.75-.75z" clipRule="evenodd" />
                                  <path fillRule="evenodd" d="M6 4.5a.75.75 0 01.75.75v3.5l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06l1.72 1.72V5.25A.75.75 0 016 4.5z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <p className="text-sm font-medium text-stone-800 mb-1">
                                {newPostMedia.name}
                              </p>
                              <p className="text-xs text-stone-500">
                                {Math.round(newPostMedia.size / 1024)}KB
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center text-amber-600 hover:text-amber-700 cursor-pointer">
                            <Upload size={18} className="mr-1" />
                            <span className="text-sm">Add media</span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={handlePostMediaSelect}
                            />
                          </label>
                          <span className="text-xs text-stone-500">{newPostContent.length}/500</span>
                        </div>
                        <Button
                          type="submit"
                          disabled={uploadingMedia || (!newPostContent.trim() && !newPostMedia)}
                          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                        >
                          {uploadingMedia ? (
                            <span className="flex items-center">
                              <Loader2 size={16} className="animate-spin mr-1" />
                              Uploading...
                            </span>
                          ) : 'Share'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </Card>
            )}
            {/* Posts Feed */}
            <div className="space-y-5">
              {posts.length === 0 ? (
                <Card className="bg-white rounded-xl border border-stone-200 p-8 text-center">
                  <MessageCircle className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-stone-800 mb-1">No posts yet</h3>
                  <p className="text-stone-600">
                    {isMember
                      ? "Be the first to share your thoughts with the community."
                      : "Join this community to see and share posts."
                    }
                  </p>
                  {!isMember && user && (
                    <Button
                      onClick={handleMembership}
                      className="mt-4 bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Join to Participate
                    </Button>
                  )}
                </Card>
              ) : (
                posts.map(post => (
                  <Card key={post.id} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex-shrink-0 flex items-center justify-center text-white font-medium">
                        {post.avatar_url ? (
                          <img
                            src={post.avatar_url}
                            alt={post.username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          post.username[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-stone-800">{post.username}</h3>
                            <p className="text-xs text-stone-500">
                              {formatRecentActivity(post.created_at)}
                            </p>
                          </div>
                          {(isModerator || post.user_id === user?.id) && (
                            <button
                              onClick={() => deletePost(post.id)}
                              disabled={deletingPostId === post.id}
                              className={`text-stone-400 hover:text-red-500 transition-colors ${deletingPostId === post.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Delete post"
                            >
                              {deletingPostId === post.id ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Trash2 size={18} />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-stone-700 whitespace-pre-line mb-4">
                          {post.content}
                        </p>
                        {post.media_url && (
                          <div className="mb-4 max-h-96 overflow-hidden rounded-lg">
                            {post.media_url.includes('video') ? (
                              <video
                                src={post.media_url}
                                controls
                                className="w-full h-auto max-h-96 object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              >
                                Your browser does not support the video tag.
                              </video>
                            ) : (
                              <img
                                src={post.media_url}
                                alt="Post media"
                                className="w-full h-auto max-h-96 object-contain rounded-lg"
                                onError={(e) => {
                                  e.currentTarget.parentElement!.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-6 text-sm text-stone-500 pt-2 border-t border-stone-100">
                          <button
                            className={`flex items-center gap-1 hover:text-amber-600 transition-colors ${post.is_liked ? 'text-amber-600' : ''}`}
                            onClick={() => handleToggleLike(post.id)}
                            disabled={likeLoading[post.id] || !user}
                          >
                            {likeLoading[post.id] ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Heart
                                size={16}
                                fill={post.is_liked ? 'currentColor' : 'none'}
                              />
                            )}
                            {post.likes_count}
                          </button>
                          <button
                            className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                            onClick={() => toggleComments(post.id)}
                            disabled={commentLoading[post.id]}
                          >
                            {commentLoading[post.id] && expandedPosts.includes(post.id) ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <MessageCircle size={16} />
                            )}
                            {post.comments_count}
                          </button>
                        </div>

                        {/* Comments section */}
                        {expandedPosts.includes(post.id) && (
                          <div className="mt-4 border-t border-stone-100 pt-4">
                            {/* Comments list */}
                            {commentLoading[post.id] ? (
                              <div className="flex justify-center py-4">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-amber-500 border-t-transparent"></div>
                              </div>
                            ) : comments[post.id]?.length === 0 ? (
                              <p className="text-sm text-stone-500 text-center py-2">No comments yet. Be the first to comment!</p>
                            ) : (
                              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                {comments[post.id]?.map(comment => (
                                  <div key={comment.id} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex-shrink-0 flex items-center justify-center text-white font-medium text-xs">
                                      {comment.avatar_url ? (
                                        <img
                                          src={comment.avatar_url}
                                          alt={comment.username}
                                          className="w-full h-full rounded-full object-cover"
                                        />
                                      ) : (
                                        comment.username[0]?.toUpperCase() || 'U'
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0 bg-stone-50 rounded-lg p-3">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <h4 className="font-medium text-stone-800 text-sm">{comment.username}</h4>
                                          <p className="text-xs text-stone-500 mt-0.5">
                                            {formatRecentActivity(comment.created_at)}
                                          </p>
                                        </div>
                                        {(comment.user_id === user?.id || isModerator) && (
                                          <button
                                            onClick={async () => {
                                              if (window.confirm('Are you sure you want to delete this comment?')) {
                                                await deleteComment(comment.id, post.id);
                                              }
                                            }}
                                            disabled={deletingCommentId === comment.id}
                                            className="text-stone-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                            title="Delete comment"
                                          >
                                            {deletingCommentId === comment.id ? (
                                              <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                              <Trash2 size={14} />
                                            )}
                                          </button>
                                        )}
                                      </div>
                                      <p className="text-stone-700 text-sm mt-1 whitespace-pre-line">
                                        {comment.content}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Add comment form */}
                            {user && (
                              <div className="mt-4 flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex-shrink-0 flex items-center justify-center text-white font-medium text-xs">
                                  {user?.user_metadata?.avatar_url ? (
                                    <img
                                      src={user.user_metadata.avatar_url}
                                      alt={authUsername}
                                      className="w-full h-full rounded-full object-cover"
                                    />
                                  ) : (
                                    authUsername[0]?.toUpperCase() || 'U'
                                  )}
                                </div>
                                <div className="flex-1">
                                  <form onSubmit={(e) => {
                                    e.preventDefault();
                                    addComment(post.id, newCommentContent[post.id] || '');
                                  }}>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={newCommentContent[post.id] || ''}
                                        onChange={(e) => setNewCommentContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                                        placeholder="Write a comment..."
                                        className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                                      />
                                      <button
                                        type="submit"
                                        disabled={addingComment[post.id] || !newCommentContent[post.id]?.trim()}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                                          newCommentContent[post.id]?.trim() 
                                            ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                                            : 'bg-stone-200 text-stone-500 cursor-not-allowed'
                                        }`}
                                      >
                                        {addingComment[post.id] ? (
                                          <Loader2 size={16} className="animate-spin" />
                                        ) : 'Comment'}
                                      </button>
                                    </div>
                                  </form>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Member List */}
            <Card className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                  <Users size={20} className="text-amber-500" />
                  Community Members
                </h2>
                {isMember && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-600 hover:bg-amber-50"
                    onClick={() => {
                      toast('Member invite functionality coming soon!');
                    }}
                  >
                    <UserPlus size={16} className="mr-1" />
                    Invite
                  </Button>
                )}
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {members.map(member => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-2 hover:bg-stone-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium ${
                          member.avatar_url
                            ? 'overflow-hidden'
                            : `bg-gradient-to-br ${gradient} text-white`
                        }`}>
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={member.username}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            member.username[0]?.toUpperCase() || 'U'
                          )}
                        </div>
                        {member.is_online && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-stone-800 truncate">{member.username}</p>
                        <p className="text-xs text-stone-500">
                          Joined {formatRecentActivity(member.joined_at)}
                        </p>
                      </div>
                    </div>
                    {member.role !== 'member' && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        member.role === 'admin'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {member.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {members.length > 10 && (
                <Button
                  variant="outline"
                  className="w-full mt-2 text-amber-600 hover:bg-amber-50"
                  onClick={() => {
                    toast('Full member list coming soon!');
                  }}
                >
                  View all members ({members.length})
                </Button>
              )}
            </Card>
            {/* Community Guidelines */}
            <Card className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                Our Guidelines
              </h2>
              <ul className="space-y-2 text-sm text-stone-600">
                <li>• Share from the heart, listen with compassion</li>
                <li>• Respect different grief journeys and timelines</li>
                <li>• No unsolicited advice - ask before offering support</li>
                <li>• Keep personal details confidential</li>
                <li>• Report harmful content to moderators</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
      {/* Banner Upload Modal */}
      {bannerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-lg">
            <div className="p-5 border-b border-stone-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-stone-800">Update Community Banner</h3>
                <button
                  onClick={() => setBannerModalOpen(false)}
                  className="text-stone-400 hover:text-stone-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div
                className="border-2 border-dashed border-stone-300 rounded-lg p-6 text-center cursor-pointer hover:border-amber-400 transition-colors"
                onClick={() => document.getElementById('banner-modal-upload')?.click()}
              >
                {bannerPreview ? (
                  <div className="relative h-48 rounded-lg overflow-hidden">
                    <img
                      src={bannerPreview}
                      alt="Banner preview"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center text-white text-sm">
                      Click to change image
                    </div>
                  </div>
                ) : (
                  <div className="py-8">
                    <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                      <ImageIcon className="h-6 w-6 text-amber-700" />
                    </div>
                    <p className="text-stone-600">
                      Upload a banner image <br />
                      <span className="text-xs text-stone-500">Recommended: 1200x300px, max 5MB</span>
                    </p>
                  </div>
                )}
              </div>
              <input
                type="file"
                id="banner-modal-upload"
                accept="image/*"
                className="hidden"
                onChange={handleBannerFileSelect}
              />
              {bannerUploadError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {bannerUploadError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2 border-t border-stone-200">
                <Button
                  variant="outline"
                  onClick={() => setBannerModalOpen(false)}
                  className="text-stone-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => bannerFile && updateBanner(bannerFile)}
                  disabled={!bannerFile || bannerUploading}
                  className="bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2"
                >
                  {bannerUploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Update Banner'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}