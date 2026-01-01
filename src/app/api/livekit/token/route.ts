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
    const { room, identity: userId, name } = await req.json(); // ✅ destructure `name`

    if (!room || !userId || typeof name !== 'string') {
      return NextResponse.json({ error: 'Missing room, identity, or valid name' }, { status: 400 });
    }

    // Validate user exists
    const supabase = createClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Optional: fallback to name from DB if client didn't send one
    const displayName = name || profile.full_name || 'Anonymous';

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      name: displayName, // ✅ SET NAME IN TOKEN — THIS IS CRITICAL
      ttl: '10m',
    });

    at.addGrant({ 
      room, 
      roomJoin: true, 
      canPublish: true, 
      canSubscribe: true 
    });

    const token = await at.toJwt();

    return NextResponse.json({ token });
  } catch (err) {
    console.error('LiveKit token generation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}