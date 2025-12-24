// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClientAuth } from '@/hooks/useClientAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import Link from 'next/link';
import Button from '@/components/ui/button';
import { Settings, Send, ImageIcon, Users, MessageCircle } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading } = useClientAuth(); // ✅ property is `loading`, not `isLoading`
  const router = useRouter();
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchData = async () => {
      const supabase = getSupabaseBrowserClient();

      try {
        // Online count
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('last_seen', new Date(Date.now() - 5 * 60000).toISOString());
        
        if (countError) {
          console.error('Error fetching online count:', countError);
        } else {
          setOnlineCount(count ?? 0);
        }

        // Recent posts → ⚠️ your `posts` table has NO `title` field (see Tables and Buckets.docx)
        // Only: id, user_id, text, media_urls, grief_types, is_anonymous, likes_count, created_at
        const { data: posts, error: postsError } = await supabase // ✅ use `data`, not `posts`
          .from('posts')
          .select('id, text, created_at, grief_types') // ✅ no `title`!
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (postsError) {
          console.error('Posts fetch error:', postsError);
        } else {
          setRecentPosts(posts || []);
        }

        // Communities
        const { data: comms, error: commsError } = await supabase // ✅ use `data`, not `comms`
          .from('communities')
          .select('id, name, description, member_count, online_count')
          .order('member_count', { ascending: false })
          .limit(3);
        
        if (commsError) {
          console.error('Communities fetch error:', commsError);
        } else {
          setCommunities(comms || []);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        Loading your space...
      </div>
    );
  }

  if (!user) {
    router.push('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Welcome & Quick Connect */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center mx-auto animate-pulse">
              <MessageCircle className="h-12 w-12 text-amber-600" />
            </div>
            {onlineCount !== null && (
              <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                {onlineCount}
              </div>
            )}
          </div>

          <h1 className="text-2xl font-semibold text-stone-800">
            Your Healing Space
          </h1>

          <p className="text-stone-600 max-w-md mx-auto">
            {onlineCount !== null
              ? `${onlineCount} people are here now — ready to witness, not fix.`
              : 'You’re safe here. Someone always is.'}
          </p>

          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-5 rounded-full text-lg font-medium"
            onClick={() => router.push('/connect')}
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Talk Now
          </Button>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { href: '/connect', icon: MessageCircle, label: 'Connect' },
            { href: '/communities', icon: Users, label: 'Communities' },
            { href: '/resources', icon: ImageIcon, label: 'Stories' },
            { href: '/schedule', icon: Send, label: 'Events' },
            { href: '/profile', icon: Settings, label: 'Profile' },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="block">
              <div className="bg-white p-4 rounded-xl border border-stone-200 text-center hover:shadow transition">
                <item.icon className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                <span className="text-xs font-medium text-stone-700">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Stories */}
        {recentPosts.length > 0 && (
          <div className="bg-white rounded-xl p-5 border border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 mb-3">Recently Shared</h2>
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`} className="block">
                  <p className="text-stone-800 text-sm">
                    {post.text?.substring(0, 100)}...
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    About {post.grief_types?.[0]?.replace('_', ' ') || 'loss'}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Active Communities */}
        {communities.length > 0 && (
          <div className="bg-white rounded-xl p-5 border border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 mb-3">Active Communities</h2>
            <div className="space-y-3">
              {communities.map((c) => (
                <Link key={c.id} href={`/communities/${c.id}`} className="block">
                  <div className="flex justify-between">
                    <span className="font-medium text-stone-800">{c.name}</span>
                    <span className="text-xs text-green-600">{c.online_count} online</span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1">{c.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {loadingData && !recentPosts.length && (
          <div className="text-center py-6 text-stone-500">Loading your feed...</div>
        )}
      </div>
    </div>
  );
}