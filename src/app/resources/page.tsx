// src/app/resources/page.tsx
'use client';

import { useState, useEffect } from 'react';
import ResourceCard from '@/components/ResourceCard';

// --- Enhanced resource type
type ResourceType = 'Guide' | 'Story' | 'Video' | 'Tool' | 'Book';

const allResources: {
  id: number;
  title: string;
  type: ResourceType;
  excerpt: string;
  category: string;
  tags: string[];
  featured: boolean;
}[] = [
  {
    id: 1,
    title: "When the Holidays Hurt",
    type: "Guide",
    excerpt: "Gentle ways to honor your loved one during family gatherings — without pretending you’re okay.",
    category: "Guidance",
    tags: ["holidays", "family", "rituals"],
    featured: true,
  },
  {
    id: 2,
    title: "I Still Talk to Her Every Morning",
    type: "Story",
    excerpt: "A widow shares how writing letters keeps her connection alive — even five years later.",
    category: "Personal Stories",
    tags: ["spouse", "daily ritual", "letters"],
    featured: true,
  },
  {
    id: 3,
    title: "Breathing Through the Wave",
    type: "Video",
    excerpt: "A 5-minute guided breathwork session for when grief hits like a tidal wave.",
    category: "Videos",
    tags: ["mindfulness", "anxiety", "breathing", "acute grief"],
    featured: false,
  },
  {
    id: 4,
    title: "Memory Journal Template",
    type: "Tool",
    excerpt: "A printable PDF to capture stories, photos, and letters — so nothing is lost.",
    category: "Tools",
    tags: ["journaling", "memory", "legacy"],
    featured: false,
  },
  {
    id: 5,
    title: "From 'Grief Is Love' — Chapter 3",
    type: "Guide", // ← Will become 'Book' later
    excerpt: "A powerful passage on how grief is the echo of deep love — and why that’s sacred.",
    category: "Guidance",
    tags: ["love", "book", "transformation", "parent"],
    featured: false,
  },
  {
    id: 6,
    title: "What to Say (and Not Say)",
    type: "Guide",
    excerpt: "Empathy over advice — 10 phrases that truly help (and 5 to avoid).",
    category: "Guidance",
    tags: ["support", "friends", "communication"],
    featured: false,
  },
];

const categories = ["All", "Guides", "Stories", "Videos", "Tools"]; 
// ↑ Hide "Books" for now — add when ready

export default function ResourcesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [forYou, setForYou] = useState<typeof allResources>([]);

  // Simulate personalization
  useEffect(() => {
    // In real app: pull from localStorage or API
    const recentInterest = 'parent'; // e.g., from visiting /communities/loss-of-parent
    const suggestions = allResources
      .filter(r => !r.featured && r.tags.includes(recentInterest))
      .slice(0, 2);
    setForYou(suggestions);
  }, []);

  const filtered = allResources.filter(r =>
    (selectedCategory === 'All' || 
      (selectedCategory === 'Guides' && r.category === 'Guidance') ||
      (selectedCategory === 'Stories' && r.category === 'Personal Stories') ||
      (selectedCategory === r.type + 's')) &&
    (r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
     r.excerpt.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const featured = allResources.filter(r => r.featured);

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <h1 className="text-3xl font-serif font-bold text-stone-800 text-center mb-2">
          Resources That Hold You
        </h1>
        <p className="text-stone-600 text-center mb-8 max-w-2xl mx-auto">
          Everything here was created by people who’ve walked through grief — 
          so you never have to feel alone.
        </p>

        {/* Search */}
        <div className="mb-8 max-w-lg mx-auto">
          <input
            type="text"
            placeholder="Search for comfort, tools, or stories…"
            className="w-full px-5 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 text-sm rounded-full transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-white'
                  : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Featured */}
        {featured.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-stone-800 mb-4 flex items-center">
              <span className="w-8 h-px bg-amber-500 mr-3"></span>
              Featured for You
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {featured.map(r => (
                <ResourceCard key={r.id} {...r} />
              ))}
            </div>
          </section>
        )}

        {/* For You */}
        {forYou.length > 0 && (
          <section className="mb-12">
            <h2 className="text-lg text-stone-700 mb-3">
              Because you’ve been thinking about loss of a parent…
            </h2>
            <div className="space-y-4">
              {forYou.map(r => (
                <ResourceCard key={`fy-${r.id}`} {...r} />
              ))}
            </div>
          </section>
        )}

        {/* All Resources */}
        <section>
          <h2 className="text-lg font-medium text-stone-700 mb-4">
            {selectedCategory === 'All' ? 'All Resources' : selectedCategory}
          </h2>
          {filtered.filter(r => !r.featured).length === 0 ? (
            <p className="text-stone-500 text-center py-6">No resources match your search.</p>
          ) : (
            <div className="space-y-4">
              {filtered
                .filter(r => !r.featured)
                .map(r => (
                  <ResourceCard key={r.id} {...r} />
                ))}
            </div>
          )}
        </section>

        <footer className="mt-16 text-center text-stone-500 text-sm">
          <p>Created by grievers, for grievers. Want to share your story or guide?</p>
          <button className="text-amber-600 hover:underline mt-1">Submit a resource</button>
        </footer>
      </div>
    </div>
  );
}