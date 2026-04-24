import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { ExploreEventDetailModal } from '@/components/mobile/ExploreEventDetailModal';
import {
  loadDiscoverPosts,
  type DiscoverPostRecord,
} from '@/lib/mobile-discover-posts';
import {
  formatViewCount,
  getPlaceholderViewCount,
  recordContentView,
} from '@/lib/mobile-content-views';
import { getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { EventRecord } from '@/types/models';

type ExploreTab = 'forYou' | 'media' | 'events';
type MediaFilter = 'all' | 'videos' | 'pictures';
type EventScope = 'nearby' | 'state' | 'country';
type OpenDropdown = 'media' | 'events' | null;

type ExploreItem =
  | {
      kind: 'video';
      id: string;
      mediaUrl: string;
      thumbnailUrl?: string;
      viewCount: number;
      raw: DiscoverPostRecord;
    }
  | {
      kind: 'picture';
      id: string;
      mediaUrl: string;
      viewCount: number;
      raw: DiscoverPostRecord;
    }
  | {
      kind: 'event';
      id: string;
      image: string;
      title: string;
      viewCount: number;
      raw: EventRecord;
    };

// Mock fallback media so the grid is never empty on a fresh DB or during dev
// disconnects. These all use stable public Unsplash URLs.
const MOCK_MEDIA: { kind: 'video' | 'picture'; mediaUrl: string }[] = [
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80' },
  { kind: 'video',   mediaUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80' },
  { kind: 'video',   mediaUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=800&q=80' },
  { kind: 'video',   mediaUrl: 'https://images.unsplash.com/photo-1495563381401-ecfbcaaa60f2?auto=format&fit=crop&w=800&q=80' },
];

const timeRank = (value?: string | null) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const interleave = (buckets: ExploreItem[][]) => {
  const queue: ExploreItem[] = [];
  const max = Math.max(...buckets.map((bucket) => bucket.length), 0);
  for (let i = 0; i < max; i += 1) {
    for (const bucket of buckets) {
      if (bucket[i]) queue.push(bucket[i]);
    }
  }
  return queue;
};

const filterEventsByScope = (events: EventRecord[], scope: EventScope) => {
  // State + country are broader scopes — until real geo filtering lands they
  // return the full set. Nearby keeps the Princess Anne / campus-keyword bias
  // the old Explore had.
  if (scope !== 'nearby') return events;

  const nearby = events.filter((event) => {
    const haystack = [event.location, event.locationName, event.locationAddress]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return /princess anne|campus|umes|maryland|eastern shore/.test(haystack);
  });
  return nearby.length > 0 ? nearby : events;
};

const TILE_GAP = 2;

export default function ExploreScreen() {
  const router = useRouter();
  const { events: allEvents = [], currentUser, savedEventIds, toggleSaveEvent } = useMobileApp();

  const [primaryTab, setPrimaryTab] = useState<ExploreTab>('forYou');
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [eventScope, setEventScope] = useState<EventScope>('nearby');
  const [searchText, setSearchText] = useState('');
  const [posts, setPosts] = useState<DiscoverPostRecord[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);

  const windowWidth = Dimensions.get('window').width;
  const tileSize = useMemo(
    () => (windowWidth - TILE_GAP * 2) / 3,
    [windowWidth]
  );

  useEffect(() => {
    let cancelled = false;
    loadDiscoverPosts({
      onData: (next) => {
        if (!cancelled) setPosts(next || []);
      },
    })
      .then((next) => {
        if (!cancelled) setPosts(next || []);
      })
      .catch(() => {
        /* swallow — we'll just fall back to mock media */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const videoItems = useMemo<ExploreItem[]>(
    () =>
      posts
        .filter((post) => post.mediaType === 'video')
        .sort((a, b) => timeRank(b.createdAt) - timeRank(a.createdAt))
        .map((post) => ({
          kind: 'video' as const,
          id: String(post.id),
          mediaUrl: post.mediaUrl,
          thumbnailUrl: post.thumbnailUrl || undefined,
          viewCount: getPlaceholderViewCount(String(post.id)),
          raw: post,
        })),
    [posts]
  );

  const pictureItems = useMemo<ExploreItem[]>(
    () =>
      posts
        .filter((post) => post.mediaType !== 'video')
        .sort((a, b) => timeRank(b.createdAt) - timeRank(a.createdAt))
        .map((post) => ({
          kind: 'picture' as const,
          id: String(post.id),
          mediaUrl: post.mediaUrl,
          viewCount: getPlaceholderViewCount(String(post.id)),
          raw: post,
        })),
    [posts]
  );

  const mockItems = useMemo<ExploreItem[]>(
    () =>
      MOCK_MEDIA.map((entry, index) => {
        const id = `mock-${entry.kind}-${index}`;
        const baseRaw = {
          id,
          mediaUrl: entry.mediaUrl,
          mediaType: entry.kind === 'video' ? 'video' : 'image',
          authorUsername: '',
          caption: '',
        } as unknown as DiscoverPostRecord;
        return entry.kind === 'video'
          ? {
              kind: 'video' as const,
              id,
              mediaUrl: entry.mediaUrl,
              thumbnailUrl: entry.mediaUrl,
              viewCount: getPlaceholderViewCount(id),
              raw: baseRaw,
            }
          : {
              kind: 'picture' as const,
              id,
              mediaUrl: entry.mediaUrl,
              viewCount: getPlaceholderViewCount(id),
              raw: baseRaw,
            };
      }),
    []
  );

  const eventItems = useMemo<ExploreItem[]>(() => {
    const scoped = filterEventsByScope(allEvents, eventScope);
    return scoped
      .slice()
      .sort(
        (a, b) =>
          timeRank(b.createdAt || b.date) - timeRank(a.createdAt || a.date)
      )
      .map((event) => ({
        kind: 'event' as const,
        id: String(event.id),
        image: event.image || '',
        title: event.title || 'Campus event',
        viewCount: getPlaceholderViewCount(String(event.id)),
        raw: event,
      }));
  }, [allEvents, eventScope]);

  const gridItems = useMemo<ExploreItem[]>(() => {
    const blendedVideos =
      videoItems.length > 0 ? videoItems : mockItems.filter((item) => item.kind === 'video');
    const blendedPictures =
      pictureItems.length > 0 ? pictureItems : mockItems.filter((item) => item.kind === 'picture');

    if (primaryTab === 'media') {
      if (mediaFilter === 'videos') return blendedVideos;
      if (mediaFilter === 'pictures') return blendedPictures;
      return [...blendedVideos, ...blendedPictures];
    }
    if (primaryTab === 'events') {
      return eventItems;
    }
    // For You = interleave media + events so the grid always has texture.
    return interleave([blendedVideos, blendedPictures, eventItems]);
  }, [eventItems, mediaFilter, mockItems, pictureItems, primaryTab, videoItems]);

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return gridItems;
    return gridItems.filter((item) => {
      if (item.kind === 'event') {
        return (
          item.title.toLowerCase().includes(query) ||
          String(item.raw.location || '').toLowerCase().includes(query)
        );
      }
      return String((item.raw as DiscoverPostRecord).caption || '')
        .toLowerCase()
        .includes(query);
    });
  }, [gridItems, searchText]);

  const handlePrimaryTabPress = useCallback(
    (tabId: ExploreTab) => {
      const hasDropdown = tabId === 'media' || tabId === 'events';
      if (!hasDropdown) {
        setPrimaryTab(tabId);
        setOpenDropdown(null);
        return;
      }
      if (primaryTab !== tabId) {
        setPrimaryTab(tabId);
        setOpenDropdown(null);
        return;
      }
      setOpenDropdown((current) => (current === tabId ? null : tabId));
    },
    [primaryTab]
  );

  const handleOpenItem = useCallback(
    (item: ExploreItem) => {
      if (item.kind === 'event') {
        setSelectedEvent(item.raw);
        void recordContentView({
          contentType: 'event',
          contentId: item.id,
          userId: currentUser?.id,
        });
        return;
      }
      void recordContentView({
        contentType: item.kind === 'video' ? 'video' : 'post',
        contentId: item.id,
        userId: currentUser?.id,
      });
      const username = (item.raw as DiscoverPostRecord).authorUsername;
      if (username) {
        router.push({ pathname: '/profile/[username]', params: { username } });
      }
    },
    [currentUser?.id, router]
  );

  const renderTile = useCallback(
    ({ item }: { item: ExploreItem }) => {
      const imageSource =
        item.kind === 'event'
          ? getEventImageSource(item.image)
          : { uri: (item.kind === 'video' && item.thumbnailUrl) || item.mediaUrl };

      return (
        <Pressable
          style={{
            width: tileSize,
            height: tileSize,
            marginRight: TILE_GAP,
            marginBottom: TILE_GAP,
            backgroundColor: '#0f0f11',
            overflow: 'hidden',
            borderRadius: 2,
          }}
          onPress={() => handleOpenItem(item)}>
          <ExpoImage
            source={imageSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />

          {/* Type indicator (top-right) */}
          <View style={styles.tileTypeBadge} pointerEvents="none">
            <Ionicons
              name={
                item.kind === 'video'
                  ? 'play'
                  : item.kind === 'event'
                    ? 'location-sharp'
                    : 'copy-outline'
              }
              size={12}
              color="#ffffff"
            />
          </View>

          {/* Event tile title strip (bottom) */}
          {item.kind === 'event' ? (
            <View style={styles.eventTitleStrip} pointerEvents="none">
              <Text style={styles.eventTitleText} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
          ) : null}

          {/* View count (bottom-left) */}
          <View style={styles.tileViewOverlay} pointerEvents="none">
            <Ionicons name="eye" size={11} color="#ffffff" />
            <Text style={styles.tileViewText}>{formatViewCount(item.viewCount)}</Text>
          </View>
        </Pressable>
      );
    },
    [handleOpenItem, tileSize]
  );

  const activeMediaLabel =
    mediaFilter === 'videos' ? 'Videos' : mediaFilter === 'pictures' ? 'Pictures' : 'Media';
  const activeEventLabel =
    eventScope === 'state' ? 'State' : eventScope === 'country' ? 'Country' : 'Nearby';

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.stickyHeader}>
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search events or people"
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.searchInput}
            />
          </View>
          <Pressable
            style={styles.searchAdjust}
            onPress={() => setOpenDropdown(null)}
            hitSlop={8}>
            <Ionicons name="options-outline" size={18} color="#ffffff" />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}>
          <Chip
            label="For you"
            active={primaryTab === 'forYou'}
            onPress={() => handlePrimaryTabPress('forYou')}
          />
          <Chip
            label={primaryTab === 'media' ? activeMediaLabel : 'Media'}
            active={primaryTab === 'media'}
            chevronOpen={openDropdown === 'media'}
            hasChevron
            onPress={() => handlePrimaryTabPress('media')}
          />
          <Chip
            label={primaryTab === 'events' ? activeEventLabel : 'Events'}
            active={primaryTab === 'events'}
            chevronOpen={openDropdown === 'events'}
            hasChevron
            onPress={() => handlePrimaryTabPress('events')}
          />
          <Chip label="Apps" onPress={() => {}} />
          <Chip label="Startup" onPress={() => {}} />
          <Chip label="NBA" onPress={() => {}} />
        </ScrollView>

        {openDropdown === 'media' ? (
          <View style={styles.dropdown}>
            {(['all', 'videos', 'pictures'] as MediaFilter[]).map((option) => (
              <DropdownItem
                key={option}
                label={
                  option === 'all' ? 'All media' : option === 'videos' ? 'Videos' : 'Pictures'
                }
                active={mediaFilter === option}
                onPress={() => {
                  setMediaFilter(option);
                  setPrimaryTab('media');
                  setOpenDropdown(null);
                }}
              />
            ))}
          </View>
        ) : null}

        {openDropdown === 'events' ? (
          <View style={styles.dropdown}>
            {(['nearby', 'state', 'country'] as EventScope[]).map((option) => (
              <DropdownItem
                key={option}
                label={option === 'nearby' ? 'Nearby' : option === 'state' ? 'State' : 'Country'}
                active={eventScope === option}
                onPress={() => {
                  setEventScope(option);
                  setPrimaryTab('events');
                  setOpenDropdown(null);
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item, index) => `${item.kind}-${item.id}-${index}`}
        renderItem={renderTile}
        numColumns={3}
        columnWrapperStyle={{ paddingLeft: TILE_GAP }}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing here yet.</Text>
            <Text style={styles.emptyCopy}>
              Events, posts and videos will land here.
            </Text>
          </View>
        }
      />

      <Pressable
        style={styles.globeButton}
        onPress={() => router.push('/map')}
        accessibilityLabel="Open event map">
        <Ionicons name="globe-outline" size={22} color="#ffffff" />
      </Pressable>

      <ExploreEventDetailModal
        visible={Boolean(selectedEvent)}
        event={selectedEvent}
        actionLabel={
          selectedEvent && savedEventIds.includes(String(selectedEvent.id))
            ? 'Going'
            : "I'm Going"
        }
        actionActive={Boolean(
          selectedEvent && savedEventIds.includes(String(selectedEvent.id))
        )}
        onClose={() => setSelectedEvent(null)}
        onActionPress={() => {
          if (!selectedEvent) return;
          void toggleSaveEvent(String(selectedEvent.id));
        }}
      />
    </AppScreen>
  );
}

type ChipProps = {
  label: string;
  active?: boolean;
  hasChevron?: boolean;
  chevronOpen?: boolean;
  onPress: () => void;
};
function Chip({ label, active, hasChevron, chevronOpen, onPress }: ChipProps) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}>
      <Text
        style={[styles.chipText, active && styles.chipTextActive]}
        numberOfLines={1}>
        {label}
      </Text>
      {hasChevron ? (
        <Ionicons
          name={chevronOpen ? 'chevron-down' : 'chevron-forward'}
          size={11}
          color={active ? '#000000' : 'rgba(255,255,255,0.75)'}
          style={{ marginLeft: 4 }}
        />
      ) : null}
    </Pressable>
  );
}

type DropdownItemProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};
function DropdownItem({ label, active, onPress }: DropdownItemProps) {
  return (
    <Pressable style={styles.dropdownItem} onPress={onPress}>
      <Text
        style={[
          styles.dropdownItemText,
          active && styles.dropdownItemTextActive,
        ]}>
        {label}
      </Text>
      {active ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#050506',
  } as ViewStyle,
  stickyHeader: {
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#050506',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    zIndex: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  searchAdjust: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  chipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  chipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#000000',
  },
  dropdown: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#0b0b0d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  dropdownItemText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownItemTextActive: {
    color: '#ffffff',
  },
  gridContent: {
    paddingTop: TILE_GAP,
    paddingBottom: 120,
  },
  tileTypeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tileViewOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tileViewText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  eventTitleStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  eventTitleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  emptyState: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCopy: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  globeButton: {
    position: 'absolute',
    right: 18,
    bottom: 96,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,15,18,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
});
