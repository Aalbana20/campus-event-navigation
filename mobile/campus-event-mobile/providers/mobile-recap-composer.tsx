import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type RecapComposerDestination = 'for-you' | 'umes';

export type RecapComposerPhoto = {
  uri: string;
  mediaType?: 'image' | 'video';
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  width?: number | null;
  height?: number | null;
};

type RecapComposerState = {
  destination: RecapComposerDestination;
  text: string;
  photos: RecapComposerPhoto[];
  taggedEventId: string | null;
};

const DEFAULT_STATE: RecapComposerState = {
  destination: 'for-you',
  text: '',
  photos: [],
  taggedEventId: null,
};

export const MAX_RECAP_PHOTOS = 10;

type RecapComposerContextValue = RecapComposerState & {
  setDestination: (destination: RecapComposerDestination) => void;
  setText: (text: string) => void;
  addPhotos: (photos: RecapComposerPhoto[]) => void;
  removePhotoAt: (index: number) => void;
  clearPhotos: () => void;
  setTaggedEventId: (eventId: string | null) => void;
  reset: () => void;
};

const RecapComposerContext = createContext<RecapComposerContextValue | null>(null);

export function RecapComposerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RecapComposerState>(DEFAULT_STATE);

  const setDestination = useCallback((destination: RecapComposerDestination) => {
    setState((prev) => ({ ...prev, destination }));
  }, []);

  const setText = useCallback((text: string) => {
    setState((prev) => ({ ...prev, text }));
  }, []);

  const addPhotos = useCallback((photos: RecapComposerPhoto[]) => {
    if (!photos.length) return;
    setState((prev) => {
      const remaining = Math.max(0, MAX_RECAP_PHOTOS - prev.photos.length);
      if (remaining <= 0) return prev;
      return { ...prev, photos: [...prev.photos, ...photos.slice(0, remaining)] };
    });
  }, []);

  const removePhotoAt = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.photos.length) return prev;
      const nextPhotos = [...prev.photos];
      nextPhotos.splice(index, 1);
      return { ...prev, photos: nextPhotos };
    });
  }, []);

  const clearPhotos = useCallback(() => {
    setState((prev) => ({ ...prev, photos: [] }));
  }, []);

  const setTaggedEventId = useCallback((taggedEventId: string | null) => {
    setState((prev) => ({ ...prev, taggedEventId }));
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const value = useMemo<RecapComposerContextValue>(
    () => ({
      ...state,
      setDestination,
      setText,
      addPhotos,
      removePhotoAt,
      clearPhotos,
      setTaggedEventId,
      reset,
    }),
    [
      addPhotos,
      clearPhotos,
      removePhotoAt,
      reset,
      setDestination,
      setTaggedEventId,
      setText,
      state,
    ]
  );

  return (
    <RecapComposerContext.Provider value={value}>{children}</RecapComposerContext.Provider>
  );
}

export function useRecapComposer() {
  const context = useContext(RecapComposerContext);
  if (!context) {
    throw new Error('useRecapComposer must be used within a RecapComposerProvider');
  }
  return context;
}
