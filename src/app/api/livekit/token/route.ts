// src/app/api/livekit/token/route.ts
import { NextRequest } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  // For testing only: bypass auth to verify LiveKit works
  const user = { id: 'test-user-' + Math.random().toString(36).slice(2, 8), user_metadata: { full_name: 'Test User' } };

  const { roomName } = await request.json();
  if (!roomName || typeof roomName !== 'string' || roomName.length > 64) {
    return new Response('Invalid room name', { status: 400 });
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: user.id,
      name: user.user_metadata.full_name || 'Anonymous',
    }
  );

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();

  return Response.json({ token, url: process.env.LIVEKIT_URL });
}