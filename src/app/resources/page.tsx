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

const categories = ["All", "Guides", "Stories", "Videos", "Tools", "Books"];

export default function ResourcesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [forYou, setForYou] = useState<typeof allResources>([]);

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

  // Common styles
  const buttonBase = {
    padding: '0.5rem 1.25rem',
    fontSize: '0.875rem',
    borderRadius: '9999px',
    cursor: 'pointer',
    border: 'none',
    fontWeight: '500' as const,
  };

  const amberButton = {
    ...buttonBase,
    backgroundColor: '#f59e0b',
    color: 'white',
  };

  const stoneButton = {
    ...buttonBase,
    backgroundColor: '#e5e5e4',
    color: '#44403c',
  };

  const linkStyle = {
    color: '#d97706',
    fontWeight: '500' as const,
    textDecoration: 'underline',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', paddingTop: '1.5rem', paddingBottom: '5rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
      <div style={{ maxWidth: '896px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '9999px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
            }}
          >
            <BookOpen size={20} />
          </div>
          <h1 style={{ fontSize: '1.875rem', fontFamily: 'serif', fontWeight: '700', color: '#1c1917', marginBottom: '0.5rem' }}>
            Resources That Hold You
          </h1>
          <p style={{ color: '#44403c', maxWidth: '42rem', margin: '0 auto' }}>
            Created by people who’ve walked through grief — so you never have to feel alone.
          </p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '2rem', maxWidth: '32rem', margin: '0 auto' }}>
          <input
            type="text"
            placeholder="Search for comfort, tools, or stories…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid #e5e5e5',
              backgroundColor: 'white',
              fontSize: '1rem',
              outline: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#f59e0b')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e5e5')}
          />
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={
  selectedCategory === cat ? amberButton : stoneButton
}
              onMouseEnter={(e) => {
                if (selectedCategory !== cat) {
                  e.currentTarget.style.backgroundColor = '#d6d3d1';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCategory !== cat) {
                  e.currentTarget.style.backgroundColor = '#e5e5e4';
                }
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Smart Featured Section */}
        {isDefaultView ? (
          featured.length > 0 && (
            <section style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1c1917', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '2rem', height: '2px', backgroundColor: '#f59e0b', marginRight: '0.75rem' }}></span>
                Featured for You
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', maxWidth: '100%' }}>
                {featured.map((r) => (
                  <ResourceCard key={r.id} {...r} />
                ))}
              </div>
            </section>
          )
        ) : (
          featured.length > 0 && (
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                style={{
                  ...linkStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                  fontSize: '0.875rem',
                }}
              >
                ← Back to Featured Resources
              </button>
            </div>
          )
        )}

        {/* For You */}
        {isDefaultView && forYou.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1rem', color: '#44403c', marginBottom: '0.75rem' }}>
              Because you’ve been thinking about loss of a parent…
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {forYou.map((r) => (
                <ResourceCard key={`fy-${r.id}`} {...r} />
              ))}
            </div>
          </section>
        )}

        {/* All Resources */}
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: '500', color: '#44403c', marginBottom: '1rem' }}>
            {selectedCategory === 'All' ? 'All Resources' : selectedCategory}
          </h2>
          {filtered.filter(r => !r.featured || !isDefaultView).length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: '2rem', paddingBottom: '2rem' }}>
              <p style={{ color: '#44403c', marginBottom: '0.75rem' }}>
                We couldn’t find anything for “{searchQuery}” — but someone in our community might have just what you need.
              </p>
              <Link href="/communities">
                <span style={linkStyle}>Ask in a Community →</span>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filtered
                .filter(r => !r.featured || !isDefaultView)
                .map((r) => (
                  <ResourceCard key={r.id} {...r} />
                ))}
            </div>
          )}
        </section>

        {/* Footer CTA */}
        <footer style={{ marginTop: '3rem', textAlign: 'center', color: '#78716c', fontSize: '0.875rem' }}>
          <p>Created by grievers, for grievers.</p>
          <button
            onClick={() => alert('Navigate to submit form')}
            style={{
              ...linkStyle,
              marginTop: '0.25rem',
            }}
          >
            Submit your story or guide
          </button>
        </footer>
      </div>
    </div>
  );
}