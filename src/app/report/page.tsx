// app/report/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { CommentsSection } from '@/components/CommentsSection';
import { Heart } from 'lucide-react';

const TEST_POST_ID = 'test-post-123'; // Replace with real UUID in production

export default function TestCommentsPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    fullName: string;
    avatarUrl?: string;
    isAnonymous: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        // Fallback for testing without auth
        setCurrentUser({
          id: 'test-user-id',
          fullName: 'Test User',
      
          isAnonymous: false,
        });
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_anonymous')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setCurrentUser({
          id: profile.id,
          fullName: profile.full_name || 'Friend',
          avatarUrl: profile.avatar_url || undefined,
          isAnonymous: profile.is_anonymous || false,
        });
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading user...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' }}>
      {/* Placeholder Post */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '1rem',
        border: '1px solid #e7e5e4',
        padding: '1.5rem',
        marginBottom: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '9999px',
            backgroundColor: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: '#92400e', fontWeight: 500 }}>T</span>
          </div>
          <div>
            <h3 style={{ fontWeight: 500, color: '#1c1917' }}>Test User</h3>
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                backgroundColor: '#fffbeb',
                color: '#92400e',
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
              }}>
                <Heart size={10} style={{ color: '#d97706' }} />
                Loss of a Parent
              </span>
            </div>
          </div>
        </div>

        <p style={{ color: '#1c1917', lineHeight: 1.6, marginBottom: '1rem' }}>
          This is a test post to demonstrate the comments section. You can reply below!
        </p>

        {/* Placeholder Image */}
        <div style={{
          width: '100%',
          height: '200px',
          backgroundColor: '#f5f5f4',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#78716c',
          border: '1px dashed #d6d3d1',
        }}>
          🖼️ Placeholder Image
        </div>
      </div>

      {/* Comments Section */}
      {currentUser && (
        <CommentsSection
          parentId={TEST_POST_ID}
          parentType="post"
          currentUser={currentUser}
        />
      )}
    </div>
  );
}