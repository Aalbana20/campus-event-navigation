import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { EventListCard } from '@/components/mobile/EventListCard';
import { ProfileAvatarLink } from '@/components/mobile/ProfileAvatarLink';
import { useAppTheme } from '@/lib/app-theme';
import {
  loadDiscoverPosts,
  type DiscoverPostRecord,
} from '@/lib/mobile-discover-posts';
import { openMobileProfile } from '@/lib/mobile-profile-navigation';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { EventRecord, ProfileRecord } from '@/types/models';

type SearchResultsTab = 'for-you' | 'profiles' | 'events' | 'places';

const RESULT_TABS: { id: SearchResultsTab; label: string }[] = [
  { id: 'for-you', label: 'For You' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'events', label: 'Events' },
  { id: 'places', label: 'Places' },
];

const normalize = (value: string) => value.trim().toLowerCase();

const includesQuery = (values: (string | null | undefined)[], query: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return false;
  return values.filter(Boolean).some((value) => normalize(String(value)).includes(normalizedQuery));
};

const profileMatchesQuery = (profile: ProfileRecord, query: string) =>
  includesQuery(
    [profile.username, profile.name, profile.bio, profile.school, profile.organizationName],
    query
  );

const eventMatchesQuery = (event: EventRecord, query: string) =>
  includesQuery(
    [
      event.title,
      event.description,
      event.locationName,
      event.location,
      event.host,
      event.organizer,
      ...(event.tags || []),
    ],
    query
  );

const postMatchesQuery = (post: DiscoverPostRecord, query: string) =>
  includesQuery([post.caption, post.authorName, post.authorUsername], query);

const getPostImage = (post: DiscoverPostRecord) =>
  post.thumbnailUrl || post.mediaUrl;

const formatCount = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10}K`;
  return String(value);
};

export default function SearchResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { currentUser, events, profiles } = useMobileApp();
  const [activeTab, setActiveTab] = useState<SearchResultsTab>('for-you');
  const [query, setQuery] = useState(String(params.q || ''));
  const [posts, setPosts] = useState<DiscoverPostRecord[]>([]);

  const cleanQuery = query.trim();

  useEffect(() => {
    let cancelled = false;
    void loadDiscoverPosts({
      currentUserId: currentUser.id,
      onData: (nextPosts) => {
        if (!cancelled) setPosts(nextPosts);
      },
    }).then((nextPosts) => {
      if (!cancelled) setPosts(nextPosts);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const matchingProfiles = useMemo(
    () =>
      profiles
        .filter((profile) => profileMatchesQuery(profile, cleanQuery))
        .filter((profile) => profile.id !== currentUser.id),
    [cleanQuery, currentUser.id, profiles]
  );

  const matchingEvents = useMemo(
    () => events.filter((event) => eventMatchesQuery(event, cleanQuery)),
    [cleanQuery, events]
  );

  const matchingPosts = useMemo(
    () => posts.filter((post) => postMatchesQuery(post, cleanQuery)),
    [cleanQuery, posts]
  );

  const places = useMemo(
    () =>
      [...new Set(matchingEvents.map((event) => event.locationName || event.location).filter(Boolean))]
        .slice(0, 12),
    [matchingEvents]
  );

  const submitSearch = () => {
    if (!cleanQuery) return;
    router.setParams({ q: cleanQuery });
  };

  const openProfile = (profile: ProfileRecord) => {
    openMobileProfile({ router, currentUser, profile });
  };

  const renderProfileRow = (profile: ProfileRecord) => (
    <Pressable
      key={profile.id}
      style={styles.profileRow}
      onPress={() => openProfile(profile)}
      accessibilityRole="button">
      <ProfileAvatarLink profile={profile} style={styles.avatar} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {profile.username || profile.name}
        </Text>
        {profile.school || profile.organizationName || profile.bio ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {profile.school || profile.organizationName || profile.bio}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  const renderForYou = () => (
    <View style={styles.grid}>
      {matchingPosts.length > 0 ? (
        matchingPosts.map((post) => (
          <Pressable key={post.id} style={styles.gridTile} accessibilityRole="button">
            <Image source={{ uri: getPostImage(post) }} style={styles.gridImage} />
            <View style={styles.gridOverlay}>
              <Ionicons
                name={post.mediaType === 'video' ? 'play' : 'images-outline'}
                size={14}
                color="#fff"
              />
              <Text style={styles.gridCount}>
                {formatCount(Math.max(post.likeCount + post.commentCount, 1))}
              </Text>
            </View>
          </Pressable>
        ))
      ) : (
        <Text style={styles.emptyCopy}>Posts and videos matching this search will appear here.</Text>
      )}
    </View>
  );

  const renderEvents = () => (
    <View style={styles.eventsList}>
      {matchingEvents.length > 0 ? (
        matchingEvents.map((event) => (
          <EventListCard
            key={event.id}
            event={event}
            onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
          />
        ))
      ) : (
        <Text style={styles.emptyCopy}>Events matching this search will appear here.</Text>
      )}
    </View>
  );

  const renderPlaces = () => (
    <View style={styles.placesList}>
      {places.length > 0 ? (
        places.map((place) => (
          <View key={place} style={styles.placeRow}>
            <View style={styles.placeIcon}>
              <Ionicons name="location-outline" size={20} color={theme.text} />
            </View>
            <Text style={styles.rowTitle}>{place}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyCopy}>Places related to this search will appear here.</Text>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Back"
          accessibilityRole="button">
          <Ionicons name="chevron-back" size={34} color={theme.text} />
        </Pressable>
        <View style={styles.searchPill}>
          <Ionicons name="search-outline" size={22} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder="Search"
            placeholderTextColor={theme.textMuted}
            selectionColor={theme.accent}
            style={styles.searchInput}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}>
        {RESULT_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={styles.resultTab}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}>
              <Text style={[styles.resultTabText, isActive && styles.resultTabTextActive]}>
                {tab.label}
              </Text>
              <View style={[styles.resultUnderline, isActive && styles.resultUnderlineActive]} />
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'for-you' ? renderForYou() : null}
        {activeTab === 'profiles' ? (
          <View style={styles.profileList}>
            {matchingProfiles.length > 0
              ? matchingProfiles.map((profile) => renderProfileRow(profile))
              : <Text style={styles.emptyCopy}>Profiles matching this search will appear here.</Text>}
          </View>
        ) : null}
        {activeTab === 'events' ? renderEvents() : null}
        {activeTab === 'places' ? renderPlaces() : null}
      </ScrollView>
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: '#05080c',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 58,
      paddingBottom: 12,
    },
    backButton: {
      width: 42,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchPill: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 999,
      paddingHorizontal: 16,
      backgroundColor: '#242930',
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 18,
      fontWeight: '500',
      paddingVertical: 0,
    },
    tabRow: {
      minHeight: 52,
      alignItems: 'flex-end',
      gap: 34,
      paddingHorizontal: 18,
    },
    resultTab: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 9,
    },
    resultTabText: {
      color: theme.textMuted,
      fontSize: 16,
      fontWeight: '800',
    },
    resultTabTextActive: {
      color: theme.text,
    },
    resultUnderline: {
      width: '100%',
      height: 3,
      borderRadius: 999,
      backgroundColor: 'transparent',
    },
    resultUnderlineActive: {
      backgroundColor: theme.text,
    },
    content: {
      paddingBottom: 42,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2,
    },
    gridTile: {
      width: '49.75%',
      aspectRatio: 0.78,
      overflow: 'hidden',
      backgroundColor: theme.surface,
    },
    gridImage: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.surfaceAlt,
    },
    gridOverlay: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    gridCount: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
    },
    profileList: {
      paddingHorizontal: 18,
      paddingTop: 18,
      gap: 14,
    },
    profileRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: theme.surfaceAlt,
    },
    rowCopy: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    rowSubtitle: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 20,
      marginTop: 2,
    },
    eventsList: {
      paddingHorizontal: 14,
      paddingTop: 16,
      gap: 12,
    },
    placesList: {
      paddingHorizontal: 18,
      paddingTop: 18,
      gap: 16,
    },
    placeRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    placeIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '700',
      paddingHorizontal: 18,
      paddingTop: 18,
    },
  });
