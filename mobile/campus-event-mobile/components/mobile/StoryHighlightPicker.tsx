import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import {
  createStoryHighlight,
  loadArchivedStoriesForUser,
  type ArchivedStoryRecord,
  type StoryHighlightRecord,
} from '@/lib/mobile-story-highlights';

type StoryHighlightPickerProps = {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onCreated: (highlight: StoryHighlightRecord) => void;
};

type PickerStep = 'select' | 'title';

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const COLUMNS = 3;
const GRID_GAP = 2;
const TILE_WIDTH = (WINDOW_WIDTH - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
const TILE_ASPECT = 0.58; // matches story aspect (portrait, ~9:16-ish)

export function StoryHighlightPicker({
  visible,
  userId,
  onClose,
  onCreated,
}: StoryHighlightPickerProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  const [stories, setStories] = useState<ArchivedStoryRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<PickerStep>('select');
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    setStep('select');
    setSelectedIds([]);
    setTitle('');
    setIsLoading(true);

    loadArchivedStoriesForUser(userId)
      .then((records) => {
        if (!cancelled) setStories(records);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, visible]);

  const selectedStories = useMemo(
    () => selectedIds
      .map((id) => stories.find((story) => story.id === id))
      .filter((story): story is ArchivedStoryRecord => Boolean(story)),
    [selectedIds, stories]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((candidate) => candidate !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (selectedIds.length === 0) return;
    setStep('title');
  };

  const handleCreate = async () => {
    if (selectedStories.length === 0 || isSaving) return;
    setIsSaving(true);
    const highlight = await createStoryHighlight({
      userId,
      title: title.trim() || 'Highlight',
      stories: selectedStories,
    });
    setIsSaving(false);
    if (!highlight) return;
    onCreated(highlight);
    onClose();
  };

  const renderTile = ({ item, index }: { item: ArchivedStoryRecord; index: number }) => {
    const isSelected = selectedIds.includes(item.id);
    const selectionNumber = isSelected ? selectedIds.indexOf(item.id) + 1 : null;
    const isRightEdge = (index + 1) % COLUMNS === 0;

    return (
      <Pressable
        style={[
          styles.tile,
          { marginRight: isRightEdge ? 0 : GRID_GAP, marginBottom: GRID_GAP },
        ]}
        onPress={() => toggleSelect(item.id)}>
        <ExpoImage
          source={{ uri: item.mediaUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        {item.mediaType === 'video' ? (
          <View style={styles.videoBadge} pointerEvents="none">
            <Ionicons name="play" size={11} color="#ffffff" />
          </View>
        ) : null}
        <View
          style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}
          pointerEvents="none">
          {isSelected ? (
            <Text style={styles.checkNumber}>{selectionNumber}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={step === 'title' ? () => setStep('select') : onClose} hitSlop={8}>
            <Text style={styles.topBarAction}>
              {step === 'title' ? 'Back' : 'Cancel'}
            </Text>
          </Pressable>
          <Text style={styles.topBarTitle}>
            {step === 'title' ? 'Name this highlight' : 'Add to highlights'}
          </Text>
          {step === 'select' ? (
            <Pressable
              onPress={handleNext}
              disabled={selectedIds.length === 0}
              hitSlop={8}>
              <Text
                style={[
                  styles.topBarAction,
                  styles.topBarActionPrimary,
                  selectedIds.length === 0 && styles.topBarActionDisabled,
                ]}>
                Next
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void handleCreate()}
              disabled={isSaving}
              hitSlop={8}>
              <Text
                style={[
                  styles.topBarAction,
                  styles.topBarActionPrimary,
                  isSaving && styles.topBarActionDisabled,
                ]}>
                {isSaving ? 'Saving...' : 'Done'}
              </Text>
            </Pressable>
          )}
        </View>

        {step === 'select' ? (
          isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={theme.text} />
            </View>
          ) : stories.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={40} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>No past stories yet</Text>
              <Text style={styles.emptyCopy}>
                Stories you post show up here once the 24-hour window ends — or while they're still live.
              </Text>
            </View>
          ) : (
            <FlatList
              data={stories}
              renderItem={renderTile}
              keyExtractor={(item) => item.id}
              numColumns={COLUMNS}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : (
          <View style={styles.titleStep}>
            <Text style={styles.titleStepLabel}>Highlight title</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Gym, Food, Trips"
              placeholderTextColor={theme.textMuted}
              autoFocus
              maxLength={32}
            />
            <Text style={styles.titleStepCopy}>
              {selectedStories.length} {selectedStories.length === 1 ? 'story' : 'stories'} will be saved to this highlight.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const isDark = theme.background === '#05070b' || theme.background === '#000000';
  const background = isDark ? '#000000' : theme.background;
  const surfaceAlt = isDark ? '#1a1a1c' : theme.surfaceAlt;
  const border = isDark ? 'rgba(255,255,255,0.12)' : theme.border;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: background,
    },
    topBar: {
      paddingTop: 54,
      paddingHorizontal: 16,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    topBarTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    topBarAction: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '600',
      minWidth: 52,
    },
    topBarActionPrimary: {
      textAlign: 'right',
      fontWeight: '800',
    },
    topBarActionDisabled: {
      opacity: 0.35,
    },
    gridContent: {
      paddingTop: GRID_GAP,
    },
    tile: {
      width: TILE_WIDTH,
      aspectRatio: TILE_ASPECT,
      backgroundColor: surfaceAlt,
      overflow: 'hidden',
    },
    videoBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    checkCircle: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.18)',
    },
    checkCircleSelected: {
      backgroundColor: theme.accent || '#3b82f6',
      borderColor: '#ffffff',
    },
    checkNumber: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
    titleStep: {
      padding: 20,
      gap: 10,
    },
    titleStepLabel: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    titleInput: {
      color: theme.text,
      fontSize: 16,
      backgroundColor: surfaceAlt,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    titleStepCopy: {
      color: theme.textMuted,
      fontSize: 13,
    },
  });
};
