// src/components/ResourceCard.tsx
'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { Users, Dot, BookOpen } from 'lucide-react';

export type ResourceType = 'Guide' | 'Story' | 'Video' | 'Tool' | 'Book';

interface ResourceCardProps {
  id: number;
  title: string;
  excerpt: string;
  type: ResourceType;
  featured?: boolean;
  author?: string; // optional author (for books/guides)
  liveViewers?: number; // for Videos: how many are watching
  communitySource?: string; // e.g., "Loss of a Parent"
  sharedAgo?: string; // e.g., "2h ago"
}

const actionTextMap: Record<ResourceType, string> = {
  Guide: 'Read more',
  Story: 'Read story',
  Video: 'Watch now',
  Tool: 'Download tool',
  Book: 'Read excerpt',
};

const typeColorMap: Record<ResourceType, string> = {
  Guide: 'bg-blue-100 text-blue-800',
  Story: 'bg-amber-100 text-amber-800',
  Video: 'bg-purple-100 text-purple-800',
  Tool: 'bg-emerald-100 text-emerald-800',
  Book: 'bg-rose-100 text-rose-800',
};

export default function ResourceCard({
  id,
  title,
  excerpt,
  type,
  featured = false,
  author,
  liveViewers,
  communitySource,
  sharedAgo,
}: ResourceCardProps) {
  const cardClasses = featured
    ? 'border-l-4 border-amber-500 bg-white shadow-sm hover:shadow-md transition-shadow'
    : 'bg-white border border-stone-200 shadow-sm hover:shadow transition-shadow';

  return (
    <Card className={cardClasses}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-stone-800 leading-tight">{title}</h3>
          <Badge className={`${typeColorMap[type]} px-2 py-1 text-xs font-medium rounded-full`}>
            {type}
          </Badge>
        </div>
        <p className="text-stone-600 text-sm mb-2">{excerpt}</p>

        {/* Author (for book-like content) */}
        {author && (
          <p className="text-xs text-stone-500 mt-1 flex items-center">
            <BookOpen className="w-3 h-3 mr-1 inline" />
            {author}
          </p>
        )}

        {/* Live or community context */}
        {(liveViewers || communitySource) && (
          <div className="text-xs text-stone-500 mt-1 flex items-center">
            {liveViewers ? (
              <>
                <Dot className="text-red-500 fill-current h-3 w-3 mr-1" />
                {liveViewers} watching now
              </>
            ) : communitySource ? (
              <>
                <Users className="w-3 h-3 mr-1" />
                Shared in <span className="font-medium ml-1">{communitySource}</span> • {sharedAgo}
              </>
            ) : null}
          </div>
        )}
      </CardContent>
      <CardFooter className="px-4 pb-3 pt-0">
        <Link
          href={`/resources/${id}`}
          className="inline-flex items-center text-amber-600 hover:text-amber-800 text-sm font-medium group"
        >
          {actionTextMap[type]}
          <ArrowRightIcon className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}