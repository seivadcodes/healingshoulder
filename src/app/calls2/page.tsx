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
  DisconnectReason,
  setLogLevel,
  LogLevel,
} from 'livekit-client';

// ... inside your component

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
    // Setup signaling channel
  useEffect(() => {
    if (!user) return;
    
    const supabase = createClient();
    const channel = supabase.channel('calls');

    // Define payload types inline for clarity
    type CallRequestEvent = { from: string; to: string; room: string };
    type CallEndEvent = { room: string };

    // Listen for call events
    channel
      .on('broadcast', { event: 'call_request' }, (payload: { payload: CallRequestEvent }) => {
        const { from, to, room } = payload.payload;
        if (to === user.id && !inCall) {
          setIncomingCall({ from, room });
        }
      })
      .on('broadcast', { event: 'call_accept' }, (payload: { payload: CallRequestEvent }) => {
        const { from, to, room } = payload.payload;
        if (to === user.id && outgoingCall?.room === room) {
          joinRoom(room);
          setOutgoingCall(null);
        }
      })
      .on('broadcast', { event: 'call_decline' }, (payload: { payload: CallRequestEvent }) => {
        const { to } = payload.payload;
        if (to === user.id) {
          setOutgoingCall(null);
          alert('Call declined');
        }
      })
      .on('broadcast', { event: 'call_end' }, (payload: { payload: CallEndEvent }) => {
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

  const startCall = async () => {
  if (!selectedUser || !user || inCall || outgoingCall) {
    // Prevent starting a call if already in one, or if no user is selected
    return;
  }

  // Create a deterministic room name: sorted user IDs to ensure both parties agree
  const participants = [user.id, selectedUser].sort();
  const roomName = `call-${participants[0]}-${participants[1]}`;

  // Set outgoing call state to update UI
  setOutgoingCall({ to: selectedUser, room: roomName });

  try {
    // Broadcast call request to the selected user via Supabase Realtime
    const supabase = createClient();
    await supabase.channel('calls').send({
      type: 'broadcast',
      event: 'call_request',
      payload: {
        from: user.id,
        to: selectedUser,
        room: roomName,
      },
    });
  } catch (error) {
    console.error('[CALLS] ❌ Failed to send call request:', error);
    alert('Failed to initiate call. Please try again.');
    setOutgoingCall(null);
  }
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

 

useEffect(() => {
  // Set LiveKit log level globally (run once)
  setLogLevel(LogLevel.debug);
}, []);

const joinRoom = async (roomName: string) => {
  if (!user) return;

  console.log('[CALLS] 🚀 Attempting to join room:', roomName);
  setInCall(true);

  try {
    console.log('[CALLS] 🔐 Fetching LiveKit token...');
    const res = await fetch('/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: roomName, identity: user.id }),
    });

    if (!res.ok) {
      throw new Error(`Token request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('[CALLS] ✅ Token received:', {
      token: data.token ? '✅ (redacted)' : '❌ missing',
    });

    if (!data.token) {
      throw new Error('No token returned from server');
    }

    console.log('[CALLS] 🏗️ Initializing LiveKit Room...');
    const newRoom = new Room(); // ← no logLevel here

    // Add event listeners
    newRoom.on(RoomEvent.Connected, () => {
      console.log('[CALLS] 🟢 Room connected successfully');
    });

    newRoom.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      console.log('[CALLS] 🔴 Room disconnected:', reason);
      Object.values(audioElementsRef.current).forEach(el => el.pause());
      audioElementsRef.current = {};
    });

    newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.log('[CALLS] 🔄 Connection state changed:', state);
    });

    newRoom.on(RoomEvent.SignalConnected, () => {
      console.log('[CALLS] 📡 Signal connected');
    });

    console.log('[CALLS] ⚡ Connecting to LiveKit server...');
    await newRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, data.token);

    console.log('[CALLS] 🎯 Successfully connected to room:', newRoom.name);

    await newRoom.localParticipant.setMicrophoneEnabled(true);
    console.log('[CALLS] ✅ Microphone enabled');

    newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('[CALLS] 🎧 Track subscribed:', {
        trackId: track.sid,
        kind: track.kind,
        participant: participant.identity,
      });

      if (track.kind === 'audio') {
        const el = audioElementsRef.current[participant.identity] || new Audio();
        track.attach(el);
        audioElementsRef.current[participant.identity] = el;
        el.play().catch(e => {
          console.warn('[CALLS] 🎵 Audio play failed for', participant.identity, e);
        });
      }
    });

    setRoom(newRoom);
    console.log('[CALLS] 🟢 Call established successfully!');

  } catch (error: any) {
    console.error('[CALLS] ❌ Failed to join room:', {
      error: error.message || error,
      roomName,
      userId: user.id,
    });
    alert(`Call failed: ${error.message || 'Unknown error'}`);
    setInCall(false);
    setRoom(null);
    setIncomingCall(null);
    setOutgoingCall(null);
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