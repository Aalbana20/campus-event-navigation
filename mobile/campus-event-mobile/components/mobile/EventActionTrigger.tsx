import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { useShareSheet } from '@/providers/mobile-share-provider';
import { EventRecord } from '@/types/models';

type EventActionTriggerProps = {
  event: EventRecord;
  style?: StyleProp<ViewStyle>;
};

export function EventActionTrigger({ event, style }: EventActionTriggerProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { openShareSheet } = useShareSheet();

  return (
    <Pressable
      style={[styles.trigger, style]}
      onPress={() => openShareSheet({ kind: 'event', event })}
      hitSlop={10}>
      <Ionicons name="ellipsis-horizontal" size={18} color={theme.text} />
    </Pressable>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    trigger: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
  });
