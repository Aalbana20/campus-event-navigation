import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getEventImageSource } from '@/lib/mobile-media';
import { EventRecord } from '@/types/models';

import { EventActionTrigger } from './EventActionTrigger';

type ExploreEventDetailModalProps = {
  event: EventRecord | null;
  visible: boolean;
  actionLabel: string;
  actionActive: boolean;
  onClose: () => void;
  onActionPress: () => void;
};

export function ExploreEventDetailModal({
  event,
  visible,
  actionLabel,
  actionActive,
  onClose,
  onActionPress,
}: ExploreEventDetailModalProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  if (!event) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(eventPress) => eventPress.stopPropagation()}>
          <View style={styles.handle} />

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.heroShell}>
              <ImageBackground source={getEventImageSource(event.image)} style={styles.hero} imageStyle={styles.heroImage}>
                <View style={styles.heroOverlay} />
                <EventActionTrigger event={event} style={styles.actions} />
                <Pressable style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={18} color="#ffffff" />
                </Pressable>

                <View style={styles.heroCopy}>
                  <Text style={styles.heroTag}>#{event.tags[0] || 'Explore'}</Text>
                  <Text style={styles.heroTitle}>{event.title}</Text>
                  <Text style={styles.heroMeta}>
                    {[event.date, event.time, event.locationName].filter(Boolean).join(' • ')}
                  </Text>
                </View>
              </ImageBackground>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Ionicons name="people-outline" size={14} color={theme.text} />
                <Text style={styles.statText}>{event.goingCount} going</Text>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="repeat-outline" size={14} color={theme.text} />
                <Text style={styles.statText}>{event.repostedByIds.length} reposts</Text>
              </View>
            </View>

            <Text style={styles.description}>
              {event.description || 'A standout event worth discovering outside your usual circle.'}
            </Text>

            <Text style={styles.detailMeta}>
              {[event.organizer, event.locationAddress || event.location].filter(Boolean).join(' • ')}
            </Text>

            <View style={styles.tagsRow}>
              {(event.tags.length > 0 ? event.tags.slice(0, 4) : ['Explore']).map((tag) => (
                <View key={`${event.id}-${tag}`} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={[styles.actionButton, actionActive && styles.actionButtonActive]}
              onPress={onActionPress}>
              <Text style={[styles.actionText, actionActive && styles.actionTextActive]}>
                {actionLabel}
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.overlay,
    },
    sheet: {
      maxHeight: '88%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: theme.surface,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 24,
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 12,
    },
    content: {
      gap: 14,
      paddingBottom: 12,
    },
    heroShell: {
      borderRadius: 26,
      overflow: 'hidden',
    },
    hero: {
      minHeight: 320,
      padding: 16,
      justifyContent: 'space-between',
    },
    heroImage: {
      borderRadius: 26,
    },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.cardImageOverlay,
    },
    actions: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      left: 16,
      zIndex: 3,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(8, 11, 16, 0.48)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
    },
    heroCopy: {
      gap: 8,
    },
    heroTag: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      overflow: 'hidden',
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
      backgroundColor: 'rgba(8, 11, 16, 0.72)',
    },
    heroTitle: {
      color: '#ffffff',
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 34,
      paddingRight: 44,
    },
    heroMeta: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
    },
    statText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
    description: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 21,
    },
    detailMeta: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tagChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
    },
    tagText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
    actionButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: theme.accent,
    },
    actionButtonActive: {
      backgroundColor: theme.successSoft,
      borderWidth: 1,
      borderColor: theme.success,
    },
    actionText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
    actionTextActive: {
      color: theme.text,
    },
  });
