// app/messages/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { toast } from 'react-hot-toast';
import CallOverlay from '@/components/calling/CallOverlay';
import { Room, RoomEvent, LocalTrack, RemoteTrack, RemoteParticipant } from 'livekit-client';

import { joinCallRoom } from '@/lib/livekit';
import { useCall } from '@/context/CallContext';
type User = {
  id: string;
  full_name: string;
  avatar_url?: string;
  last_seen?: string;
  is_online?: boolean;
};

type ConversationSummary = {
  id: string;
  other_user_id: string;
  other_user_full_name: string;
  other_user_avatar_url?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  other_user_last_seen?: string;
  other_user_is_online?: boolean;
};

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender: { full_name: string; avatar_url?: string };
  reply_to?: string | null;
  file_url?: string | null;
  file_type?: string | null;
  deleted_for_me?: string[];
  deleted_for_everyone?: boolean;
  conversation_id: string;
  reactions?: Record<string, string[]>; // New: reactions tracking
};

interface EmojiMartEmoji {
  native: string;
  id: string;
  name?: string;
  unified?: string;
}

// Helper functions
const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?'; // or '', or 'U' for "Unknown"

  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
};

const formatTime = (isoString: string) => {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (isoString: string | null) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
const isUserOnline = (lastSeen: string | null | undefined): boolean => {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 60_000;
};
const formatLastSeen = (isoString: string | null) => {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const isImageUrl = (url: string) => {
  return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url);
};

const isPdfUrl = (url: string) => {
  return /\.pdf$/i.test(url);
};

export default function MessagesPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const [otherUserLastSeen, setOtherUserLastSeen] = useState<string | null>(null);

  const [otherUserPresenceLoaded, setOtherUserPresenceLoaded] = useState(false);
  
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showConversationMenu, setShowConversationMenu] = useState<string | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const lastActivityRef = useRef(Date.now());
const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // New state for long press/reactions
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{x: number, y: number} | null>(null);
  
  // Mobile view state
  const [isMobileView, setIsMobileView] = useState(false);
  const [showChatView, setShowChatView] = useState(false);
  
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const {
  callState,
  incomingCall,
  startCall,   // 👈 this is the key new function
  acceptCall,
  rejectCall,
  hangUp,
} = useCall();
  



useEffect(() => {
  console.log('MessagesPage: currentUserId =', currentUserId);
}, [currentUserId]);


  // Live-update other user's last_seen for accurate presence
useEffect(() => {
  if (!selectedConversation?.other_user_id) {
    setOtherUserLastSeen(null);
    setOtherUserPresenceLoaded(true); // no user = ready
    return;
  }

  const fetchOtherUserStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('last_seen')
        .eq('id', selectedConversation.other_user_id)
        .single();

      if (error) {
        setOtherUserLastSeen(null);
      } else {
        setOtherUserLastSeen(data.last_seen);
      }
    } catch (err) {
      console.error('Error fetching other user status:', err);
      setOtherUserLastSeen(null);
    } finally {
      setOtherUserPresenceLoaded(true); // ✅ mark as loaded even on error
    }
  };

  fetchOtherUserStatus(); // initial fetch
  const intervalId = setInterval(fetchOtherUserStatus, 10000);
  return () => clearInterval(intervalId);
}, [selectedConversation?.other_user_id, supabase]);
  // Check for mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session?.user) {
          router.push('/auth');
          return;
        }

        const userId = session.user.id;
        setCurrentUserId(userId);

        // Load other users (exclude current)
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, last_seen, is_online')
          .neq('id', userId);

        setUsers(profiles || []);

        // Load conversations
        const { data: convData, error: convError } = await supabase.rpc('get_user_conversations', {
          user_id: userId,
        });

        setConversations(convData || []);
        setIsLoading(false);
      } catch (err) {
        console.error('Load error:', err);
        toast.error('Failed to load messages');
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [router, supabase]);

  // Polling for new messages
  useEffect(() => {
    if (!selectedConversation || !currentUserId) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data: newMessages, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:sender_id (
              full_name,
              avatar_url
            )
          `)
          .eq('conversation_id', selectedConversation.id)
          .gt('created_at', messages[messages.length - 1]?.created_at || '1970-01-01')
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (newMessages && newMessages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const filteredNew = newMessages.filter(msg => !existingIds.has(msg.id));
            
            // Filter based on deletion status
            const validNewMessages = filteredNew.filter(msg => {
              if (msg.deleted_for_everyone) return true;
              if (msg.deleted_for_me?.includes(currentUserId)) return false;
              return true;
            });
            
            return [...prev, ...validNewMessages];
          });
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [selectedConversation, messages, currentUserId, supabase]);

  // Update user online status on page visibility
  useEffect(() => {
    const updateOnlineStatus = async () => {
      if (!currentUserId) return;
      
      try {
        await supabase
          .from('profiles')
          .update({ 
            is_online: true,
            last_seen: new Date().toISOString()
          })
          .eq('id', currentUserId);
      } catch (err) {
        console.error('Update online status error:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateOnlineStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial status update
    if (currentUserId) {
      updateOnlineStatus();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUserId, supabase]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const emojiPicker = document.querySelector('.emoji-picker-container');
      if (emojiPicker && !emojiPicker.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      
      if (!(event.target as Element).closest('.conversation-menu-container')) {
        setShowConversationMenu(null);
      }
      
      if (!(event.target as Element).closest('.message-menu-container')) {
        setShowMessageMenu(null);
      }
      
      if (!(event.target as Element).closest('.reaction-picker-container')) {
        setShowReactionPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);



  // Handle long press for reactions (only on others' messages)
  const handleLongPressStart = (messageId: string, isOwn: boolean, event: React.MouseEvent | React.TouchEvent) => {
    // Only allow reactions on others' messages
    if (isOwn) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // Get position for reaction picker
    let x, y;
    if ('touches' in event) {
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    } else {
      x = event.clientX;
      y = event.clientY;
    }
    
    const timer = setTimeout(() => {
      setShowReactionPicker(messageId);
      setReactionPickerPosition({ x, y });
    }, 500); // 500ms for long press
    
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;
    
    try {
      // Get current message
      const { data: currentMessage, error: fetchError } = await supabase
        .from('messages')
        .select('reactions')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      const currentReactions = currentMessage.reactions || {};
      const userReactions: string[] = currentReactions[currentUserId] || [];
      
      // Toggle reaction - remove if already exists, add if not
      let updatedReactions;
      if (userReactions.includes(emoji)) {
        updatedReactions = {
          ...currentReactions,
          [currentUserId]: userReactions.filter(r => r !== emoji)
        };
      } else {
        updatedReactions = {
          ...currentReactions,
          [currentUserId]: [...userReactions, emoji]
        };
      }

      // Update in database
      const { error: updateError } = await supabase
        .from('messages')
        .update({ reactions: updatedReactions })
        .eq('id', messageId);

      if (updateError) throw updateError;

      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, reactions: updatedReactions }
          : msg
      ));

      setShowReactionPicker(null);
    } catch (err) {
      console.error('Reaction error:', err);
      toast.error('Failed to add reaction');
    }
  };

  const openConversation = async (conv: ConversationSummary) => {
    if (!currentUserId) return;

    setSelectedConversation(conv);
    setMessages([]);
    setReplyingTo(null);
    setShowConversationMenu(null);
    
    if (isMobileView) {
      setShowChatView(true);
    }

    try {
      // Get all messages, including those marked as deleted
      const { data: allMessages, error: msgError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id (
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      // Filter messages based on deletion status
      const filteredMessages = (allMessages || []).filter(msg => {
        // If message is deleted for everyone, always show it as tombstone
        if (msg.deleted_for_everyone) {
          return true;
        }
        
        // If message is deleted for me, hide it
        if (msg.deleted_for_me?.includes(currentUserId)) {
          return false;
        }
        
        return true;
      });

      setMessages(filteredMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
      toast.error('Failed to load conversation');
    }
  };

  const handleStartNewConversation = async (userId: string) => {
    if (!currentUserId) return;
    setIsOpen(false);

    try {
      // Check for existing conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(
          `and(user1_id.eq.${currentUserId},user2_id.eq.${userId}),` +
          `and(user1_id.eq.${userId},user2_id.eq.${currentUserId})`
        )
        .maybeSingle();

      let convId: string;
      if (existing) {
        convId = existing.id;
      } else {
        // Create new conversation
        const user1 = currentUserId < userId ? currentUserId : userId;
        const user2 = currentUserId > userId ? currentUserId : userId;
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({ user1_id: user1, user2_id: user2 })
          .select('id')
          .single();

        if (convError) throw convError;
        convId = newConv!.id;
      }

      // Get other user's profile
      const { data: otherUser, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, last_seen, is_online')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      const newConv: ConversationSummary = {
        id: convId,
        other_user_id: otherUser.id,
        other_user_full_name: otherUser.full_name,
        other_user_avatar_url: otherUser.avatar_url,
        other_user_last_seen: otherUser.last_seen,
        other_user_is_online: otherUser.is_online,
      };

      // Update conversations list
      setConversations(prev => {
        if (!prev.some(c => c.id === convId)) {
          return [newConv, ...prev];
        }
        return prev;
      });

      setSelectedConversation(newConv);
      setMessages([]);
      if (isMobileView) {
        setShowChatView(true);
      }
    } catch (err) {
      console.error('Create conversation error:', err);
      toast.error('Failed to start conversation');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !currentUserId) return;
     trackActivity(); 
    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    
    // Optimistic message update
    const optimisticMessage: Message = {
      id: tempId,
      content,
      sender_id: currentUserId,
      created_at: now,
      sender: { full_name: 'You' },
      reply_to: replyingTo?.id || null,
      conversation_id: selectedConversation.id,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data: inserted, error: dbError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUserId,
          content,
          reply_to: replyingTo?.id || null,
        })
        .select(`
          *,
          sender:sender_id (
            full_name,
            avatar_url
          )
        `)
        .single();

      if (dbError) throw dbError;

      // Update messages with real data
      setMessages(prev =>
        prev.map(msg => (msg.id === tempId ? inserted : msg))
      );

      // Update conversations list
      setConversations(prev =>
        prev.map(conv =>
          conv.id === selectedConversation.id
            ? { ...conv, last_message: content, last_message_at: now }
            : conv
        )
      );
    } catch (err) {
      console.error('Send failed:', err);
      toast.error('Message failed to send');
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(content);
    } finally {
      setIsSending(false);
    }
  };
const updateLastSeen = useCallback(async () => {
  if (!currentUserId || document.hidden) return;
  try {
    await supabase
      .from(' profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', currentUserId);
  } catch (err) {
    console.warn('Failed to update last_seen:', err);
  }
}, [currentUserId, supabase]);

// Mark user as active
const trackActivity = useCallback(() => {
  lastActivityRef.current = Date.now();
}, []);


  const handleDeleteForMe = async (messageId: string) => {
    if (!currentUserId || !selectedConversation) return;

    try {
      // First, get the current message to check its deleted_for_me array
      const { data: currentMessage, error: fetchError } = await supabase
        .from('messages')
        .select('deleted_for_me, deleted_for_everyone')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      // Create or update the deleted_for_me array
      const updatedDeletedForMe = [
        ...(currentMessage.deleted_for_me || []),
        currentUserId
      ];

      // Update the message with current user added to deleted_for_me
      const { error: updateError } = await supabase
        .from('messages')
        .update({ 
          deleted_for_me: updatedDeletedForMe 
        })
        .eq('id', messageId);

      if (updateError) throw updateError;

      // Remove message from local state (unless it's deleted for everyone)
      setMessages(prev => {
        return prev.filter(msg => {
          // Keep message if it's deleted for everyone (show tombstone)
          if (msg.id === messageId && msg.deleted_for_everyone) {
            return true;
          }
          // Remove message if it's being deleted for me
          return msg.id !== messageId;
        });
      });
      
      toast.success('Message removed for you');
    } catch (err) {
      console.error('Delete for me failed:', err);
      toast.error('Failed to remove message');
    } finally {
      setShowMessageMenu(null);
    }
  };

  const handleDeleteForEveryone = async (messageId: string) => {
    if (!currentUserId || !selectedConversation) return;

    // Check if user is the sender
    const message = messages.find(m => m.id === messageId);
    if (!message || message.sender_id !== currentUserId) {
      toast.error('Only the sender can delete for everyone');
      return;
    }

    if (!confirm('Delete for everyone? This cannot be undone.')) {
      return;
    }

    try {
      // Soft delete by marking as deleted_for_everyone and updating content
      const { error: deleteError } = await supabase
        .from('messages')
        .update({ 
          deleted_for_everyone: true,
          content: '[Message deleted]',
          file_url: null,
          file_type: null
        })
        .eq('id', messageId);

      if (deleteError) throw deleteError;

      // Update local state to show deleted message placeholder
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              content: '[Message deleted]',
              file_url: null,
              file_type: null,
              deleted_for_everyone: true 
            }
          : msg
      ));
      
      toast.success('Message deleted for everyone');
    } catch (err) {
      console.error('Delete for everyone failed:', err);
      toast.error('Failed to delete message');
    } finally {
      setShowMessageMenu(null);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!currentUserId) {
      toast.error('You must be logged in to delete a conversation');
      return;
    }

    const prevConversations = [...conversations];
    try {
      // Call the PostgreSQL function
      const { error: rpcError } = await supabase
        .rpc('mark_conversation_deleted_for_user', {
          conv_id: conversationId,
          user_id: currentUserId,
        });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        throw rpcError;
      }

      // Optimistic UI update
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
        if (isMobileView) {
          setShowChatView(false);
        }
      }

      toast.success('Conversation hidden for you');
    } catch (err) {
      console.error('Delete conversation error:', err);
      toast.error('Failed to delete conversation');
      setConversations(prevConversations);
    } finally {
      setShowDeleteConfirm(null);
      setShowConversationMenu(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    trackActivity(); 
    
    const file = e.target.files?.[0];
    if (!file || !selectedConversation || !currentUserId) return;
    
    setUploading(true);
    
    try {
      const fileName = `${currentUserId}/${selectedConversation.id}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('message-files')
        .upload(fileName, file);
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('message-files')
        .getPublicUrl(fileName);
        
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUserId,
          content: file.name,
          file_url: publicUrl,
          file_type: file.type,
        });
        
      if (msgError) throw msgError;
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      toast.success('File sent successfully');
    } catch (err) {
      console.error('File upload error:', err);
      toast.error('Failed to send file');
    } finally {
      setUploading(false);
      setFilePreview(null);
    }
  };

  const handleEmojiSelect = (emoji: EmojiMartEmoji) => {
    setNewMessage((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };
const handleCallUser = async () => {
  if (!selectedConversation || !currentUserId) {
    toast.error('Unable to start call');
    return;
  }
  
  const roomName = selectedConversation.id; // Use conversation ID as room name
  const otherUserName = selectedConversation.other_user_full_name || 'User';
  const otherUserAvatar = selectedConversation.other_user_avatar_url || null;
  
  // Start the call with all required parameters
  await startCall(
    selectedConversation.other_user_id, 
    otherUserName, 
    'audio', 
    roomName,
    selectedConversation.id,
    otherUserAvatar
  );
  
  toast.success(`Calling ${otherUserName}...`);
};
  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefs.current.get(messageId);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
      setTimeout(() => {
        messageElement.style.backgroundColor = '';
      }, 2000);
    }
  };

  const handleBackToConversations = () => {
    setShowChatView(false);
    setSelectedConversation(null);
    setMessages([]);
  };

  // ——— RENDER ———
  if (isLoading) {
    return (
      <div style={{
        padding: '80px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#6b7280'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid #cbd5e1',
            borderTopColor: '#6366f1',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }}></div>
          Connecting your messages...
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Mobile view: Show chat view or conversations list
  if (isMobileView && showChatView && selectedConversation) {

 const {
  other_user_full_name,
  other_user_avatar_url
} = selectedConversation;
// Use the live-updated state instead of stale conversation data
const safeLastSeen = otherUserLastSeen;
    return (
      <div style={{
        height: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Mobile Chat Header */}
        <div style={{
          padding: '50px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <button
            onClick={handleBackToConversations}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px'
            }}
          >
            ←
          </button>
          
          {selectedConversation.other_user_avatar_url ? (
            <img
              src={selectedConversation.other_user_avatar_url}
              alt=""
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #e2e8f0'
              }}
            />
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#e0e7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              fontSize: '16px',
              color: '#4f46e5'
            }}>
              {getInitials(selectedConversation.other_user_full_name)}
            </div>
          )}
          
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0
            }}>
              {selectedConversation.other_user_full_name}
            </h3>
            <p style={{ fontSize: '12px', color: isUserOnline(safeLastSeen) ? '#10b981' : '#64748b', margin: '2px 0 0' }}>
  {isUserOnline(safeLastSeen) ? 'Online' : `Last seen ${formatLastSeen(safeLastSeen)}`}
</p>
          </div>
          
          {/* Call Button */}
          <button
            onClick={handleCallUser}
            style={{
              background: 'none',
              border: 'none',
              color: '#4f46e5',
              cursor: 'pointer',
              fontSize: '24px',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            📞
          </button>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: '#f9fafb'
        }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#94a3b8',
              marginTop: '40px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>🕊️</div>
              <p>
                This conversation is new.<br />
                Be the first to share.
              </p>
            </div>
          ) : (
            <>
              {messages.map(msg => {
                const isOwn = msg.sender_id === currentUserId;
                const repliedMessage = messages.find(m => m.id === msg.reply_to);
                const isDeleted = msg.deleted_for_everyone;
                const isDeletedForMe = msg.deleted_for_me?.includes(currentUserId || '');
                
                // Calculate reactions
                const reactions = msg.reactions || {};
                const allReactions = Object.values(reactions).flat();
                const reactionCounts = allReactions.reduce((acc, emoji) => {
                  acc[emoji] = (acc[emoji] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                
                return (
                  <div
                    key={msg.id}
                    ref={(el) => {
                      if (el) {
                        messageRefs.current.set(msg.id, el);
                      } else {
                        messageRefs.current.delete(msg.id);
                      }
                    }}
                    id={`message-${msg.id}`}
                    style={{
                      display: 'flex',
                      justifyContent: isOwn ? 'flex-end' : 'flex-start',
                      position: 'relative'
                    }}
                  >
                    {!isOwn && (
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#e0e7ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        fontSize: '12px',
                        color: '#4f46e5',
                        flexShrink: 0,
                        marginRight: '8px',
                        marginTop: repliedMessage ? '20px' : '0'
                      }}>
                        {msg.sender.full_name.charAt(0)}
                      </div>
                    )}
                    
                    <div style={{
                      maxWidth: '80%',
                      position: 'relative'
                    }}>
                      {repliedMessage && !repliedMessage.deleted_for_everyone && !repliedMessage.deleted_for_me?.includes(currentUserId || '') && (
                        <div 
                          onClick={() => scrollToMessage(repliedMessage.id)}
                          style={{
                            backgroundColor: '#f1f5f6',
                            borderRadius: '10px',
                            padding: '6px 10px',
                            marginBottom: '6px',
                            fontSize: '12px',
                            borderLeft: '2px solid #94a3b8',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontWeight: '500', color: '#334155' }}>
                            {repliedMessage.sender.full_name}
                          </div>
                          <div style={{ color: '#64748b' }}>
                            {repliedMessage.content === '[Message deleted]' ? 'Message deleted' : repliedMessage.content.substring(0, 40)}{repliedMessage.content.length > 40 ? '...' : ''}
                          </div>
                        </div>
                      )}
                      
                      <div
                        onMouseDown={(e) => {
                          if (!isDeleted && !isDeletedForMe && !isOwn && e.button === 0) {
                            handleLongPressStart(msg.id, isOwn, e);
                          }
                        }}
                        onMouseUp={(e) => {
                          if (!isDeleted && !isDeletedForMe && !isOwn && e.button === 0) {
                            handleLongPressEnd(e);
                          }
                        }}
                        onMouseLeave={handleLongPressEnd}
                        onTouchStart={(e) => {
                          if (!isDeleted && !isDeletedForMe && !isOwn) {
                            handleLongPressStart(msg.id, isOwn, e);
                          }
                        }}
                        onTouchEnd={handleLongPressEnd}
                        onTouchCancel={handleLongPressEnd}
                        style={{
                          padding: '10px 14px',
                          borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          backgroundColor: isDeleted ? '#f3f4f6' : (isOwn ? '#e0e7ff' : '#f1f5f6'),
                          color: isDeleted ? '#9ca3af' : (isOwn ? '#312e81' : '#1e293b'),
                          fontSize: '14px',
                          lineHeight: '1.4',
                          position: 'relative',
                          paddingRight: '30px',
                          fontStyle: isDeleted ? 'italic' : 'normal',
                          cursor: isDeleted ? 'default' : (isOwn ? 'default' : 'pointer'),
                          userSelect: 'none',
                          WebkitUserSelect: 'none'
                        }}
                      >
                        {/* Message Menu Button - Only show for non-tombstone, non-deleted-for-me messages */}
                        {currentUserId && !isDeletedForMe && !isDeleted && (
                          <div className="message-menu-container" style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            opacity: 0,
                            transition: 'opacity 0.2s'
                          }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowMessageMenu(showMessageMenu === msg.id ? null : msg.id);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)';
                                e.currentTarget.parentElement!.style.opacity = '1';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                if (showMessageMenu !== msg.id) {
                                  e.currentTarget.parentElement!.style.opacity = '0';
                                }
                              }}
                            >
                              ⋮
                            </button>

                            {/* Message Menu Dropdown - Only show non-delete options for tombstone messages */}
                            {showMessageMenu === msg.id && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                backgroundColor: 'white',
                                borderRadius: '8px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                zIndex: 10,
                                minWidth: '140px',
                                overflow: 'hidden'
                              }}>
                                {!isDeleted && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReplyingTo(msg);
                                        setShowMessageMenu(null);
                                        messageInputRef.current?.focus();
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        textAlign: 'left',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#334155',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        borderBottom: '1px solid #f1f5f6'
                                      }}
                                    >
                                      ↩️ Reply
                                    </button>
                                    
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteForMe(msg.id);
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        textAlign: 'left',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        borderBottom: '1px solid #f1f5f6'
                                      }}
                                    >
                                      🗑️ Delete for Me
                                    </button>
                                  </>
                                )}
                                
                                {/* Only show "Delete for Everyone" if sender AND not already deleted (tombstone) */}
                                {isOwn && !isDeleted && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteForEveryone(msg.id);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '10px 14px',
                                      textAlign: 'left',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: '#ef4444',
                                      fontSize: '14px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}
                                  >
                                    🗑️ Delete for Everyone
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Message Content */}
                        {isDeleted ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px' }}>🗑️</span>
                            <span>Message deleted</span>
                          </div>
                        ) : msg.file_url ? (
                          <div>
                            {(() => {
                              const url = msg.file_url;
                              if (isImageUrl(url)) {
                                return (
                                  <img
                                    src={url}
                                    alt="Attachment"
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '200px',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => window.open(url, '_blank')}
                                  />
                                );
                              }
                              if (isPdfUrl(url)) {
                                return (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px',
                                      backgroundColor: 'white',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '8px',
                                    }}
                                  >
                                    <div style={{ fontSize: '20px', color: '#ef4444' }}>📄</div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: '500', fontSize: '12px' }}>{msg.content}</div>
                                      <div style={{ fontSize: '10px', color: '#64748b' }}>PDF Document</div>
                                    </div>
                                    <button
                                      onClick={() => window.open(url, '_blank')}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#4f46e5',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                      }}
                                    >
                                      Open
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: '#4f46e5',
                                    textDecoration: 'underline',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '14px'
                                  }}
                                >
                                  📎 {msg.content}
                                </a>
                              );
                            })()}
                          </div>
                        ) : (
                          <div>{msg.content}</div>
                        )}
                        
                        {/* Reactions Display */}
                        {Object.keys(reactionCounts).length > 0 && (
                          <div style={{
                            display: 'flex',
                            gap: '2px',
                            marginTop: '6px',
                            flexWrap: 'wrap'
                          }}>
                            {Object.entries(reactionCounts).map(([emoji, count]) => (
                              <div
                                key={emoji}
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                  borderRadius: '10px',
                                  padding: '1px 4px',
                                  fontSize: '10px',
                                  border: '1px solid #e2e8f0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '1px'
                                }}
                              >
                                <span>{emoji}</span>
                                <span style={{ color: '#64748b', fontWeight: '500' }}>{count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div style={{
                          fontSize: '10px',
                          textAlign: 'right',
                          marginTop: '4px',
                          color: isDeleted ? '#9ca3af' : (isOwn ? '#4f46e5' : '#94a3b8'),
                        }}>
                          <span>{formatTime(msg.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Reaction Picker Modal */}
        {showReactionPicker && reactionPickerPosition && (
          <div 
            className="reaction-picker-container"
            style={{
              position: 'fixed',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'white',
              borderRadius: '24px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              zIndex: 1000,
              padding: '8px',
              display: 'flex',
              gap: '8px',
              border: '1px solid #e2e8f0'
            }}
          >
            {['❤️', '😊', '👍', '👏', '🙏', '🎉', '😢', '🤔'].map(emoji => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  handleReaction(showReactionPicker, emoji);
                }}
                style={{
                  fontSize: '24px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '50%',
                  transition: 'transform 0.2s'
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Reply Preview */}
        {replyingTo && !replyingTo.deleted_for_everyone && !replyingTo.deleted_for_me?.includes(currentUserId || '') && (
          <div style={{
            padding: '10px 16px',
            backgroundColor: '#f0f4ff',
            borderTop: '1px solid #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{ flex: 1, fontSize: '12px', color: '#4f46e5' }}>
              <div style={{ fontWeight: '600', marginBottom: '2px' }}>Replying to {replyingTo.sender.full_name}</div>
              <div 
                onClick={() => scrollToMessage(replyingTo.id)}
                style={{ 
                  color: '#312e81',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.5)',
                  display: 'inline-block'
                }}
              >
                {replyingTo.content === '[Message deleted]' ? 'Message deleted' : replyingTo.content.substring(0, 40)}{replyingTo.content.length > 40 ? '...' : ''}
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Message Input */}
        <form
          onSubmit={handleSendMessage}
          style={{
            padding: '12px 16px',
            backgroundColor: 'white',
            paddingBottom: '70px',
            borderTop: '1px solid #e2e8f0',
            position: 'sticky',
            bottom: 0,
            zIndex: 10
          }}
        >
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#64748b',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              😊
            </button>
            
         <input
  ref={messageInputRef}
  type="text"
  value={newMessage}
  onChange={(e) => {
    setNewMessage(e.target.value);
    trackActivity(); // 👈 this marks you as active while typing
  }}
  placeholder={replyingTo ? "Write your reply..." : "Type your message…"}
  disabled={isSending || uploading}
  style={{
    flex: 1,
    padding: '12px 16px',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    backgroundColor: '#f8fafc',
    color: '#1e293b'
  }}
/>
            
            <label htmlFor="file-upload-mobile" style={{ 
              cursor: 'pointer', 
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <input
                id="file-upload-mobile"
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,.pdf"
                style={{ display: 'none' }}
              />
              {uploading ? (
                <div style={{ color: '#94a3b8' }}>📤</div>
              ) : (
                <div style={{ fontSize: '20px', color: '#64748b' }}>📎</div>
              )}
            </label>
            
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending || uploading}
              style={{
                padding: '12px 20px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: newMessage.trim() && !isSending && !uploading ? '#4f46e5' : '#cbd5e1',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                cursor: newMessage.trim() && !isSending && !uploading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isSending ? '...' : 'Send'}
            </button>
          </div>
          
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div 
              className="emoji-picker-container"
              style={{
                position: 'absolute',
                bottom: '60px',
                left: '0',
                width: '100%',
                zIndex: 100,
                boxShadow: '0 -5px 20px rgba(0,0,0,0.1)',
                borderRadius: '12px 12px 0 0',
                overflow: 'hidden'
              }}
            >
              <Picker 
                data={data} 
                onEmojiSelect={handleEmojiSelect} 
                theme="light"
                previewPosition="none"
                maxFrequentRows={0}
                navPosition="none"
                skinTonePosition="none"
                perLine={8}
              />
            </div>
          )}
        </form>
      </div>
    );
  }

  // Desktop view or mobile conversations list
  return (
    <div style={{
      padding: isMobileView ? '16px' : '80px 16px',
      maxWidth: '1200px',
      margin: '0 auto',
      backgroundColor: '#f9fafb',
      minHeight: isMobileView ? '100vh' : 'calc(100vh - 80px)'
    }}>
      {/* Header */}
      {!isMobileView && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
          paddingLeft: '8px',
          paddingRight: '8px'
        }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1e293b'
          }}>Your Messages</h1>
          <button
            onClick={() => setIsOpen(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4f46e5',
              color: 'white',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '15px',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4338ca'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
          >
            New Message
          </button>
        </div>
      )}

      {/* Mobile Header */}
      {isMobileView && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: '0 8px'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#1e293b'
          }}>Messages</h1>
          <button
            onClick={() => setIsOpen(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4f46e5',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            New
          </button>
        </div>
      )}

      {/* New Message Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b' }}>Start a New Conversation</h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                ✕
              </button>
            </div>
            <p style={{ marginBottom: '16px', color: '#64748b' }}>
              Choose someone to connect with. You can share support, stories, or just listen.
            </p>
            <label style={{ display: 'block', fontSize: '15px', fontWeight: '600', marginBottom: '10px', color: '#334155' }}>
              Select a person:
            </label>
            <select
              value=""
              onChange={(e) => e.target.value && handleStartNewConversation(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '16px',
                backgroundColor: '#f8fafc',
                color: '#1e293b'
              }}
            >
              <option value="" disabled>— Choose someone to message —</option>
              {users.map(user => (
                <option key={user.id} value={user.id} style={{ padding: '8px' }}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
              Delete Conversation
            </h3>
            <p style={{ marginBottom: '24px', color: '#64748b', lineHeight: '1.5' }}>
              Are you sure you want to delete this conversation? This will only hide it for you.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConversation(showDeleteConfirm)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px'
                }}>
                Delete for Me
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reaction Picker Modal */}
      {showReactionPicker && reactionPickerPosition && (
        <div 
          className="reaction-picker-container"
          style={{
            position: 'fixed',
            top: reactionPickerPosition.y - 60,
            left: reactionPickerPosition.x - 100,
            backgroundColor: 'white',
            borderRadius: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 1000,
            padding: '8px',
            display: 'flex',
            gap: '8px',
            border: '1px solid #e2e8f0'
          }}
        >
          {['❤️', '😊', '👍', '👏', '🙏', '🎉', '😢', '🤔'].map(emoji => (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                handleReaction(showReactionPicker, emoji);
              }}
              style={{
                fontSize: '24px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '50%',
                transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main Content - Only show conversations list on mobile when not in chat view */}
      {!isMobileView || (isMobileView && !showChatView) ? (
        <div style={{
          display: 'flex',
          gap: isMobileView ? '0' : '24px',
          flexWrap: isMobileView ? 'wrap' : 'nowrap'
        }}>
          {/* Conversations Sidebar */}
          <div style={{
            flex: '1',
            minWidth: isMobileView ? '100%' : '300px',
            maxWidth: isMobileView ? '100%' : '400px',
            backgroundColor: 'white',
            borderRadius: isMobileView ? '12px' : '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: isMobileView ? '16px' : '20px',
              borderBottom: '1px solid #f1f5f6',
              backgroundColor: '#f8fafc'
            }}>
              <h2 style={{ fontSize: isMobileView ? '16px' : '18px', fontWeight: '600', color: '#334155' }}>
                Your Conversations
              </h2>
            </div>
            <div style={{
              maxHeight: isMobileView ? 'calc(100vh - 180px)' : '600px',
              overflowY: 'auto'
            }}>
              {conversations.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#94a3b8'
                }}>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    opacity: 0.4
                  }}>💬</div>
                  <p style={{ fontSize: '15px' }}>
                    No conversations yet.<br />
                    Start one with someone who understands.
                  </p>
                </div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    style={{
                      padding: isMobileView ? '12px 16px' : '16px 20px',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '12px',
                      borderBottom: '1px solid #f1f5f6',
                      backgroundColor: selectedConversation?.id === conv.id ? '#f0f4ff' : 'transparent',
                      position: 'relative'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = selectedConversation?.id === conv.id ? '#f0f4ff' : '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = selectedConversation?.id === conv.id ? '#f0f4ff' : 'transparent'}
                  >
                    {conv.other_user_avatar_url ? (
                      <img
                        src={conv.other_user_avatar_url}
                        alt=""
                        style={{
                          width: isMobileView ? '44px' : '50px',
                          height: isMobileView ? '44px' : '50px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #e2e8f0'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: isMobileView ? '44px' : '50px',
                        height: isMobileView ? '44px' : '50px',
                        borderRadius: '50%',
                        backgroundColor: '#e0e7ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        fontSize: isMobileView ? '16px' : '18px',
                        color: '#4f46e5'
                      }}>
                        {getInitials(conv.other_user_full_name)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: isMobileView ? '15px' : '16px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {conv.other_user_full_name}
                       {isUserOnline(conv.other_user_last_seen) && (
  <span style={{
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    display: 'inline-block'
  }}></span>
)}
                      </div>
                      {conv.last_message && (
                        <div style={{
                          fontSize: isMobileView ? '13px' : '14px',
                          color: '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: '2px'
                        }}>
                          {conv.last_message === '[Message deleted]' ? 'Message deleted' : conv.last_message}
                        </div>
                      )}
                      {conv.last_message_at && (
                        <div style={{
                          fontSize: isMobileView ? '11px' : '12px',
                          color: '#94a3b8',
                          marginTop: '2px'
                        }}>
                          {formatDate(conv.last_message_at)}
                        </div>
                      )}
                    </div>
                    
                    {/* Conversation Menu Button */}
                    <div className="conversation-menu-container" style={{ position: 'relative' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowConversationMenu(showConversationMenu === conv.id ? null : conv.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '20px',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        ⋮
                      </button>
                      
                      {/* Conversation Menu Dropdown */}
                      {showConversationMenu === conv.id && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                          zIndex: 10,
                          minWidth: '160px',
                          overflow: 'hidden'
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(conv.id);
                            }}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#ef4444',
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            🗑️ Delete Conversation
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Desktop Chat Area */}
          {!isMobileView && (
            <div style={{
              flex: '2',
              minWidth: '300px'
            }}>
              {selectedConversation ? (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '70vh'
                }}>
                  {/* Chat Header with Call Button */}
                  <div style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid #f1f5f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#f8fafc'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {selectedConversation.other_user_avatar_url ? (
                        <img
                          src={selectedConversation.other_user_avatar_url}
                          alt=""
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #e2e8f0'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          backgroundColor: '#e0e7ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '600',
                          fontSize: '18px',
                          color: '#4f46e5'
                        }}>
                          {getInitials(selectedConversation.other_user_full_name)}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <h3 style={{
  fontSize: '18px',
  fontWeight: '700',
  color: '#1e293b',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
}}>
  {selectedConversation.other_user_full_name}
  {isUserOnline(selectedConversation?.other_user_last_seen ?? null)&& (
    <span style={{
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: '#10b981',
      display: 'inline-block'
    }}></span>
  )}
</h3>
{otherUserPresenceLoaded && (
  <p style={{ fontSize: '14px', color: isUserOnline(otherUserLastSeen) ? '#10b981' : '#64748b', margin: '4px 0 0' }}>
    {isUserOnline(otherUserLastSeen) ? 'Online' : `Last seen ${formatLastSeen(otherUserLastSeen)}`}
  </p>
)}
                      </div>
                    </div>
                    
                    {/* Call Button */}
                    <button
                      onClick={handleCallUser}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '15px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0da271'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                    >
                      <span style={{ fontSize: '18px' }}>📞</span>
                      <span>Call {selectedConversation.other_user_full_name}</span>
                    </button>
                  </div>

                  {/* Messages */}
                  <div style={{
                    flex: 1,
                    padding: '24px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    {messages.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        color: '#94a3b8',
                        marginTop: '40px'
                      }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>🕊️</div>
                        <p>
                          This conversation is new.<br />
                          Be the first to share.
                        </p>
                      </div>
                    ) : (
                      <>
                        {messages.map(msg => {
                          const isOwn = msg.sender_id === currentUserId;
                          const repliedMessage = messages.find(m => m.id === msg.reply_to);
                          const isDeleted = msg.deleted_for_everyone;
                          const isDeletedForMe = msg.deleted_for_me?.includes(currentUserId || '');
                          
                          // Calculate reactions
                          const reactions = msg.reactions || {};
                          const allReactions = Object.values(reactions).flat();
                          const reactionCounts = allReactions.reduce((acc, emoji) => {
                            acc[emoji] = (acc[emoji] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          
                          return (
                            <div
                              key={msg.id}
                              ref={(el) => {
                                if (el) {
                                  messageRefs.current.set(msg.id, el);
                                } else {
                                  messageRefs.current.delete(msg.id);
                                }
                              }}
                              id={`message-${msg.id}`}
                              style={{
                                display: 'flex',
                                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                                position: 'relative'
                              }}
                            >
                              {!isOwn && (
                                <div style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  backgroundColor: '#e0e7ff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: '600',
                                  fontSize: '14px',
                                  color: '#4f46e5',
                                  flexShrink: 0,
                                  marginRight: '12px',
                                  marginTop: repliedMessage ? '24px' : '0'
                                }}>
                                  {msg.sender.full_name.charAt(0)}
                                </div>
                              )}
                              
                              <div style={{
                                maxWidth: '70%',
                                position: 'relative'
                              }}>
                                {repliedMessage && !repliedMessage.deleted_for_everyone && !repliedMessage.deleted_for_me?.includes(currentUserId || '') && (
                                  <div 
                                    onClick={() => scrollToMessage(repliedMessage.id)}
                                    style={{
                                      backgroundColor: '#f1f5f6',
                                      borderRadius: '12px',
                                      padding: '8px 12px',
                                      marginBottom: '8px',
                                      fontSize: '13px',
                                      borderLeft: '2px solid #94a3b8',
                                      cursor: 'pointer',
                                      transition: 'background-color 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f1f5f6'}
                                  >
                                    <div style={{ fontWeight: '500', color: '#334155' }}>
                                      {repliedMessage.sender.full_name}
                                    </div>
                                    <div style={{ color: '#64748b' }}>
                                      {repliedMessage.content === '[Message deleted]' ? 'Message deleted' : repliedMessage.content.substring(0, 50)}{repliedMessage.content.length > 50 ? '...' : ''}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                      Click to view
                                    </div>
                                  </div>
                                )}
                                
                                <div
                                  onMouseDown={(e) => {
                                    if (!isDeleted && !isDeletedForMe && !isOwn && e.button === 0) {
                                      handleLongPressStart(msg.id, isOwn, e);
                                    }
                                  }}
                                  onMouseUp={(e) => {
                                    if (!isDeleted && !isDeletedForMe && !isOwn && e.button === 0) {
                                      handleLongPressEnd(e);
                                    }
                                  }}
                                  onMouseLeave={handleLongPressEnd}
                                  onTouchStart={(e) => {
                                    if (!isDeleted && !isDeletedForMe && !isOwn) {
                                      handleLongPressStart(msg.id, isOwn, e);
                                    }
                                  }}
                                  onTouchEnd={handleLongPressEnd}
                                  onTouchCancel={handleLongPressEnd}
                                  style={{
                                    padding: '14px 18px',
                                    borderRadius: isOwn ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                    backgroundColor: isDeleted ? '#f3f4f6' : (isOwn ? '#e0e7ff' : '#f1f5f6'),
                                    color: isDeleted ? '#9ca3af' : (isOwn ? '#312e81' : '#1e293b'),
                                    fontSize: '15px',
                                    lineHeight: '1.5',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    position: 'relative',
                                    paddingRight: isDeleted ? '18px' : '40px',
                                    fontStyle: isDeleted ? 'italic' : 'normal',
                                    cursor: isDeleted ? 'default' : (isOwn ? 'default' : 'pointer'),
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                   
                                  }}
                                >
                                  {/* Message Menu Button - Only show for non-tombstone, non-deleted-for-me messages */}
                                  {currentUserId && !isDeletedForMe && !isDeleted && (
                                    <div className="message-menu-container" style={{
                                      position: 'absolute',
                                      top: '10px',
                                      right: '10px',
                                      opacity: 0,
                                      transition: 'opacity 0.2s'
                                    }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowMessageMenu(showMessageMenu === msg.id ? null : msg.id);
                                        }}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#64748b',
                                          cursor: 'pointer',
                                          fontSize: '18px',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                        onMouseOver={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)';
                                          e.currentTarget.parentElement!.style.opacity = '1';
                                        }}
                                        onMouseOut={(e) => {
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                          if (showMessageMenu !== msg.id) {
                                            e.currentTarget.parentElement!.style.opacity = '0';
                                          }
                                        }}
                                      >
                                        ⋮
                                      </button>

                                      {/* Message Menu Dropdown - Only show non-delete options for tombstone messages */}
                                      {showMessageMenu === msg.id && (
                                        <div style={{
                                          position: 'absolute',
                                          top: '100%',
                                          right: 0,
                                          backgroundColor: 'white',
                                          borderRadius: '8px',
                                          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                          zIndex: 10,
                                          minWidth: '140px',
                                          overflow: 'hidden'
                                        }}>
                                          {!isDeleted && (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setReplyingTo(msg);
                                                  setShowMessageMenu(null);
                                                  messageInputRef.current?.focus();
                                                }}
                                                style={{
                                                  width: '100%',
                                                  padding: '10px 14px',
                                                  textAlign: 'left',
                                                  background: 'none',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                  color: '#334155',
                                                  fontSize: '14px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '8px',
                                                  borderBottom: '1px solid #f1f5f6'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                              >
                                                ↩️ Reply
                                              </button>
                                              
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteForMe(msg.id);
                                                }}
                                                style={{
                                                  width: '100%',
                                                  padding: '10px 14px',
                                                  textAlign: 'left',
                                                  background: 'none',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                  color: '#6b7280',
                                                  fontSize: '14px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '8px',
                                                  borderBottom: '1px solid #f1f5f6'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                              >
                                                🗑️ Delete for Me
                                              </button>
                                            </>
                                          )}
                                          
                                          {/* Only show "Delete for Everyone" if sender AND not already deleted (tombstone) */}
                                          {isOwn && !isDeleted && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteForEveryone(msg.id);
                                              }}
                                              style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                textAlign: 'left',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#ef4444',
                                                fontSize: '14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                              }}
                                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                              🗑️ Delete for Everyone
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Message Content */}
                                  {isDeleted ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '14px' }}>🗑️</span>
                                      <span>Message deleted</span>
                                    </div>
                                  ) : msg.file_url ? (
                                    <div>
                                      {(() => {
                                        const url = msg.file_url;
                                        if (isImageUrl(url)) {
                                          return (
                                            <div style={{ position: 'relative' }}>
                                              <img
                                                src={url}
                                                alt="Attachment"
                                                style={{
                                                  maxWidth: '100%',
                                                  maxHeight: '300px',
                                                  borderRadius: '8px',
                                                  cursor: 'pointer',
                                                }}
                                                onClick={() => window.open(url, '_blank')}
                                              />
                                            </div>
                                          );
                                        }
                                        if (isPdfUrl(url)) {
                                          return (
                                            <div
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '10px',
                                                backgroundColor: 'white',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                              }}
                                            >
                                              <div style={{ fontSize: '24px', color: '#ef4444' }}>📄</div>
                                              <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '500' }}>{msg.content}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>PDF Document</div>
                                              </div>
                                              <button
                                                onClick={() => window.open(url, '_blank')}
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  color: '#4f46e5',
                                                  cursor: 'pointer',
                                                }}
                                              >
                                                Open
                                              </button>
                                            </div>
                                          );
                                        }
                                        return (
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              color: '#4f46e5',
                                              textDecoration: 'underline',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                            }}
                                          >
                                            📎 {msg.content}
                                          </a>
                                        );
                                      })()}
                                    </div>
                                  ) : (
                                    <div>{msg.content}</div>
                                  )}
                                  
                                  {/* Reactions Display */}
                                  {Object.keys(reactionCounts).length > 0 && (
                                    <div style={{
                                      display: 'flex',
                                      gap: '4px',
                                      marginTop: '8px',
                                      flexWrap: 'wrap'
                                    }}>
                                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                                        <div
                                          key={emoji}
                                          style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                            borderRadius: '12px',
                                            padding: '2px 6px',
                                            fontSize: '12px',
                                            border: '1px solid #e2e8f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}
                                        >
                                          <span>{emoji}</span>
                                          <span style={{ color: '#64748b', fontWeight: '500' }}>{count}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  <div style={{
                                    fontSize: '11px',
                                    textAlign: 'right',
                                    marginTop: '6px',
                                    color: isDeleted ? '#9ca3af' : (isOwn ? '#4f46e5' : '#94a3b8'),
                                  }}>
                                    <span>{formatTime(msg.created_at)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>

                  {/* Reply Preview */}
                  {replyingTo && !replyingTo.deleted_for_everyone && !replyingTo.deleted_for_me?.includes(currentUserId || '') && (
                    <div style={{
                      padding: '12px 24px',
                      backgroundColor: '#f0f4ff',
                      borderTop: '1px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <div style={{ flex: 1, fontSize: '14px', color: '#4f46e5' }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>Replying to {replyingTo.sender.full_name}</div>
                        <div 
                          onClick={() => scrollToMessage(replyingTo.id)}
                          style={{ 
                            color: '#312e81',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.5)',
                            display: 'inline-block'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.8)'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'}
                        >
                          {replyingTo.content === '[Message deleted]' ? 'Message deleted' : replyingTo.content.substring(0, 60)}{replyingTo.content.length > 60 ? '...' : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          fontSize: '18px',
                          padding: '4px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Message Input */}
                  <form
                    onSubmit={handleSendMessage}
                    style={{
                      padding: '16px 24px 24px',
                      borderTop: '1px solid #f1f5f6'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      position: 'relative'
                    }}>
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '20px',
                          cursor: 'pointer',
                          color: '#64748b',
                          padding: '8px'
                        }}
                      >
                        😊
                      </button>
                      
                      <input
                        ref={messageInputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={replyingTo ? "Write your reply..." : "Type your message… Be kind, be present."}
                        disabled={isSending || uploading}
                        style={{
                          flex: 1,
                          padding: '14px 20px',
                          borderRadius: '14px',
                          border: '1px solid #e2e8f0',
                          fontSize: '15px',
                          backgroundColor: '#f8fafc',
                          color: '#1e293b'
                        }}
                      />
                      
                      <label htmlFor="file-upload" style={{ 
                        cursor: 'pointer', 
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <input
                          id="file-upload"
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/*,.pdf"
                          style={{ display: 'none' }}
                        />
                        {uploading ? (
                          <div style={{ color: '#94a3b8' }}>📤</div>
                        ) : (
                          <div style={{ fontSize: '20px', color: '#64748b' }}>📎</div>
                        )}
                      </label>
                      
                      <button
                        type="submit"
                        disabled={!newMessage.trim() || isSending || uploading}
                        style={{
                          padding: '14px 28px',
                          borderRadius: '14px',
                          border: 'none',
                          backgroundColor: newMessage.trim() && !isSending && !uploading ? '#4f46e5' : '#cbd5e1',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '15px',
                          cursor: newMessage.trim() && !isSending && !uploading ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        {isSending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                    
                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                      <div 
                        className="emoji-picker-container"
                        style={{
                          position: 'absolute',
                          bottom: '70px',
                          left: '50px',
                          zIndex: 100,
                          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                          borderRadius: '12px',
                          overflow: 'hidden'
                        }}
                      >
                        <Picker 
                          data={data} 
                          onEmojiSelect={handleEmojiSelect} 
                          theme="light"
                          previewPosition="none"
                          maxFrequentRows={0}
                          navPosition="none"
                        />
                      </div>
                    )}
                  </form>
                </div>
              ) : (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  padding: '60px 30px',
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>💬</div>
                  <h3 style={{ fontSize: '22px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
                    Your Support Circle
                  </h3>
                  <p style={{ fontSize: '16px', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
                    Select a conversation from the list to connect, share, or simply listen. You are not alone.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
      <CallOverlay />
    </div>
  );
}