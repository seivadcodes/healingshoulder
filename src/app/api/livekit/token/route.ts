// app/api/livekit/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server'; 
import { AccessToken } from 'livekit-server-sdk';



export async function POST(req: NextRequest) {
  try {
    const { room } = await req.json();
    
    // Validate room format
    const roomParts = room.split('-');
    if (roomParts.length !== 2) {
      return NextResponse.json({ error: 'Invalid room format' }, { status: 400 });
    }

    // Create client without conflict
    const supabase = await createClient();
    
    // Get session using proper Supabase method
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user belongs to this room
    if (!room.includes(session.user.id)) {
      return NextResponse.json({ error: 'Not authorized for this room' }, { status: 403 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Generate LiveKit token
    const apiKey = process.env.LIVEKIT_API_KEY!;
    const apiSecret = process.env.LIVEKIT_API_SECRET!;
    const token = new AccessToken(apiKey, apiSecret, {
      identity: session.user.id,
      name: profile.full_name || 'User',
      ttl: 60 * 10, // 10 minutes in seconds
    });

    token.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return NextResponse.json({ token: token.toJwt() });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}