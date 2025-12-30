// app/api/livekit/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { AccessToken } from 'livekit-server-sdk';

if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
  throw new Error('Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET in .env.local');
}

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

export async function POST(req: NextRequest) {
  try {
    const { room, identity: userId } = await req.json(); // renamed for clarity

    if (!room || !userId) {
      return NextResponse.json({ error: 'Missing room or identity' }, { status: 400 });
    }

    // Validate user exists by ID (not username!)
    const supabase = createClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId, // use user.id
      ttl: '10m',
    });

    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();

    return NextResponse.json({ token });
  } catch (err) {
    console.error('LiveKit token generation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}