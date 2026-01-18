// hooks/useBannerPreference.ts
import { useState, useEffect } from 'react';

export function useBannerPreference(userId: string | null) {
  // Initialize from localStorage *synchronously* if possible
  const getInitialPreference = () => {
    if (typeof window === 'undefined' || !userId) return true; // default: show
    const saved = localStorage.getItem(`hideCommunityHeader_${userId}`);
    return saved === 'true' ? false : true;
  };

  const [showBanner, setShowBanner] = useState(getInitialPreference);

  const toggleBanner = () => {
    const newValue = !showBanner;
    setShowBanner(newValue);
    if (userId) {
      localStorage.setItem(`hideCommunityHeader_${userId}`, String(!newValue));
    }
  };

  return { showBanner, toggleBanner };
}