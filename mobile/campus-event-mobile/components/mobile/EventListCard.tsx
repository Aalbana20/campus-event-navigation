import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getEventImageSource } from '@/lib/mobile-media';
import { EventRecord } from '@/types/models';

import { EventActionTrigger } from './EventActionTrigger';

type EventListCardProps = {
  event: EventRecord;
  onPress?: () => void;
  actionLabel?: string;
  onActionPress?: () => void;
  actionTone?: 'accent' | 'success' | 'danger' | 'muted';
};

export function EventListCard({
  event,
  onPress,
  actionLabel,
  onActionPress,
  actionTone = 'accent',
}: EventListCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <EventActionTrigger event={event} style={styles.actions} />

      <Pressable style={styles.content} onPress={onPress}>
        <Image source={getEventImageSource(event.image)} style={styles.image} />

        <View style={styles.copy}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {[event.date, event.time, event.locationName].filter(Boolean).join(' • ')}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {event.description}
          </Text>

          <View style={styles.tagsRow}>
            {event.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>

      {actionLabel ? (
        <Pressable
          style={[
            styles.actionButton,
            actionTone === 'success'
              ? styles.successButton
              : actionTone === 'danger'
                ? styles.dangerButton
                : actionTone === 'muted'
                  ? styles.mutedButton
                  : styles.accentButton,
          ]}
          onPress={onActionPress}>
          <Text
            style={[
              styles.actionText,
              actionTone === 'accent' ? styles.accentText : undefined,
              actionTone === 'muted' ? styles.mutedText : undefined,
            ]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    card: {
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 14,
    },
    actions: {
      position: 'absolute',
      right: 14,
      top: 14,
      zIndex: 2,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingRight: 44,
    },
    image: {
      width: 90,
      height: 112,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
    },
    copy: {
      flex: 1,
      gap: 6,
    },
    title: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 22,
    },
    meta: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    description: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    tagChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
    },
    tagText: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '700',
    },
    actionButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 16,
    },
    accentButton: {
      backgroundColor: theme.accent,
    },
    successButton: {
      backgroundColor: theme.successSoft,
      borderWidth: 1,
      borderColor: theme.successSoft,
    },
    dangerButton: {
      backgroundColor: theme.dangerSoft,
      borderWidth: 1,
      borderColor: theme.dangerSoft,
    },
    mutedButton: {
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    accentText: {
      color: theme.background,
    },
    mutedText: {
      color: theme.text,
    },
  });
