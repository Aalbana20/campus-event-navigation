import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';

type DiscoverMode = 'events' | 'friends';

type DiscoverModeSwitchProps = {
  activeMode: DiscoverMode;
  onChange: (mode: DiscoverMode) => void;
};

const OPTIONS: { id: DiscoverMode; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'friends', label: 'Friends' },
];

export function DiscoverModeSwitch({
  activeMode,
  onChange,
}: DiscoverModeSwitchProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = containerWidth > 0 ? Math.max((containerWidth - 8) / 2, 0) : 0;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: activeMode === 'events' ? 0 : indicatorWidth,
      useNativeDriver: true,
      speed: 18,
      bounciness: 7,
    }).start();
  }, [activeMode, indicatorWidth, translateX]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.shell} onLayout={handleLayout}>
      {indicatorWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: indicatorWidth,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}

      {OPTIONS.map((option) => (
        <Pressable
          key={option.id}
          style={styles.option}
          onPress={() => onChange(option.id)}>
          <Text
            style={[
              styles.optionText,
              activeMode === option.id && styles.optionTextActive,
            ]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    shell: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 999,
      padding: 3,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      shadowColor: theme.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 2,
    },
    indicator: {
      position: 'absolute',
      top: 3,
      left: 3,
      bottom: 3,
      borderRadius: 999,
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    option: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      zIndex: 1,
    },
    optionText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    optionTextActive: {
      color: theme.text,
    },
  });
