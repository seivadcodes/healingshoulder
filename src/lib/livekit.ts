import { Room, LocalTrack } from 'livekit-client';
import { createClient } from '@/lib/supabase/client';

export async function joinCallRoom(roomName: string) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) throw new Error('Not authenticated');
  
  const currentUserId = session.user.id;
  const userName = session.user.user_metadata?.full_name || session.user.email || 'Anonymous';

  // Get token
  const tokenRes = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: roomName, identity: currentUserId, name: userName }),
  });
  
  if (!tokenRes.ok) {
    const errData = await tokenRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to get call token');
  }
  
  const { token } = await tokenRes.json();

  // Connect to room
  const room = new Room();
  await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);

  // Create and publish audio track
  let audioTrack: LocalTrack | null = null;
  try {
    const tracks = await room.localParticipant.createTracks({ audio: true });
    if (tracks[0]) {
      await room.localParticipant.publishTrack(tracks[0]);
      audioTrack = tracks[0];
    }
  } catch (e) {
    console.warn('CallCheck: Audio track creation failed', e);
  }

  console.log('CallCheck: Joined room successfully');
  return {
    room,
    localAudioTrack: audioTrack,
  };
}