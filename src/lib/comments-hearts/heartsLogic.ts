// src/lib/comments-hearts/heartsLogic.ts
import { createClient } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

/**
 * Maps a post table name to its corresponding likes table name.
 * Assumes convention: '<base>_posts' → '<base>_post_likes'
 * - 'posts' → 'post_likes'
 * - 'community_posts' → 'community_post_likes'
 * - 'event_posts' → 'event_post_likes'
 */
function getLikesTableName(postTableName: string): string {
  if (postTableName === 'posts') {
    return 'post_likes';
  }
  if (postTableName.endsWith('_posts')) {
    const base = postTableName.slice(0, -6); // removes '_posts'
    return `${base}_post_likes`;
  }
  throw new Error(
    `Unsupported post table name: '${postTableName}'. Expected 'posts' or '<base>_posts'.`
  );
}

/**
 * Validates that a post exists in the specified table.
 */
async function validatePostExists(postId: string, tableName: string): Promise<void> {
  const supabase = createClient();
  const { data: post, error } = await supabase
    .from(tableName)
    .select('id')
    .eq('id', postId)
    .single();

  if (error || !post) {
    throw new Error(`Post does not exist in table '${tableName}'`);
  }
}

/**
 * Toggles like status for a post by a user.
 * Returns updated like status and count.
 */
export async function toggleLike(
  postId: string,
  userId: string,
  tableName: string = 'posts'
) {
  const supabase = createClient();

  try {
    // ✅ Validate post exists
    await validatePostExists(postId, tableName);

    // ✅ Derive correct likes table name
    const likesTableName = getLikesTableName(tableName);

    // Check if user already liked this post
    const { data: existingLike, error: checkError } = await supabase
      .from(likesTableName)
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    let newLikeCount = 0;

    if (existingLike) {
      // 👎 Unlike the post
      const { error: unlikeError } = await supabase
        .from(likesTableName)
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (unlikeError) throw unlikeError;

      // Decrement like count safely
      const { data: postData, error: fetchError } = await supabase
        .from(tableName)
        .select('likes_count')
        .eq('id', postId)
        .single();

      if (fetchError) throw fetchError;

      newLikeCount = Math.max(0, (postData.likes_count || 0) - 1);

      const { error: updateError } = await supabase
        .from(tableName)
        .update({ likes_count: newLikeCount })
        .eq('id', postId);

      if (updateError) throw updateError;

      toast.success('Like removed');
      return { isLiked: false, likesCount: newLikeCount };
    } else {
      // 👍 Like the post
      const { error: likeError } = await supabase
        .from(likesTableName)
        .insert({
          post_id: postId,
          user_id: userId,
        });

      if (likeError) throw likeError;

      // Increment like count
      const { data: postData, error: fetchError } = await supabase
        .from(tableName)
        .select('likes_count')
        .eq('id', postId)
        .single();

      if (fetchError) throw fetchError;

      newLikeCount = (postData.likes_count || 0) + 1;

      const { error: updateError } = await supabase
        .from(tableName)
        .update({ likes_count: newLikeCount })
        .eq('id', postId);

      if (updateError) throw updateError;

      toast.success('Post liked');
      return { isLiked: true, likesCount: newLikeCount };
    }
  } catch (error: any) {
    console.error('Error toggling like:', error);
    toast.error(error.message || 'Failed to update like');
    throw error;
  }
}

/**
 * Checks if a user has already liked a post in a specific table.
 */
export async function checkIfLiked(
  postId: string,
  userId: string,
  tableName: string = 'posts'
) {
  const supabase = createClient();

  try {
    const likesTableName = getLikesTableName(tableName);

    const { data, error } = await supabase
      .from(likesTableName)
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return false; // No like found
    }

    if (error) throw error;
    return !!data;
  } catch (error: any) {
    console.error('Error checking like status:', error);
    return false;
  }
}

/**
 * Retrieves the current like count for a post in a specific table.
 */
export async function getLikeCount(
  postId: string,
  tableName: string = 'posts'
) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('likes_count')
      .eq('id', postId)
      .single();

    if (error) {
      console.warn(`Post not found or error fetching like count from table '${tableName}':`, error);
      return 0;
    }

    return data.likes_count || 0;
  } catch (error: any) {
    console.error('Error getting like count:', error);
    return 0;
  }
}