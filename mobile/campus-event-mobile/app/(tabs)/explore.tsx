import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { EventListCard } from '@/components/mobile/EventListCard';
import { PersonRowCard } from '@/components/mobile/PersonRowCard';
import { useAppTheme } from '@/lib/app-theme';
import { useMobileApp } from '@/providers/mobile-app-provider';

type ExploreFilter = 'all' | 'events' | 'people';

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
  const [activeFilter, setActiveFilter] = useState<ExploreFilter>('all');

  const normalizedQuery = query.trim().toLowerCase();

  const peopleResults = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          profile.id !== currentUser.id &&
          `${profile.name} ${profile.username} ${profile.bio}`.toLowerCase().includes(normalizedQuery)
      ),
    [currentUser.id, normalizedQuery, profiles]
  );

  const eventResults = useMemo(
    () =>
      events.filter((event) =>
        `${event.title} ${event.description} ${event.locationName} ${event.tags.join(' ')}`.toLowerCase().includes(normalizedQuery)
      ),
    [events, normalizedQuery]
  );

  const filters: ExploreFilter[] = ['all', 'events', 'people'];

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

        <View style={styles.chipsRow}>
          {filters.map((filter) => {
            const active = activeFilter === filter;

            return (
              <Pressable
                key={filter}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveFilter(filter)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {filter === 'all' ? 'All' : filter === 'events' ? 'Events' : 'People'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {(activeFilter === 'all' || activeFilter === 'events') && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suggested Events</Text>
              <Text style={styles.sectionCount}>{eventResults.length}</Text>
            </View>

            {eventResults.map((event) => (
              <EventListCard
                key={event.id}
                event={event}
                actionLabel={savedEventIds.includes(event.id) ? 'Saved' : 'Add'}
                actionTone={savedEventIds.includes(event.id) ? 'success' : 'accent'}
                onPress={() =>
                  router.push({
                    pathname: '/event/[id]',
                    params: { id: event.id },
                  })
                }
                onActionPress={() => toggleSaveEvent(event.id)}
              />
            ))}
          </View>
        )}

        {(activeFilter === 'all' || activeFilter === 'people') && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suggested People</Text>
              <Text style={styles.sectionCount}>{peopleResults.length}</Text>
            </View>

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
                  isFollowingProfile(profile.id) ? unfollowProfile(profile.id) : followProfile(profile.id)
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    scrollContent: {
      padding: 18,
      gap: 18,
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
    chipsRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    chipText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    chipTextActive: {
      color: theme.background,
    },
    section: {
      gap: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    sectionCount: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
  });
