'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  RemoteParticipant,
  LocalTrack,
} from 'livekit-client';

type Profile = {
  id: string;
  full_name?: string;
  avatar_url?: string | null;
};

interface RoomRecord {
  room_id: string;
  status: string;
  call_started_at?: string | null;
  user_id: string; // facilitator ID
}

interface CallEndedMessage {
  by: string;
}

interface RoomParticipantRecord {
  room_id: string;
  user_id: string;
  active: boolean;
}

type PostgresChangeEvent<T> =
  | { eventType: 'INSERT'; new: T; old?: undefined }
  | { eventType: 'UPDATE'; new: T; old: T }
  | { eventType: 'DELETE'; new?: undefined; old: T };

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
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callEndedByPeer, setCallEndedByPeer] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<Date | null>(null);
  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [participantLoading, setParticipantLoading] = useState(true);

  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const supabaseChannelRef = useRef<any[]>([]);
  const participantChannelRef = useRef<any>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedTimerRef = useRef(false);

  // 🔒 Redirect guard
  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/auth');
    }
    if (!authLoading && roomId && !isGroupCall && !isOneOnOne) {
      router.push('/connect');
    }
  }, [authLoading, authUser, roomId, isGroupCall, isOneOnOne, router]);

  // 🧹 Cleanup call resources
  const cleanupCall = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      hasStartedTimerRef.current = false;
    }

    remoteAudioRefs.current.forEach((el) => {
      if (el.parentElement) el.parentElement.removeChild(el);
    });
    remoteAudioRefs.current.clear();

    supabaseChannelRef.current.forEach((channel) => {
      if (channel?.unsubscribe) supabase.removeChannel(channel);
    });
    supabaseChannelRef.current = [];

    if (participantChannelRef.current) {
      supabase.removeChannel(participantChannelRef.current);
      participantChannelRef.current = null;
    }

    setIsInCall(false);
    setCallDuration(0);
    setCallStartedAt(null);
  };

  // ⏱️ Unified timer management
  const startTimer = (startTime: Date) => {
    if (hasStartedTimerRef.current) return;
    
    setCallStartedAt(startTime);
    hasStartedTimerRef.current = true;

    const updateTimer = () => {
      const now = new Date();
      const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setCallDuration(duration);
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 1000);
  };

  // 📡 Realtime room updates
  useEffect(() => {
    if (!roomId || !authUser) return;

    const table = isOneOnOne ? 'quick_connect_requests' : 'quick_group_requests';
    
    const roomUpdateChannel = supabase
      .channel(`room_updates:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: table,
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { eventType: 'UPDATE'; new: RoomRecord }) => {
          setRoomRecord(payload.new);
          
          // Start timer if call_started_at was just set
          if (payload.new.call_started_at && !callStartedAt) {
            startTimer(new Date(payload.new.call_started_at));
          }
        }
      )
      .subscribe();

    supabaseChannelRef.current.push(roomUpdateChannel);

    return () => {
      supabase.removeChannel(roomUpdateChannel);
    };
  }, [roomId, authUser, isOneOnOne, isGroupCall, callStartedAt]);

  // 👥 Realtime participant updates
  useEffect(() => {
    if (!roomId || !authUser) return;

    const channel = supabase
      .channel(`room_participants:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload: PostgresChangeEvent<RoomParticipantRecord>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            await fetchParticipants();
          } else if (payload.eventType === 'DELETE') {
            const userId = payload.old.user_id;
            if (isGroupCall && userId !== hostId) {
              setParticipants((prev) => prev.filter((p) => p.id !== userId));
            }
          }
        }
      )
      .subscribe();

    participantChannelRef.current = channel;
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, authUser, isGroupCall, hostId]);

  // 📥 Fetch active participants from DB
  const fetchParticipants = async () => {
    if (!authUser?.id || !roomId) return;

    setParticipantLoading(true);
    try {
      const { data: participantData, error: partErr } = await supabase
        .from('room_participants')
        .select('user_id')
        .eq('room_id', roomId)
        .eq('active', true);
        
      if (partErr) throw partErr;
      if (!participantData) {
        setParticipants([]);
        return;
      }

      const participantIds = participantData.map((p) => p.user_id);
      if (participantIds.length === 0) {
        setParticipants([]);
        return;
      }

      const { data: profileData, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', participantIds);
        
      if (profilesErr) throw profilesErr;
      if (!profileData) {
        setParticipants([]);
        return;
      }

      const profileMap = new Map(profileData.map((p) => [p.id, p]));
      const parts = participantIds.map((id) => {
        const profile = profileMap.get(id);
        return {
          id,
          name: profile?.full_name || 'Anonymous',
          avatar: profile?.avatar_url || undefined,
        };
      });
      
      setParticipants(parts);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch participants');
      console.error('Participant fetch error:', err);
    } finally {
      setParticipantLoading(false);
    }
  };

  // 🚀 Main initialization
  useEffect(() => {
    if (!authUser?.id || !roomId || (!isOneOnOne && !isGroupCall)) return;

    const initialize = async () => {
      try {
        // Fetch user profile
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', authUser.id)
          .single();
          
        if (profileErr) throw profileErr;
        if (!profileData) throw new Error('Profile not found');
        setUser(profileData);

        // Fetch room record
        const roomTable = isOneOnOne ? 'quick_connect_requests' : 'quick_group_requests';
        const { data: recordData, error: roomErr } = await supabase
          .from(roomTable)
          .select('room_id, status, call_started_at, user_id')
          .eq('room_id', roomId)
          .single();
          
        if (roomErr || !recordData) throw new Error('Room not found');
        setRoomRecord(recordData);

        // Start timer immediately if call has already started
        if (recordData.call_started_at) {
          startTimer(new Date(recordData.call_started_at));
        }

        // Set host ID for group calls
        if (isGroupCall) {
          setHostId(recordData.user_id);
        } else {
          setHostId(null);
        }

        // ✅ REGISTER PARTICIPANT FIRST
        const { error: registerErr } = await supabase
          .from('room_participants')
          .upsert(
            { room_id: roomId, user_id: authUser.id, active: true },
            { onConflict: 'room_id,user_id' }
          );
        if (registerErr) throw registerErr;

        // Fetch participants after registration
        await fetchParticipants();

        // Validate room status
        if (isGroupCall && recordData.status !== 'matched' && recordData.status !== 'available') {
          throw new Error('Group room is not active');
        }
        if (isOneOnOne && recordData.status !== 'matched') {
          throw new Error('One-on-one room is not active');
        }

        // Setup broadcast channel for call ending
        const broadcastChannel = supabase
          .channel(`room:${roomId}`)
          .on('broadcast', { event: 'call_ended' }, (payload: { payload: CallEndedMessage }) => {
            const { by } = payload.payload;
            if (isOneOnOne || (isGroupCall && by === hostId)) {
              setCallEndedByPeer(true);
            }
          })
          .subscribe();

        supabaseChannelRef.current.push(broadcastChannel);

        // Pass name to ensure proper identification
        await joinLiveKitRoom(roomId, authUser.id, profileData.full_name || 'Anonymous');
      } catch (err: any) {
        setError(err.message || 'Failed to join room');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      cleanupCall();
      if (currentRoom) currentRoom.disconnect();
    };
  }, [roomId, authUser?.id, isOneOnOne, isGroupCall]);

  // 📞 Join LiveKit room
  const joinLiveKitRoom = async (roomName: string, identity: string, name: string) => {
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!livekitUrl) {
      setError('LiveKit URL not configured');
      return;
    }

    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    setCurrentRoom(newRoom);

    // 🔊 Audio track handling
    newRoom.on(RoomEvent.TrackSubscribed, (track: Track, publication: any, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.autoplay = true;
        el.muted = false;
        el.volume = 1.0;
        remoteAudioRefs.current.set(participant.identity, el);
        document.body.appendChild(el);
      }
    });

    newRoom.on(RoomEvent.TrackUnsubscribed, (track: Track, publication: any, participant: RemoteParticipant) => {
      const el = remoteAudioRefs.current.get(participant.identity);
      if (el) {
        el.parentElement?.removeChild(el);
        remoteAudioRefs.current.delete(participant.identity);
      }
    });

    // 👥 Participant connection handling
    newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.id === participant.identity)) return prev;
        return [
          ...prev,
          { 
            id: participant.identity, 
            name: participant.name || 'Anonymous', 
            avatar: undefined 
          },
        ];
      });
    });

    newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      setParticipants((prev) => prev.filter((p) => p.id !== participant.identity));
      remoteAudioRefs.current.delete(participant.identity);
    });

    // 🛑 Disconnection handling
    const handleDisconnect = () => {
      cleanupCall();
    };
    newRoom.on(RoomEvent.Disconnected, handleDisconnect);
    newRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      if (state === ConnectionState.Disconnected) cleanupCall();
    });

    try {
      // Generate token with participant name
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, identity, name }),
      });
      if (!tokenRes.ok) throw new Error(`Token error: ${tokenRes.status}`);
      const { token } = await tokenRes.json();
      await newRoom.connect(livekitUrl, token);

      // Set participant name
      newRoom.localParticipant.name = name;

      // Publish audio track
      const tracks = await newRoom.localParticipant.createTracks({ audio: true });
      tracks.forEach((track: LocalTrack) => newRoom.localParticipant.publishTrack(track));

      setIsInCall(true);

      // ✅ Start timer when second participant joins AND call hasn't started yet
      if (!callStartedAt) {
        const currentParticipantCount = newRoom.remoteParticipants.size + 1;
        if ((isOneOnOne && currentParticipantCount >= 2) || 
            (isGroupCall && currentParticipantCount >= 2 && authUser?.id === hostId)) {
          
          const table = isOneOnOne ? 'quick_connect_requests' : 'quick_group_requests';
          const now = new Date();
          
          // Update database
          const { error } = await supabase
            .from(table)
            .update({ call_started_at: now.toISOString() })
            .eq('room_id', roomId)
            .is('call_started_at', null);

          if (error) {
            console.error('Failed to set call_started_at:', error);
          } else {
            // Update local state immediately
            setRoomRecord(prev => prev ? { 
              ...prev, 
              call_started_at: now.toISOString() 
            } : null);
            
            // Start timer locally
            startTimer(now);
          }
        }
      }
    } catch (err: any) {
      setError(`Call failed: ${err.message}`);
      cleanupCall();
    }

    return () => {
      newRoom.off(RoomEvent.Disconnected, handleDisconnect);
    };
  };

  // 🔇 Toggle mic
  const toggleAudio = () => {
    if (!currentRoom) return;
    const localAudioPublication = currentRoom.localParticipant.audioTrackPublications.values().next().value;
    if (localAudioPublication?.track) {
      if (isAudioEnabled) {
        localAudioPublication.track.mute();
      } else {
        localAudioPublication.track.unmute();
      }
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  // 🚪 Leave room
  const leaveRoom = async (endedByUser = true) => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      if (currentRoom) currentRoom.disconnect();

      // ✅ Deactivate participant
      if (authUser?.id) {
        const { error: deactivateErr } = await supabase
          .from('room_participants')
          .update({ active: false })
          .eq('room_id', roomId)
          .eq('user_id', authUser.id);

        if (deactivateErr) {
          console.warn('Failed to deactivate participant:', deactivateErr);
        }
      }

      // Broadcast call end if applicable
      if (endedByUser && supabaseChannelRef.current.length > 0) {
        const broadcastChannel = supabaseChannelRef.current[0];
        if (broadcastChannel) {
          if (isOneOnOne || (isGroupCall && authUser?.id === hostId)) {
            broadcastChannel.send({
              type: 'broadcast',
              event: 'call_ended',
              payload: { by: authUser?.id },
            });

            const table = isOneOnOne ? 'quick_connect_requests' : 'quick_group_requests';
            await supabase.from(table).update({ status: 'completed' }).eq('room_id', roomId);
          }
        }
      }

      router.push('/connect');
    } catch (err) {
      setError('Failed to leave room');
    } finally {
      setIsLeaving(false);
      cleanupCall();
    }
  };

  // 📴 Redirect if call ended by peer
  useEffect(() => {
    if (callEndedByPeer && isInCall) {
      currentRoom?.disconnect();
      setTimeout(() => router.push('/connect'), 1000);
    }
  }, [callEndedByPeer, isInCall, currentRoom, router]);

  // 🕓 Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    // State
    user,
    participants,
    isLoading: authLoading || isLoading || participantLoading,
    error,
    isLeaving,
    isInCall,
    isAudioEnabled,
    callDuration,
    callEndedByPeer,
    hostId,
    // Actions
    toggleAudio,
    leaveRoom,
    formatDuration,
    // Derived
    isGroupCall,
    isOneOnOne,
    otherParticipants: participants.filter((p) => p.id !== user?.id),
  };
};