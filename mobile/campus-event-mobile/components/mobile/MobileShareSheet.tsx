import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getAvatarImageSource } from '@/lib/mobile-media';
import type { ProfileRecord } from '@/types/models';

const WINDOW_HEIGHT = Dimensions.get('window').height;

export type ShareSheetActionKey =
  | 'add_to_story'
  | 'repost'
  | 'copy_link'
  | 'share_to_native';

export type ShareSheetSendMode = 'individual' | 'group';

type ShareSheetAction = {
  key: ShareSheetActionKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  available: boolean;
};

type ShareSheetPreview = {
  title: string;
  subtitle?: string;
  image?: string;
};

type MobileShareSheetProps = {
  visible: boolean;
  title?: string;
  preview?: ShareSheetPreview | null;
  people: ProfileRecord[];
  currentUserId: string;
  actions: ShareSheetAction[];
  toast?: string | null;
  onClose: () => void;
  onSendToRecipients: (
    recipients: ProfileRecord[],
    message: string,
    mode: ShareSheetSendMode
  ) => void;
  onPressAction: (key: ShareSheetActionKey) => void;
  onPressNewGroup: () => void;
};

const dedupeProfiles = (profiles: ProfileRecord[]) => {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    const key = String(profile.id);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function MobileShareSheet({
  visible,
  title = 'Share',
  preview,
  people,
  currentUserId,
  actions,
  toast,
  onClose,
  onSendToRecipients,
  onPressAction,
  onPressNewGroup,
}: MobileShareSheetProps) {
  const translateY = useRef(new Animated.Value(WINDOW_HEIGHT)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [messageDraft, setMessageDraft] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setSelectedIds(new Set());
      setMessageDraft('');
      return;
    }

    dragY.setValue(0);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [dragY, translateY, visible]);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: WINDOW_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      dragY.setValue(0);
      onClose();
    });
  }, [dragY, onClose, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 120 || g.vy > 1.2) {
            dismiss();
            return;
          }
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 240,
          }).start();
        },
      }),
    [dismiss, dragY]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const uniquePeople = useMemo(
    () =>
      dedupeProfiles(people).filter(
        (profile) => String(profile.id) !== String(currentUserId)
      ),
    [currentUserId, people]
  );
  const filteredPeople = useMemo(() => {
    if (!normalizedQuery) return uniquePeople;
    return uniquePeople.filter((profile) =>
      `${profile.name || ''} ${profile.username || ''}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [normalizedQuery, uniquePeople]);

  const selectedProfiles = useMemo(
    () => uniquePeople.filter((profile) => selectedIds.has(String(profile.id))),
    [selectedIds, uniquePeople]
  );
  const selectionCount = selectedProfiles.length;

  const toggleSelection = (profile: ProfileRecord) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = String(profile.id);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const commitSend = (mode: ShareSheetSendMode) => {
    if (selectionCount === 0) return;
    onSendToRecipients(selectedProfiles, messageDraft.trim(), mode);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}>
      <View style={styles.overlayRoot}>
        <Pressable style={styles.backdrop} onPress={dismiss} />
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: Animated.add(translateY, dragY) }] },
          ]}>
          <View {...panResponder.panHandlers} style={styles.grabberArea}>
            <View style={styles.handle} />
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={styles.searchInput}
              />
            </View>
            <Pressable style={styles.groupButton} onPress={onPressNewGroup}>
              <Ionicons name="people-outline" size={18} color="#ffffff" />
            </Pressable>
          </View>

          {preview ? (
            <View style={styles.preview}>
              {preview.image ? (
                <Image
                  source={{ uri: preview.image }}
                  style={styles.previewImage}
                />
              ) : (
                <View style={[styles.previewImage, styles.previewImageFallback]}>
                  <Ionicons name="image-outline" size={20} color="#ffffff" />
                </View>
              )}
              <View style={styles.previewCopy}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {preview.title || title}
                </Text>
                {preview.subtitle ? (
                  <Text style={styles.previewSubtitle} numberOfLines={1}>
                    {preview.subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <ScrollView
            style={styles.peopleScroll}
            contentContainerStyle={styles.peopleGrid}
            showsVerticalScrollIndicator={false}>
            {filteredPeople.length > 0 ? (
              filteredPeople.map((profile) => {
                const isSelected = selectedIds.has(String(profile.id));
                return (
                  <Pressable
                    key={profile.id}
                    style={styles.personCell}
                    onPress={() => toggleSelection(profile)}>
                    <View style={styles.personAvatarWrap}>
                      <Image
                        source={getAvatarImageSource(profile.avatar)}
                        style={[styles.personAvatar, isSelected && styles.personAvatarSelected]}
                      />
                      {isSelected ? (
                        <View style={styles.personSelectBadge}>
                          <Ionicons name="checkmark" size={13} color="#000000" />
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.personName,
                        isSelected && styles.personNameSelected,
                      ]}
                      numberOfLines={1}>
                      {profile.username ? profile.username : profile.name || 'Campus'}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No people matched.</Text>
                <Text style={styles.emptyCopy}>
                  Following and recent DM contacts will appear here.
                </Text>
              </View>
            )}
          </ScrollView>

          {selectionCount > 0 ? (
            <View style={styles.composeBar}>
              <TextInput
                value={messageDraft}
                onChangeText={setMessageDraft}
                placeholder="Write a message…"
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={styles.composeInput}
                multiline
              />

              {selectionCount >= 2 ? (
                <View style={styles.sendModeRow}>
                  <Pressable
                    style={styles.sendPrimary}
                    onPress={() => commitSend('individual')}>
                    <Ionicons name="paper-plane" size={14} color="#000000" />
                    <Text style={styles.sendPrimaryText}>
                      Send separately ({selectionCount})
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.sendSecondary}
                    onPress={() => commitSend('group')}>
                    <Ionicons
                      name="people-outline"
                      size={14}
                      color="rgba(255,255,255,0.92)"
                    />
                    <Text style={styles.sendSecondaryText}>Send as group</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.sendPrimary}
                  onPress={() => commitSend('individual')}>
                  <Ionicons name="paper-plane" size={14} color="#000000" />
                  <Text style={styles.sendPrimaryText}>Send</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actionsRow}>
              {actions.map((action) => {
                const disabled = !action.available;
                return (
                  <Pressable
                    key={action.key}
                    disabled={disabled}
                    onPress={() => onPressAction(action.key)}
                    style={[styles.actionCell, disabled && styles.actionCellDisabled]}>
                    <View
                      style={[
                        styles.actionCircle,
                        action.key === 'add_to_story' && styles.actionCircleAdd,
                      ]}>
                      <Ionicons name={action.icon} size={22} color="#ffffff" />
                    </View>
                    <Text style={styles.actionLabel} numberOfLines={1}>
                      {action.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {toast ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '82%',
    paddingBottom: 28,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#0b0b0d',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  grabberArea: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
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
  groupButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#131316',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  previewImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1b1b20',
  },
  previewImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopy: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  previewSubtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    fontWeight: '500',
  },
  peopleScroll: {
    maxHeight: 320,
  },
  peopleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
    rowGap: 16,
  },
  personCell: {
    width: '25%',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  personAvatarWrap: {
    position: 'relative',
  },
  personAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#1b1b20',
  },
  personAvatarSelected: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  personSelectBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0b0b0d',
  },
  personName: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 74,
    textAlign: 'center',
  },
  personNameSelected: {
    fontWeight: '800',
  },
  composeBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 10,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  composeInput: {
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  sendModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sendPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  sendPrimaryText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  sendSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendSecondaryText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    flexBasis: '100%',
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCopy: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 22,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  actionCell: {
    alignItems: 'center',
    gap: 7,
    width: 74,
  },
  actionCellDisabled: {
    opacity: 0.45,
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionCircleAdd: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  actionLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  toast: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1c1c21',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
