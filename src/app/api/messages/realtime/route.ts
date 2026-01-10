// app/api/messages/realtime/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      type,
      toUserId,
      conversationId,
      ...data
    } = body
    
    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { error: 'Missing notification type' },
        { status: 400 }
      )
    }
    
    if (!toUserId && !conversationId) {
      return NextResponse.json(
        { error: 'Missing recipient (toUserId or conversationId)' },
        { status: 400 }
      )
    }
    
    // Get WebSocket server details
    const wsHost = process.env.WS_HOST || 'localhost'
    const wsPort = process.env.WS_PORT || '8084'
    
    // Forward notification to WebSocket server
    const notificationRes = await fetch(`http://${wsHost}:${wsPort}/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        toUserId,
        conversationId,
        ...data
      }),
    })
    
    if (!notificationRes.ok) {
      const errorData = await notificationRes.json().catch(() => null)
      console.error('WebSocket server notification failed:', errorData || notificationRes.statusText)
      
      return NextResponse.json(
        { error: 'Failed to send notification', details: errorData },
        { status: notificationRes.status }
      )
    }
    
    const result = await notificationRes.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Realtime notification error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// This route is only for POST requests
export const runtime = 'edge'