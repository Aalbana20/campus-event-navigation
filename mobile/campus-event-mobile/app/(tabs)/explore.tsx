import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { ProfileRecord } from '@/types/models';

import { AppScreen } from '@/components/mobile/AppScreen';
import { ExploreEventDetailModal } from '@/components/mobile/ExploreEventDetailModal';
import { ExploreEventTile } from '@/components/mobile/ExploreEventTile';
import { PersonRowCard } from '@/components/mobile/PersonRowCard';
import { useAppTheme } from '@/lib/app-theme';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { EventRecord } from '@/types/models';

const includesAny = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

const getEventSearchFields = (event: EventRecord) =>
  [
    event.title,
    event.description,
    event.location,
    event.locationName,
    event.locationAddress,
    event.organizer,
    ...event.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const sortEventsByMomentum = (events: EventRecord[]) =>
  [...events].sort((left, right) => {
    const rightScore = Number(right.goingCount || 0) + right.repostedByIds.length * 3;
    const leftScore = Number(left.goingCount || 0) + left.repostedByIds.length * 3;
    return rightScore - leftScore;
  });

const SECTION_DEFINITIONS = [
  {
    id: 'discover',
    eyebrow: 'Featured',
    title: 'Discover',
    note: 'Strong campus picks with the most energy right now.',
    select: (events: EventRecord[]) => sortEventsByMomentum(events),
  },
  {
    id: 'nearby',
    eyebrow: 'Local',
    title: 'Nearby',
    note: 'Plans happening around campus and close by.',
    select: (events: EventRecord[]) => {
      const nearbyMatches = events.filter((event) =>
        includesAny(getEventSearchFields(event), [
          'princess anne',
          'campus',
          'student center',
          'quad',
          'arena',
          'library',
          'arts',
          'center',
        ])
      );

      return nearbyMatches.length > 0 ? sortEventsByMomentum(nearbyMatches) : sortEventsByMomentum(events);
    },
  },
  {
    id: 'sports',
    eyebrow: 'Energy',
    title: 'Sports',
    note: 'Games, wellness plans, and competitive nights.',
    select: (events: EventRecord[]) =>
      sortEventsByMomentum(
        events.filter((event) =>
          includesAny(getEventSearchFields(event), [
            'sports',
            'game',
            'basketball',
            'football',
            'soccer',
            'run',
            'wellness',
            'athletic',
          ])
        )
      ),
  },
  {
    id: 'movies',
    eyebrow: 'Watch',
    title: 'Movies & Film',
    note: 'Screenings, film nights, and cozy watch plans.',
    select: (events: EventRecord[]) =>
      sortEventsByMomentum(
        events.filter((event) =>
          includesAny(getEventSearchFields(event), [
            'movie',
            'film',
            'screening',
            'cinema',
            'watch',
          ])
        )
      ),
  },
  {
    id: 'creative',
    eyebrow: 'Creative',
    title: 'Music & Arts',
    note: 'Open mics, showcases, concerts, and art-forward hangs.',
    select: (events: EventRecord[]) =>
      sortEventsByMomentum(
        events.filter((event) =>
          includesAny(getEventSearchFields(event), [
            'music',
            'concert',
            'creative',
            'arts',
            'art',
            'open mic',
            'poetry',
            'showcase',
          ])
        )
      ),
  },
  {
    id: 'social',
    eyebrow: 'Social',
    title: 'Parties & Mixers',
    note: 'Social plans for meeting people outside your usual circle.',
    select: (events: EventRecord[]) =>
      sortEventsByMomentum(
        events.filter((event) =>
          includesAny(getEventSearchFields(event), [
            'party',
            'social',
            'nightlife',
            'mixer',
            'brunch',
            'rooftop',
            'afterparty',
          ])
        )
      ),
  },
  {
    id: 'networking',
    eyebrow: 'Connect',
    title: 'Networking',
    note: 'Career-minded and community-building events.',
    select: (events: EventRecord[]) =>
      sortEventsByMomentum(
        events.filter((event) =>
          includesAny(getEventSearchFields(event), [
            'networking',
            'career',
            'founder',
            'startup',
            'professional',
            'mixer',
            'community',
          ])
        )
      ),
  },
];

const buildExploreSections = (events: EventRecord[], limit = 4) => {
  const seen = new Set<string>();

  return SECTION_DEFINITIONS.map((section) => {
    const items = section
      .select(events)
      .filter((event) => {
        const key = String(event.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);

    return {
      ...section,
      items,
    };
  }).filter((section) => section.items.length > 0);
};

export default function ExploreScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const {
    currentUser,
    profiles,
    events,
    savedEventIds,
    toggleSaveEvent,
    isFollowingProfile,
    followProfile,
    unfollowProfile,
  } = useMobileApp();
  const [query, setQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const savedEventIdSet = useMemo(() => new Set(savedEventIds), [savedEventIds]);

  useEffect(() => {
    setSelectedEvent(null);
  }, [normalizedQuery]);

  const discoverableEvents = useMemo(
    () =>
      sortEventsByMomentum(
        events.filter((event) => !event.isPrivate && event.createdBy !== currentUser.id)
      ),
    [currentUser.id, events]
  );

  const peoplePool = useMemo(
    () => profiles.filter((profile) => profile.id !== currentUser.id),
    [currentUser.id, profiles]
  );

  const suggestedPeople = useMemo(
    () =>
      [...peoplePool]
        .sort((left, right) => Number(isFollowingProfile(left.id)) - Number(isFollowingProfile(right.id)))
        .slice(0, 4),
    [isFollowingProfile, peoplePool]
  );

  const eventResults = useMemo(
    () =>
      normalizedQuery
        ? discoverableEvents.filter((event) => getEventSearchFields(event).includes(normalizedQuery))
        : [],
    [discoverableEvents, normalizedQuery]
  );

  const [remoteProfileResults, setRemoteProfileResults] = useState<ProfileRecord[]>([]);

  useEffect(() => {
    if (!normalizedQuery || !supabase) {
      setRemoteProfileResults([]);
      return;
    }

    const client = supabase;
    const timer = setTimeout(async () => {
      const { data } = await client
        .from('profiles')
        .select('id, name, username, bio, avatar_url')
        .or(`name.ilike.%${normalizedQuery}%,username.ilike.%${normalizedQuery}%`)
        .neq('id', currentUser.id)
        .limit(20);

      if (data) {
        setRemoteProfileResults(
          data.map((row) => ({
            id: String(row.id),
            name: String(row.name || row.username || 'Campus User'),
            username: String(row.username || ''),
            bio: String(row.bio || ''),
            avatar: String(row.avatar_url || ''),
            interests: [],
          }))
        );
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [normalizedQuery, currentUser.id]);

  const peopleResults = remoteProfileResults;

  const curatedSections = useMemo(
    () => buildExploreSections(discoverableEvents),
    [discoverableEvents]
  );

  const renderTileGrid = (items: EventRecord[]) => (
    <View style={styles.tilesGrid}>
      {items.map((event) => (
        <ExploreEventTile key={event.id} event={event} onPress={() => setSelectedEvent(event)} />
      ))}
    </View>
  );

  const selectedEventActionLabel = selectedEvent
    ? savedEventIdSet.has(selectedEvent.id)
      ? 'Saved'
      : 'Add Event'
    : 'Add Event';

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search events or people"
          placeholderTextColor={theme.textMuted}
          style={styles.searchInput}
        />

        <Text style={styles.searchCaption}>
          Browse a denser grid first, then open any tile to see the full event details.
        </Text>

        {normalizedQuery ? (
          <View style={styles.feed}>
            <View style={styles.resultsIntro}>
              <Text style={styles.sectionEyebrow}>Results</Text>
              <Text style={styles.sectionTitle}>Search Results</Text>
              <Text style={styles.sectionNote}>
                Matching events and people for &quot;{query.trim()}&quot;
              </Text>
            </View>

            <View style={styles.sectionShell}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>Events</Text>
                <Text style={styles.sectionTitle}>Matching Events</Text>
                <Text style={styles.sectionNote}>{eventResults.length} found</Text>
              </View>

              {eventResults.length > 0 ? (
                renderTileGrid(eventResults)
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No matching events yet.</Text>
                  <Text style={styles.emptyCopy}>Try a different word or browse the discovery feed below.</Text>
                </View>
              )}
            </View>

            <View style={styles.sectionShell}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>People</Text>
                <Text style={styles.sectionTitle}>Matching People</Text>
                <Text style={styles.sectionNote}>{peopleResults.length} found</Text>
              </View>

              {peopleResults.length > 0 ? (
                <View style={styles.peopleCards}>
                  {peopleResults.map((profile) => (
                    <PersonRowCard
                      key={profile.id}
                      profile={profile}
                      actionLabel={isFollowingProfile(profile.id) ? 'Following' : 'Follow'}
                      onPress={() =>
                        router.push({
                          pathname: '/profile/[username]',
                          params: { username: profile.username },
                        })
                      }
                      onActionPress={() =>
                        isFollowingProfile(profile.id)
                          ? unfollowProfile(profile.id)
                          : followProfile(profile.id)
                      }
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No matching people yet.</Text>
                  <Text style={styles.emptyCopy}>Try another search or keep scrolling for suggested people.</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.feed}>
            {curatedSections.map((section) => (
              <View key={section.id} style={styles.sectionShell}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEyebrow}>{section.eyebrow}</Text>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionNote}>{section.note}</Text>
                </View>

                {renderTileGrid(section.items)}
              </View>
            ))}

            <View style={styles.sectionShell}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>People</Text>
                <Text style={styles.sectionTitle}>People to Follow</Text>
                <Text style={styles.sectionNote}>
                  Profiles that can lead you to your next favorite plan.
                </Text>
              </View>

              <View style={styles.peopleCards}>
                {suggestedPeople.map((profile) => (
                  <PersonRowCard
                    key={profile.id}
                    profile={profile}
                    actionLabel={isFollowingProfile(profile.id) ? 'Following' : 'Follow'}
                    onPress={() =>
                      router.push({
                        pathname: '/profile/[username]',
                        params: { username: profile.username },
                      })
                    }
                    onActionPress={() =>
                      isFollowingProfile(profile.id)
                        ? unfollowProfile(profile.id)
                        : followProfile(profile.id)
                    }
                  />
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <ExploreEventDetailModal
        event={selectedEvent}
        visible={Boolean(selectedEvent)}
        actionLabel={selectedEventActionLabel}
        actionActive={Boolean(selectedEvent && savedEventIdSet.has(selectedEvent.id))}
        onClose={() => setSelectedEvent(null)}
        onActionPress={() => {
          if (!selectedEvent || savedEventIdSet.has(selectedEvent.id)) return;
          toggleSaveEvent(selectedEvent.id);
        }}
      />
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    scrollContent: {
      padding: 18,
      gap: 14,
      paddingBottom: 120,
    },
    searchInput: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingVertical: 15,
      color: theme.text,
      fontSize: 15,
    },
    searchCaption: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    feed: {
      gap: 22,
    },
    resultsIntro: {
      gap: 4,
    },
    sectionShell: {
      gap: 12,
    },
    sectionHeader: {
      gap: 4,
    },
    sectionEyebrow: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
    },
    sectionNote: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    tilesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 12,
    },
    peopleCards: {
      gap: 12,
    },
    emptyState: {
      padding: 18,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
