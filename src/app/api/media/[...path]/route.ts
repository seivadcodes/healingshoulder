//app/api/media/[...path]

import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// Whitelist allowed buckets for security
const ALLOWED_BUCKETS = ['communities', 'angels-media', 'avatars', 'resources', 'message-files', 'media-files', 'community-files',  'book-covers', 'videos', 'posts','angels',];

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const pathParts = params.path;
  if (pathParts.length < 2) {
    return NextResponse.json({ error: 'Invalid path: missing bucket' }, { status: 400 });
  }

  const [bucketName, ...rest] = pathParts;
  const filePath = rest.join('/');

  if (!filePath) {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
  }

  if (!ALLOWED_BUCKETS.includes(bucketName)) {
    return NextResponse.json({ error: 'Unauthorized bucket' }, { status: 403 });
  }

  // Optional: block path traversal
  if (filePath.includes('../') || filePath.startsWith('/')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucketName)
    .download(filePath);

  if (error) {
    console.error(`Media fetch error from bucket "${bucketName}":`, error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Detect MIME type
  const mimeType = filePath.endsWith('.png')
    ? 'image/png'
    : filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')
    ? 'image/jpeg'
    : filePath.endsWith('.gif')
    ? 'image/gif'
    : filePath.endsWith('.pdf')
    ? 'application/pdf'
    : filePath.endsWith('.mp4')
    ? 'video/mp4'
    : 'application/octet-stream'; // fallback

  return new NextResponse(data, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}