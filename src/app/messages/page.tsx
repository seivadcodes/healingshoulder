// app/messages/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Picker, { Theme } from 'emoji-picker-react';
import { toast } from 'react-hot-toast';
import CallOverlay from '@/components/calling/CallOverlay';
import Image from 'next/image';
import FooterNav from '@/components/layout/FooterNav';


import { useCall } from '@/context/CallContext';
import { consumePendingConversation } from '@/lib/conversationHandoff';
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
  unread_count?: number;
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
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [otherUserPresenceLoaded, setOtherUserPresenceLoaded] = useState(false);

  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [uploading, setUploading] = useState(false);
  const [showConversationMenu, setShowConversationMenu] = useState<string | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const lastActivityRef = useRef(Date.now());
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);

  // New state for long press/reactions
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ x: number, y: number } | null>(null);

  // Mobile view state
  const [isMobileView, setIsMobileView] = useState(false);
  const [showChatView, setShowChatView] = useState(false);

  // In Header.tsx


  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [offlineMessageQueue, setOfflineMessageQueue] = useState<Array<{
    tempId: string;
    content: string;
    conversationId: string;
    replyTo?: string | null;
    fileUrl?: string;
    fileType?: string;
  }>>([]);
  const [isOnline, setIsOnline] = useState(true);

  const {

    startCall,   // 👈 this is the key new function

  } = useCall();



  // Add this new state
  const [lastReadConversationId, setLastReadConversationId] = useState<string | null>(null);

  // Add this effect to handle the event dispatch after render
  useEffect(() => {
    if (lastReadConversationId && conversations.length > 0) {
      // Calculate total unread after state has updated
      const totalUnread = conversations.reduce((sum, conv) =>
        sum + (conv.unread_count || 0), 0);

      // Dispatch event safely after render
      window.dispatchEvent(new CustomEvent('unreadUpdate', { detail: totalUnread }));

      // Reset the trigger
      setLastReadConversationId(null);
    }
  }, [lastReadConversationId, conversations]);

  const loadMessagesForConversation = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;
      try {
        const { data: allMessages, error: msgError } = await supabase
          .from('messages')
          .select(`*, sender:sender_id (full_name, avatar_url)`)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
        if (msgError) throw msgError;
        const filteredMessages = (allMessages || []).filter((msg) => {
          if (msg.deleted_for_everyone) return true;
          if (msg.deleted_for_me?.includes(currentUserId)) return false;
          return true;
        });
        setMessages(filteredMessages);
      } catch (err) {
        console.error('Error loading messages:', err);
        toast.error('Failed to load conversation');
      }
    },
    [currentUserId, supabase, setMessages]
  );

  const markConversationAsRead = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;
      try {
        const { error } = await supabase.rpc('mark_conversation_read', {
          p_conv_id: conversationId,
          p_user_id: currentUserId,
        });
        if (error) {
          console.warn('Failed to mark conversation as read:', error);
          return;
        }
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
          )
        );
        setLastReadConversationId(conversationId);
      } catch (err) {
        console.error('Unexpected error in markConversationAsRead:', err);
      }
    },
    [currentUserId, supabase, setConversations, setLastReadConversationId]
  );

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { data: convData, error } = await supabase.rpc(
        'get_user_conversations_with_unread',
        { p_user_id: currentUserId }
      );
      if (error) throw error;
      setConversations(convData || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  }, [currentUserId, supabase, setConversations]);



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
        const { data: profiles, } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, last_seen, is_online')
          .neq('id', userId);

        setUsers(profiles || []);

        // Load conversations
        const { data: convData, error: convError } = await supabase.rpc('get_user_conversations_with_unread', {
          p_user_id: userId,
        });

        if (convError) {
          console.error('Failed to load conversations:', convError);
          // handle error
        } else {
          setConversations(convData || []);
        }

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



  // Update user online status on page visibility
  // ✅ Activity-aware presence tracking with proper cleanup and const usage
  useEffect(() => {
    if (!currentUserId) return;

    let lastActivity = Date.now();
    let isCurrentlyOnline = true;
    const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];

    const handleActivity = () => {
      lastActivity = Date.now();
      if (!isCurrentlyOnline) {
        updatePresenceStatus(true);
        isCurrentlyOnline = true;
      }
    };

    ACTIVITY_EVENTS.forEach(event =>
      document.addEventListener(event, handleActivity, { passive: true })
    );

    const updatePresenceStatus = async (shouldBeOnline: boolean) => {
      try {
        const now = Date.now();
        if (shouldBeOnline !== isCurrentlyOnline || now - lastActivity > 120000) {
          await supabase
            .from('profiles')
            .update({
              is_online: shouldBeOnline,
              last_seen: new Date().toISOString(),
            })
            .eq('id', currentUserId);

          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'user_presence',
                userId: currentUserId,
                isOnline: shouldBeOnline,
                timestamp: new Date().toISOString(),
                broadcast: true,
              })
            );
          }

          isCurrentlyOnline = shouldBeOnline;
        }
      } catch (err) {
        console.error('Failed to update presence status:', err);
      }
    };

    // ✅ FIXED: Use `const` because assigned only once → satisfies ESLint
    const presenceInterval = setInterval(() => {
      const inactiveTime = Date.now() - lastActivity;
      const shouldBeOnline = inactiveTime < 60000; // 1 minute threshold

      if (shouldBeOnline !== isCurrentlyOnline) {
        updatePresenceStatus(shouldBeOnline);
      }
    }, 30000);

    // Initial update
    updatePresenceStatus(true);

    return () => {
      ACTIVITY_EVENTS.forEach(event =>
        document.removeEventListener(event, handleActivity)
      );
      clearInterval(presenceInterval); // ✅ Works with `const`
      updatePresenceStatus(false);
    };
  }, [currentUserId, supabase, wsRef]);


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
  // Replace your existing scroll effect with this:
  useLayoutEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      // Instant scroll on initial load — no animation = no visible jump
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length]); // Only depend on length to avoid unnecessary calls


  useEffect(() => {
    if (!currentUserId) return;

    if (wsRef.current) wsRef.current.close();

    const socket = new WebSocket(`wss://livekit.survivingdeathloss.site/notify?userId=${currentUserId}`);

    socket.onopen = () => {
      console.log('✅ WebSocket connected');
      setWsConnected(true);
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        console.log('📩 Received message via WS:', data);

        if (data.type === 'new_message' && data.conversationId) {
          if (selectedConversation?.id === data.conversationId) {
            await loadMessagesForConversation(data.conversationId);
            await markConversationAsRead(data.conversationId);
          } else {
            fetchConversations();
          }
          return;
        }

        if (data.type === 'user_presence') {
          setConversations((prev) =>
            prev.map((conv) =>
              conv.other_user_id === data.userId
                ? { ...conv, other_user_is_online: data.isOnline, other_user_last_seen: data.timestamp }
                : conv
            )
          );
          if (selectedConversation?.other_user_id === data.userId) {
            setOtherUserLastSeen(data.timestamp);
            setOtherUserPresenceLoaded(true);
          }
          return;
        }

        if (data.type === 'message_reaction' && data.conversationId === selectedConversation?.id) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== data.messageId) return msg;
              const updatedReactions = { ...msg.reactions };
              if (data.action === 'add') {
                updatedReactions[data.userId] = [
                  ...(updatedReactions[data.userId] || []),
                  data.emoji,
                ].filter((v, i, a) => a.indexOf(v) === i);
              } else if (data.action === 'remove') {
                if (updatedReactions[data.userId]) {
                  updatedReactions[data.userId] = updatedReactions[data.userId].filter(
                    (emoji) => emoji !== data.emoji
                  );
                  if (updatedReactions[data.userId].length === 0) {
                    delete updatedReactions[data.userId];
                  }
                }
              }
              return { ...msg, reactions: updatedReactions };
            })
          );
          return;
        }

        if (data.type === 'user_typing' && data.conversationId === selectedConversation?.id) {
          setIsOtherUserTyping(data.isTyping);
          return;
        }

        // Handle calls...
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };

    wsRef.current = socket;

    return () => {
      socket.close();
    };
  }, [
    currentUserId,
    selectedConversation?.id,
    selectedConversation?.other_user_id, // ✅ now included
    loadMessagesForConversation,
    markConversationAsRead,
    fetchConversations,
  ]);


  useEffect(() => {
    if (!currentUserId) return;

    console.log(`🔄 Setting up presence tracking for user: ${currentUserId}`);

    // Update database with online status
    const updateDbStatus = async (isOnline: boolean) => {
      console.log(`💾 Updating DB status for ${currentUserId}: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            is_online: isOnline,
            last_seen: new Date().toISOString()
          })
          .eq('id', currentUserId);

        if (error) {
          console.error('❌ Database update error:', error);
          throw error;
        }
        console.log(`✅ DB updated successfully for user ${currentUserId}`);
      } catch (err) {
        console.error('🔥 Update online status DB error:', err);
      }
    };

    // Send presence update via WebSocket
    const sendPresenceUpdate = async (isOnline: boolean) => {
      try {
        await sendNotification({
          type: 'user_presence',
          userId: currentUserId,
          isOnline,
          timestamp: new Date().toISOString(),
          broadcast: true
        });
      } catch (err) {
        console.error('Failed to send presence update:', err);
      }
    };

    // Combined function to update both DB and broadcast
    const updatePresence = async (isOnline: boolean) => {
      console.log(`🔄 Starting presence update for ${currentUserId}: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      try {
        await Promise.allSettled([
          updateDbStatus(isOnline),
          sendPresenceUpdate(isOnline)
        ]);
        console.log(`✅ Completed presence update for ${currentUserId}: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      } catch (err) {
        console.error('🔥 Combined presence update failed:', err);
      }
    };

    // Initial online status update
    console.log(`🚀 Initializing presence tracking for user ${currentUserId}`);
    updatePresence(true);

    // Update when tab becomes visible/invisible  
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        console.log(`📴 Tab hidden - setting ${currentUserId} to OFFLINE`);
        await updatePresence(false);
      } else {
        console.log(`💡 Tab visible - setting ${currentUserId} to ONLINE`);
        await updatePresence(true);
      }
    };

    // Update when window is closed
    const handleBeforeUnload = async () => {
      console.log(`CloseOperation: Setting ${currentUserId} to OFFLINE`);
      await updatePresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Heartbeat to keep presence alive
    console.log('💓 Starting presence heartbeat (every 30 seconds)');
    const heartbeatInterval = setInterval(async () => {
      if (!document.hidden) {
        console.log(`💓 Heartbeat - confirming ${currentUserId} is ONLINE`);
        await updatePresence(true);
      }
    }, 30000); // Every 30 seconds

    return () => {
      console.log('🧹 Cleaning up presence tracking');
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Final offline status update with timeout to ensure it completes
      console.log(`CloseOperation (cleanup): Setting ${currentUserId} to OFFLINE`);
      updatePresence(false).catch(err => {
        console.error('CloseOperation cleanup failed:', err);
      });
    };
  }, [currentUserId, supabase]);

  const sendNotification = useCallback(async (notification: {
    type: string;
    toUserId?: string;
    conversationId?: string;
    isTyping?: boolean;
    userId?: string;
    isOnline?: boolean;
    timestamp?: string;
    broadcast?: boolean;
    [key: string]: unknown;
  }) => {
    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        let errorData;
        const text = await response.text();
        try {
          errorData = JSON.parse(text);
        } catch {
          errorData = { error: 'Non-JSON server response', details: text.trim().substring(0, 200) };
        }
        console.warn('Notification API error:', errorData);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }, []); // ✅ No dependencies → stable across renders

  // Handle when user starts typing
  const handleUserTyping = useCallback(() => {
    if (!selectedConversation || !currentUserId) return;
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

    typingDebounceRef.current = setTimeout(() => {
      sendNotification({
        type: 'user_typing',
        toUserId: selectedConversation.other_user_id,
        conversationId: selectedConversation.id,
        isTyping: true,
        userId: currentUserId,
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendNotification({
          type: 'user_typing',
          toUserId: selectedConversation.other_user_id,
          conversationId: selectedConversation.id,
          isTyping: false,
          userId: currentUserId,
        });
      }, 2500);
    }, 300);
  }, [
    currentUserId,
    selectedConversation,
    sendNotification, // ✅ now included
  ]);

  // Clear typing timeout when component unmounts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);






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
    if (!currentUserId || !selectedConversation?.id) return;

    try {
      // Optimistically get current message reactions from local state (faster UX)
      const currentMessage = messages.find(m => m.id === messageId);
      const currentReactions = currentMessage?.reactions || {};
      const userReactions: string[] = currentReactions[currentUserId] || [];

      const isAdding = !userReactions.includes(emoji);

      // Prepare updated reactions object
      const updatedReactions = { ...currentReactions };
      if (isAdding) {
        updatedReactions[currentUserId] = [...userReactions, emoji];
      } else {
        const filtered = userReactions.filter(r => r !== emoji);
        if (filtered.length === 0) {
          delete updatedReactions[currentUserId];
        } else {
          updatedReactions[currentUserId] = filtered;
        }
      }

      // Optimistic UI update
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg
        )
      );

      // Close picker immediately
      setShowReactionPicker(null);

      // Save to Supabase
      const { error: updateError } = await supabase
        .from('messages')
        .update({ reactions: updatedReactions })
        .eq('id', messageId);

      if (updateError) {
        throw updateError;
      }

      // 🔥 Broadcast real-time reaction to others in the conversation
      // Update this part of handleReaction
      await sendNotification({
        type: 'message_reaction',
        conversationId: selectedConversation.id,
        messageId,
        userId: currentUserId,
        emoji,
        action: isAdding ? 'add' : 'remove',
        toUserId: selectedConversation.other_user_id, // Add this line
      });
    } catch (err) {
      console.error('Reaction error:', err);
      toast.error('Failed to update reaction');
      // Optional: rollback optimistic update on error
    }
  };





  const openConversation = async (conv: ConversationSummary) => {
    if (!currentUserId) return;

    setSelectedConversation(conv);
    setMessages([]); // clear optimistic old data
    setIsMessagesLoading(true); // 👈 start loading
    setReplyingTo(null);
    setShowConversationMenu(null);

    if (isMobileView) {
      setShowChatView(true);
    }

    try {
      const { data: allMessages, error: msgError } = await supabase
        .from('messages')
        .select(`
        *,
        sender:sender_id (full_name, avatar_url)
      `)
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      const filteredMessages = (allMessages || []).filter(msg => {
        if (msg.deleted_for_everyone) return true;
        if (msg.deleted_for_me?.includes(currentUserId)) return false;
        return true;
      });

      setMessages(filteredMessages);

      if (conv.unread_count && conv.unread_count > 0) {
        markConversationAsRead(conv.id);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      toast.error('Failed to load conversation');
    } finally {
      setIsMessagesLoading(false); // 👈 done
    }
  };
  const handleStartNewConversation = useCallback(async (userId: string) => {
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
        other_user_avatar_url: otherUser.avatar_url || undefined,
        other_user_last_seen: otherUser.last_seen || undefined,
        other_user_is_online: otherUser.is_online || false,
        unread_count: 0,
      };

      setConversations((prev) => {
        if (!prev.some((c) => c.id === convId)) {
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
  }, [currentUserId, isMobileView, supabase]);

  useEffect(() => {
    const userId = consumePendingConversation();
    if (userId && currentUserId) {
      handleStartNewConversation(userId);
    }
  }, [currentUserId, handleStartNewConversation]);


  // app/messages/page.tsx (modified handleSendMessage function)
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

    // Optimistic UI update
    const optimisticMessage: Message = {
      id: tempId,
      content,
      sender_id: currentUserId,
      created_at: now,
      sender: { full_name: 'You' },
      reply_to: replyingTo?.id || null,
      conversation_id: selectedConversation.id,
      reactions: {},
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // If offline, queue the message
    if (!isOnline || !wsConnected) {
      setOfflineMessageQueue(prev => [...prev, {
        tempId,
        content,
        conversationId: selectedConversation.id,
        replyTo: replyingTo?.id || null,
      }]);
      setIsSending(false);
      return;
    }

    // Send immediately when online
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

      // Update messages with actual data
      setMessages(prev => prev.map(msg =>
        msg.id === tempId ? inserted : msg
      ));

      // Update conversations list
      const updatedConv = {
        id: selectedConversation.id,
        last_message: content,
        last_message_at: now
      };
      setConversations(prev => prev.map(conv =>
        conv.id === selectedConversation.id ? { ...conv, ...updatedConv } : conv
      ));

      // Send real-time notification
      await sendNotification({
        type: 'new_message',
        toUserId: selectedConversation.other_user_id,
        conversationId: selectedConversation.id,
        messageId: inserted.id,
        content: inserted.content,
        senderId: currentUserId,
        timestamp: now
      });

      toast.success('Message sent!');
    } catch (err) {
      console.error('Send failed:', err);
      // Queue failed message
      setOfflineMessageQueue(prev => [...prev, {
        tempId,
        content,
        conversationId: selectedConversation.id,
        replyTo: replyingTo?.id || null,
      }]);
      toast.error('Message queued for sending');
    } finally {
      setIsSending(false);
    }
  };

  const processOfflineQueue = useCallback(async () => {
    if (offlineMessageQueue.length === 0 || !isOnline || !wsConnected) return;
    toast.loading('Sending queued messages...', { id: 'queue-process' });

    for (const message of [...offlineMessageQueue]) {
      try {
        const { data: inserted, error: dbError } = await supabase
          .from('messages')
          .insert({
            conversation_id: message.conversationId,
            sender_id: currentUserId!,
            content: message.content,
            reply_to: message.replyTo || null,
            file_url: message.fileUrl || null,
            file_type: message.fileType || null,
          })
          .select(`
          *,
          sender:sender_id (full_name, avatar_url)
        `)
          .single();

        if (dbError) throw dbError;

        setMessages((prev) =>
          prev.map((msg) => (msg.id === message.tempId ? inserted : msg))
        );

        const conv = conversations.find((c) => c.id === message.conversationId);
        if (conv && selectedConversation?.id === conv.id) {
          await sendNotification({
            type: 'new_message',
            toUserId: conv.other_user_id,
            conversationId: message.conversationId,
            messageId: inserted.id,
            content: inserted.content,
            senderId: currentUserId!,
            timestamp: inserted.created_at,
          });
        }

        setOfflineMessageQueue((prev) =>
          prev.filter((q) => q.tempId !== message.tempId)
        );
      } catch (err) {
        console.error('Failed to send queued message:', err);
        break;
      }
    }

    if (offlineMessageQueue.length === 0) {
      toast.success('All queued messages sent!', { id: 'queue-process' });
    }
  }, [
    offlineMessageQueue,
    isOnline,
    wsConnected,
    currentUserId,
    conversations,
    selectedConversation?.id,
    supabase,
    sendNotification,
    setMessages,
    setOfflineMessageQueue,
  ]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast('You are offline. Messages will be sent when connection is restored.', {
        duration: 5000,
        icon: '⚠️',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processOfflineQueue]); // ✅ now safe



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

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('message-files')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = await supabase.storage
        .from('message-files')
        .getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      // Optimistic message
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      const optimisticMessage: Message = {
        id: tempId,
        content: file.name,
        sender_id: currentUserId,
        created_at: now,
        sender: { full_name: 'You' },
        file_url: publicUrl,
        file_type: file.type,
        conversation_id: selectedConversation.id,
        reactions: {},
        reply_to: null,
      };

      setMessages(prev => [...prev, optimisticMessage]);

      // Insert and get full message
      const { data: inserted, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUserId,
          content: file.name,
          file_url: publicUrl,
          file_type: file.type,
        })
        .select(`
        *,
        sender:sender_id (
          full_name,
          avatar_url
        )
      `)
        .single();

      if (msgError) throw msgError;

      // Replace optimistic with real
      setMessages(prev => prev.map(msg => msg.id === tempId ? inserted : msg));

      // Update conversation preview
      setConversations(prev =>
        prev.map(conv =>
          conv.id === selectedConversation.id
            ? { ...conv, last_message: file.name, last_message_at: now }
            : conv
        )
      );

      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('File sent!');
    } catch (err) {
      console.error('File upload error:', err);
      toast.error('Failed to send file');
    } finally {
      setUploading(false);
    }
  };

  // Define the correct type (or just use inline)
  interface EmojiData {
    emoji: string;
  }

  const handleEmojiSelect = (emojiData: EmojiData) => {
    setNewMessage((prev) => prev + emojiData.emoji); // 👈 .emoji, not .native
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


    } = selectedConversation;
    // Use the live-updated state instead of stale conversation data
    const safeLastSeen = otherUserLastSeen;
   return (
  <div style={{
    height: '100dvh',
    backgroundColor: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: '0.5rem', // 👈 ADD THIS LINE
  }}>
        {/* Mobile Chat Header */}
        <div style={{
          padding: '65px 10px 8px 10px',
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
            <Image
              src={selectedConversation.other_user_avatar_url}
              alt=""
              width={40}
              height={40}
              style={{
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
          {isMessagesLoading ? (
            <div style={{
              textAlign: 'center',
              color: '#94a3b8',
              marginTop: '40px'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#94a3b8',
              marginTop: '40px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>🕊️</div>
              <p>This conversation is new.<br />Be the first to share.</p>
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
                          WebkitUserSelect: 'none',
                          overflowWrap: 'break-word'

                        }}
                      >
                        {/* Message Menu Button - Only show for non-tombstone, non-deleted-for-me messages */}
                        {currentUserId && !isDeletedForMe && !isDeleted && (
                          <div className="message-menu-container" style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            opacity: .4,
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
                                  <div style={{
                                    position: 'relative',
                                    width: '300px',      // ✅ full message width
                                    height: '300px',    // ✅ minimum visible height (not auto!)
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                  }}>
                                    <Image
                                      src={url}
                                      alt="Attachment"
                                      fill
                                      style={{
                                        objectFit: 'cover', // or 'contain' if you prefer no cropping
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

        {/* ADD THIS TYPING INDICATOR COMPONENT FOR MOBILE VIEW */}
        {isOtherUserTyping && selectedConversation && (
          <div style={{
            padding: '8px 16px',
            fontSize: '14px',
            color: '#64748b',
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'center'
          }}>
            <span>{selectedConversation.other_user_full_name} is typing</span>
            <div style={{ display: 'flex', gap: '2px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#94a3b8',
                  animation: `typing-bounce 1.4s infinite ease-in-out ${i * 0.16}s`,
                }} />
              ))}
            </div>
            <style>{`
      @keyframes typing-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
    `}</style>
          </div>
        )}

        {/* Message Input */}
        <form
          onSubmit={handleSendMessage}
          style={{
            padding: '6px 10px',
            backgroundColor: 'white',
            paddingBottom: '1px',
            borderTop: '1px solid #e2e8f0',

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
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.color = '#3b82f6';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              {/* Grey/Flat Face SVG */}
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" stroke="#64748b" />
                <path stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" d="M8 14s1.5 2 4 2 4-2 4-2" />
                <path stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" d="M9 9h.01" />
                <path stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" d="M15 9h.01" />
              </svg>
            </button>

            <input
              ref={messageInputRef}
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleUserTyping();
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
              padding: '4px',
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
                <label htmlFor="file-upload" style={{
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf" style={{ display: 'none' }} />
                  {uploading ? (
                    <div style={{ color: '#94a3b8' }}>📤</div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                  )}
                </label>
              )}
            </label>

            <button
  type="submit"
  disabled={!newMessage.trim() || isSending || uploading}
  style={{
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: newMessage.trim() && !isSending && !uploading ? '#4f46e5' : '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: newMessage.trim() && !isSending && !uploading ? 'pointer' : 'not-allowed',
    padding: 0,
     minWidth: '36px',
  minHeight: '36px',
  boxSizing: 'border-box',
  }}
>
  {isSending ? (
    <div style={{ width: '20px', height: '20px', border: '2px solid transparent', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  )}
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
                overflow: 'hidden',
                // 👇 Light theme via CSS variables (for @emoji-mart/react v4+)
                '--rgb-bg': '255, 255, 255',
                '--rgb-color': '30, 41, 59',
                '--rgb-color-border': '226, 232, 240',
                colorScheme: 'light',
              } as React.CSSProperties}
            >
              <Picker
                onEmojiClick={handleEmojiSelect} // 👈 note: onEmojiClick, not onEmojiSelect
                theme={Theme.LIGHT}
                skinTonesDisabled
                searchDisabled
                previewConfig={{ showPreview: false }}
                style={{ width: '100%', height: '300px' }}
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
                      <Image
                        src={conv.other_user_avatar_url}
                        alt=""
                        width={isMobileView ? 44 : 50}
                        height={isMobileView ? 44 : 50}
                        style={{
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
                    {/* Add this inside the conversation list item, near the end */}
                    {(conv.unread_count ?? 0) > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: isMobileView ? '10px' : '16px',
                        right: isMobileView ? '16px' : '20px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        borderRadius: '10px',
                        minWidth: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        padding: '0 4px'
                      }}>
                        {(conv.unread_count ?? 0) > 9 ? '9+' : conv.unread_count}
                      </div>
                    )}
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
                        <Image
                          src={selectedConversation.other_user_avatar_url}
                          alt=""
                          width={48}
                          height={48}
                          style={{
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
                          {isUserOnline(selectedConversation?.other_user_last_seen ?? null) && (
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
                                    overflowWrap: 'break-word'

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
                                              <Image
                                                src={url}
                                                alt="Attachment"
                                                width={400}
                                                height={300}
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
                  {/* Typing Indicator */}
                  {isOtherUserTyping && selectedConversation && (
                    <div style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      color: '#64748b',
                      fontStyle: 'italic',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      justifyContent: 'center'
                    }}>
                      <span>{selectedConversation.other_user_full_name} is typing</span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#94a3b8',
                            animation: `typing-bounce 1.4s infinite ease-in-out ${i * 0.16}s`,
                          }} />
                        ))}
                      </div>
                      <style>{`
      @keyframes typing-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
    `}</style>
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
                          width: '36px',
                          height: '36px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = '#f1f5f9';
                          e.currentTarget.style.color = '#3b82f6';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#64748b';
                        }}
                      >
                        {/* Grey/Flat Face SVG */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" stroke="#64748b" />
                          <path stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" d="M8 14s1.5 2 4 2 4-2 4-2" />
                          <path stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" d="M9 9h.01" />
                          <path stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" d="M15 9h.01" />
                        </svg>
                      </button>

                      <input
                        ref={messageInputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => {
                          setNewMessage(e.target.value);
                          handleUserTyping(); // Trigger typing detection
                          trackActivity();
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
                          <label htmlFor="file-upload" style={{
                            cursor: 'pointer',
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf" style={{ display: 'none' }} />
                            {uploading ? (
                              <div style={{ color: '#94a3b8' }}>📤</div>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                              </svg>
                            )}
                          </label>
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
                          onEmojiClick={handleEmojiSelect}
                          theme={Theme.LIGHT}
                          skinTonesDisabled
                          searchDisabled
                          previewConfig={{ showPreview: false }}
                          style={{ width: '100%', height: '300px' }}
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