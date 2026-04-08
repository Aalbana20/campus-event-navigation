import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { EventRecord } from '@/types/models';

import { EventActionSheet } from './EventActionSheet';

type EventActionTriggerProps = {
  event: EventRecord;
  style?: StyleProp<ViewStyle>;
};

export function EventActionTrigger({ event, style }: EventActionTriggerProps) {
  const [visible, setVisible] = useState(false);
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <>
      <Pressable style={[styles.trigger, style]} onPress={() => setVisible(true)} hitSlop={10}>
        <Ionicons name="ellipsis-horizontal" size={18} color={theme.text} />
      </Pressable>

      <EventActionSheet event={event} visible={visible} onClose={() => setVisible(false)} />
    </>
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
