import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type {
  RecapComposerDestination,
  RecapComposerPhoto,
} from '@/providers/mobile-recap-composer';

export type LocalRecapTaggedEvent = {
  id: string;
  title: string;
  image: string;
  date?: string;
  time?: string;
};

export type LocalRecapPost = {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string;
  destination: RecapComposerDestination;
  caption: string;
  photos: RecapComposerPhoto[];
  taggedEvent: LocalRecapTaggedEvent | null;
  createdAt: string;
  contentType: 'text' | 'photo' | 'mixed';
};

type LocalRecapsContextValue = {
  recaps: LocalRecapPost[];
  addLocalRecap: (recap: LocalRecapPost) => void;
};

const LocalRecapsContext = createContext<LocalRecapsContextValue | null>(null);

export function MobileLocalRecapsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [recaps, setRecaps] = useState<LocalRecapPost[]>([]);

  const addLocalRecap = useCallback((recap: LocalRecapPost) => {
    setRecaps((prev) => [recap, ...prev]);
  }, []);

  const value = useMemo(
    () => ({
      recaps,
      addLocalRecap,
    }),
    [addLocalRecap, recaps]
  );

  return (
    <LocalRecapsContext.Provider value={value}>
      {children}
    </LocalRecapsContext.Provider>
  );
}

export function useLocalRecaps() {
  const context = useContext(LocalRecapsContext);
  if (!context) {
    throw new Error('useLocalRecaps must be used within MobileLocalRecapsProvider');
  }
  return context;
}
