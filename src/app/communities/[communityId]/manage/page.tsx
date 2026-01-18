// src/app/communities/[communityId]/manage/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';
import {
  Settings,
  Users,
  Shield,
  Upload,
  Loader2,
  Crown,
  BadgeCheck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// --- Types ---
interface Community {
  id: string;
  name: string;
  description: string;
  grief_type: string;
  cover_photo_url?: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_anonymous: boolean;
}

interface Member {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'member' | 'moderator' | 'admin';
  joined_at: string;
  is_anonymous: boolean;
}

const griefTypeOptions = [
  { value: 'parent', label: 'Loss of a Parent' },
  { value: 'child', label: 'Loss of a Child' },
  { value: 'spouse', label: 'Loss of a Spouse/Partner' },
  { value: 'sibling', label: 'Loss of a Sibling' },
  { value: 'friend', label: 'Loss of a Friend' },
  { value: 'pet', label: 'Loss of a Pet' },
  { value: 'miscarriage', label: 'Miscarriage or Pregnancy Loss' },
  { value: 'caregiver', label: 'Loss After Caregiving' },
  { value: 'suicide', label: 'Suicide Loss' },
  { value: 'other', label: 'Other' },
];

export default function CommunityManagePage() {
  const params = useParams();
  const communityId = params.communityId as string;
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Helper: get fallback banner URL
  const getBannerUrl = (id: string) => {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/communities/${id}/banner.jpg?t=${Date.now()}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !communityId) return;

      try {
        setLoading(true);

        // Check admin status
        const { data: adminCheck, error: adminErr } = await supabase
          .from('community_members')
          .select('role')
          .eq('community_id', communityId)
          .eq('user_id', user.id)
          .single();

        const isAdminUser = !adminErr && adminCheck?.role === 'admin';
        setIsAdmin(isAdminUser);

        if (!isAdminUser) {
          toast.error('You must be an admin to manage this community.');
          router.push(`/communities/${communityId}`);
          return;
        }

        // Fetch community
        const { data: commData, error: commErr } = await supabase
          .from('communities')
          .select('id, name, description, grief_type, cover_photo_url')
          .eq('id', communityId)
          .single();

        if (commErr) throw commErr;

        let coverPhotoUrl = commData.cover_photo_url;
        if (!coverPhotoUrl) {
          coverPhotoUrl = getBannerUrl(communityId);
        }

        setCommunity({ ...commData, cover_photo_url: coverPhotoUrl });

        // Fetch members
        const { data: membersData, error: memErr } = await supabase
          .from('community_members')
          .select(`
            user_id,
            role,
            joined_at,
            user:profiles!left(id, full_name, avatar_url, is_anonymous)
          `)
          .eq('community_id', communityId)
          .order('joined_at', { ascending: true });

        if (memErr) throw memErr;

        const formatted: Member[] = membersData.map((m) => {
          const profile = Array.isArray(m.user) ? m.user[0] : m.user;
          return {
            user_id: m.user_id,
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            is_anonymous: profile?.is_anonymous ?? false,
            role: m.role,
            joined_at: m.joined_at,
          };
        });

        setMembers(formatted);
      } catch (err) {
        console.error('Fetch error:', err);
        toast.error('Failed to load management page.');
        router.push(`/communities/${communityId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [communityId, user, supabase, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community || !isAdmin) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('communities')
        .update({
          name: community.name.trim(),
          description: community.description.trim(),
          grief_type: community.grief_type,
        })
        .eq('id', communityId);

      if (error) throw error;
      toast.success('Community settings updated!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const uploadBanner = async () => {
    if (!bannerFile || !communityId || !isAdmin) return;
    setBannerUploading(true);
    try {
      const ext = bannerFile.name.split('.').pop() || 'jpg';
      const path = `${communityId}/banner.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('communities')
        .upload(path, bannerFile, { upsert: true });

      if (uploadErr) throw uploadErr;

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/communities/${path}?t=${Date.now()}`;

      const { error: updateErr } = await supabase
        .from('communities')
        .update({ cover_photo_url: publicUrl })
        .eq('id', communityId);

      if (updateErr) throw updateErr;

      setCommunity((prev) => (prev ? { ...prev, cover_photo_url: publicUrl } : null));
      setBannerFile(null);
      setBannerPreview(null);
      toast.success('Banner updated!');
    } catch (err) {
      console.error('Banner upload failed:', err);
      toast.error('Failed to update banner.');
    } finally {
      setBannerUploading(false);
    }
  };

  const updateMemberRole = async (userId: string, newRole: 'member' | 'moderator' | 'admin') => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to set this user's role to ${newRole}?`)) return;

    try {
      const { error } = await supabase
        .from('community_members')
        .update({ role: newRole })
        .eq('community_id', communityId)
        .eq('user_id', userId);

      if (error) throw error;

      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m))
      );
      toast.success('Role updated.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update role.');
    }
  };

  const removeMember = async (userId: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Remove this member from the community?')) return;

    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', userId);

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast.success('Member removed.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove member.');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#cbd5e1' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        Loading management panel...
      </div>
    );
  }

  if (!community) return null;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: '#f1f9ff' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Settings size={24} /> Manage Community
      </h1>

      {/* Banner */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Banner</h2>
        <div
          style={{
            width: '100%',
            height: '150px',
            borderRadius: '0.5rem',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid #334155',
            marginBottom: '0.75rem',
          }}
        >
          {bannerPreview ? (
            <Image
              src={bannerPreview}
              alt="Preview"
              fill
              style={{ objectFit: 'cover' }}
            />
          ) : community.cover_photo_url ? (
            <Image
              src={community.cover_photo_url}
              alt="Current banner"
              fill
              style={{ objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = getBannerUrl(communityId);
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              No banner set
            </div>
          )}
        </div>
        {isAdmin && (
          <>
            <input type="file" accept="image/*" onChange={handleBannerChange} style={{ marginBottom: '0.5rem' }} />
            <button
              onClick={uploadBanner}
              disabled={!bannerFile || bannerUploading}
              style={{
                padding: '0.5rem 1rem',
                background: '#334155',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {bannerUploading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
              {bannerUploading ? 'Uploading...' : 'Update Banner'}
            </button>
          </>
        )}
      </div>

      {/* Community Info Form */}
      {isAdmin && (
        <form onSubmit={handleSave} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Community Info</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>Name</label>
              <input
                type="text"
                value={community.name}
                onChange={(e) => setCommunity({ ...community, name: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: 'white',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>Description</label>
              <textarea
                value={community.description}
                onChange={(e) => setCommunity({ ...community, description: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: 'white',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>Grief Type</label>
              <select
                value={community.grief_type}
                onChange={(e) => setCommunity({ ...community, grief_type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: 'white',
                }}
              >
                {griefTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.5rem 1rem',
                background: saving ? '#334155' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                width: 'fit-content',
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Members */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} /> Members ({members.length})
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {members.map((member) => {
            const displayName = member.is_anonymous && user?.id !== member.user_id
              ? 'Anonymous'
              : member.full_name || 'Anonymous';

            return (
              <div
                key={member.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: '#1e293b',
                  borderRadius: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {member.avatar_url ? (
                    <Image
                      src={member.avatar_url}
                      alt={displayName}
                      width={36}
                      height={36}
                      style={{ borderRadius: '9999px' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '9999px',
                        background: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8',
                      }}
                    >
                      {displayName[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600 }}>{displayName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {member.role === 'admin' && <Crown size={16} color="#fbbf24" />}
                  {member.role === 'moderator' && <Shield size={16} color="#38bdf8" />}
                  {member.role === 'member' && <BadgeCheck size={16} color="#6ee7b7" />}
                  {isAdmin && member.user_id !== user?.id && (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => {
                          const role = e.target.value as 'member' | 'moderator' | 'admin';
                          updateMemberRole(member.user_id, role);
                        }}
                        style={{
                          padding: '0.25rem',
                          background: '#334155',
                          color: 'white',
                          border: '1px solid #4b5563',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                        }}
                      >
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => removeMember(member.user_id)}
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.25rem',
                          padding: '0.25rem',
                          cursor: 'pointer',
                        }}
                        aria-label="Remove member"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reports Link */}
      {isAdmin && (
        <div style={{ marginTop: '2rem' }}>
          <Link
            href={`/reports?community=${communityId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#60a5fa',
              textDecoration: 'none',
            }}
          >
            <Shield size={16} /> View community reports
          </Link>
        </div>
      )}
    </div>
  );
}