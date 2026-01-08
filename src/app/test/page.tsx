'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCall } from '@/context/CallContext';

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
};

export interface IncomingCall {
  callerId: string;
  callerName: string;
  roomName: string;
  callType: 'audio' | 'video';
  conversationId: string;
}

export default function TestCallPage() {
  const { user: currentUser } = useAuth();
  const supabase = createClient();
  const { incomingCall, setIncomingCall } = useCall();

  const [users, setUsers] = useState<Profile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  // Call state management
  const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [calleeName, setCalleeName] = useState('');
  const callStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callStateRef = useRef(callState);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    const fetchUsersAndProfile = async () => {
      if (!currentUser?.id) return;

      const { data: otherUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .neq('id', currentUser.id);

      if (usersError) {
        console.error('Failed to load users:', usersError);
        toast.error('Failed to load users');
      } else {
        setUsers(otherUsers || []);
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', currentUser.id)
        .single();

      if (profileError) {
        console.error('Failed to load current user profile:', profileError);
        toast.error('Failed to load your profile');
      } else {
        setCurrentUserProfile(profile);
      }
    };

    fetchUsersAndProfile();
  }, [currentUser?.id, supabase]);

  // Handle call timer
  useEffect(() => {
    if (callState === 'connected' && callStartTimeRef.current) {
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current!) / 1000);
        setCallTimer(elapsed);
      }, 1000);
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [callState]);

  // Handle call state transitions
  useEffect(() => {
    if (callState === 'calling') {
      ringingTimeoutRef.current = setTimeout(() => {
        setCallState('ringing');
      }, 2000);
    } else if (callState === 'ringing') {
      ringingTimeoutRef.current = setTimeout(() => {
        setCallState('ended');
        toast('CallCheck timed out', { icon: '⏰' });
      }, 30000);
    } else if (callState === 'connected') {
      callStartTimeRef.current = Date.now();
    } else if (callState === 'ended') {
      const resetTimeout = setTimeout(() => {
        setCallState('idle');
        setCalleeName('');
        setCallTimer(0);
        callStartTimeRef.current = null;
      }, 1000);
      return () => clearTimeout(resetTimeout);
    }

    return () => {
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
      }
    };
  }, [callState]);

  // 🔥 Fixed WebSocket listener with proper dependencies
  useEffect(() => {
    if (!currentUser?.id) return;

    const ws = new WebSocket(`ws://178.128.210.229:8084?userId=${currentUser.id}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type } = msg;

        if (type === 'incoming_call') {
          setIncomingCall({
            callerId: msg.callerId,
            callerName: msg.callerName,
            roomName: msg.roomName,
            callType: msg.callType,
            conversationId: msg.conversationId,
          });
        }
        else if (type === 'call_accepted') {
          // Use ref to get latest call state
          if (callStateRef.current === 'ringing' || callStateRef.current === 'calling') {
            if (ringingTimeoutRef.current) {
              clearTimeout(ringingTimeoutRef.current);
              ringingTimeoutRef.current = null;
            }
            setCallState('connected');
            callStartTimeRef.current = Date.now();
          }
        }
        else if (type === 'call_ended') {
          if (callStateRef.current === 'connected' || callStateRef.current === 'ringing') {
            setCallState('ended');
          }
        }
      } catch (e) {
        console.error('WebSocket message error', e);
      }
    };

    ws.onopen = () => console.log('✅ WebSocket connected');
    ws.onerror = (err) => console.error('WebSocket error:', err);
    ws.onclose = () => console.log('WebSocket disconnected');

    return () => ws.close();
  }, [currentUser?.id]); // Only depend on user ID

  const handleAccept = async () => {
    if (!incomingCall) return;

    const callerName = incomingCall.callerName || 'User';
    setCalleeName(callerName);
    setCallState('connected');
    callStartTimeRef.current = Date.now();
    setIncomingCall(null);

    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: incomingCall.callerId,
          type: 'call_accepted',
          roomName: incomingCall.roomName,
        }),
      });
    } catch (err) {
      console.error('Failed to send call accepted', err);
    }
  };

  const handleDecline = () => {
    setIncomingCall(null);
    toast('CallCheck declined', { icon: '📞' });
    
    if (callState !== 'idle' && callState !== 'ended') {
      setCallState('ended');
    }
  };

  const handleCall = async () => {
    if (!selectedUserId || !currentUser?.id || !currentUserProfile) return;

    const callerName = currentUserProfile.full_name || currentUser.email?.split('@')[0] || 'User';
    const callee = users.find(u => u.id === selectedUserId);
    const calleeName = callee?.full_name || 'Recipient';

    setCalleeName(calleeName);
    setCallState('calling');

    const roomName = `call-test-${Date.now()}`;
    const callType: 'audio' | 'video' = 'video';

    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: selectedUserId,
          callerId: currentUser.id,
          callerName,
          roomName,
          callType,
          conversationId: `test-conv-${currentUser.id}-${selectedUserId}`,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('CallCheck failed:', errorData);
        toast.error('Failed to send call');
        setCallState('ended');
      }
    } catch (err) {
      console.error('CallCheck error:', err);
      toast.error('Network error: failed to send call');
      setCallState('ended');
    }
  };

  const hangUp = async () => {
    setCallState('ended');
    
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
    }
    
    if (incomingCall || (callState === 'connected' && selectedUserId)) {
      const peerId = incomingCall ? incomingCall.callerId : selectedUserId;
      const roomName = incomingCall ? incomingCall.roomName : `call-test-${Date.now()}`;
      
      if (peerId) {
        try {
          await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toUserId: peerId,
              type: 'call_ended',
              roomName,
            }),
          });
        } catch (err) {
          console.error('Failed to send hangup notification', err);
        }
      }
    }
    
    toast('CallCheck ended', { icon: '✅' });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const callCardStyle: React.CSSProperties = {
    backgroundColor: '#1e293b',
    borderRadius: '24px',
    padding: '32px',
    width: '90%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
    position: 'relative',
  };

  const avatarStyle: React.CSSProperties = {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    backgroundColor: '#334155',
    margin: '0 auto 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#cbd5e1',
    border: '4px solid #4f46e5',
  };

  const nameStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: '8px',
  };

  const statusStyle: React.CSSProperties = {
    fontSize: '18px',
    color: '#94a3b8',
    marginBottom: '24px',
    textTransform: 'capitalize',
  };

  const timerStyle: React.CSSProperties = {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#f1f5f9',
    margin: '16px 0 32px',
    fontFamily: 'monospace',
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    marginTop: '16px',
  };

  const buttonStyle: React.CSSProperties = {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.1s, box-shadow 0.1s',
  };

  const hangUpButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#ef4444',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
  };

  const acceptButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#22c55e',
    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
  };

  const declineButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#64748b',
    boxShadow: '0 4px 12px rgba(100, 116, 139, 0.4)',
  };

  const iconStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    strokeWidth: '1.5',
  };

  if (!currentUser) {
    return <div style={{ padding: '32px' }}>Loading...</div>;
  }

  if (!currentUserProfile) {
    return <div style={{ padding: '32px' }}>Loading your profile...</div>;
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px', position: 'relative' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>CallCheck Test</h1>
      <p style={{ color: '#475569', lineHeight: 1.5, marginBottom: '32px' }}>
        Select a user to call. They will receive a real-time notification <strong>on this page</strong>.
      </p>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>
          Select User to Call
        </label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={{
            width: '100%',
            padding: '14px',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            fontSize: '16px',
            backgroundColor: '#f8fafc',
            color: '#1e293b',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#4f46e5'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
        >
          <option value="">— Choose a user —</option>
          {users.map((user) => (
            <option key={user.id} value={user.id} style={{ padding: '8px' }}>
              {user.full_name || 'Unnamed User'}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleCall}
        disabled={!selectedUserId || callState !== 'idle'}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: selectedUserId && callState === 'idle' ? '#4f46e5' : '#94a8c4',
          color: 'white',
          fontWeight: '600',
          fontSize: '18px',
          borderRadius: '16px',
          border: 'none',
          cursor: selectedUserId && callState === 'idle' ? 'pointer' : 'not-allowed',
          transition: 'background-color 0.2s',
        }}
        onMouseOver={(e) => {
          if (selectedUserId && callState === 'idle') {
            e.currentTarget.style.backgroundColor = '#4338ca';
          }
        }}
        onMouseOut={(e) => {
          if (selectedUserId && callState === 'idle') {
            e.currentTarget.style.backgroundColor = '#4f46e5';
          }
        }}
      >
        {callState === 'idle' ? 'CallCheck Them!' : 'CallCheck in Progress...'}
      </button>

      {/* Incoming Call Popup */}
      {incomingCall && callState === 'idle' && (
        <div style={overlayStyle}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '28px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          }}>
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
              Incoming {incomingCall.callType} Call
            </h3>
            <p style={{ color: '#475569', marginBottom: '24px' }}>From: {incomingCall.callerName}</p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                onClick={handleAccept}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  borderRadius: '16px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
              >
                Accept
              </button>
              <button
                onClick={handleDecline}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: '#64748b',
                  color: 'white',
                  borderRadius: '16px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#475a6d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#64748b'}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calling Overlay */}
      {(callState === 'calling' || callState === 'ringing' || callState === 'connected') && (
        <div style={overlayStyle}>
          <div style={callCardStyle}>
            <div style={avatarStyle}>
              {(calleeName || 'U').charAt(0).toUpperCase()}
            </div>
            
            <div style={nameStyle}>{calleeName}</div>
            
            <div style={statusStyle}>
              {callState === 'calling' && 'Calling...'}
              {callState === 'ringing' && 'Ringing...'}
              {callState === 'connected' && 'Connected'}
            </div>
            
            {callState === 'connected' && (
              <div style={timerStyle}>
                {formatTime(callTimer)}
              </div>
            )}
            
            <div style={buttonContainerStyle}>
              {callState === 'ringing' && (
                <>
                  <button 
                    onClick={() => setCallState('ended')} 
                    style={declineButtonStyle}
                    title="Simulate Decline"
                  >
                    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 9L9 15M9 9l6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button 
                    onClick={() => setCallState('connected')} 
                    style={acceptButtonStyle}
                    title="Simulate Accept"
                  >
                    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </>
              )}
              
              <button 
                onClick={hangUp} 
                style={hangUpButtonStyle}
                title="Hang Up"
              >
                <svg style={iconStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15.75 9a4.5 4.5 0 00-4.5-4.5 4.5 4.5 0 00-4.5 4.5 4.5 4.5 0 004.5 4.5M8.25 10.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM19.5 9a4.5 4.5 0 00-4.5-4.5 4.5 4.5 0 00-4.5 4.5 4.5 4.5 0 004.5 4.5M16.5 10.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}