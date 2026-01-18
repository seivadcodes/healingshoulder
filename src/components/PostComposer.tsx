// src/components/PostComposer.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, X, Send } from 'lucide-react';
import Image from 'next/image';

interface PostComposerProps {
  onSubmit: (text: string, mediaFiles: File[]) => Promise<void>;
  isSubmitting?: boolean;
  placeholder?: string;
  avatarUrl?: string | null;
  displayName?: string;
  maxFiles?: number;
}

export function PostComposer({
  onSubmit,
  isSubmitting = false,
  placeholder = "What's on your mind?",
  avatarUrl,
  displayName = 'You',
  maxFiles = 4,
}: PostComposerProps) {
  const [text, setText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      mediaPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [mediaPreviews]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).slice(0, maxFiles - mediaFiles.length);
    setMediaFiles(prev => [...prev, ...validFiles]);
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setMediaPreviews(prev => [...prev, ...newPreviews]);
    setIsExpanded(true);
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (!text.trim() && mediaFiles.length === 0) return;
    await onSubmit(text.trim(), mediaFiles);
    setText('');
    setMediaFiles([]);
    setMediaPreviews([]);
    setIsExpanded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasContent = text.trim().length > 0 || mediaFiles.length > 0;

  // 🟢 COMPACT STATE: with blinking cursor + send icon
  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        style={{
          backgroundColor: '#fff',
          borderRadius: '1rem',
          border: '1px solid #e7e5e4',
          padding: '0.75rem 1rem',
          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
          cursor: 'text',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        {/* Avatar */}
        <div style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '9999px',
          backgroundColor: avatarUrl ? 'transparent' : '#fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={32}
              height={32}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: '#92400e', fontWeight: 500, fontSize: '0.875rem' }}>
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Placeholder + blinking cursor */}
        <div style={{
          color: '#a8a29e',
          fontSize: '0.875rem',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
        }}>
          {placeholder}
          <span
            style={{
              marginLeft: '4px',
              width: '1px',
              height: '1em',
              backgroundColor: '#a8a29e',
              animation: 'blink 1s step-end infinite',
              display: 'inline-block',
              verticalAlign: 'middle',
            }}
          />
        </div>

        {/* Tiny Send icon on the far right */}
        <Send size={16} color="#a8a29e" style={{ flexShrink: 0 }} />

        <style jsx>{`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // 🔵 EXPANDED STATE
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '1rem',
      border: '1px solid #e7e5e4',
      padding: '1rem',
      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {/* Avatar */}
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '9999px',
          backgroundColor: avatarUrl ? 'transparent' : '#fef3c7',
          border: avatarUrl ? 'none' : '1px solid #fde68a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={40}
              height={40}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: '#92400e', fontWeight: 500, fontSize: '0.875rem' }}>
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Text + Media */}
        <div style={{ flex: 1 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            autoFocus
            style={{
              width: '100%',
              padding: '0.5rem',
              color: '#1c1917',
              backgroundColor: 'transparent',
              border: '1px solid #e7e5e4',
              borderRadius: '0.5rem',
              resize: 'vertical',
              fontFamily: 'inherit',
              fontSize: '1rem',
              minHeight: '4rem',
              outline: 'none',
            }}
            disabled={isSubmitting}
            rows={3}
          />

          {/* Media Previews */}
          {mediaPreviews.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
              {mediaPreviews.map((url, i) => (
                <div key={i} style={{
                  position: 'relative',
                  width: '5rem',
                  height: '5rem',
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  border: '1px solid #e7e5e4',
                }}>
                  <Image
                    src={url}
                    alt={`Preview ${i + 1}`}
                    fill
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                  <button
                    onClick={() => removeMedia(i)}
                    style={{
                      position: 'absolute',
                      top: '-0.25rem',
                      right: '-0.25rem',
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      width: '1.25rem',
                      height: '1.25rem',
                      borderRadius: '9999px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    aria-label="Remove attachment"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid #f5f5f4',
          }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#78716c',
                fontSize: '0.875rem',
                fontWeight: 500,
                padding: '0.375rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: isSubmitting || mediaFiles.length >= maxFiles ? 'not-allowed' : 'pointer',
              }}
              disabled={isSubmitting || mediaFiles.length >= maxFiles}
            >
              <Camera size={16} />
              {mediaFiles.length > 0
                ? `Add more (${maxFiles - mediaFiles.length} left)`
                : 'Add photo/video'}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              multiple
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  setText('');
                  setMediaFiles([]);
                  setMediaPreviews([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{
                  flex: 1,
                  padding: '0.625rem',
                  borderRadius: '0.75rem',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  backgroundColor: '#f5f5f4',
                  color: '#404040',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                disabled={!hasContent || isSubmitting}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem',
                  borderRadius: '0.75rem',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  backgroundColor: hasContent && !isSubmitting ? '#f59e0b' : '#d6d3d1',
                  color: hasContent && !isSubmitting ? '#fff' : '#a8a29e',
                  cursor: !hasContent || isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: hasContent && !isSubmitting ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {isSubmitting ? (
                  <>
                    <div style={{
                      width: '1rem',
                      height: '1rem',
                      borderRadius: '50%',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      animation: 'spin 1s linear infinite',
                    }}></div>
                    Sharing...
                  </>
                ) : (
                  <>
                    Share
                    <Send size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}