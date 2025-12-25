'use client';

import { useState, useEffect } from 'react';
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
  toggleAnonymity,
  setShowSettings,
  setShowGriefSetup,
  setNewPostText,
  onConnectClick,
  onCommunitiesClick,
}: DashboardUIProps) {
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-stone-600">Loading your space...</p>
        </div>
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
        toggleAnonymity={toggleAnonymity}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 p-4 md:p-6 pb-24 pt-6 md:pt-[120px]">
      <div className="max-w-4xl mx-auto space-y-8">
        {error && (
          <div className="fixed top-4 right-4 max-w-sm p-4 bg-red-100 text-red-700 rounded-lg shadow-lg z-50">
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

// --- UI Components --- //
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
  <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 p-4 flex flex-col items-center justify-start">
    <div className="max-w-md w-full">
      <h1 className="text-2xl font-medium text-stone-800 text-center mb-2">
        What losses are you carrying?
      </h1>
      <p className="text-stone-600 text-center mb-6">
        You can choose more than one. This helps us connect you with the right people.
      </p>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      <div className="space-y-3 mb-6">
        {(Object.keys(griefTypeLabels) as GriefType[]).map((type) => (
          <button
            key={type}
            onClick={() => toggleGriefType(type)}
            className={`w-full text-left p-4 rounded-lg border transition ${
              selectedGriefTypes.includes(type)
                ? 'border-amber-500 bg-amber-50 text-amber-800'
                : 'border-stone-200 bg-white text-stone-800 hover:border-amber-300'
            }`}
          >
            {griefTypeLabels[type]}
            {selectedGriefTypes.includes(type) && (
              <span className="ml-2 text-amber-600">✓</span>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={handleSaveGriefTypes}
        disabled={selectedGriefTypes.length === 0 || isSubmitting}
        className={`w-full py-3 rounded-full font-medium transition ${
          selectedGriefTypes.length > 0 && !isSubmitting
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
        }`}
      >
        {isSubmitting ? 'Saving...' : 'Save & Continue'}
      </button>
      <p className="text-center text-xs text-stone-500 mt-4">
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
  toggleAnonymity 
}: {
  profile: UserProfile | null;
  preferences: UserPreferences;
  error: string | null;
  setShowSettings: (show: boolean) => void;
  setShowGriefSetup: (show: boolean) => void;
  toggleAcceptsCalls: () => Promise<void>;
  toggleAnonymity: () => Promise<void>;
}) => (
  <div className="min-h-screen bg-stone-50 p-4">
    <div className="max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-stone-800">Settings</h2>
        <button
          onClick={() => setShowSettings(false)}
          className="text-stone-500 hover:text-stone-700"
        >
          ✕
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="mb-6">
        <h3 className="font-medium text-stone-800 mb-2">Your Grief Context</h3>
        <p className="text-sm text-stone-600 mb-2">
          {profile?.griefTypes.map((t: GriefType) => griefTypeLabels[t] || 'Unknown loss').join(', ') || 'Not set'}
        </p>
        <button
          onClick={() => {
            setShowGriefSetup(true);
            setShowSettings(false);
          }}
          className="text-amber-600 text-sm hover:underline"
        >
          Edit grief types
        </button>
      </div>

      <div className="mb-6">
        <label 
          className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg border border-stone-200 hover:border-amber-300 transition"
          onClick={toggleAcceptsCalls}
        >
          <div className="flex-1">
            <div className="font-medium text-stone-800">
              {preferences.acceptsCalls ? 'Accepting support calls' : 'Paused for now'}
            </div>
            <div className="text-sm text-stone-500 mt-1">
              {preferences.acceptsCalls 
                ? 'You\'ll appear in matches for 1:1 support'
                : 'You won\'t be matched for calls until you turn this back on'
              }
            </div>
          </div>
          <ToggleLeft
            className={`w-10 h-5 rounded-full p-1 transition-colors ${
              preferences.acceptsCalls
                ? 'bg-amber-500 text-white'
                : 'bg-stone-300 text-stone-500'
            }`}
          />
        </label>
      </div>

      <div className="mb-6">
        <h3 className="font-medium text-stone-800 mb-3">Privacy Settings</h3>
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-stone-200">
            <input
              type="checkbox"
              checked={preferences.isAnonymous}
              onChange={toggleAnonymity}
              className="form-checkbox h-5 w-5 text-amber-600 rounded mt-1"
            />
            <div>
              <div className="font-medium text-stone-800">Post anonymously</div>
              <div className="text-sm text-stone-500 mt-1">
                Your name and profile picture won't be shown on your posts
              </div>
            </div>
          </label>
          
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Heart size={20} className="text-amber-600" />
              </div>
              <div>
                <div className="font-medium text-amber-800">Your safety matters</div>
                <div className="text-sm text-amber-700 mt-1">
                  We never share your contact information. All connections happen within our secure platform.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowSettings(false)}
        className="w-full py-3 bg-stone-800 text-white rounded-lg font-medium hover:bg-stone-900 transition"
      >
        Done
      </button>
    </div>
  </div>
);

const ProfileContextSection = ({ 
  profile, 
  setShowSettings, 
  setShowGriefSetup 
}: {
  profile: UserProfile | null;
  setShowSettings: (show: boolean) => void;
  setShowGriefSetup: (show: boolean) => void;
}) => (
  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-stone-200">
    <div className="flex justify-between items-start">
      <div>
        <h2 className="text-sm font-medium text-stone-600 mb-1">Your grief context</h2>
        <div className="flex flex-wrap gap-2">
          {profile?.griefTypes?.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-sm px-3 py-1.5 rounded-full border border-amber-200"
            >
              <Heart size={12} className="text-amber-600" />
              {griefTypeLabels[type]}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={() => setShowSettings(true)}
        className="p-2.5 text-stone-600 hover:text-stone-900 rounded-full hover:bg-stone-200 transition-colors"
        aria-label="Settings"
      >
        <Settings size={20} />
      </button>
    </div>
    <button
      onClick={() => setShowGriefSetup(true)}
      className="mt-3 text-xs text-amber-600 hover:underline flex items-center gap-1"
    >
      <Edit size={12} />
      Edit or add another loss
    </button>
  </div>
);

const CommunityPresence = ({ onlineCount }: { onlineCount: number }) => (
  <div className="text-center">
    <p className="text-stone-600 font-medium">Your grief is seen here</p>
    <div className="mt-2 inline-flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full text-sm font-medium text-green-800 border border-green-200">
      <Heart size={14} className="text-green-600 fill-green-500" />
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
  <section className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 border border-amber-200">
        {profile?.avatarUrl ? (
          <img 
            src={profile.avatarUrl} 
            alt="Your avatar" 
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <MessageCircle size={18} className="text-amber-600" />
        )}
      </div>
      <div className="flex-1">
        <textarea
          value={newPostText}
          onChange={(e) => setNewPostText(e.target.value)}
          placeholder="What's in your heart today? It's safe to share here..."
          className="w-full p-2 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300 rounded-lg resize-none border border-stone-200"
          rows={3}
          disabled={isSubmitting}
        />
        
        {mediaPreviews.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {mediaPreviews.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-200">
                <img
                  src={url}
                  alt={`Attachment ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeMedia(i)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                  aria-label="Remove attachment"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-stone-100">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-stone-600 hover:text-amber-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
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
            className="hidden"
          />
          
          <button
            onClick={handlePostSubmit}
            disabled={!newPostText.trim() || isSubmitting}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              newPostText.trim() && !isSubmitting
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md hover:shadow-lg'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
    <div className="flex justify-between items-center mb-4">
      <h2 className="font-semibold text-stone-800 text-lg">Shared Moments</h2>
      <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-full">
        {posts.length} posts
      </span>
    </div>
    
    {posts.length === 0 ? (
      <div className="bg-white border-2 border-dashed rounded-xl p-8 text-center border-stone-200">
        <MessageCircle className="mx-auto text-stone-300" size={48} />
        <p className="text-stone-500 mt-2">No posts yet. Be the first to share.</p>
        <p className="text-stone-400 text-sm mt-1">Your words can comfort others walking a similar path</p>
      </div>
    ) : (
      <div className="space-y-4">
        {posts.map((post) => (
          <PostItem key={post.id} post={post} />
        ))}
      </div>
    )}
  </section>
);

const PostItem = ({ post }: { post: Post }) => (
  <div 
    key={post.id} 
    className="bg-white rounded-xl border border-stone-200 overflow-hidden transition-shadow hover:shadow-md"
  >
    <div className="p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex-shrink-0 flex items-center justify-center border border-amber-200 overflow-hidden">
          {post.user?.avatarUrl && !post.isAnonymous ? (
            <img 
              src={post.user.avatarUrl} 
              alt={post.user.fullName} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-amber-700 font-medium">
              {post.isAnonymous ? 'A' : post.user?.fullName?.charAt(0) || 'C'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-medium text-stone-800 truncate">
              {post.isAnonymous ? 'Anonymous' : post.user?.fullName || 'Community Member'}
            </h3>
            {post.isAnonymous && (
              <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                Anonymous
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {post.griefTypes.map((type, i) => (
              <span 
                key={i} 
                className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full border border-amber-100"
              >
                <Heart size={10} className="text-amber-500" />
                {griefTypeLabels[type].split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <p className="text-stone-800 whitespace-pre-wrap leading-relaxed">
        {post.text}
      </p>
      
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {post.mediaUrls.map((url, i) => (
            <div 
              key={i} 
              className="aspect-square rounded-lg overflow-hidden bg-stone-100 border border-stone-200"
            >
              <img
                src={url}
                alt={`Post media ${i + 1}`}
                className="w-full h-full object-cover transition-transform hover:scale-105"
              />
            </div>
          ))}
        </div>
      )}
    </div>
    
    <div className="px-4 py-3 border-t border-stone-100 flex justify-between items-center text-sm">
      <span className="text-stone-500">
        {new Date(post.createdAt).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </span>
      <button className="flex items-center gap-1.5 text-stone-500 hover:text-amber-600 font-medium group">
        <Heart size={16} className="group-hover:fill-amber-100 group-hover:text-amber-600 transition-colors" />
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
    <h2 className="font-semibold text-stone-800 mb-4 text-lg">Find Support</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button
        onClick={onConnectClick}
        className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-stone-200 bg-white hover:border-amber-400 transition-all group"
      >
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200 transition-colors">
          <MessageCircle className="text-amber-600" size={28} />
        </div>
        <span className="font-medium text-stone-800 group-hover:text-amber-700 transition-colors">
          1:1 Support
        </span>
        <span className="text-xs text-stone-500 mt-1 text-center">
          Connect with someone who understands
        </span>
      </button>
      <button
        onClick={onCommunitiesClick}
        className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-stone-200 bg-white hover:border-amber-400 transition-all group"
      >
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200 transition-colors">
          <Users className="text-amber-600" size={28} />
        </div>
        <span className="font-medium text-stone-800 group-hover:text-amber-700 transition-colors">
          Communities
        </span>
        <span className="text-xs text-stone-500 mt-1 text-center">
          Join groups with shared experiences
        </span>
      </button>
    </div>
  </section>
);

const CommunityFooter = () => (
  <div className="text-center pt-6 border-t border-stone-200 mt-6">
    <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 px-4 py-2 rounded-full border border-amber-100">
      <Heart size={16} className="text-amber-600 fill-amber-200" />
      <span className="font-medium">You belong here</span>
    </div>
    <p className="text-stone-600 text-sm mt-2">
      This is a judgment-free space for your grief journey
    </p>
  </div>
);