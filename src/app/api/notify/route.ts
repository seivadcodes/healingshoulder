import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    // Handle different notification types with appropriate validation
    if (type === 'call_accepted' || type === 'call_ended') {
      const { toUserId, roomName } = body;
      if (!toUserId || !roomName) {
        return Response.json(
          { error: 'Missing required fields for call event' },
          { status: 400 }
        );
      }
    } else {
      // Initial call notification validation
      const {
        toUserId,
        callerId,
        callerName,
        roomName,
        callType,
      } = body;

      if (!toUserId || !callerId || !callerName || !roomName || !callType) {
        return Response.json(
          { error: 'Missing required fields for initial call' },
          { status: 400 }
        );
      }
    }

    // Forward notification to signaling server
    const signalingRes = await fetch('http://178.128.210.229:8084/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!signalingRes.ok) {
      const errorData = await signalingRes.json();
      console.error('Signaling server error:', errorData);
      return Response.json(
        { error: 'Failed to notify signaling server' },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Notify API error:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}