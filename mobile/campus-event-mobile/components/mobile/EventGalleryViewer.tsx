import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';

type EventGalleryViewerProps = {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
};

export function EventGalleryViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: EventGalleryViewerProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    if (!visible || !images.length) return;

    const timeoutId = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: Math.min(initialIndex, images.length - 1),
        animated: false,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [images.length, initialIndex, visible]);

  if (!images.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={20} color="#ffffff" />
        </Pressable>

        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(item, index) => `${item}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={[styles.slide, { width, height }]}>
              <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
              <View style={styles.indexPill}>
                <Text style={styles.indexText}>
                  {index + 1} / {images.length}
                </Text>
              </View>
            </View>
          )}
          getItemLayout={(_, index) => ({
            index,
            length: width,
            offset: width * index,
          })}
        />
      </View>
    </Modal>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.96)',
    },
    closeButton: {
      position: 'absolute',
      top: 56,
      right: 22,
      zIndex: 4,
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(18, 19, 24, 0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    slide: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 72,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    indexPill: {
      position: 'absolute',
      bottom: 44,
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(18, 19, 24, 0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    indexText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
  });
