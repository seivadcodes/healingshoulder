// src/app/resources/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ResourceCard, { ResourceType } from '@/components/ResourceCard';
import { BookOpen } from 'lucide-react';

// Expanded, emotionally rich mock data reflecting diverse grief experiences
const allResources: {
  id: number;
  title: string;
  type: ResourceType;
  excerpt: string;
  category: string;
  tags: string[];
  featured: boolean;
  author?: string;
  liveViewers?: number;
  communitySource?: string;
  sharedAgo?: string;
}[] = [
  // ─── Featured (Curated) ─────────────────────
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
    communitySource: "Loss of a Spouse",
    sharedAgo: "3h ago",
  },

  // ─── Personal Stories (5) ───────────────────
  {
    id: 3,
    title: "The Day My Son’s Laughter Stopped",
    type: "Story",
    excerpt: "A father’s raw account of losing his 8-year-old to a sudden illness — and how he keeps his joy alive.",
    category: "Personal Stories",
    tags: ["child", "sudden loss", "father"],
    featured: false,
    communitySource: "Loss of a Child",
    sharedAgo: "1d ago",
  },
  {
    id: 4,
    title: "After the Overdose",
    type: "Story",
    excerpt: "I blamed myself for years. This is how I began to forgive.",
    category: "Personal Stories",
    tags: ["overdose", "guilt", "addiction", "sibling"],
    featured: false,
  },
  {
    id: 5,
    title: "My Dog Was My Anchor",
    type: "Story",
    excerpt: "When my service dog passed, my world collapsed. Here’s how I found solid ground again.",
    category: "Personal Stories",
    tags: ["pet loss", "service animal", "disability"],
    featured: false,
    communitySource: "Grief Beyond Humans",
    sharedAgo: "5h ago",
  },
  {
    id: 6,
    title: "Estranged, But Still Grieving",
    type: "Story",
    excerpt: "My mother died before we could reconcile. The grief is complicated — and that’s okay.",
    category: "Personal Stories",
    tags: ["estrangement", "mother", "complicated grief"],
    featured: false,
  },
  {
    id: 7,
    title: "I Miss His Laugh Today",
    type: "Story",
    excerpt: "Sometimes it’s the small things — like his laugh during breakfast — that undo me.",
    category: "Personal Stories",
    tags: ["father", "everyday", "memory"],
    featured: false,
    communitySource: "Loss of a Parent",
    sharedAgo: "2h ago",
  },

  // ─── Tools (4) ─────────────────────────────
  {
    id: 8,
    title: "Memory Journal Template",
    type: "Tool",
    excerpt: "A printable PDF to capture stories, photos, and letters — so nothing is lost.",
    category: "Tools",
    tags: ["journaling", "memory", "legacy"],
    featured: false,
    communitySource: "Friends Who Understand",
    sharedAgo: "1d ago",
  },
  {
    id: 9,
    title: "Grief First Aid Kit",
    type: "Tool",
    excerpt: "A checklist for acute grief moments: what to do when the wave hits.",
    category: "Tools",
    tags: ["acute grief", "coping", "emergency"],
    featured: false,
  },
  {
    id: 10,
    title: "How to Plan a Memorial on $50",
    type: "Tool",
    excerpt: "Simple, meaningful ideas that honor your person without financial strain.",
    category: "Tools",
    tags: ["memorial", "budget", "practical"],
    featured: false,
  },
  {
    id: 11,
    title: "Letter to My Future Self",
    type: "Tool",
    excerpt: "A guided template to write to yourself one year from now — with compassion.",
    category: "Tools",
    tags: ["hope", "future", "writing"],
    featured: false,
  },

  // ─── Videos (3) ────────────────────────────
  {
    id: 12,
    title: "Breathing Through the Wave",
    type: "Video",
    excerpt: "A 5-minute guided breathwork session for when grief hits like a tidal wave.",
    category: "Videos",
    tags: ["mindfulness", "anxiety", "breathing", "acute grief"],
    featured: false,
    liveViewers: 8,
  },
  {
    id: 13,
    title: "Why Grief Isn’t Linear",
    type: "Video",
    excerpt: "A therapist explains why ‘stages’ don’t apply — and what to expect instead.",
    category: "Videos",
    tags: ["education", "emotions", "therapy"],
    featured: false,
  },
  {
    id: 14,
    title: "Creating a Memory Altar at Home",
    type: "Video",
    excerpt: "Step-by-step guide to building a sacred space for your loved one.",
    category: "Videos",
    tags: ["ritual", "home", "altar"],
    featured: false,
  },

  // ─── Books (3 real author excerpts) ────────
  {
    id: 15,
    title: "From ‘Grief Is Love’",
    type: "Book",
    excerpt: "Grief is not a problem to be solved, but love with nowhere to go.",
    category: "Books",
    tags: ["love", "book", "transformation", "parent"],
    featured: false,
    author: "Marisa Renee Lee",
  },
  {
    id: 16,
    title: "From ‘It’s OK That You’re Not OK’",
    type: "Book",
    excerpt: "The opposite of grief is not happiness — it’s apathy. Feeling deeply is still living.",
    category: "Books",
    tags: ["truth", "book", "culture", "sibling"],
    featured: false,
    author: "Megan Devine",
  },
  {
    id: 17,
    title: "From ‘The Wild Edge of Sorrow’",
    type: "Book",
    excerpt: "Grief is a wilderness. You don’t ‘get over’ it — you learn to carry it.",
    category: "Books",
    tags: ["nature", "book", "ritual", "earth"],
    featured: false,
    author: "Francis Weller",
  },
];

// Now includes "Books"
const categories = ["All", "Guides", "Stories", "Videos", "Tools", "Books"];

export default function ResourcesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [forYou, setForYou] = useState<typeof allResources>([]);

  // Simulate personalization (e.g., user visited "Loss of Parent")
  useEffect(() => {
    const recentInterest = 'parent';
    const suggestions = allResources
      .filter(r => !r.featured && r.tags.includes(recentInterest))
      .slice(0, 2);
    setForYou(suggestions);
  }, []);

  const isDefaultView = selectedCategory === 'All' && searchQuery.trim() === '';
  const featured = allResources.filter(r => r.featured);
  const filtered = allResources.filter(r =>
    (selectedCategory === 'All' ||
      (selectedCategory === 'Guides' && r.category === 'Guidance') ||
      (selectedCategory === 'Stories' && r.category === 'Personal Stories') ||
      (selectedCategory === 'Videos' && r.category === 'Videos') ||
      (selectedCategory === 'Tools' && r.category === 'Tools') ||
      (selectedCategory === 'Books' && r.category === 'Books')) &&
    (r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
     r.excerpt.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-stone-50 pb-20 pt-6 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 mb-3">
            <BookOpen size={20} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-800 mb-2">
            Resources That Hold You
          </h1>
          <p className="text-stone-600 max-w-2xl mx-auto">
            Created by people who’ve walked through grief — so you never have to feel alone.
          </p>
        </div>

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
        <div className="flex flex-wrap justify-center gap-2 mb-8">
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

        {/* Smart Featured Section */}
        {isDefaultView ? (
          featured.length > 0 && (
            <section className="mb-10">
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
          )
        ) : (
          // Minimal banner when filtered
          featured.length > 0 && (
            <div className="text-center mb-6">
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                className="text-sm text-amber-600 hover:underline flex items-center justify-center gap-1"
              >
                ← Back to Featured Resources
              </button>
            </div>
          )
        )}

        {/* For You */}
        {isDefaultView && forYou.length > 0 && (
          <section className="mb-10">
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
          {filtered.filter(r => !r.featured || !isDefaultView).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-stone-600 mb-3">
                We couldn’t find anything for “{searchQuery}” — but someone in our community might have just what you need.
              </p>
              <Link
                href="/communities"
                className="text-amber-600 font-medium hover:underline"
              >
                Ask in a Community →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered
                .filter(r => !r.featured || !isDefaultView)
                .map(r => (
                  <ResourceCard key={r.id} {...r} />
                ))}
            </div>
          )}
        </section>

        {/* Footer CTA */}
        <footer className="mt-12 text-center text-stone-500 text-sm">
          <p>Created by grievers, for grievers.</p>
          <button
            onClick={() => alert('Navigate to submit form')}
            className="text-amber-600 hover:underline mt-1"
          >
            Submit your story or guide
          </button>
        </footer>
      </div>
    </div>
  );
}