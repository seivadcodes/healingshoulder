import { NextRequest, NextResponse } from 'next/server';

// === Types ===
interface CommunityMemberRow {
  user_id: string;
}

interface NotificationBody {
  type: string;
  broadcast?: boolean;
  userId?: string;
  communityId?: string;
  toUserId?: string;
  isTyping?: boolean;
  messageId?: string;
  emoji?: string;
  action?: 'add' | 'remove';
  [key: string]: unknown; // allow extra fields like `isTyping`, `messageId`, etc.
}

// === Constants ===
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const signalingServerUrl = 'http://178.128.210.229:8084';

// Validate required env vars once at module level
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Missing NEXT_PUBLIC_SUPABASE_* env vars (may affect client-side only)');
}
if (!supabaseServiceRoleKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY – backend operations will fail');
}

// === Helper: Fetch community member IDs safely ===
async function getCommunityMemberIds(communityId: string): Promise<string[]> {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/community_members?community_id=eq.${encodeURIComponent(communityId)}&select=user_id`,
      {
        method: 'GET',
        headers: {
          apiKey: supabaseAnonKey!,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Supabase returned ${res.status}: ${errorText}`);
    }

    const data: CommunityMemberRow[] = await res.json();
    return data.map((row) => row.user_id);
  } catch (err) {
    console.error('Failed to fetch community members:', err);
    return []; // Return empty list so caller can decide how to proceed
  }
}

// === Main POST handler ===
export async function POST(request: NextRequest) {
  try {
    const body: NotificationBody = await request.json();
    console.log('📥 API received notification:', body);

    // === 1. Broadcast presence (e.g., global user online status) ===
    if (body.broadcast && body.type === 'user_presence') {
      console.log(`📤 Broadcasting presence for user: ${body.userId}`);
      const signalingRes = await fetch(`${signalingServerUrl}/notify-broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!signalingRes.ok) {
        const errorData = await signalingRes.json().catch(() => ({}));
        console.error('❌ Broadcast failed:', errorData);
        return NextResponse.json({ error: 'Broadcast failed', details: errorData }, { status: 500 });
      }

      const result = await signalingRes.json();
      return NextResponse.json({ ok: true, delivered: result.delivered ?? 0 });
    }

    // === 2. Handle COMMUNITY notifications ===
    const { communityId, type } = body;

    // ✅ Optimize: Typing events don’t need full member list — send as-is
    if (communityId && type === 'community_user_typing') {
      console.log(`📤 Forwarding typing event in community ${communityId} for user ${body.userId}`);
      const signalingRes = await fetch(`${signalingServerUrl}/notify-community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!signalingRes.ok) {
        const errorData = await signalingRes.json().catch(() => ({}));
        console.error('❌ Typing notify failed:', errorData);
        return NextResponse.json({ error: 'Typing notify failed', details: errorData }, { status: 500 });
      }

      const result = await signalingRes.json();
      return NextResponse.json({ ok: true, delivered: result.delivered ?? 0 });
    }

    // 📩 For messages/reactions: notify all members
    if (
      communityId &&
      (type === 'new_community_message' || type === 'community_message_reaction')
    ) {
      console.log(`📤 Handling community notification: ${type} in ${communityId}`);

      const userIds = await getCommunityMemberIds(communityId);
      if (userIds.length === 0) {
        console.warn(`No members found in community ${communityId}`);
        return NextResponse.json({ ok: true, delivered: 0 });
      }

      const payload = {
        communityId,
        userIds,
        ...body,
      };

      const signalingRes = await fetch(`${signalingServerUrl}/notify-community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!signalingRes.ok) {
        const errorData = await signalingRes.json().catch(() => ({}));
        console.error('❌ Community notify failed:', errorData);
        return NextResponse.json({ error: 'Community notify failed', details: errorData }, { status: 500 });
      }

      const result = await signalingRes.json();
      console.log(`✅ Delivered to ${result.delivered ?? 0} users`);
      return NextResponse.json({ ok: true, delivered: result.delivered ?? 0 });
    }

    // === 3. Direct user-to-user notifications ===
    const { toUserId } = body;
    if (!toUserId) {
      console.error('❌ Invalid payload: missing toUserId and not a community/broadcast event');
      return NextResponse.json({ error: 'Invalid notification payload' }, { status: 400 });
    }

    const signalingRes = await fetch(`${signalingServerUrl}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!signalingRes.ok) {
      const errorData = await signalingRes.json().catch(() => ({}));
      console.error('❌ Direct notify failed:', errorData);
      return NextResponse.json({ error: 'Delivery failed', details: errorData }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('🔥 Notify API internal error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: (err as Error).message },
      { status: 500 }
    );
  }
}