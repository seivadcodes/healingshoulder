// src/app/calls2/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  Room,
  RemoteParticipant,
  RoomEvent,
} from 'livekit-client';


export default function CallsPage() {
  const { user, sessionChecked, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ from: string; room: string } | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<{ to: string; room: string } | null>(null);
  const [inCall, setInCall] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const router = useRouter();
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionChecked && !user) {
      router.push('/auth');
    }
  }, [user, sessionChecked, router]);

  // Fetch other users
  useEffect(() => {
    if (!user) return;
    
    const supabase = createClient();
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .neq('id', user.id);
      
      if (!error && data) {
        setUsers(data);
      }
    };
    
    fetchUsers();
  }, [user]);

  // Setup signaling channel
  useEffect(() => {
    if (!user) return;
    
    const supabase = createClient();
    const channel = supabase.channel('calls');
    
    // Listen for call events
    channel
      .on('broadcast', { event: 'call_request' }, (payload) => {
        const { from, to, room } = payload.payload;
        if (to === user.id && !inCall) {
          setIncomingCall({ from, room });
        }
      })
      .on('broadcast', { event: 'call_accept' }, (payload) => {
        const { from, to, room } = payload.payload;
        if (to === user.id && outgoingCall?.room === room) {
          joinRoom(room);
          setOutgoingCall(null);
        }
      })
      .on('broadcast', { event: 'call_decline' }, (payload) => {
        const { to } = payload.payload;
        if (to === user.id) {
          setOutgoingCall(null);
          alert('Call declined');
        }
      })
      .on('broadcast', { event: 'call_end' }, (payload) => {
        const { room: endedRoom } = payload.payload;
        if (room?.name === endedRoom) {
          hangup();
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, inCall, room, outgoingCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  const generateRoomName = (userId: string) => {
    const ids = [user!.id, userId].sort();
    return `call_${ids.join('_')}`;
  };

  const startCall = async () => {
    if (!selectedUser || !user) return;
    
    const roomName = generateRoomName(selectedUser);
    setOutgoingCall({ to: selectedUser, room: roomName });
    
    const supabase = createClient();
    await supabase.channel('calls').send({
      type: 'broadcast',
      event: 'call_request',
      payload: { 
        from: user.id, 
        to: selectedUser, 
        room: roomName 
      },
    });
  };

  const acceptCall = () => {
    if (!incomingCall || !user) return;
    
    const supabase = createClient();
    supabase.channel('calls').send({
      type: 'broadcast',
      event: 'call_accept',
      payload: { 
        from: user.id, 
        to: incomingCall.from, 
        room: incomingCall.room 
      },
    });
    
    joinRoom(incomingCall.room);
    setIncomingCall(null);
  };

  const declineCall = () => {
    if (!incomingCall || !user) return;
    
    const supabase = createClient();
    supabase.channel('calls').send({
      type: 'broadcast',
      event: 'call_decline',
      payload: { 
        from: user.id, 
        to: incomingCall.from,
        room: incomingCall.room 
      },
    });
    
    setIncomingCall(null);
  };

  const hangup = () => {
    if (!room || !user) return;
    
    const supabase = createClient();
    supabase.channel('calls').send({
      type: 'broadcast',
      event: 'call_end',
      payload: { room: room.name },
    });
    
    room.disconnect();
    setRoom(null);
    setInCall(false);
    setIncomingCall(null);
    setOutgoingCall(null);
  };

  const joinRoom = async (roomName: string) => {
    if (!user) return;
    
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, identity: user.id }),
      });
      
      const { token } = await res.json();
      
      const newRoom = new Room();
      await newRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);
      
      // Enable audio
      await newRoom.localParticipant.setMicrophoneEnabled(true);
      
      // Handle remote audio tracks
      newRoom.on(RoomEvent.TrackSubscribed, (track, _, participant) => {
        if (track.kind === 'audio') {
          const el = audioElementsRef.current[participant.identity] || new Audio();
          track.attach(el);
          audioElementsRef.current[participant.identity] = el;
          el.play().catch(e => console.log('Audio play failed', e));
        }
      });
      
      // Cleanup on disconnect
      newRoom.on(RoomEvent.Disconnected, () => {
        Object.values(audioElementsRef.current).forEach(el => el.pause());
        audioElementsRef.current = {};
      });
      
      setRoom(newRoom);
      setInCall(true);
    } catch (error) {
      console.error('Failed to join room', error);
    }
  };

  if (authLoading || !sessionChecked) {
    return <div className="p-4">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  if (inCall && room) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Active Call</h1>
          <button
            onClick={hangup}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Hang Up
          </button>
        </div>
        
        {/* Use plain div instead of LiveKitRoom since we manage Room manually */}
        <div className="p-4 border rounded-lg bg-gray-50">
          <div className="space-y-4">
            {room.remoteParticipants.size === 0 ? (
              <p>Waiting for participants to join...</p>
            ) : (
              Array.from(room.remoteParticipants.values()).map(participant => (
                <div key={participant.identity} className="p-3 border rounded">
                  <p className="font-medium">{participant.identity}</p>
                  {/* Correctly access audio track count */}
                  <p className="text-sm text-gray-500">
                    Audio tracks: {
                      Array.from(participant.getTrackPublications())
                        .filter(pub => pub.kind === 'audio' && pub.isSubscribed)
                        .length
                    }
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Audio Calls</h1>
      
      {/* Incoming call notification */}
      {incomingCall && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="font-medium">Incoming call from ID: {incomingCall.from}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={acceptCall}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Accept
            </button>
            <button
              onClick={declineCall}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Decline
            </button>
          </div>
        </div>
      )}
      
      {/* Outgoing call status */}
      {outgoingCall && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p>Calling user {outgoingCall.to}... Waiting for response</p>
          <button
            onClick={hangup}
            className="mt-2 text-red-500 hover:text-red-700"
          >
            Cancel Call
          </button>
        </div>
      )}
      
      {/* User selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Select user to call:
        </label>
        <select
          value={selectedUser || ''}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">-- Select a user --</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.full_name} (ID: {u.id})
            </option>
          ))}
        </select>
      </div>
      
      <button
        onClick={startCall}
        disabled={!selectedUser || !!outgoingCall}
        className={`w-full py-2 rounded text-white ${
          !selectedUser || outgoingCall
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {outgoingCall ? 'Calling...' : 'Start Audio Call'}
      </button>
      
      {/* User list */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Online Users</h2>
        <div className="space-y-2">
          {users.map(u => (
            <div 
              key={u.id} 
              className="p-3 border rounded flex justify-between items-center"
            >
              <span>{u.full_name}</span>
              <span className="text-sm text-gray-500">ID: {u.id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}