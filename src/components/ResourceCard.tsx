// src/components/ResourceCard.tsx
'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

// Matches your resource types + leaves room for "Book" later
type ResourceType = 'Guide' | 'Story' | 'Video' | 'Tool' | 'Book';

interface ResourceCardProps {
  id: number;
  title: string;
  excerpt: string;
  type: ResourceType;
  featured?: boolean;
}

export default function ResourceCard({
  id,
  title,
  excerpt,
  type,
  featured = false,
}: ResourceCardProps) {
  // Color mapping — warm, non-clinical, emotionally intuitive
  const typeColorMap: Record<ResourceType, string> = {
    Guide: 'bg-blue-100 text-blue-800',
    Story: 'bg-amber-100 text-amber-800',
    Video: 'bg-purple-100 text-purple-800',
    Tool: 'bg-emerald-100 text-emerald-800',
    Book: 'bg-rose-100 text-rose-800', // ready for future use
  };

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
        <p className="text-stone-600 text-sm mb-3">{excerpt}</p>
      </CardContent>
      <CardFooter className="px-4 pb-3 pt-0">
        <Link
          href={`/resources/${id}`}
          className="inline-flex items-center text-amber-600 hover:text-amber-800 text-sm font-medium group"
        >
          Read more
          <ArrowRightIcon className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}