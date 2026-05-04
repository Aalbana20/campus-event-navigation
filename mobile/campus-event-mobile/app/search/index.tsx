import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ProfileAvatarLink } from '@/components/mobile/ProfileAvatarLink';
import { useAppTheme } from '@/lib/app-theme';
import { openMobileProfile } from '@/lib/mobile-profile-navigation';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { ProfileRecord } from '@/types/models';

const RECENT_SEARCHES_KEY = 'discover-search:recent';

const normalize = (value: string) => value.trim().toLowerCase();

const profileMatchesQuery = (profile: ProfileRecord, query: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return false;

  return [profile.username, profile.name, profile.bio, profile.school, profile.organizationName]
    .filter(Boolean)
    .some((value) => normalize(String(value)).includes(normalizedQuery));
};

const getProfileSubtitle = (profile: ProfileRecord) =>
  profile.school || profile.organizationName || profile.bio || '';

export default function SearchScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { currentUser, events, profiles } = useMobileApp();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const cleanQuery = query.trim();

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(RECENT_SEARCHES_KEY).then((stored) => {
      if (!mounted || !stored) return;
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((item) => typeof item === 'string').slice(0, 8));
        }
      } catch {
        setRecentSearches([]);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const suggestedSearches = useMemo(() => {
    const tags = events.flatMap((event) => event.tags || []);
    const locations = events.map((event) => event.locationName || event.location).filter(Boolean);
    return [...new Set([...tags, ...locations])]
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 6);
  }, [events]);

  const matchingProfiles = useMemo(
    () =>
      profiles
        .filter((profile) => profileMatchesQuery(profile, cleanQuery))
        .filter((profile) => profile.id !== currentUser.id)
        .slice(0, 12),
    [cleanQuery, currentUser.id, profiles]
  );

  const submitSearch = (nextQuery = cleanQuery) => {
    const submitted = nextQuery.trim();
    if (!submitted) return;
    setRecentSearches((current) => {
      const next = [submitted, ...current.filter((item) => normalize(item) !== normalize(submitted))]
        .slice(0, 8);
      void AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
    router.push({ pathname: '/search/results', params: { q: submitted } });
  };

  const removeRecentSearch = (term: string) => {
    setRecentSearches((current) => {
      const next = current.filter((item) => item !== term);
      void AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const openProfile = (profile: ProfileRecord) => {
    openMobileProfile({ router, currentUser, profile });
  };

  const renderProfileRow = (profile: ProfileRecord, trailing?: React.ReactNode) => (
    <Pressable
      key={profile.id}
      style={styles.searchRow}
      onPress={() => openProfile(profile)}
      accessibilityRole="button">
      <ProfileAvatarLink profile={profile} style={styles.avatar} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {profile.username || profile.name}
        </Text>
        {getProfileSubtitle(profile) ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {getProfileSubtitle(profile)}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.searchHeader}>
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
            autoFocus
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => submitSearch()}
            returnKeyType="search"
            placeholder="Search"
            placeholderTextColor={theme.textMuted}
            selectionColor={theme.accent}
            style={styles.searchInput}
          />
          {cleanQuery ? (
            <Pressable
              style={styles.clearButton}
              onPress={() => setQuery('')}
              accessibilityLabel="Clear search"
              accessibilityRole="button">
              <Ionicons name="close-circle" size={20} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {!cleanQuery ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent</Text>
              {recentSearches.length > 0 ? (
                recentSearches.map((term) => {
                  const matchingProfile = profiles.find(
                    (profile) => normalize(profile.username) === normalize(term)
                  );

                  return matchingProfile ? (
                    renderProfileRow(
                      matchingProfile,
                      <Pressable
                        style={styles.removeButton}
                        onPress={(event) => {
                          event.stopPropagation();
                          removeRecentSearch(term);
                        }}
                        accessibilityLabel={`Remove ${term} from recent searches`}
                        accessibilityRole="button">
                        <Ionicons name="close-outline" size={24} color={theme.textMuted} />
                      </Pressable>
                    )
                  ) : (
                    <Pressable
                      key={term}
                      style={styles.searchRow}
                      onPress={() => submitSearch(term)}
                      accessibilityRole="button">
                      <View style={styles.topicIcon}>
                        <Ionicons name="time-outline" size={22} color={theme.text} />
                      </View>
                      <Text style={styles.suggestionText} numberOfLines={1}>
                        {term}
                      </Text>
                      <Pressable
                        style={styles.removeButton}
                        onPress={(event) => {
                          event.stopPropagation();
                          removeRecentSearch(term);
                        }}
                        accessibilityLabel={`Remove ${term} from recent searches`}
                        accessibilityRole="button">
                        <Ionicons name="close-outline" size={24} color={theme.textMuted} />
                      </Pressable>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.emptyCopy}>No recent searches yet.</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suggested</Text>
              {suggestedSearches.length > 0 ? (
                suggestedSearches.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    style={styles.searchRow}
                    onPress={() => submitSearch(suggestion)}
                    accessibilityRole="button">
                    <View style={styles.topicIcon}>
                      <Ionicons name="search-outline" size={22} color={theme.text} />
                    </View>
                    <Text style={styles.suggestionText} numberOfLines={1}>
                      {suggestion}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.emptyCopy}>Suggested searches will appear here.</Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.section}>
            {cleanQuery.length >= 3 ? (
              <Pressable
                style={styles.topicRow}
                onPress={() => submitSearch()}
                accessibilityRole="button">
                <View style={styles.topicIcon}>
                  <Ionicons name="search-outline" size={23} color={theme.text} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.topicTitle}>{cleanQuery}</Text>
                  <Text style={styles.rowSubtitle}>Search topic</Text>
                </View>
              </Pressable>
            ) : null}

            {matchingProfiles.length > 0 ? (
              matchingProfiles.map((profile) => renderProfileRow(profile))
            ) : (
              <Text style={styles.emptyCopy}>No matching profiles yet.</Text>
            )}
          </View>
        )}
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
    searchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 58,
      paddingBottom: 14,
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
    clearButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: 18,
      paddingBottom: 48,
      gap: 28,
    },
    section: {
      gap: 14,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 4,
    },
    searchRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    topicRow: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 2,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: theme.surfaceAlt,
    },
    topicIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      backgroundColor: 'rgba(255,255,255,0.04)',
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
    topicTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
    },
    rowSubtitle: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 20,
      marginTop: 2,
    },
    suggestionText: {
      flex: 1,
      color: theme.text,
      fontSize: 17,
      fontWeight: '500',
    },
    removeButton: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
    },
  });
