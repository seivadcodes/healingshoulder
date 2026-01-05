// src/app/submit-resource/page.tsx
'use client';

import { useState,  } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

const CATEGORIES: Record<string, string> = {
  Story: 'Personal Stories',
  Guide: 'Guidance',
  Tool: 'Tools',
  Video: 'Videos',
  Book: 'Books',
};

const TAG_SUGGESTIONS = [
  'spouse', 'parent', 'child', 'sibling', 'friend', 'pet',
  'sudden loss', 'illness', 'suicide', 'overdose', 'estrangement',
  'holidays', 'guilt', 'anger', 'memory', 'ritual', 'hope'
];

export default function SubmitResourcePage() {
  const supabase = createClient(); // ✅ Only declared once

 type ResourceType = 'Story' | 'Guide' | 'Tool' | 'Video' | 'Book';

const [formData, setFormData] = useState({
  title: '',
  excerpt: '',
  type: 'Story' as ResourceType,
  tags: [] as string[],
  contentWarnings: [] as string[],
  communitySource: '',
  bookAuthor: '',
  bookQuote: '',
  externalUrl: '',
});

  const [newTag, setNewTag] = useState('');
  const [newWarning, setNewWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleTagAdd = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim()) && formData.tags.length < 5) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleWarningAdd = () => {
    if (newWarning.trim() && !formData.contentWarnings.includes(newWarning.trim())) {
      setFormData({ ...formData, contentWarnings: [...formData.contentWarnings, newWarning.trim()] });
      setNewWarning('');
    }
  };

  const handleTagRemove = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const handleWarningRemove = (warning: string) => {
    setFormData({ ...formData, contentWarnings: formData.contentWarnings.filter(w => w !== warning) });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!formData.title.trim() || formData.title.length < 5) {
      return 'Title is required (min 5 characters).';
    }
    if (!formData.excerpt.trim() || formData.excerpt.length < 20) {
      return 'Please share a meaningful reflection (min 20 characters).';
    }
    if (formData.tags.length === 0) {
      return 'Please add at least one tag.';
    }
    if (formData.type === 'Book') {
      if (!formData.bookAuthor.trim()) return 'Book author is required.';
      if (!formData.bookQuote.trim() || formData.bookQuote.length > 150) {
        return 'Book quote is required and should be under 150 characters.';
      }
      try {
        new URL(formData.externalUrl);
      } catch {
        return 'Please provide a valid link (e.g., Amazon, Bookshop).';
      }
    } else if (formData.externalUrl) {
      try {
        new URL(formData.externalUrl);
      } catch {
        return 'Please provide a valid URL.';
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      setErrorMessage(error);
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    // ✅ Fixed destructuring
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage('You must be signed in to submit.');
      setSubmitStatus('error');
      setIsSubmitting(false);
      return;
    }

    const { error: supabaseError } = await supabase
      .from('resources')
      .insert({
        user_id: user.id,
        title: formData.title.trim(),
        excerpt: formData.excerpt.trim(),
        type: formData.type,
        category: CATEGORIES[formData.type],
        tags: formData.tags,
        content_warnings: formData.contentWarnings,
        community_source: formData.communitySource || null,
        book_author: formData.type === 'Book' ? formData.bookAuthor.trim() : null,
        book_quote: formData.type === 'Book' ? formData.bookQuote.trim() : null,
        external_url: formData.externalUrl || null,
        status: 'pending',
        is_curated: false,
      });

    if (supabaseError) {
      console.error('Submission error:', supabaseError);
      setErrorMessage('Failed to submit. Please try again.');
      setSubmitStatus('error');
    } else {
      setSubmitStatus('success');
    }
    setIsSubmitting(false);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', padding: '1.5rem 1rem' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1c1917' }}>
            Share a Resource
          </h1>
          <p style={{ color: '#44403c' }}>
            Your experience can be a lifeline for someone else.
          </p>
        </div>

        {submitStatus === 'success' ? (
          <div style={{ backgroundColor: '#fff8e1', padding: '1.25rem', borderRadius: '0.75rem', textAlign: 'center' }}>
            <p style={{ color: '#92400e', fontWeight: '600' }}>
              Thank you. Your resource has been submitted for review.
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b6864', marginTop: '0.25rem' }}>
              Approved resources appear on the <Link href="/resources" style={{ color: '#d97706' }}>Resources</Link> page.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {submitStatus === 'error' && (
              <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                {errorMessage}
              </div>
            )}

            {/* Type */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                Resource Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                }}
              >
                <option value="Story">Personal Story</option>
                <option value="Guide">Guide / Advice</option>
                <option value="Tool">Tool / Template</option>
                <option value="Video">Video</option>
                <option value="Book">Book Recommendation</option>
              </select>
            </div>

            {/* Title */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                Title
              </label>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder={formData.type === 'Book' ? "Book title" : "A meaningful title"}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                }}
              />
            </div>

            {/* Excerpt */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                {formData.type === 'Book' ? 'Why this book helped you' : 'Your reflection or summary'}
              </label>
              <textarea
                name="excerpt"
                value={formData.excerpt}
                onChange={handleChange}
                rows={3}
                placeholder={formData.type === 'Book' 
                  ? "e.g., 'This book made me feel seen in my anger...'" 
                  : "Share what this resource offers or your experience"}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Book fields */}
            {formData.type === 'Book' && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                    Author
                  </label>
                  <input
                    name="bookAuthor"
                    value={formData.bookAuthor}
                    onChange={handleChange}
                    placeholder="e.g., Megan Devine"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                    Short Quote (max 150 chars)
                  </label>
                  <input
                    name="bookQuote"
                    value={formData.bookQuote}
                    onChange={handleChange}
                    placeholder="e.g., 'Grief is love with nowhere to go.'"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                    Link to Book
                  </label>
                  <input
                    name="externalUrl"
                    value={formData.externalUrl}
                    onChange={handleChange}
                    placeholder="https://bookshop.org/..."
                    type="url"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                    }}
                  />
                </div>
              </>
            )}

            {/* Non-book URL */}
            {formData.type !== 'Book' && formData.externalUrl && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                  Link (optional)
                </label>
                <input
                  name="externalUrl"
                  value={formData.externalUrl}
                  onChange={handleChange}
                  placeholder="e.g., YouTube, PDF, tool website"
                  type="url"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                  }}
                />
              </div>
            )}

            {/* Community Source */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                Shared in community (optional)
              </label>
              <input
                name="communitySource"
                value={formData.communitySource}
                onChange={handleChange}
                placeholder="e.g., Loss of a Parent"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                }}
              />
            </div>

            {/* Tags */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                Tags (up to 5)
              </label>
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleTagAdd())}
                  placeholder="Add a tag"
                  style={{
                    flex: 1,
                    padding: '0.25rem 0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  type="button"
                  onClick={handleTagAdd}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#e5e5e4',
                    border: 'none',
                    borderRadius: '9999px',
                    fontWeight: '500',
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                      style={{ background: 'none', border: 'none', color: '#92400e', fontSize: '1rem' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                Suggestions: {TAG_SUGGESTIONS.slice(0, 8).join(', ')}
              </div>
            </div>

            {/* Content Warnings */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>
                Content Warnings (optional)
              </label>
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
                <input
                  value={newWarning}
                  onChange={(e) => setNewWarning(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleWarningAdd())}
                  placeholder="e.g., suicide, child loss"
                  style={{
                    flex: 1,
                    padding: '0.25rem 0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  type="button"
                  onClick={handleWarningAdd}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#e5e5e4',
                    border: 'none',
                    borderRadius: '9999px',
                    fontWeight: '500',
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                {formData.contentWarnings.map(warning => (
                  <span
                    key={warning}
                    style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: '#f3e8ff',
                      color: '#7e22ce',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {warning}
                    <button
                      type="button"
                      onClick={() => handleWarningRemove(warning)}
                      style={{ background: 'none', border: 'none', color: '#7e22ce', fontSize: '1rem' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: isSubmitting ? '#d1d5db' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
          <p>All submissions are reviewed before appearing publicly.</p>
        </div>
      </div>
    </div>
  );
}