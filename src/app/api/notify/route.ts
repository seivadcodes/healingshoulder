// app/api/notify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// Get signaling server URL from environment variables
const SIGNALING_SERVER_URL = process.env.SIGNALING_SERVER_URL || 'http://localhost:8084';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📥 API received notification:', body);
    const supabase = createClient();

    // Handle community notifications (most common case)
    if (body.communityId) {
      console.log(`🔊 Processing community notification for: ${body.communityId}`);
      
      // Skip unnecessary DB fetch - signaling server tracks connected members
      const signalingRes = await fetch(`${SIGNALING_SERVER_URL}/notify-community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          type: body.type || 'new_community_message' // Ensure type is set
        }),
      });

      if (!signalingRes.ok) {
        const errorData = await signalingRes.json().catch(() => ({}));
        console.error('❌ Community broadcast failed:', errorData);
        return NextResponse.json({ 
          error: 'Community broadcast failed',
          details: errorData
        }, { status: 500 });
      }

      const result = await signalingRes.json();
      console.log(`✅ Community broadcast delivered to ${result.delivered} connections`);
      
      return NextResponse.json({ 
        ok: true,
        delivered: result.delivered,
        connectedMembers: result.totalConnected
      });
    }

    // Handle presence updates
    if (body.broadcast && body.type === 'user_presence') {
      console.log(`👥 Broadcasting presence for user: ${body.userId}`);
      
      const signalingRes = await fetch(`${SIGNALING_SERVER_URL}/notify-broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!signalingRes.ok) {
        const errorData = await signalingRes.json().catch(() => ({}));
        return NextResponse.json({ 
          error: 'Presence broadcast failed',
          details: errorData
        }, { status: 500 });
      }

      return NextResponse.json(await signalingRes.json());
    }

    // Handle direct user notifications
    if (body.toUserId) {
      console.log(`📩 Direct notification to user: ${body.toUserId}`);
      
      const signalingRes = await fetch(`${SIGNALING_SERVER_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!signalingRes.ok) {
        const errorData = await signalingRes.json().catch(() => ({}));
        return NextResponse.json({ 
          error: 'Direct notification failed',
          details: errorData
        }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid notification payload' }, { status: 400 });
    
  } catch (err) {
    console.error('🔥 Notify API critical error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}