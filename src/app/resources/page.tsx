// src/app/resources/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Tag, AlertTriangle, ExternalLink, Search, Filter } from 'lucide-react';

function getYouTubeEmbedUrl(url: string): string | null {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[2].length === 11 ? match[2] : null;
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

type ResourceType = 'Story' | 'Guide' | 'Tool' | 'Video' | 'Book';

interface Resource {
  id: string;
  title: string;
  excerpt: string;
  type: ResourceType;
  category: string;
  tags: string[];
  content_warnings: string[];
  community_source: string | null;
  book_author: string | null;
  book_quote: string | null;
  external_url: string | null;
  created_at: string;
  book_cover_url: string | null;
  user_id: string;
  video_url: string | null;
  video_type: 'link' | 'upload';
}

const CATEGORIES: Record<ResourceType, string> = {
  Story: 'Personal Stories',
  Guide: 'Guidance',
  Tool: 'Tools',
  Video: 'Videos',
  Book: 'Books',
};

// Define filter options
const ALL_TYPES = 'All';
type FilterType = ResourceType | 'All';

export default function ResourcesPage() {
  const supabase = createClient();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, 'helpful' | 'unhelpful'>>({});
  const [resourceCounts, setResourceCounts] = useState<Record<string, { helpful: number; unhelpful: number }>>({});
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<FilterType>(ALL_TYPES);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Get all unique tags from resources
  
 

  // Filter resources based on search, type, and tag
  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      // Filter by type
      if (selectedType !== ALL_TYPES && resource.type !== selectedType) {
        return false;
      }
      
      // Filter by tag
      if (selectedTag && !resource.tags.includes(selectedTag)) {
        return false;
      }
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          resource.title.toLowerCase().includes(query) ||
          resource.excerpt.toLowerCase().includes(query) ||
          resource.tags.some(tag => tag.toLowerCase().includes(query)) ||
          (resource.book_author && resource.book_author.toLowerCase().includes(query)) ||
          (resource.community_source && resource.community_source.toLowerCase().includes(query))
        );
      }
      
      return true;
    });
  }, [resources, searchQuery, selectedType, selectedTag]);

  useEffect(() => {
    const fetchResourcesAndVotes = async () => {
      try {
        // Fetch approved resources
        const { data: resourcesData, error: resourcesError } = await supabase
          .from('resources')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (resourcesError) {
          console.error('Error fetching resources:', resourcesError);
          setError('Failed to load resources.');
          setLoading(false);
          return;
        }

        setResources(resourcesData as Resource[]);

        // Get resource IDs for batch queries
        const resourceIds = resourcesData.map((r: Resource) => r.id);

        // Fetch all votes for these resources to calculate counts
        const { data: allVotes, error: votesError } = await supabase
          .from('resource_votes')
          .select('resource_id, vote_type')
          .in('resource_id', resourceIds);

        if (votesError) {
          console.error('Error fetching votes:', votesError);
        } else {
          // Calculate counts from votes
          const counts: Record<string, { helpful: number; unhelpful: number }> = {};
          
          // Initialize all counts to 0
          resourcesData.forEach((r: Resource) => {
            counts[r.id] = { helpful: 0, unhelpful: 0 };
          });

          // Count votes
          allVotes?.forEach(vote => {
            if (counts[vote.resource_id]) {
              if (vote.vote_type === 'helpful') {
                counts[vote.resource_id].helpful += 1;
              } else if (vote.vote_type === 'unhelpful') {
                counts[vote.resource_id].unhelpful += 1;
              }
            }
          });

          setResourceCounts(counts);
        }

        // Fetch current user's votes if logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (user && resourceIds.length > 0) {
          const { data: userVotesData, error: userVotesError } = await supabase
            .from('resource_votes')
            .select('resource_id, vote_type')
            .in('resource_id', resourceIds)
            .eq('user_id', user.id);

          if (!userVotesError && userVotesData) {
            const voteMap: Record<string, 'helpful' | 'unhelpful'> = {};
            userVotesData.forEach(v => {
              voteMap[v.resource_id] = v.vote_type as 'helpful' | 'unhelpful';
            });
            setUserVotes(voteMap);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error in fetchResourcesAndVotes:', err);
        setError('Failed to load resources.');
        setLoading(false);
      }
    };

    fetchResourcesAndVotes();
  }, [supabase]);

  const handleVote = async (resourceId: string, newVoteType: 'helpful' | 'unhelpful') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please log in to vote.');
      return;
    }

    const currentVote = userVotes[resourceId];
    const currentCount = resourceCounts[resourceId] || { 
      helpful: 0, 
      unhelpful: 0 
    };

    // Optimistic UI update
    const newCounts = { ...currentCount };
    const newUserVotes = { ...userVotes };

    if (currentVote === newVoteType) {
      // Toggle OFF
      if (newVoteType === 'helpful') {
        newCounts.helpful = Math.max(0, newCounts.helpful - 1);
      } else {
        newCounts.unhelpful = Math.max(0, newCounts.unhelpful - 1);
      }
      delete newUserVotes[resourceId];
    } else {
      // Remove old vote if exists
      if (currentVote === 'helpful') {
        newCounts.helpful = Math.max(0, newCounts.helpful - 1);
      } else if (currentVote === 'unhelpful') {
        newCounts.unhelpful = Math.max(0, newCounts.unhelpful - 1);
      }
      // Add new vote
      if (newVoteType === 'helpful') {
        newCounts.helpful += 1;
      } else {
        newCounts.unhelpful += 1;
      }
      newUserVotes[resourceId] = newVoteType;
    }

    // Apply optimistic updates
    setResourceCounts(prev => ({ ...prev, [resourceId]: newCounts }));
    setUserVotes(newUserVotes);

    try {
      if (currentVote === newVoteType) {
        // Remove vote
        await supabase
          .from('resource_votes')
          .delete()
          .eq('resource_id', resourceId)
          .eq('user_id', user.id);
      } else {
        // Upsert vote
        await supabase
          .from('resource_votes')
          .upsert({
            resource_id: resourceId,
            user_id: user.id,
            vote_type: newVoteType,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'resource_id,user_id'
          });
      }

      // Verify the update by fetching fresh counts for this resource
      const { data: freshVotes, error: fetchError } = await supabase
        .from('resource_votes')
        .select('vote_type')
        .eq('resource_id', resourceId);

      if (!fetchError && freshVotes) {
        const freshCounts = { helpful: 0, unhelpful: 0 };
        freshVotes.forEach(vote => {
          if (vote.vote_type === 'helpful') {
            freshCounts.helpful += 1;
          } else if (vote.vote_type === 'unhelpful') {
            freshCounts.unhelpful += 1;
          }
        });

        // Update with fresh counts from database
        setResourceCounts(prev => ({
          ...prev,
          [resourceId]: freshCounts
        }));
      } else {
        console.error('Failed to fetch fresh votes:', fetchError);
        // Revert on error
        setResourceCounts(prev => ({ ...prev, [resourceId]: currentCount }));
        setUserVotes(prev => {
          const reverted = { ...prev };
          if (currentVote) {
            reverted[resourceId] = currentVote;
          } else {
            delete reverted[resourceId];
          }
          return reverted;
        });
        alert('Failed to save your vote. Please try again.');
      }
    } catch (err) {
      console.error('Vote sync failed:', err);
      // Revert optimistic update on error
      setResourceCounts(prev => ({ ...prev, [resourceId]: currentCount }));
      setUserVotes(prev => {
        const reverted = { ...prev };
        if (currentVote) {
          reverted[resourceId] = currentVote;
        } else {
          delete reverted[resourceId];
        }
        return reverted;
      });
      alert('Failed to save your vote. Please try again.');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType(ALL_TYPES);
    setSelectedTag(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', padding: '1.5rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: '#44403c' }}>Loading resources...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', padding: '1.5rem 1rem' }}>
        <div style={{ maxWidth: '768px', margin: '0 auto', backgroundColor: '#fee2e2', padding: '1rem', borderRadius: '0.5rem' }}>
          <p style={{ color: '#b91c1c' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', padding: '1.5rem 1rem' }}>
      <div style={{ maxWidth: '768px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '9999px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
            }}
          >
            <BookOpen size={18} />
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1c1917' }}>
            Grief Resources
          </h1>
          <p style={{ color: '#44403c', marginTop: '0.5rem' }}>
            Shared wisdom and tools from people who understand grief
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <Search 
              size={20} 
              style={{ 
                position: 'absolute', 
                left: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#9ca3af' 
              }} 
            />
            <input
              type="text"
              placeholder="Search resources by title, tags, author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem 0.625rem 2.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                fontSize: '0.875rem',
                color: '#374151',
                outline: 'none',
                transition: 'all 150ms ease-in-out',
              }}
            />
          </div>
        </div>

        {/* Category Filters */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Filter size={16} style={{ color: '#92400e' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e' }}>Filter by Type</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setSelectedType(ALL_TYPES)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '9999px',
                border: selectedType === ALL_TYPES ? '2px solid #f59e0b' : '1px solid #d1d5db',
                backgroundColor: selectedType === ALL_TYPES ? '#fef3c7' : 'white',
                color: selectedType === ALL_TYPES ? '#92400e' : '#4b5563',
                fontSize: '0.875rem',
                fontWeight: selectedType === ALL_TYPES ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 150ms ease-in-out',
              }}
            >
              All Resources ({resources.length})
            </button>
            {Object.entries(CATEGORIES).map(([type, label]) => {
              const count = resources.filter(r => r.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type as ResourceType)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: '9999px',
                    border: selectedType === type ? '2px solid #f59e0b' : '1px solid #d1d5db',
                    backgroundColor: selectedType === type ? '#fef3c7' : 'white',
                    color: selectedType === type ? '#92400e' : '#4b5563',
                    fontSize: '0.875rem',
                    fontWeight: selectedType === type ? '600' : '400',
                    cursor: 'pointer',
                    transition: 'all 150ms ease-in-out',
                  }}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {/* Active Filters & Clear Button */}
          {(searchQuery || selectedType !== ALL_TYPES || selectedTag) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Showing {filteredResources.length} of {resources.length} resources
                  {searchQuery && ` for "${searchQuery}"`}
                  {selectedType !== ALL_TYPES && ` in ${CATEGORIES[selectedType as ResourceType]}`}
                  {selectedTag && ` tagged "${selectedTag}"`}
                </span>
              </div>
              <button
                onClick={clearFilters}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 150ms ease-in-out',
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {filteredResources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>
              No resources found{searchQuery ? ` for "${searchQuery}"` : ''}.
            </p>
            {(searchQuery || selectedType !== ALL_TYPES || selectedTag) && (
              <button
                onClick={clearFilters}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 150ms ease-in-out',
                }}
              >
                Clear filters to show all resources
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {filteredResources.map((resource) => {
              const currentVote = userVotes[resource.id];
              const counts = resourceCounts[resource.id] || {
                helpful: 0,
                unhelpful: 0,
              };

              return (
                <div
                  key={resource.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    borderLeft: '4px solid #f59e0b',
                  }}
                >
                  <div style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                      }}
                    >
                      {CATEGORIES[resource.type]}
                    </span>
                  </div>

                  <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1c1917', marginBottom: '0.5rem' }}>
                    {resource.title}
                  </h2>

                  {resource.type === 'Book' && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      {resource.book_cover_url && (
                        <div
                          style={{
                            width: '200px',
                            height: '260px',
                            marginBottom: '0.75rem',
                            overflow: 'hidden',
                            borderRadius: '0.25rem',
                            border: '1px solid #e5e7eb',
                            position: 'relative',
                          }}
                        >
                          <Image
                            src={resource.book_cover_url}
                            alt={`Cover for ${resource.title}`}
                            fill
                            style={{ objectFit: 'cover' }}
                            quality={80}
                          />
                        </div>
                      )}
                      {resource.book_author && (
                        <p style={{ color: '#6b7280', fontStyle: 'italic', marginBottom: '0.25rem' }}>
                          by {resource.book_author}
                        </p>
                      )}
                      {resource.book_quote && (
                        <p style={{ color: '#374151', fontStyle: 'normal', margin: 0 }}>
                          {`"${resource.book_quote}"`}
                        </p>
                      )}
                    </div>
                  )}

                  {resource.type !== 'Book' && resource.excerpt && (
                    <p style={{ color: '#374151', marginBottom: '1rem' }}>
                      {resource.excerpt}
                    </p>
                  )}

                  {resource.community_source && (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                      Shared in: <strong>{resource.community_source}</strong>
                    </p>
                  )}

                  {resource.tags.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                        <Tag size={14} style={{ color: '#92400e' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e' }}>Tags</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {resource.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              padding: '0.125rem 0.5rem',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {resource.content_warnings.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                        <AlertTriangle size={14} style={{ color: '#7e22ce' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#7e22ce' }}>Content Warnings</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {resource.content_warnings.map((warning) => (
                          <span
                            key={warning}
                            style={{
                              padding: '0.125rem 0.5rem',
                              backgroundColor: '#f3e8ff',
                              color: '#7e22ce',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                            }}
                          >
                            {warning}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {resource.type === 'Video' && (
                    <div style={{ marginBottom: '1rem' }}>
                      {resource.video_type === 'upload' && resource.video_url ? (
                        <video
                          src={resource.video_url}
                          controls
                          style={{
                            width: '100%',
                            borderRadius: '0.25rem',
                            border: '1px solid #e5e7eb',
                          }}
                        />
                      ) : resource.video_type === 'link' && resource.external_url ? (
                        getYouTubeEmbedUrl(resource.external_url) ? (
                          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '0.25rem' }}>
                            <iframe
                              src={getYouTubeEmbedUrl(resource.external_url)!}
                              title={resource.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                border: 'none',
                              }}
                            />
                          </div>
                        ) : (
                          <Link
                            href={resource.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              color: '#d97706',
                              fontWeight: '600',
                              textDecoration: 'none',
                            }}
                          >
                            Watch Video <ExternalLink size={14} />
                          </Link>
                        )
                      ) : (
                        <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                          No playable video content available.
                        </p>
                      )}
                    </div>
                  )}

                  {resource.external_url && resource.type !== 'Video' && (
                    <div style={{ marginTop: '1rem' }}>
                      <Link
                        href={resource.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: '#d97706',
                          fontWeight: '600',
                          textDecoration: 'none',
                        }}
                      >
                        View Resource <ExternalLink size={14} />
                      </Link>
                    </div>
                  )}

                  {/* Voting Controls with live count */}
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleVote(resource.id, 'helpful')}
                      style={{
                        background: 'none',
                        border: '1px solid #d1d5db',
                        borderRadius: '9999px',
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.875rem',
                        color: currentVote === 'helpful' ? '#16a34a' : '#4b5563',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontWeight: currentVote === 'helpful' ? 'bold' : 'normal',
                      }}
                    >
                      👍 Helpful ({counts.helpful})
                    </button>
                    <button
                      onClick={() => handleVote(resource.id, 'unhelpful')}
                      style={{
                        background: 'none',
                        border: '1px solid #d1d5db',
                        borderRadius: '9999px',
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.875rem',
                        color: currentVote === 'unhelpful' ? '#dc2626' : '#4b5563',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontWeight: currentVote === 'unhelpful' ? 'bold' : 'normal',
                      }}
                    >
                      👎 Not Helpful ({counts.unhelpful})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link
            href="/submit-resource"
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              backgroundColor: '#f59e0b',
              color: 'white',
              borderRadius: '0.5rem',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            Share Your Own Resource
          </Link>
        </div>
      </div>
    </div>
  );
}