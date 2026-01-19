// src/app/communities/[communityId]/chat/page.tsx
'use client';
import { useEffect, useState, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import Picker, { Theme } from 'emoji-picker-react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import FooterNav from '@/components/layout/FooterNav';
import CallOverlay from '@/components/calling/CallOverlay';

// Types
type User = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  last_online?: string | null;
};

type CommunityMessage = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender: { full_name: string; avatar_url?: string | null };
  file_url?: string | null;
  file_type?: string | null;
  reactions: Record<string, string[]>;
  reply_to?: string | null;
  deleted_for_everyone?: boolean;
};

// Helpers
const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

const formatDateLabel = (isoString: string): string => {
  const msgDate = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDate.toDateString() === today.toDateString()) return 'Today';
  if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (msgDate.getFullYear() === now.getFullYear())
    return msgDate.toLocaleDateString([], { month: 'long', day: 'numeric' });
  return msgDate.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatTimeOnly = (isoString: string): string => {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const isUserOnline = (lastOnline: string | null | undefined): boolean => {
  if (!lastOnline) return false;
  const lastOnlineDate = new Date(lastOnline);
  const now = new Date();
  return now.getTime() - lastOnlineDate.getTime() < 5 * 60 * 1000;
};

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url);
const isPdfUrl = (url: string) => /\.pdf$/i.test(url);

export default function CommunityChatPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // State
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommunityMessage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState<User[]>([]);
  const [myRole, setMyRole] = useState<'member' | 'moderator' | 'admin' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [lastChatView, setLastChatView] = useState<string | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ x: number; y: number } | null>(null);

  // Responsive check
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchMembersAndOnlineCount = useCallback(async () => {
    if (!user || !communityId) return;
    try {
      const { data: onlineMembersData, error } = await supabase
        .from('community_online_members')
        .select(`
          user_id,
          full_name,
          avatar_url,
          last_online
        `)
        .eq('community_id', communityId);
      if (error) {
        console.error('Failed to fetch online members:', error);
        return;
      }
      const formattedMembers: User[] = (onlineMembersData || []).map((m) => ({
        id: m.user_id,
        full_name: m.full_name || 'Anonymous',
        avatar_url: m.avatar_url || null,
        last_online: m.last_online || null,
      }));
      setOnlineMembers(formattedMembers);
    } catch (err) {
      console.error('Failed to fetch members for online count:', err);
    }
  }, [communityId, user, supabase]);

  const fetchInitialData = useCallback(async () => {
    if (!user || !communityId) return;
    try {
      const { data: myRoleData } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .single();
      if (!myRoleData) {
        toast.error('You must be a member to view chat');
        router.push(`/communities/${communityId}`);
        return;
      }
      setMyRole(myRoleData.role);
      await fetchMembersAndOnlineCount();
      const { data: msgData } = await supabase
        .from('community_messages')
        .select(`
          *,
          sender:sender_id (full_name, avatar_url)
        `)
        .eq('community_id', communityId)
        .order('created_at', { ascending: true });
      setMessages(msgData || []);
      const { data: viewData } = await supabase
        .from('community_user_views')
        .select('last_chat_view')
        .eq('user_id', user.id)
        .eq('community_id', communityId)
        .single();
      setLastChatView(viewData?.last_chat_view || null);
      await supabase
        .from('community_user_views')
        .upsert(
          {
            user_id: user.id,
            community_id: communityId,
            last_chat_view: new Date().toISOString(),
          },
          { onConflict: 'user_id,community_id' }
        );
    } catch (err) {
      console.error('Failed to load chat:', err);
      toast.error('Failed to load chat');
    } finally {
      setIsLoading(false);
    }
  }, [communityId, user, supabase, router, fetchMembersAndOnlineCount]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!communityId || !user) return;
    fetchMembersAndOnlineCount();
    const interval = setInterval(fetchMembersAndOnlineCount, 30_000);
    return () => clearInterval(interval);
  }, [communityId, user, fetchMembersAndOnlineCount]);

  useEffect(() => {
    if (!user || !communityId) return;
   const socket = new WebSocket(
  `wss://livekit.survivingdeathloss.site/notify?userId=${user.id}&communityId=${communityId}`
);
    socket.onopen = () => console.log('✅ WS connected for community chat');
    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        if (data.type === 'new_community_message' && data.communityId === communityId) {
          const { data: newMsg } = await supabase
            .from('community_messages')
            .select(`*, sender:sender_id (full_name, avatar_url)`)
            .eq('id', data.messageId)
            .single();
          if (newMsg) setMessages((prev) => [...prev, newMsg]);
        }
        if (data.type === 'community_user_typing' && data.communityId === communityId) {
          setIsOtherUserTyping(data.isTyping);
          if (data.isTyping) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsOtherUserTyping(false), 3000);
          }
        }
        if (data.type === 'community_message_reaction' && data.communityId === communityId) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== data.messageId) return msg;
              const updated = { ...msg.reactions };
              if (data.action === 'add') {
                updated[data.userId] = [...(updated[data.userId] || []), data.emoji].filter(
                  (v, i, a) => a.indexOf(v) === i
                );
              } else {
                if (updated[data.userId]) {
                  updated[data.userId] = updated[data.userId].filter((e) => e !== data.emoji);
                  if (updated[data.userId].length === 0) delete updated[data.userId];
                }
              }
              return { ...msg, reactions: updated };
            })
          );
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    };
    wsRef.current = socket;
    return () => socket.close();
  }, [communityId, user, supabase]);

  // 👇 Group messages by date label
  const groupedMessages = useMemo(() => {
    const groups: { dateLabel: string; messages: CommunityMessage[] }[] = [];
    let currentLabel = '';
    for (const msg of messages) {
      const label = formatDateLabel(msg.created_at);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ dateLabel: label, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    }
    return groups;
  }, [messages]);

  // 👇 Find first unread message FROM OTHER USERS only
  const firstUnreadIndex = useMemo(() => {
    if (!lastChatView || !user) return -1;
    const cutoff = new Date(lastChatView);
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.sender_id !== user.id && new Date(msg.created_at) > cutoff) {
        return i;
      }
    }
    return -1;
  }, [messages, lastChatView, user]);

  // 🔁 NEW: Auto-scroll on initial load — either to unread or bottom
  useLayoutEffect(() => {
    if (isLoading || messages.length === 0) return;

    // If there's an unread message, scroll to it
    if (firstUnreadIndex >= 0) {
      const el = messageRefs.current.get(messages[firstUnreadIndex].id);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
        // Fade out banner after 10s
        const timer = setTimeout(() => {
          const banner = document.getElementById('unread-marker');
          if (banner) banner.style.opacity = '0.3';
        }, 10_000);
        return () => clearTimeout(timer);
      }
    } else {
      // Otherwise scroll to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [isLoading, messages.length, firstUnreadIndex]); // Only run once after load

  // Rest of handlers unchanged...
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !communityId) return;
    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    setReplyingTo(null);
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimisticMsg: CommunityMessage = {
      id: tempId,
      content,
      sender_id: user.id,
      created_at: now,
      sender: { full_name: user.user_metadata?.full_name || 'You', avatar_url: user.user_metadata?.avatar_url || null },
      reactions: {},
      reply_to: replyingTo?.id || null,
      deleted_for_everyone: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    try {
      const { data: inserted, error } = await supabase
        .from('community_messages')
        .insert({
          community_id: communityId,
          sender_id: user.id,
          content,
          reply_to: replyingTo?.id || null,
        })
        .select(`*, sender:sender_id (full_name, avatar_url)`)
        .single();
      if (error) throw error;
      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? inserted : msg)));
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_community_message',
          communityId,
          messageId: inserted.id,
        }),
      });
    } catch (err) {
      console.error('Send failed:', err);
      toast.error('Failed to send message');
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleUserTyping = useCallback(() => {
    if (!user || !communityId) return;
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'community_user_typing',
          communityId,
          isTyping: true,
          userId: user.id,
        }),
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'community_user_typing',
            communityId,
            isTyping: false,
            userId: user.id,
          }),
        });
      }, 2500);
    }, 300);
  }, [communityId, user]);

  const handleLongPressStart = (messageId: string, isOwn: boolean, event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
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
    }, 500);
    longPressTimer.current = timer;
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user || !communityId) return;
    const currentMsg = messages.find((m) => m.id === messageId);
    if (!currentMsg) return;
    const currentReactions = { ...currentMsg.reactions };
    const userReactions = currentReactions[user.id] || [];
    const isAdding = !userReactions.includes(emoji);
    const updated = { ...currentReactions };
    if (isAdding) {
      updated[user.id] = [...userReactions, emoji];
    } else {
      const filtered = userReactions.filter((r) => r !== emoji);
      if (filtered.length === 0) delete updated[user.id];
      else updated[user.id] = filtered;
    }
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, reactions: updated } : msg))
    );
    setShowReactionPicker(null);
    await supabase.from('community_messages').update({ reactions: updated }).eq('id', messageId);
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'community_message_reaction',
        communityId,
        messageId,
        userId: user.id,
        emoji,
        action: isAdding ? 'add' : 'remove',
      }),
    });
  };

  const handleDeleteForEveryone = async (messageId: string) => {
    if (!user || !communityId) return;
    const message = messages.find((m) => m.id === messageId);
    if (!message || message.sender_id !== user.id) {
      toast.error('Only the sender can delete for everyone');
      return;
    }
    if (!confirm('Delete for everyone? This cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('community_messages')
        .update({
          deleted_for_everyone: true,
          content: '[Message deleted]',
          file_url: null,
          file_type: null,
        })
        .eq('id', messageId);
      if (error) throw error;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: '[Message deleted]',
                file_url: null,
                file_type: null,
                deleted_for_everyone: true,
              }
            : msg
        )
      );
      toast.success('Message deleted for everyone');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete message');
    } finally {
      setShowMessageMenu(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !communityId || !user) return;
    setUploading(true);
    try {
      const fileName = `${user.id}/${communityId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('community-files')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = await supabase.storage
        .from('community-files')
        .getPublicUrl(fileName);
      const publicUrl = data.publicUrl;
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      const optimisticMsg: CommunityMessage = {
        id: tempId,
        content: file.name,
        sender_id: user.id,
        created_at: now,
        sender: { full_name: user.user_metadata?.full_name || 'You', avatar_url: user.user_metadata?.avatar_url || null },
        file_url: publicUrl,
        file_type: file.type,
        reactions: {},
        reply_to: null,
        deleted_for_everyone: false,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      const { data: inserted, error: msgError } = await supabase
        .from('community_messages')
        .insert({
          community_id: communityId,
          sender_id: user.id,
          content: file.name,
          file_url: publicUrl,
          file_type: file.type,
        })
        .select(`*, sender:sender_id (full_name, avatar_url)`)
        .single();
      if (msgError) throw msgError;
      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? inserted : msg)));
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_community_message',
          communityId,
          messageId: inserted.id,
        }),
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('File sent!');
    } catch (err) {
      console.error('File upload error:', err);
      toast.error('Failed to send file');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const emojiPicker = document.querySelector('.emoji-picker-container');
      if (emojiPicker && !emojiPicker.contains(event.target as Node)) {
        setShowEmojiPicker(false);
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

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Loading community chat...
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f9fafb',
        paddingBottom: '3.5rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '65px 10px 8px 10px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Community Chat</h2>
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          {onlineMembers.length} online • {myRole}
        </span>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {groupedMessages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>💬</div>
            <p>No messages yet. Be the first to say hello!</p>
          </div>
        ) : (
          groupedMessages.map((group, groupIndex) => (
            <div key={group.dateLabel}>
              {/* Date Header */}
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#64748b',
                  margin: '16px 0 8px',
                  fontWeight: '600',
                }}
              >
                {group.dateLabel}
              </div>

              {/* Messages in this group */}
              {group.messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                const repliedMsg = messages.find((m) => m.id === msg.reply_to);
                const isDeleted = msg.deleted_for_everyone;
                const reactions = msg.reactions || {};
                const allReactions = Object.values(reactions).flat();
                const reactionCounts = allReactions.reduce((acc, emoji) => {
                  acc[emoji] = (acc[emoji] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);

                // Show "Unread" banner ONLY before first unread message from others
                const showUnreadBanner = messages.indexOf(msg) === firstUnreadIndex && firstUnreadIndex >= 0;

                return (
                  <div key={msg.id}>
                    {showUnreadBanner && (
                      <div
                        id="unread-marker"
                        style={{
                          textAlign: 'center',
                          margin: '12px 0',
                          position: 'sticky',
                          top: '70px',
                          zIndex: 5,
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: '#e0e7ff',
                            color: '#4f46e5',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                          }}
                        >
                          Unread messages
                        </span>
                      </div>
                    )}

                    <div
                      ref={(el) => {
                        if (el) messageRefs.current.set(msg.id, el);
                        else messageRefs.current.delete(msg.id);
                      }}
                      style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', position: 'relative' }}
                    >
                      {!isOwn && (
                        <div style={{ width: '36px', marginRight: '12px', flexShrink: 0, marginTop: repliedMsg ? '24px' : '0' }}>
                          {msg.sender.avatar_url ? (
                            <Image
                              src={msg.sender.avatar_url}
                              alt={msg.sender.full_name || 'User'}
                              width={36}
                              height={36}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                              }}
                              unoptimized
                            />
                          ) : (
                            <div
                              style={{
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
                              }}
                            >
                              {getInitials(msg.sender.full_name)}
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ maxWidth: '80%', position: 'relative' }}>
                        {repliedMsg && !repliedMsg.deleted_for_everyone && (
                          <div
                            style={{
                              backgroundColor: '#f1f5f6',
                              borderRadius: '10px',
                              padding: '6px 10px',
                              marginBottom: '6px',
                              fontSize: '12px',
                              borderLeft: '2px solid #94a3b8',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              const el = messageRefs.current.get(repliedMsg.id);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                          >
                            <div style={{ fontWeight: '500', color: '#334155' }}>{repliedMsg.sender.full_name}</div>
                            <div style={{ color: '#64748b' }}>
                              {repliedMsg.content.substring(0, 40)}
                              {repliedMsg.content.length > 40 ? '...' : ''}
                            </div>
                          </div>
                        )}

                        <div
                          onMouseDown={(e) => !isDeleted && handleLongPressStart(msg.id, isOwn, e)}
                          onMouseUp={handleLongPressEnd}
                          onMouseLeave={handleLongPressEnd}
                          onTouchStart={(e) => !isDeleted && handleLongPressStart(msg.id, isOwn, e)}
                          onTouchEnd={handleLongPressEnd}
                          onTouchCancel={handleLongPressEnd}
                          style={{
                            padding: '10px 14px',
                            borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            backgroundColor: isDeleted ? '#f3f4f6' : isOwn ? '#e0e7ff' : '#f1f5f6',
                            color: isDeleted ? '#9ca3af' : isOwn ? '#312e81' : '#1e293b',
                            fontSize: '14px',
                            lineHeight: '1.4',
                            position: 'relative',
                            paddingRight: '30px',
                            overflowWrap: 'break-word',
                            cursor: isDeleted ? 'default' : 'pointer',
                            fontStyle: isDeleted ? 'italic' : 'normal',
                          }}
                        >
                          {!isDeleted && (
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#334155',
                                marginBottom: '4px',
                                lineHeight: 1.2,
                              }}
                            >
                              {isOwn ? 'Me' : msg.sender.full_name}
                            </div>
                          )}

                          {isOwn && !isDeleted && (
                            <div className="message-menu-container" style={{ position: 'absolute', top: '6px', right: '6px', opacity: 0.4 }}>
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
                              {showMessageMenu === msg.id && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                    zIndex: 10,
                                    minWidth: '140px',
                                    overflow: 'hidden',
                                  }}
                                >
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
                                      borderBottom: '1px solid #f1f5f6',
                                    }}
                                  >
                                    ↩️ Reply
                                  </button>
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
                                      gap: '8px',
                                    }}
                                  >
                                    🗑️ Delete for Everyone
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {!isOwn && !isDeleted && (
                            <div className="message-menu-container" style={{ position: 'absolute', top: '6px', right: '6px', opacity: 0.4 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReplyingTo(msg);
                                  messageInputRef.current?.focus();
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#64748b',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                  padding: '2px 4px',
                                  borderRadius: '4px',
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)';
                                  e.currentTarget.parentElement!.style.opacity = '1';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.parentElement!.style.opacity = '0.4';
                                }}
                              >
                                ⋮
                              </button>
                            </div>
                          )}

                          {isDeleted ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12px' }}>🗑️</span>
                              <span>Message deleted</span>
                            </div>
                          ) : msg.file_url ? (
                            (() => {
                              const url = msg.file_url;
                              if (isImageUrl(url)) {
                                return (
                                  <div style={{ position: 'relative', width: '300px', height: '300px', borderRadius: '8px', overflow: 'hidden' }}>
                                    <Image
                                      src={url}
                                      alt="Attachment"
                                      fill
                                      style={{ objectFit: 'cover', cursor: 'pointer' }}
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
                                        fontSize: '12px',
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
                                    fontSize: '14px',
                                  }}
                                >
                                  📎 {msg.content}
                                </a>
                              );
                            })()
                          ) : (
                            <div>{msg.content}</div>
                          )}

                          {Object.keys(reactionCounts).length > 0 && (
                            <div style={{ display: 'flex', gap: '2px', marginTop: '6px', flexWrap: 'wrap' }}>
                              {Object.entries(reactionCounts).map(([emoji, count]) => (
                                <div
                                  key={emoji}
                                  style={{
                                    backgroundColor: 'rgba(255,255,255,0.9)',
                                    borderRadius: '10px',
                                    padding: '1px 4px',
                                    fontSize: '10px',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1px',
                                  }}
                                >
                                  <span>{emoji}</span>
                                  <span style={{ color: '#64748b', fontWeight: '500' }}>{count}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div
                            style={{
                              fontSize: '10px',
                              textAlign: 'right',
                              marginTop: '4px',
                              color: isDeleted ? '#9ca3af' : isOwn ? '#4f46e5' : '#94a3b8',
                            }}
                          >
                            {formatTimeOnly(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        <div ref={messagesEndRef} />

        {isOtherUserTyping && (
          <div
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              color: '#64748b',
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center',
            }}
          >
            Someone is typing
            <div style={{ display: 'flex', gap: '2px' }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#94a3b8',
                    animation: `typing-bounce 1.4s infinite ease-in-out ${i * 0.16}s`,
                  }}
                />
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
      </div>

      {/* Reaction Picker */}
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
            border: '1px solid #e2e8f0',
          }}
        >
          {['❤️', '😊', '👍', '👏', '🙏', '🎉', '😢', '🤔'].map((emoji) => (
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
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Reply Preview */}
      {replyingTo && !replyingTo.deleted_for_everyone && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#f0f4ff',
            borderTop: '1px solid #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div style={{ flex: 1, fontSize: '12px', color: '#4f46e5' }}>
            Replying to {replyingTo.sender.full_name}
          </div>
          <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', fontSize: '16px' }}>
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '6px 10px',
          backgroundColor: 'white',
          borderTop: '1px solid #e2e8f0',
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
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
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <path d="M9 9h.01" />
              <path d="M15 9h.01" />
            </svg>
          </button>
          <input
            ref={messageInputRef}
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleUserTyping();
            }}
            placeholder={replyingTo ? 'Write your reply...' : 'Type a message…'}
            disabled={isSending || uploading}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              backgroundColor: '#f8fafc',
            }}
          />
          <label htmlFor="file-upload" style={{ cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
              </svg>
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
            }}
          >
            {isSending ? (
              <div style={{ width: '20px', height: '20px', border: '2px solid transparent', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>

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
            }}
          >
            <Picker
              onEmojiClick={(emojiData) => {
                setNewMessage((prev) => prev + emojiData.emoji);
                setShowEmojiPicker(false);
                messageInputRef.current?.focus();
              }}
              theme={Theme.LIGHT}
              skinTonesDisabled
              searchDisabled
              previewConfig={{ showPreview: false }}
              style={{ width: '100%', height: '300px' }}
            />
          </div>
        )}
      </form>

      <CallOverlay />
      {!isMobileView && <FooterNav />}
    </div>
  );
}