import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';

export type GlobalCreateOptionKey = 'post' | 'story' | 'event';

type GlobalCreateOption = {
  key: GlobalCreateOptionKey;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CREATE_OPTIONS: GlobalCreateOption[] = [
  {
    key: 'post',
    label: 'Post',
    subtitle: 'Share a photo or video to your profile.',
    icon: 'grid-outline',
  },
  {
    key: 'story',
    label: 'Story',
    subtitle: 'Post a moment that disappears later.',
    icon: 'radio-button-on-outline',
  },
  {
    key: 'event',
    label: 'Event',
    subtitle: 'Create a campus event with RSVP details.',
    icon: 'calendar-outline',
  },
];

type GlobalCreateMenuProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: GlobalCreateOptionKey) => void;
};

export function GlobalCreateMenu({ visible, onClose, onSelect }: GlobalCreateMenuProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(eventPress) => eventPress.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Create</Text>

          <View style={styles.list}>
            {CREATE_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={styles.row}
                onPress={() => onSelect(option.key)}>
                <View style={styles.icon}>
                  <Ionicons name={option.icon} size={21} color={theme.text} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.label}>{option.label}</Text>
                  <Text style={styles.subtitle}>{option.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </Pressable>
            ))}
          </View>
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
      backgroundColor: 'rgba(0,0,0,0.58)',
    },
    sheet: {
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      backgroundColor: theme.surface,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 34,
      borderWidth: 1,
      borderColor: theme.border,
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 12,
    },
    title: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 12,
    },
    list: {
      gap: 8,
    },
    row: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    icon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    copy: {
      flex: 1,
      gap: 3,
    },
    label: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '900',
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
    },
  });
