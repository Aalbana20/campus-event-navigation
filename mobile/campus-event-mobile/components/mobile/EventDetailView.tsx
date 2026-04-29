import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '@/components/mobile/AppScreen';
import { EventActionTrigger } from '@/components/mobile/EventActionTrigger';
import { EventGoingIcon } from '@/components/mobile/EventGoingIcon';
import { useAppTheme } from '@/lib/app-theme';
import { getEventCreatorLabel } from '@/lib/mobile-backend';
import type { EventMemoryRecord } from '@/lib/mobile-event-memories';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import type { EventRecord } from '@/types/models';

type EventDetailViewProps = {
  event: EventRecord;
  onBack: () => void;
  galleryImages?: string[];
  onPressHeroImage?: () => void;
  primaryActionLabel: string;
  onPrimaryActionPress?: () => void;
  showGoingIcon?: boolean;
  mapButtonLabel?: string;
  onPressMap?: () => void;
  canAddMemory?: boolean;
  isMemoryBusy?: boolean;
  onAddMemory?: () => void;
  eventMemories?: EventMemoryRecord[];
  showActionTrigger?: boolean;
};

export function EventDetailView({
  event,
  onBack,
  galleryImages = [],
  onPressHeroImage,
  primaryActionLabel,
  onPrimaryActionPress,
  showGoingIcon = false,
  mapButtonLabel = 'Open in Maps',
  onPressMap,
  canAddMemory = false,
  isMemoryBusy = false,
  onAddMemory,
  eventMemories = [],
  showActionTrigger = true,
}: EventDetailViewProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  return (
    <AppScreen edges={[]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          {onPressHeroImage ? (
            <Pressable style={styles.heroImagePressable} onPress={onPressHeroImage}>
              <Image source={getEventImageSource(event.image)} style={styles.heroImage} />
              {galleryImages.length > 1 ? (
                <View style={styles.galleryCountPill}>
                  <Ionicons name="images-outline" size={14} color="#ffffff" />
                  <Text style={styles.galleryCountText}>{galleryImages.length}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <Image source={getEventImageSource(event.image)} style={styles.heroImage} />
          )}
          {showActionTrigger ? (
            <EventActionTrigger
              event={event}
              style={[styles.actionButton, { top: insets.top + 12 }]}
            />
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.meta}>
                {[event.date, event.time, event.locationName].filter(Boolean).join(' • ')}
              </Text>
              <View style={styles.creatorCard}>
                <View style={styles.creatorRow}>
                  <Image source={getAvatarImageSource(event.creatorAvatar)} style={styles.creatorAvatar} />
                  <View style={styles.creatorTextWrap}>
                    <Text style={styles.creatorLabel}>Hosted by</Text>
                    <Text style={styles.creatorName} numberOfLines={1}>
                      {getEventCreatorLabel(event)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.privacyPill}>
              <Text style={styles.privacyText}>{event.isPrivate ? 'Private' : 'Public'}</Text>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.description}>
              {event.description || 'No description available yet.'}
            </Text>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>
                {event.locationAddress || event.locationName || 'Address unavailable'}
              </Text>
            </View>
          </View>

          <View style={styles.memoriesSection}>
            <View style={styles.memoryHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Tag Photos</Text>
                <Text style={styles.memoryCopy}>
                  Photos people tagged to this event after attending.
                </Text>
              </View>
              {canAddMemory ? (
                <Pressable
                  style={styles.memoryButton}
                  disabled={isMemoryBusy}
                  onPress={onAddMemory}>
                  <Text style={styles.memoryButtonText}>
                    {isMemoryBusy ? 'Adding...' : 'Tag Photo'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {eventMemories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.memoryRow}>
                  {eventMemories.map((memory) => (
                    <View key={memory.id} style={styles.memoryTile}>
                      {memory.mediaType === 'video' ? (
                        <View style={styles.memoryVideoFallback}>
                          <Ionicons name="play-circle-outline" size={30} color="#ffffff" />
                        </View>
                      ) : (
                        <Image source={{ uri: memory.mediaUrl }} style={styles.memoryImage} />
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.memoryEmpty}>
                <Text style={styles.memoryEmptyText}>No tagged photos yet.</Text>
              </View>
            )}
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={styles.primaryButton}
              onPress={onPrimaryActionPress}
              disabled={!onPrimaryActionPress}>
              {showGoingIcon ? (
                <EventGoingIcon size={24} color={theme.background} />
              ) : null}
              <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
            </Pressable>
            {(event.locationAddress || event.locationName) && onPressMap ? (
              <Pressable
                style={[styles.secondaryButton, styles.mapButton]}
                onPress={onPressMap}>
                <Ionicons name="map-outline" size={16} color={theme.text} />
                <Text style={styles.secondaryButtonText}>{mapButtonLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <Pressable
        style={[styles.backButton, { top: insets.top + 12 }]}
        hitSlop={14}
        onPress={onBack}>
        <Ionicons name="chevron-back" size={22} color="#ffffff" />
      </Pressable>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 120,
    },
    heroWrap: {
      height: 340,
      position: 'relative',
    },
    heroImagePressable: {
      flex: 1,
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    galleryCountPill: {
      position: 'absolute',
      right: 18,
      bottom: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(8, 11, 16, 0.66)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    galleryCountText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },
    backButton: {
      position: 'absolute',
      left: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(8, 11, 16, 0.7)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
      elevation: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    actionButton: {
      position: 'absolute',
      right: 18,
      top: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
    body: {
      marginTop: -28,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 12,
      backgroundColor: theme.background,
      gap: 18,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    titleBlock: {
      flex: 1,
      gap: 8,
    },
    creatorCard: {
      alignSelf: 'flex-start',
      marginTop: 2,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    creatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    creatorAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    creatorTextWrap: {
      flexShrink: 1,
      gap: 2,
    },
    creatorLabel: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    creatorName: {
      flexShrink: 1,
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 34,
    },
    meta: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    privacyPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    privacyText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '800',
    },
    description: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 24,
    },
    sectionBlock: {
      gap: 8,
    },
    detailsCard: {
      gap: 14,
      padding: 16,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    detailRow: {
      gap: 6,
    },
    detailLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailValue: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 22,
    },
    sectionEyebrow: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    memoriesSection: {
      gap: 12,
    },
    memoryHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    memoryCopy: {
      marginTop: 4,
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    memoryButton: {
      flexShrink: 0,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    memoryButtonText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '800',
    },
    memoryRow: {
      flexDirection: 'row',
      gap: 10,
      paddingRight: 20,
    },
    memoryTile: {
      width: 96,
      height: 128,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    memoryImage: {
      width: '100%',
      height: '100%',
    },
    memoryVideoFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)',
    },
    memoryEmpty: {
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    memoryEmptyText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    primaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: theme.accent,
    },
    primaryButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    mapButton: {
      flexDirection: 'row',
      gap: 8,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
  });
