'use client';

import { useState, useEffect, CSSProperties } from 'react';
import {
  Heart,
  MessageCircle,
  Users,
  Edit,
  Send,
  Camera,
  X,
  Settings,
  ToggleLeft,
  User,
} from 'lucide-react';
import type { 
  GriefType, 
  Post, 
  UserProfile, 
  UserPreferences,
  DashboardUIProps
} from './useDashboardLogic';

const griefTypeLabels: Record<GriefType, string> = {
  parent: 'Loss of a Parent',
  child: 'Loss of a Child',
  spouse: 'Grieving a Partner',
  sibling: 'Loss of a Sibling',
  friend: 'Loss of a Friend',
  pet: 'Pet Loss',
  miscarriage: 'Pregnancy or Infant Loss',
  caregiver: 'Caregiver Grief',
  suicide: 'Suicide Loss',
  other: 'Other Loss',
};

// =============== Base Styles ===============
const baseStyles = {
  container: {
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  textCenter: { textAlign: 'center' as const },
  flexCenter: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
  fullScreenCenter: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafaf9',
  },
  buttonBase: {
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background-color 0.2s, color 0.2s',
  },
  inputBase: {
    padding: '0.625rem',
    border: '1px solid #d6d3d1',
    borderRadius: '0.5rem',
    fontFamily: 'inherit',
    fontSize: '1rem',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '1rem',
    border: '1px solid #e7e5e4',
    padding: '1rem',
  },
} as const;

// =============== DashboardUI ===============
export function DashboardUI({
  profile,
  preferences,
  showGriefSetup,
  showSettings,
  selectedGriefTypes,
  newPostText,
  mediaFiles,
  mediaPreviews,
  posts,
  onlineCount,
  isLoading,
  isSubmitting,
  error,
  fileInputRef,
  toggleGriefType,
  handleSaveGriefTypes,
  handleFileChange,
  removeMedia,
  handlePostSubmit,
  toggleAcceptsCalls,
  toggleAcceptsVideoCalls,
  toggleAnonymity,
  updateFullName,
  setShowSettings,
  setShowGriefSetup,
  setNewPostText,
  onConnectClick,
  onCommunitiesClick,
}: DashboardUIProps) {
  if (isLoading) {
    return (
      <div style={baseStyles.fullScreenCenter}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: '50%',
            border: '4px solid #f59e0b',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          }}></div>
          <p style={{ color: '#44403c', marginTop: '1rem' }}>Loading your space...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (showGriefSetup) {
    return (
      <GriefSetupModal
        selectedGriefTypes={selectedGriefTypes}
        error={error}
        toggleGriefType={toggleGriefType}
        handleSaveGriefTypes={handleSaveGriefTypes}
        isSubmitting={isSubmitting}
      />
    );
  }

  if (showSettings) {
    return (
      <SettingsModal
        profile={profile}
        preferences={preferences}
        error={error}
        setShowSettings={setShowSettings}
        setShowGriefSetup={setShowGriefSetup}
        toggleAcceptsCalls={toggleAcceptsCalls}
        toggleAcceptsVideoCalls={toggleAcceptsVideoCalls}
        toggleAnonymity={toggleAnonymity}
        updateFullName={updateFullName}
      />
    );
  }

  return (
    <div style={{
      ...baseStyles.container,
      background: 'linear-gradient(to bottom, #fffbeb, #fafaf9, #f5f5f4)',
      padding: '1rem',
      paddingBottom: '10rem',
      paddingTop: '1.5rem',
    }}>
      <div style={{
        maxWidth: '1024px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '2rem',
      }}>
        {error && (
          <div style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            maxWidth: '24rem',
            padding: '1rem',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            zIndex: 50,
          }}>
            {error}
          </div>
        )}
        
        <ProfileContextSection 
          profile={profile}
          setShowSettings={setShowSettings}
          setShowGriefSetup={setShowGriefSetup}
        />

        <CommunityPresence onlineCount={onlineCount} />

        <NewPostForm
          profile={profile}
          mediaFiles={mediaFiles}
          newPostText={newPostText}
          mediaPreviews={mediaPreviews}
          isSubmitting={isSubmitting}
          fileInputRef={fileInputRef}
          setNewPostText={setNewPostText}
          handleFileChange={handleFileChange}
          removeMedia={removeMedia}
          handlePostSubmit={handlePostSubmit}
        />

        <PostsSection posts={posts} />

        <SupportOptions 
          onConnectClick={onConnectClick}
          onCommunitiesClick={onCommunitiesClick}
        />

        <CommunityFooter />
      </div>
    </div>
  );
}

// =============== Reusable Subcomponents with Inline CSS ===============
const GriefSetupModal = ({ 
  selectedGriefTypes, 
  error, 
  toggleGriefType, 
  handleSaveGriefTypes,
  isSubmitting 
}: {
  selectedGriefTypes: GriefType[];
  error: string | null;
  toggleGriefType: (type: GriefType) => void;
  handleSaveGriefTypes: () => Promise<void>;
  isSubmitting: boolean;
}) => (
  <div style={{
    minHeight: '100vh',
    background: 'linear-gradient(to bottom, #fffbeb, #fafaf9, #f5f5f4)',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-start',
  }}>
    <div style={{ maxWidth: '28rem', width: '100%' }}>
      <h1 style={{
        fontSize: '1.5rem',
        fontWeight: 500,
        color: '#1c1917',
        textAlign: 'center',
        marginBottom: '0.5rem',
      }}>
        What losses are you carrying?
      </h1>
      <p style={{
        color: '#44403c',
        textAlign: 'center',
        marginBottom: '1.5rem',
      }}>
        You can choose more than one. This helps us connect you with the right people.
      </p>
      
      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.75rem', marginBottom: '1.5rem' }}>
        {(Object.keys(griefTypeLabels) as GriefType[]).map((type) => (
          <button
            key={type}
            onClick={() => toggleGriefType(type)}
            style={{
              ...baseStyles.buttonBase,
              width: '100%',
              textAlign: 'left' as const,
              padding: '1rem',
              border: selectedGriefTypes.includes(type)
                ? '1px solid #f59e0b'
                : '1px solid #e7e5e4',
              backgroundColor: selectedGriefTypes.includes(type)
                ? '#fffbeb'
                : '#fff',
              color: selectedGriefTypes.includes(type)
                ? '#92400e'
                : '#1c1917',
            }}
          >
            {griefTypeLabels[type]}
            {selectedGriefTypes.includes(type) && (
              <span style={{ marginLeft: '0.5rem', color: '#b45309' }}>✓</span>
            )}
          </button>
        ))}
      </div>
      
      <button
        onClick={handleSaveGriefTypes}
        disabled={selectedGriefTypes.length === 0 || isSubmitting}
        style={{
          ...baseStyles.buttonBase,
          width: '100%',
          padding: '0.75rem',
          backgroundColor: selectedGriefTypes.length > 0 && !isSubmitting
            ? '#f59e0b'
            : '#d6d3d1',
          color: selectedGriefTypes.length > 0 && !isSubmitting
            ? '#fff'
            : '#a8a29e',
          cursor: selectedGriefTypes.length === 0 || isSubmitting ? 'not-allowed' : 'pointer',
        }}
      >
        {isSubmitting ? 'Saving...' : 'Save & Continue'}
      </button>
      
      <p style={{
        textAlign: 'center',
        fontSize: '0.75rem',
        color: '#78716c',
        marginTop: '1rem',
      }}>
        You can edit this anytime in Settings.
      </p>
    </div>
  </div>
);

const SettingsModal = ({ 
  profile, 
  preferences, 
  error, 
  setShowSettings,
  setShowGriefSetup,
  toggleAcceptsCalls,
  toggleAcceptsVideoCalls,
  toggleAnonymity,
  updateFullName
}: {
  profile: UserProfile | null;
  preferences: UserPreferences;
  error: string | null;
  setShowSettings: (show: boolean) => void;
  setShowGriefSetup: (show: boolean) => void;
  toggleAcceptsCalls: () => Promise<void>;
  toggleAcceptsVideoCalls: () => Promise<void>;
  toggleAnonymity: () => Promise<void>;
  updateFullName: (firstName: string, lastName: string) => Promise<void>;
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.fullName) {
      const parts = profile.fullName.split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    } else {
      const email = profile?.email || '';
      if (email) {
        const namePart = email.split('@')[0];
        setFirstName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        setLastName('');
      }
    }
  }, [profile]);

  const handleSaveName = async () => {
    if (!firstName.trim()) {
      setNameError('First name is required');
      return;
    }
    
    setNameError(null);
    setIsSavingName(true);
    
    try {
      await updateFullName(firstName.trim(), lastName.trim());
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  };

    return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fafaf9',
        padding: '1rem',
        paddingBottom: 'calc(60px + env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ maxWidth: '28rem', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1c1917' }}>Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            style={{ color: '#78716c', fontSize: '1.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {/* Display Name Section */}
        <div style={{ ...baseStyles.card, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', borderRadius: '0.5rem' }}>
              <User size={20} style={{ color: '#92400e' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontWeight: 500, color: '#1c1917', marginBottom: '0.75rem' }}>Display Name</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, color: '#3f3f46', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setNameError(null);
                    }}
                    style={{ ...baseStyles.inputBase, width: '100%' }}
                    placeholder="First name"
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 500, color: '#3f3f46', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    style={{ ...baseStyles.inputBase, width: '100%' }}
                    placeholder="Last name (optional)"
                  />
                </div>
                
                {nameError && (
                  <div style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>{nameError}</div>
                )}
                
                <button
                  onClick={handleSaveName}
                  disabled={!firstName.trim() || isSavingName}
                  style={{
                    ...baseStyles.buttonBase,
                    padding: '0.625rem',
                    backgroundColor: firstName.trim() && !isSavingName ? '#f59e0b' : '#d6d3d1',
                    color: firstName.trim() && !isSavingName ? '#fff' : '#a8a29e',
                    cursor: !firstName.trim() || isSavingName ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSavingName ? 'Saving...' : 'Update Display Name'}
                </button>
                
                <div style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '0.5rem' }}>
                  This name will be used across the platform. You can change it anytime.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 500, color: '#1c1917', marginBottom: '0.5rem' }}>Your Grief Context</h3>
          <p style={{ fontSize: '0.875rem', color: '#44403c', marginBottom: '0.5rem' }}>
            {profile?.griefTypes.map((t: GriefType) => griefTypeLabels[t] || 'Unknown loss').join(', ') || 'Not set'}
          </p>
          <button
            onClick={() => {
              setShowGriefSetup(true);
              setShowSettings(false);
            }}
            style={{ color: '#b45309', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Edit grief types
          </button>
        </div>

        {/* 1:1 Support Toggle */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label 
            style={{
              display: 'flex',
              gap: '0.75rem',
              cursor: 'pointer',
              padding: '0.75rem',
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              border: '1px solid #e7e5e4',
            }}
            onClick={toggleAcceptsCalls}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: '#1c1917' }}>
                {preferences.acceptsCalls ? 'Accepting support calls' : 'Paused for now'}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#78716c', marginTop: '0.25rem' }}>
                {preferences.acceptsCalls 
                  ? 'You\'ll appear in matches for 1:1 support'
                  : 'You won\'t be matched for calls until you turn this back on'
                }
              </div>
            </div>
            <ToggleLeft
              style={{
                width: '2.5rem',
                height: '1.25rem',
                padding: '0.25rem',
                borderRadius: '9999px',
                backgroundColor: preferences.acceptsCalls ? '#f59e0b' : '#d6d3d1',
                color: preferences.acceptsCalls ? '#fff' : '#78716c',
              }}
            />
          </label>
        </div>

        {/* Video Calls Toggle */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label 
            style={{
              display: 'flex',
              gap: '0.75rem',
              cursor: 'pointer',
              padding: '0.75rem',
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              border: '1px solid #e7e5e4',
            }}
            onClick={toggleAcceptsVideoCalls}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: '#1c1917' }}>
                {preferences.acceptsVideoCalls ? 'Video calls enabled' : 'Video calls disabled'}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#78716c', marginTop: '0.25rem' }}>
                {preferences.acceptsVideoCalls
                  ? 'You can be invited to video support sessions'
                  : 'You’ll only be matched for text or audio support'
                }
              </div>
            </div>
            <ToggleLeft
              style={{
                width: '2.5rem',
                height: '1.25rem',
                padding: '0.25rem',
                borderRadius: '9999px',
                backgroundColor: preferences.acceptsVideoCalls ? '#f59e0b' : '#d6d3d1',
                color: preferences.acceptsVideoCalls ? '#fff' : '#78716c',
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 500, color: '#1c1917', marginBottom: '0.75rem' }}>Privacy Settings</h3>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' }}>
            <label style={{
              display: 'flex',
              gap: '0.75rem',
              padding: '0.75rem',
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              border: '1px solid #e7e5e4',
              alignItems: 'flex-start',
            }}>
              <input
                type="checkbox"
                checked={preferences.isAnonymous}
                onChange={toggleAnonymity}
                style={{
                  height: '1.25rem',
                  width: '1.25rem',
                  accentColor: '#f59e0b',
                  marginTop: '0.25rem',
                }}
              />
              <div>
                <div style={{ fontWeight: 500, color: '#1c1917' }}>Post anonymously</div>
                <div style={{ fontSize: '0.875rem', color: '#78716c', marginTop: '0.25rem' }}>
                  Your name and profile picture won't be shown on your posts
                </div>
              </div>
            </label>
            
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#fef3c7',
              borderRadius: '0.5rem',
              border: '1px solid #fde68a',
            }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ marginTop: '0.25rem' }}>
                  <Heart size={20} style={{ color: '#b45309' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: '#92400e' }}>Your safety matters</div>
                  <div style={{ fontSize: '0.875rem', color: '#92400e', marginTop: '0.25rem' }}>
                    We never share your contact information. All connections happen within our secure platform.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(false)}
          style={{
            ...baseStyles.buttonBase,
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#1c1917',
            color: '#fff',
            marginTop: '1rem',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
};

const ProfileContextSection = ({ 
  profile, 
  setShowSettings, 
  setShowGriefSetup 
}: {
  profile: UserProfile | null;
  setShowSettings: (show: boolean) => void;
  setShowGriefSetup: (show: boolean) => void;
}) => {
  const displayName = profile?.fullName || (profile?.email ? profile.email.split('@')[0] : 'Friend');
  const firstName = displayName.split(' ')[0];

  return (
    <div style={{
      ...baseStyles.card,
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 500, color: '#1c1917', marginBottom: '0.25rem' }}>
            Welcome back, {firstName}
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#44403c' }}>Your grief context</p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            padding: '0.625rem',
            color: '#78716c',
            borderRadius: '9999px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
      </div>
      
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem', marginBottom: '1rem' }}>
        {profile?.griefTypes?.map((type) => (
          <span
            key={type}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              fontSize: '0.875rem',
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              border: '1px solid #fde68a',
            }}
          >
            <Heart size={12} style={{ color: '#d97706' }} />
            {griefTypeLabels[type]}
          </span>
        ))}
      </div>
      
      <button
        onClick={() => setShowGriefSetup(true)}
        style={{
          fontSize: '0.75rem',
          color: '#b45309',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        <Edit size={12} />
        Edit or add another loss
      </button>
    </div>
  );
};

const CommunityPresence = ({ onlineCount }: { onlineCount: number }) => (
  <div style={{ textAlign: 'center' as const }}>
    <p style={{ color: '#44403c', fontWeight: 500 }}>Your grief is seen here</p>
    <div style={{
      marginTop: '0.5rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      backgroundColor: '#f0fdf4',
      padding: '0.5rem 1rem',
      borderRadius: '9999px',
      fontSize: '0.875rem',
      fontWeight: 500,
      color: '#166534',
      border: '1px solid #bbf7d0',
    }}>
      <Heart size={14} style={{ color: '#22c55e', fill: '#dcfce7' }} />
      {onlineCount} people in community right now
    </div>
  </div>
);

const NewPostForm = ({ 
  profile,
  mediaFiles,
  newPostText, 
  mediaPreviews, 
  isSubmitting, 
  fileInputRef,
  setNewPostText,
  handleFileChange,
  removeMedia,
  handlePostSubmit
}: {
  profile: UserProfile | null;
  mediaFiles: File[];
  newPostText: string;
  mediaPreviews: string[];
  isSubmitting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setNewPostText: (text: string) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeMedia: (index: number) => void;
  handlePostSubmit: () => Promise<void>;
}) => (
  <section style={{ ...baseStyles.card, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <div style={{
        width: '2.5rem',
        height: '2.5rem',
        borderRadius: '9999px',
        backgroundColor: '#fef3c7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: '1px solid #fde68a',
      }}>
        {profile?.avatarUrl ? (
          <img 
            src={profile.avatarUrl} 
            alt="Your avatar" 
            style={{ width: '100%', height: '100%', borderRadius: '9999px', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ color: '#92400e', fontWeight: 500, fontSize: '0.875rem' }}>
            {(profile?.fullName || 'U').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <textarea
          value={newPostText}
          onChange={(e) => setNewPostText(e.target.value)}
          placeholder="What's in your heart today? It's safe to share here..."
          style={{
            width: '100%',
            padding: '0.5rem',
            color: '#1c1917',
            backgroundColor: 'transparent',
            border: '1px solid #e7e5e4',
            borderRadius: '0.5rem',
            resize: 'none',
            fontFamily: 'inherit',
            fontSize: '1rem',
            minHeight: '4rem',
            outline: 'none',
          }}
          disabled={isSubmitting}
        />
        
        {mediaPreviews.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem', marginTop: '0.75rem' }}>
            {mediaPreviews.map((url, i) => (
              <div key={i} style={{
                position: 'relative',
                width: '5rem',
                height: '5rem',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                border: '1px solid #e7e5e4',
              }}>
                <img
                  src={url}
                  alt={`Attachment ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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

        <div style={{
          display: 'flex',
          flexDirection: 'column' as const,
          gap: '0.75rem',
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #f5f5f4',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem' }}>
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
                cursor: isSubmitting || mediaFiles.length >= 4 ? 'not-allowed' : 'pointer',
              }}
              disabled={isSubmitting || mediaFiles.length >= 4}
            >
              <Camera size={16} />
              {mediaFiles.length > 0 ? `Add more (${4 - mediaFiles.length} left)` : 'Add photo/video'}
            </button>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*"
            multiple
            style={{ display: 'none' }}
          />
          
          <button
            onClick={handlePostSubmit}
            disabled={!newPostText.trim() || isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.75rem',
              fontWeight: 500,
              fontSize: '0.875rem',
              backgroundColor: newPostText.trim() && !isSubmitting
                ? '#f59e0b'
                : '#d6d3d1',
              color: newPostText.trim() && !isSubmitting
                ? '#fff'
                : '#a8a29e',
              cursor: !newPostText.trim() || isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: newPostText.trim() && !isSubmitting ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
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
  </section>
);

const PostsSection = ({ posts }: { posts: Post[] }) => (
  <section>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <h2 style={{ fontWeight: 600, color: '#1c1917', fontSize: '1.125rem' }}>Shared Moments</h2>
      <span style={{
        fontSize: '0.75rem',
        fontWeight: 500,
        color: '#b45309',
        backgroundColor: '#fffbeb',
        padding: '0.25rem 0.5rem',
        borderRadius: '9999px',
      }}>
        {posts.length} posts
      </span>
    </div>
    
    {posts.length === 0 ? (
      <div style={{
        ...baseStyles.card,
        borderStyle: 'dashed',
        borderWidth: '2px',
        borderColor: '#e7e5e4',
        textAlign: 'center' as const,
        padding: '2rem',
      }}>
        <MessageCircle style={{ color: '#d6d3d1', margin: '0 auto', width: '3rem', height: '3rem' }} />
        <p style={{ color: '#78716c', marginTop: '0.5rem' }}>No posts yet. Be the first to share.</p>
        <p style={{ color: '#a8a29e', fontSize: '0.875rem', marginTop: '0.25rem' }}>Your words can comfort others walking a similar path</p>
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1rem' }}>
        {posts.map((post) => (
          <PostItem key={post.id} post={post} />
        ))}
      </div>
    )}
  </section>
);

const PostItem = ({ post }: { post: Post }) => (
  <div 
    style={{
      ...baseStyles.card,
      transition: 'box-shadow 0.2s',
    }}
  >
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '9999px',
          backgroundColor: '#fef3c7',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #fde68a',
          overflow: 'hidden',
        }}>
          {post.user?.avatarUrl && !post.isAnonymous ? (
            <img 
              src={post.user.avatarUrl} 
              alt={post.user.fullName} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9999px' }}
            />
          ) : (
            <div style={{ color: '#92400e', fontWeight: 500 }}>
              {post.isAnonymous ? 'A' : post.user?.fullName?.charAt(0) || 'C'}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3 style={{
              fontWeight: 500,
              color: '#1c1917',
              whiteSpace: 'nowrap' as const,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {post.isAnonymous ? 'Anonymous' : post.user?.fullName || 'Community Member'}
            </h3>
            {post.isAnonymous && (
              <span style={{
                fontSize: '0.75rem',
                backgroundColor: '#fffbeb',
                color: '#92400e',
                padding: '0.125rem 0.375rem',
                borderRadius: '9999px',
              }}>
                Anonymous
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.25rem', marginTop: '0.25rem' }}>
            {post.griefTypes.map((type, i) => (
              <span 
                key={i} 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  backgroundColor: '#fffbeb',
                  color: '#92400e',
                  fontSize: '0.75rem',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '9999px',
                  border: '1px solid #fde68a',
                }}
              >
                <Heart size={10} style={{ color: '#d97706' }} />
                {griefTypeLabels[type].split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <p style={{
        color: '#1c1917',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.6,
      }}>
        {post.text}
      </p>
      
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div style={{
          marginTop: '0.75rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: '0.5rem',
        }}>
          {post.mediaUrls.map((url, i) => (
            <div 
              key={i} 
              style={{
                aspectRatio: '1',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                backgroundColor: '#f5f5f4',
                border: '1px solid #e7e5e4',
              }}
            >
              <img
                src={url}
                alt={`Post media ${i + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'transform 0.2s',
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
    
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.75rem 1rem',
      borderTop: '1px solid #f5f5f4',
      fontSize: '0.875rem',
    }}>
      <span style={{ color: '#78716c' }}>
        {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      <button style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        color: '#78716c',
        fontWeight: 500,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}>
        <Heart size={16} style={{ transition: 'color 0.2s' }} />
        <span>{post.likes}</span>
      </button>
    </div>
  </div>
);

const SupportOptions = ({ 
  onConnectClick, 
  onCommunitiesClick 
}: {
  onConnectClick: () => void;
  onCommunitiesClick: () => void;
}) => (
  <section>
    <h2 style={{ fontWeight: 600, color: '#1c1917', marginBottom: '1rem', fontSize: '1.125rem' }}>Find Support</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
      <button
        onClick={onConnectClick}
        style={{
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          borderRadius: '1rem',
          border: '2px solid #e7e5e4',
          backgroundColor: '#fff',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
      >
        <div style={{
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '9999px',
          backgroundColor: '#fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.75rem',
        }}>
          <MessageCircle style={{ color: '#92400e' }} size={28} />
        </div>
        <span style={{ fontWeight: 500, color: '#1c1917' }}>
          1:1 Support
        </span>
        <span style={{ fontSize: '0.75rem', color: '#78716c', textAlign: 'center', marginTop: '0.25rem' }}>
          Connect with someone who understands
        </span>
      </button>
      <button
        onClick={onCommunitiesClick}
        style={{
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          borderRadius: '1rem',
          border: '2px solid #e7e5e4',
          backgroundColor: '#fff',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
      >
        <div style={{
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '9999px',
          backgroundColor: '#fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.75rem',
        }}>
          <Users style={{ color: '#92400e' }} size={28} />
        </div>
        <span style={{ fontWeight: 500, color: '#1c1917' }}>
          Communities
        </span>
        <span style={{ fontSize: '0.75rem', color: '#78716c', textAlign: 'center', marginTop: '0.25rem' }}>
          Join groups with shared experiences
        </span>
      </button>
    </div>
  </section>
);

const CommunityFooter = () => (
  <div style={{
    textAlign: 'center' as const,
    paddingTop: '1.5rem',
    borderTop: '1px solid #e7e5e4',
    marginTop: '1.5rem',
  }}>
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      backgroundColor: '#fffbeb',
      color: '#92400e',
      padding: '0.5rem 1rem',
      borderRadius: '9999px',
      border: '1px solid #fde68a',
    }}>
      <Heart size={16} style={{ color: '#d97706', fill: '#fef3c7' }} />
      <span style={{ fontWeight: 500 }}>You belong here</span>
    </div>
    <p style={{ color: '#78716c', fontSize: '0.875rem', marginTop: '0.5rem' }}>
      This is a judgment-free space for your grief journey
    </p>
  </div>
);