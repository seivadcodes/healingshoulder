// src/lib/matching.ts
// Simulates real-time matching logic for grief support sessions
// Replace with WebRTC/Supabase/Socket.io integration later

export interface Peer {
  name: string;
  background: string;
  responseTime: string;
}

export interface Session {
  id: string;
  peer: Peer;
  startedAt: string;
}

const MOCK_PEERS: Peer[] = [
  { name: 'Maya', background: 'Lost a parent', responseTime: 'Typically replies in < 1 min' },
  { name: 'James', background: 'Grieving a friend', responseTime: 'Usually available right away' },
  { name: 'Elena', background: 'Experienced a miscarriage', responseTime: 'Replies within 2 minutes' },
  { name: 'David', background: 'Survivor of suicide loss', responseTime: 'Often online in evenings' },
  { name: 'Amina', background: 'Caregiver grief', responseTime: 'Responds thoughtfully & quickly' },
];

// Simulates creating a live 1:1 support session
export async function createSession(): Promise<Session> {
  // In production, this would:
  // - Call your matching API
  // - Initiate WebRTC handshake
  // - Reserve a Supabase channel

  await new Promise((resolve) => setTimeout(resolve, 2500 + Math.random() * 2000)); // realistic delay

  const randomPeer = MOCK_PEERS[Math.floor(Math.random() * MOCK_PEERS.length)];

  return {
    id: 'sess_' + Math.random().toString(36).substring(2, 12),
    peer: randomPeer,
    startedAt: new Date().toISOString(),
  };
}

// Simulates fetching an existing session (e.g., from URL param)
export async function getSession(id: string): Promise<Session | null> {
  // In prod: fetch(`/api/session/${id}`)
  if (!id.startsWith('sess_')) return null;

  // Simulate loading
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Reconstruct a consistent mock based on ID hash (for demo stability)
  const idx = Math.abs(id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % MOCK_PEERS.length;
  const peer = MOCK_PEERS[idx];

  return {
    id,
    peer,
    startedAt: new Date().toISOString(),
  };
}