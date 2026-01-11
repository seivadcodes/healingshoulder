import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📥 API received notification:', body);

    // Handle broadcast notifications (presence updates)
    if (body.broadcast && body.type === 'user_presence') {
      console.log(`📤 Broadcasting presence update for user: ${body.userId}`);
      
      // Forward to signaling server with broadcast flag
      const signalingRes = await fetch('http://178.128.210.229:8084/notify-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!signalingRes.ok) {
        const errorData = await signalingRes.json();
        console.error('❌ Broadcast signaling error:', errorData);
        return NextResponse.json({ 
          error: 'Failed to broadcast notification',
          details: errorData
        }, { status: 500 });
      }

      const result = await signalingRes.json();
      console.log(`✅ Successfully broadcast to ${result.delivered} connections`);
      
      return NextResponse.json({ 
        ok: true,
        delivered: result.delivered,
        connections: result.connections
      });
    }

    // Handle regular notifications to specific users
    const { toUserId, } = body;
    
    if (!toUserId) {
      console.error('❌ Missing toUserId in notification');
      return NextResponse.json({ error: 'Missing toUserId' }, { status: 400 });
    }

    // Forward to signaling server
    const signalingRes = await fetch('http://178.128.210.229:8084/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!signalingRes.ok) {
      const errorData = await signalingRes.json();
      console.error('❌ Signaling server error:', errorData);
      return NextResponse.json({ 
        error: 'Failed to notify signaling server',
        details: errorData
      }, { status: 500 });
    }

    console.log(`✅ Notification delivered to user: ${toUserId}`);
    return NextResponse.json({ ok: true });
    
  } catch (err) {
    console.error('🔥 Notify API error:', err);
    if (err instanceof Error) {
      return NextResponse.json({ 
        error: 'Internal server error',
        details: err.message
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}