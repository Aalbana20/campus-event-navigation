import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlobalCreateMenu, type GlobalCreateOptionKey } from '@/components/mobile/GlobalCreateMenu';
import { useAppTheme } from '@/lib/app-theme';
import { getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useMobileInbox } from '@/providers/mobile-inbox-provider';
import type { EventRecord } from '@/types/models';

import DiscoverScreen from './Discover';
import EventsScreen from './events';

type HomeView = 'events' | 'calendar' | 'friends' | 'explore';

const HOME_VIEWS: { id: HomeView; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'friends', label: 'Friends' },
  { id: 'explore', label: 'Explore' },
];

const HOME_VIEW_ORDER: HomeView[] = ['events', 'calendar', 'friends', 'explore'];

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { unreadNotificationCount } = useMobileInbox();
  const { currentUser, events, followingProfiles, savedEventIds } = useMobileApp();
  const [activeView, setActiveView] = useState<HomeView>('events');
  const calendarSearchSignal = 0;
  const [isCreateMenuVisible, setIsCreateMenuVisible] = useState(false);
  const [exploreSearch, setExploreSearch] = useState('');

  const followingIds = useMemo(
    () => new Set(followingProfiles.map((profile) => String(profile.id))),
    [followingProfiles]
  );
  const currentUserId = String(currentUser.id || '');
  const savedIdSet = useMemo(() => new Set(savedEventIds.map(String)), [savedEventIds]);

  const friendGoingEvents = useMemo(
    () =>
      events.filter((event) => {
        const attendees = event.attendees || [];
        const hasFriendGoing = attendees.some((attendeeId) => followingIds.has(String(attendeeId)));
        const userCommitted = attendees.includes(currentUserId);
        return hasFriendGoing && !userCommitted && !savedIdSet.has(String(event.id));
      }),
    [currentUserId, events, followingIds, savedIdSet]
  );

  const friendHostedEvents = useMemo(
    () => events.filter((event) => followingIds.has(String(event.createdBy))),
    [events, followingIds]
  );

  const trendingEvents = useMemo(
    () => [...events].sort((a, b) => (b.goingCount || 0) - (a.goingCount || 0)).slice(0, 4),
    [events]
  );

  const nearbyEvents = useMemo(
    () =>
      events
        .filter((event) =>
          [event.location, event.locationName, event.locationAddress]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .match(/campus|quad|hall|center|umes|princess anne|maryland/)
        )
        .slice(0, 6),
    [events]
  );

  const thisWeekEvents = useMemo(() => {
    const today = new Date();
    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);

    return events
      .filter((event) => {
        const parsedDate = Date.parse(event.eventDate || event.date || '');
        return Number.isFinite(parsedDate) && parsedDate >= today.getTime() && parsedDate <= weekFromNow.getTime();
      })
      .slice(0, 5);
  }, [events]);

  const searchedExploreEvents = useMemo(() => {
    const query = exploreSearch.trim().toLowerCase();
    if (!query) return null;

    return events
      .filter((event) =>
        [event.title, event.locationName, event.location, event.description, ...(event.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 6);
  }, [events, exploreSearch]);

  const handleOpenCreate = useCallback(() => {
    setIsCreateMenuVisible(true);
  }, []);

  const handleCreateOption = useCallback((option: GlobalCreateOptionKey) => {
    setIsCreateMenuVisible(false);

    if (option === 'post') {
      router.push({ pathname: '/story/create', params: { mode: 'post' } });
      return;
    }

    if (option === 'story') {
      router.push({ pathname: '/story/create', params: { mode: 'story' } });
      return;
    }

    router.push('/create-event');
  }, [router]);

  const handleOpenNotifications = useCallback(() => {
    router.push('/inbox');
  }, [router]);

  const handleTabPress = useCallback((viewId: HomeView) => {
    setActiveView((currentView) => {
      if (viewId !== currentView) return viewId;

      const currentIndex = HOME_VIEW_ORDER.indexOf(currentView);
      return HOME_VIEW_ORDER[currentIndex + 1] ?? currentView;
    });
  }, []);

  const openEvent = useCallback(
    (event: EventRecord) => {
      router.push({
        pathname: '/event/[id]',
        params: { id: event.id },
      });
    },
    [router]
  );

  const renderMiniEventCard = useCallback(
    (event: EventRecord, variant: 'wide' | 'compact' = 'compact') => (
      <Pressable
        key={event.id}
        style={variant === 'wide' ? styles.wideEventCard : styles.miniEventCard}
        onPress={() => openEvent(event)}>
        <Image source={getEventImageSource(event.image)} style={styles.miniEventImage} />
        <View style={styles.miniEventScrim} />
        <View style={styles.miniEventBookmark}>
          <Ionicons name="bookmark-outline" size={17} color="#ffffff" />
        </View>
        <View style={styles.miniEventCopy}>
          <Text style={styles.miniEventTitle} numberOfLines={variant === 'wide' ? 1 : 2}>
            {event.title}
          </Text>
          <Text style={styles.miniEventMeta} numberOfLines={1}>
            {[event.date, event.time].filter(Boolean).join(' • ')}
          </Text>
          <Text style={styles.miniEventMeta} numberOfLines={1}>
            <Ionicons name="location" size={11} color="rgba(255,255,255,0.72)" />{' '}
            {event.locationName || event.location || 'Campus'}
          </Text>
        </View>
      </Pressable>
    ),
    [openEvent, styles.miniEventBookmark, styles.miniEventCard, styles.miniEventCopy, styles.miniEventImage, styles.miniEventMeta, styles.miniEventScrim, styles.miniEventTitle, styles.wideEventCard]
  );

  const renderEventSection = useCallback(
    (title: string, sectionEvents: EventRecord[], variant: 'wide' | 'compact' = 'compact') => {
      const visibleEvents = sectionEvents.length > 0 ? sectionEvents : events.slice(0, variant === 'wide' ? 2 : 4);

      return (
        <View style={styles.exploreSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionLink}>See all</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalCards}>
            {visibleEvents.map((event) => renderMiniEventCard(event, variant))}
          </ScrollView>
        </View>
      );
    },
    [events, renderMiniEventCard, styles.exploreSection, styles.horizontalCards, styles.sectionHeaderRow, styles.sectionLink, styles.sectionTitle]
  );

  const renderFriendsView = () => {
    const recentActivityEvents = [...friendGoingEvents, ...friendHostedEvents].slice(0, 3);

    return (
      <ScrollView
        style={styles.panelScroll}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.friendSection}>
          <Text style={styles.sectionTitle}>Go With Friends</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
            {(friendGoingEvents.length > 0 ? friendGoingEvents : events.slice(0, 4)).map((event) =>
              renderMiniEventCard(event)
            )}
          </ScrollView>
        </View>

        <View style={styles.friendSection}>
          <Text style={styles.sectionTitle}>Hosted by Friends</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
            {(friendHostedEvents.length > 0 ? friendHostedEvents : events.slice(0, 4)).map((event) =>
              renderMiniEventCard(event)
            )}
          </ScrollView>
        </View>

        <View style={styles.friendSection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {(recentActivityEvents.length > 0 ? recentActivityEvents : events.slice(0, 2)).map((event) => (
            <View key={`activity-${event.id}`} style={styles.activityRow}>
              <View style={styles.activityIcon}>
                <Ionicons name="people-outline" size={18} color={theme.accent} />
              </View>
              <View style={styles.friendEventCopy}>
                <Text style={styles.friendEventTitle} numberOfLines={1}>{event.title}</Text>
                <Text style={styles.friendEventMeta} numberOfLines={1}>
                  {recentActivityEvents.length > 0 ? 'Friend activity from event data' : 'Placeholder activity'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.friendSection}>
          <Text style={styles.sectionTitle}>Group Planning</Text>
          {['Pick a meetup time', 'Start a group chat', 'Vote on where to go'].map((label, index) => (
            <View key={label} style={styles.planningRow}>
              <View style={styles.planningNumber}>
                <Text style={styles.planningNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.planningText}>{label}</Text>
              <Ionicons name="add-circle-outline" size={20} color={theme.textMuted} />
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderExploreView = () => (
    <ScrollView
      style={styles.panelScroll}
      contentContainerStyle={styles.panelContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={21} color={theme.textMuted} />
        <TextInput
          value={exploreSearch}
          onChangeText={setExploreSearch}
          placeholder="Search events, places, or interests"
          placeholderTextColor={theme.textMuted}
          style={styles.searchInput}
        />
      </View>

      {searchedExploreEvents ? renderEventSection('Search Results', searchedExploreEvents, 'wide') : null}
      {renderEventSection('Trending Now', trendingEvents, 'wide')}
      {renderEventSection('Nearby', nearbyEvents)}
      {renderEventSection('This Week', thisWeekEvents, 'wide')}

      <View style={styles.exploreSection}>
        <Text style={styles.sectionTitle}>Popular Categories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}>
          {[
            ['musical-notes', 'Music'],
            ['basketball', 'Sports'],
            ['color-palette', 'Art'],
            ['fast-food', 'Food'],
            ['game-controller', 'Games'],
          ].map(([icon, label]) => (
            <Pressable key={label} style={styles.categoryChip}>
              <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={17} color={theme.accent} />
              <Text style={styles.categoryText}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.toggleBar, { paddingTop: Math.max(insets.top - 2, 0) }]}>
        <View style={styles.topBarRow}>
          <View style={styles.topActionSlot}>
            <Pressable style={styles.topActionButton} onPress={handleOpenCreate}>
              <Ionicons name="add-outline" size={25} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.headerSwitch}>
            {HOME_VIEWS.map((view, index) => {
              const isActive = activeView === view.id;
              return (
                <React.Fragment key={view.id}>
                  <Pressable
                    style={styles.headerSwitchOption}
                    onPress={() => handleTabPress(view.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}>
                    <Text style={[styles.headerSwitchText, isActive && styles.headerSwitchTextActive]}>
                      {view.label}
                    </Text>
                  </Pressable>
                  {index < HOME_VIEWS.length - 1 ? <Text style={styles.headerSwitchSeparator}>|</Text> : null}
                </React.Fragment>
              );
            })}
          </View>

          <View style={[styles.topActionSlot, styles.topActionSlotRight]}>
            <Pressable style={styles.topActionButton} onPress={handleOpenNotifications}>
              <Ionicons name="notifications-outline" size={23} color={theme.text} />
              {unreadNotificationCount > 0 ? <View style={styles.topActionBadge} /> : null}
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.content} pointerEvents="box-none">
        {activeView === 'events' ? (
          <DiscoverScreen hideModeSwitch initialMode="events" embedded />
        ) : null}
        {activeView === 'calendar' ? (
          <EventsScreen
            searchSignal={calendarSearchSignal}
          />
        ) : null}
        {activeView === 'friends' ? renderFriendsView() : null}
        {activeView === 'explore' ? renderExploreView() : null}
      </View>

      <GlobalCreateMenu
        visible={isCreateMenuVisible}
        onClose={() => setIsCreateMenuVisible(false)}
        onSelect={handleCreateOption}
      />
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    toggleBar: {
      paddingBottom: 0,
      paddingHorizontal: 14,
      backgroundColor: theme.background,
    },
    topBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    topActionSlot: {
      width: 36,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    topActionSlotRight: {
      alignItems: 'flex-end',
    },
    headerSwitch: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    topActionButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    topActionBadge: {
      position: 'absolute',
      top: 5,
      right: 7,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: theme.success,
    },
    content: {
      flex: 1,
    },
    headerSwitchOption: {
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    headerSwitchText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '900',
    },
    headerSwitchTextActive: {
      color: theme.accent,
    },
    headerSwitchSeparator: {
      color: 'rgba(255,255,255,0.32)',
      fontSize: 13,
      fontWeight: '700',
      marginHorizontal: 3,
    },
    panelScroll: {
      flex: 1,
      backgroundColor: theme.background,
    },
    panelContent: {
      paddingHorizontal: 18,
      paddingTop: 4,
      paddingBottom: 76,
      gap: 18,
    },
    searchBar: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderRadius: 21,
      paddingHorizontal: 15,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
      paddingVertical: 0,
    },
    exploreSection: {
      gap: 12,
    },
    friendSection: {
      gap: 10,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '900',
    },
    sectionLink: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: '900',
    },
    horizontalCards: {
      gap: 12,
      paddingRight: 18,
    },
    wideEventCard: {
      width: 186,
      height: 190,
      overflow: 'hidden',
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    miniEventCard: {
      width: 142,
      height: 178,
      overflow: 'hidden',
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    miniEventImage: {
      width: '100%',
      height: '100%',
    },
    miniEventScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.24)',
    },
    miniEventBookmark: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)',
    },
    miniEventCopy: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      gap: 4,
    },
    miniEventTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 20,
    },
    miniEventMeta: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 12,
      fontWeight: '800',
    },
    friendEventCopy: {
      flex: 1,
      gap: 4,
    },
    friendEventTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '900',
    },
    friendEventMeta: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    activityRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activityIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSoft,
    },
    planningRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    planningNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    planningNumberText: {
      color: theme.background,
      fontSize: 13,
      fontWeight: '900',
    },
    planningText: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    categoryRow: {
      flexDirection: 'row',
      gap: 10,
      paddingRight: 18,
    },
    categoryChip: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 21,
      paddingHorizontal: 15,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    categoryText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
  });
