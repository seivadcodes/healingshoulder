// app/api/media/[...path]/route.ts

import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_BUCKETS = [
  'communities',
  'angels-media',
  'avatars',
  'resources',
  'message-files',
  'media-files',
  'community-files',
  'book-covers',
  'videos',
  'posts',
  'angels',
] as const;

type AllowedBucket = typeof ALLOWED_BUCKETS[number];

function isAllowedBucket(bucket: string): bucket is AllowedBucket {
  return (ALLOWED_BUCKETS as readonly string[]).includes(bucket);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Record<string, string | string[]> } // Fixed type annotation
) {
  // Get and validate path parts
  const pathParts = params.path;
  
  if (!Array.isArray(pathParts) || pathParts.length < 2) {
    return NextResponse.json({ error: 'Invalid path: missing bucket or file' }, { status: 400 });
  }

  const [bucketName, ...rest] = pathParts;
  const filePath = rest.join('/');

  if (!filePath) {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
  }

  if (!isAllowedBucket(bucketName)) {
    return NextResponse.json({ error: 'Unauthorized bucket' }, { status: 403 });
  }

  // Block path traversal
  if (filePath.includes('../') || filePath.startsWith('/')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucketName).download(filePath);

  if (error) {
    console.error(`Media fetch error from bucket "${bucketName}":`, error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  let mimeType = 'application/octet-stream';
  if (filePath.endsWith('.png')) mimeType = 'image/png';
  else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) mimeType = 'image/jpeg';
  else if (filePath.endsWith('.gif')) mimeType = 'image/gif';
  else if (filePath.endsWith('.pdf')) mimeType = 'application/pdf';
  else if (filePath.endsWith('.mp4')) mimeType = 'video/mp4';
  else if (filePath.endsWith('.webp')) mimeType = 'image/webp';
  else if (filePath.endsWith('.svg')) mimeType = 'image/svg+xml';

  return new NextResponse(data, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}