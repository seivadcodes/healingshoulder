// room/[id]/useRoomLogic.ts
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';

type Profile = {
  id: string;
  full_name?: string;
  avatar_url?: string | null;
};

interface CallEndedMessage {
  by: string;
}

export const useRoomLogic = (roomId: string) => {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const supabase = createClient();

  const isGroupCall = roomId.startsWith('group-call-');
  const isOneOnOne = roomId.startsWith('quick-connect-');

  const [user, setUser] = useState<Profile | null>(null);
  const [participants, setParticipants] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callEndedByPeer, setCallEndedByPeer] = useState(false);

  const remoteAudioRefs = useRef<HTMLAudioElement[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const callDurationStartedRef = useRef(false);

  // Redirect guard
  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/auth');
    }
    if (!authLoading && roomId && !isGroupCall && !isOneOnOne) {
      router.push('/connect');
    }
  }, [authLoading, authUser, roomId, isGroupCall, isOneOnOne, router]);

  const cleanupCall = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    remoteAudioRefs.current.forEach((el) => {
      if (el.parentElement) el.parentElement.removeChild(el);
    });
    remoteAudioRefs.current = [];
    if (supabaseChannelRef.current) {
      supabase.removeChannel(supabaseChannelRef.current);
      supabaseChannelRef.current = null;
    }
    setIsInCall(false);
    setCallDuration(0);
    callDurationStartedRef.current = false;
  };

  useEffect(() => {
    if (!authUser?.id || !roomId || (!isOneOnOne && !isGroupCall)) return;

    const initialize = async () => {
      try {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', authUser.id)
          .single();
        if (profileErr) throw profileErr;
        setUser(profile);

        const roomTable = isOneOnOne ? 'quick_connect_requests' : 'quick_group_requests';
        const { data: roomRecord, error: roomErr } = await supabase
          .from(roomTable)
          .select('room_id, status')
          .eq('room_id', roomId)
          .single();
        if (roomErr || !roomRecord) throw new Error('Room not found');

        if (isGroupCall && roomRecord.status !== 'matched' && roomRecord.status !== 'available') {
          throw new Error('Group room is not active');
        }
        if (isOneOnOne && roomRecord.status !== 'matched') {
          throw new Error('One-on-one room is not active');
        }

        const { data: participantRows, error: partErr } = await supabase
          .from('room_participants')
          .select('user_id')
          .eq('room_id', roomId)
          .eq('active', true);
        if (partErr) throw partErr;

        const participantIds = participantRows.map(p => p.user_id);
        if (!participantIds.includes(authUser.id)) {
          throw new Error('Not authorized');
        }

        const { data: profiles, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', participantIds);
        if (profilesErr) throw profilesErr;

        const profileMap = new Map(profiles.map(p => [p.id, p]));
        const parts = participantIds.map(id => ({
          id,
          name: profileMap.get(id)?.full_name || 'Anonymous',
          avatar: profileMap.get(id)?.avatar_url,
        }));
        setParticipants(parts);

        const channel = supabase
          .channel(`room:${roomId}`)
          .on('broadcast', { event: 'call_ended' }, (payload: { payload: CallEndedMessage }) => {
            setCallEndedByPeer(true);
          })
          .subscribe();
        supabaseChannelRef.current = channel;

        await joinLiveKitRoom(roomId, authUser.id);
      } catch (err: any) {
        setError(err.message || 'Failed to join room');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      cleanupCall();
      if (room) room.disconnect();
    };
  }, [roomId, authUser?.id, isOneOnOne, isGroupCall]);

  const joinLiveKitRoom = async (roomName: string, identity: string) => {
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!livekitUrl) {
      setError('LiveKit URL not configured');
      return;
    }

    const newRoom = new Room();
    setRoom(newRoom);

    const hasActiveRemoteAudio = () => {
      for (const participant of newRoom.remoteParticipants.values()) {
        for (const pub of participant.audioTrackPublications.values()) {
          if (pub.isSubscribed && pub.track) return true;
        }
      }
      return false;
    };

    const startCallTimer = () => {
      if (callDurationStartedRef.current) return;
      callDurationStartedRef.current = true;
      setCallDuration(0);
      intervalRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    };

    const checkAndStartCall = () => {
      if (!callDurationStartedRef.current && hasActiveRemoteAudio()) startCallTimer();
    };

    newRoom.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.autoplay = true; el.muted = false; el.volume = 1.0;
        remoteAudioRefs.current.push(el);
        document.body.appendChild(el);
        checkAndStartCall();
      }
    });

    newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
      const index = remoteAudioRefs.current.indexOf(track as any);
      if (index > -1) {
        const el = remoteAudioRefs.current.splice(index, 1)[0];
        el.parentElement?.removeChild(el);
      }
    });

    newRoom.on(RoomEvent.ParticipantConnected, () => setTimeout(checkAndStartCall, 500));
    newRoom.on(RoomEvent.Connected, () => setTimeout(checkAndStartCall, 500));
    newRoom.on(RoomEvent.Disconnected, cleanupCall);
    newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (state === ConnectionState.Disconnected) cleanupCall();
    });

    try {
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, identity }),
      });
      if (!tokenRes.ok) throw new Error(`Token error: ${tokenRes.status}`);
      const { token } = await tokenRes.json();
      await newRoom.connect(livekitUrl, token);

      const tracks = await newRoom.localParticipant.createTracks({ audio: true });
      tracks.forEach(track => newRoom.localParticipant.publishTrack(track));

      setIsInCall(true);
    } catch (err: any) {
      setError(`Call failed: ${err.message}`);
      cleanupCall();
    }
  };

  const toggleAudio = () => {
    if (!room) return;
    const localAudioTrack = room.localParticipant.audioTrackPublications.values().next().value?.track;
    if (localAudioTrack) {
      if (isAudioEnabled) localAudioTrack.mute();
      else localAudioTrack.unmute();
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const leaveRoom = async (endedByUser = true) => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      if (endedByUser) {
        supabaseChannelRef.current?.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { by: authUser?.id },
        });
        const table = isOneOnOne ? 'quick_connect_requests' : 'quick_group_requests';
        await supabase.from(table).update({ status: 'completed' }).eq('room_id', roomId);
      }
      if (room) room.disconnect();
      router.push('/connect');
    } catch (err) {
      setError('Failed to leave room');
    } finally {
      setIsLeaving(false);
    }
  };

  useEffect(() => {
    if (callEndedByPeer && isInCall) {
      room?.disconnect();
      setTimeout(() => router.push('/connect'), 1000);
    }
  }, [callEndedByPeer, isInCall, room, router]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    // State
    user,
    participants,
    isLoading: authLoading || isLoading,
    error,
    isLeaving,
    isInCall,
    isAudioEnabled,
    callDuration,
    callEndedByPeer,
    // Actions
    toggleAudio,
    leaveRoom,
    formatDuration,
    // Derived
    isGroupCall,
    isOneOnOne,
    otherParticipants: participants.filter(p => p.id !== user?.id),
  };
};