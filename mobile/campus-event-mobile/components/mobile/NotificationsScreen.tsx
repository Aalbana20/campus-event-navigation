import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getAvatarImageSource } from '@/lib/mobile-media';
import { openMobileProfile } from '@/lib/mobile-profile-navigation';
import {
  MobileNotification,
  useMobileInbox,
} from '@/providers/mobile-inbox-provider';
import { useMobileApp } from '@/providers/mobile-app-provider';

import { AppScreen } from './AppScreen';

type FilterKey = 'all' | 'following' | 'events' | 'comments' | 'mentions';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'following', label: 'Follows' },
  { key: 'events', label: 'Events' },
  { key: 'comments', label: 'Comments' },
  { key: 'mentions', label: 'Mentions' },
];

const sectionTitleFor = (notification: MobileNotification) => {
  const ts = notification.createdAt ? new Date(notification.createdAt).getTime() : 0;
  if (!ts) return 'Earlier';
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (now - ts < day) return 'Today';
  if (now - ts < 7 * day) return 'This week';
  return 'Earlier';
};

const sectionOrder = ['Today', 'This week', 'Earlier'];

const filterNotifications = (
  list: MobileNotification[],
  filter: FilterKey,
): MobileNotification[] => {
  if (filter === 'all') return list;
  if (filter === 'mentions')
    return list.filter((n) => n.category === 'mentions');
  if (filter === 'comments')
    return list.filter((n) => n.category === 'comments');
  if (filter === 'events') return list.filter((n) => n.category === 'events');
  if (filter === 'following')
    return list.filter((n) => n.category === 'following');
  return list;
};

const splitActorAndAction = (notification: MobileNotification) => {
  const text = notification.text || '';
  // The provider builds notification text like "Avery liked your story" or
  // "@nights_out commented on your post". Try to peel off a leading actor
  // chunk so we can render it bold; fall back to the username, then the raw
  // text.
  const username = notification.username ? `@${notification.username}` : '';
  if (username && text.startsWith(`${username} `)) {
    return { actor: username, action: text.slice(username.length + 1) };
  }
  const firstSpace = text.indexOf(' ');
  if (firstSpace > 0) {
    return { actor: text.slice(0, firstSpace), action: text.slice(firstSpace + 1) };
  }
  return { actor: username || text, action: '' };
};

export function NotificationsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { currentUser } = useMobileApp();
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    clearNotifications,
  } = useMobileInbox();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);
  const headerTitle = currentUser.username || currentUser.name || 'Notifications';

  // The provider derives notifications from app data; pull-to-refresh just
  // gives a brief visual cue while React rerenders.
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const sections = useMemo(() => {
    const filtered = filterNotifications(notifications, filter).filter(
      (n) => n.category !== 'messages',
    );
    const grouped: Record<string, MobileNotification[]> = {};
    for (const n of filtered) {
      const title = sectionTitleFor(n);
      if (!grouped[title]) grouped[title] = [];
      grouped[title].push(n);
    }
    return sectionOrder
      .filter((title) => grouped[title]?.length)
      .map((title) => ({ title, data: grouped[title] }));
  }, [filter, notifications]);

  const handleOpen = (n: MobileNotification) => {
    markNotificationRead(n.id);
    if (n.eventId) {
      router.push({ pathname: '/event/[id]', params: { id: n.eventId } });
      return;
    }
    if (n.username) {
      openMobileProfile({
        router,
        currentUser,
        profile: { username: n.username, name: n.username },
      });
      return;
    }
  };

  const renderItem = ({ item }: { item: MobileNotification }) => {
    const { actor, action } = splitActorAndAction(item);
    return (
      <Pressable
        onPress={() => handleOpen(item)}
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      >
        <Image source={getAvatarImageSource(item.image)} style={styles.avatar} />
        <View style={styles.rowBody}>
          <Text style={styles.rowText} numberOfLines={3}>
            <Text style={styles.actor}>{actor}</Text>
            {action ? <Text style={styles.action}>{` ${action}`}</Text> : null}
          </Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        {item.previewImage ? (
          <Image source={getAvatarImageSource(item.previewImage)} style={styles.preview} />
        ) : null}
        {!item.read ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    );
  };

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title} numberOfLines={1}>{headerTitle}</Text>
          <Text style={styles.subtitle}>
            {unreadNotificationCount > 0
              ? `${unreadNotificationCount} new update${unreadNotificationCount === 1 ? '' : 's'}`
              : 'All caught up'}
          </Text>
        </View>
        {notifications.length > 0 ? (
          <Pressable onPress={clearNotifications} hitSlop={8} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        SectionSeparatorComponent={() => null}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={
          sections.length === 0
            ? styles.emptyContainer
            : { paddingBottom: 40, paddingHorizontal: 16 }
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyView}>
            <View style={styles.emptyGlyphRing}>
              <Text style={styles.emptyGlyph}>🔔</Text>
            </View>
            <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
            <Text style={styles.emptyBody}>
              Likes, follows, comments, and event updates will live here.
            </Text>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text}
          />
        }
      />
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: { backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(18,21,28,0.78)',
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerCopy: {
      flex: 1,
    },
    title: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 14,
      marginTop: 4,
    },
    clearBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
    },
    clearText: { color: theme.text, fontSize: 13, fontWeight: '600' },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      flexWrap: 'wrap',
    },
    chip: {
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: {
      backgroundColor: theme.text,
      borderColor: theme.text,
    },
    chipLabel: { color: theme.text, fontSize: 13, fontWeight: '500' },
    chipLabelActive: { color: theme.background },
    sectionHeader: {
      paddingTop: 20,
      paddingBottom: 8,
    },
    sectionLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    rowPressed: { backgroundColor: theme.surface },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.surfaceAlt,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowText: { color: theme.text, fontSize: 14, lineHeight: 19 },
    actor: { color: theme.text, fontWeight: '700' },
    action: { color: theme.textMuted },
    time: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
    preview: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: theme.surfaceAlt,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#0a84ff',
      marginLeft: 6,
    },
    separator: {
      height: 1,
      backgroundColor: theme.border,
      marginLeft: 58,
      opacity: 0.5,
    },
    emptyContainer: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyView: { alignItems: 'center', paddingTop: 40 },
    emptyGlyphRing: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    emptyGlyph: { fontSize: 32 },
    emptyTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    emptyBody: {
      color: theme.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 280,
    },
  });
