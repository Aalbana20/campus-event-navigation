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

export type SegmentedToggleOption<TId extends string> = {
  id: TId;
  label: string;
};

type SegmentedToggleProps<TId extends string> = {
  options: SegmentedToggleOption<TId>[];
  value: TId;
  onChange: (next: TId) => void;
  isDark?: boolean;
  width?: number;
};

export function SegmentedToggle<TId extends string>({
  options,
  value,
  onChange,
  isDark,
  width = 220,
}: SegmentedToggleProps<TId>) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const count = options.length || 1;
  const indicatorWidth = containerWidth > 0 ? Math.max((containerWidth - 8) / count, 0) : 0;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value)
  );

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: indicatorWidth * activeIndex,
      useNativeDriver: true,
      speed: 18,
      bounciness: 7,
    }).start();
  }, [activeIndex, indicatorWidth, translateX]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      style={[styles.shell, { width }, isDark && styles.shellDark]}
      onLayout={handleLayout}
      accessibilityRole="tablist"
    >
      {indicatorWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            isDark && styles.indicatorDark,
            { width: indicatorWidth, transform: [{ translateX }] },
          ]}
        />
      ) : null}

      {options.map((option) => (
        <Pressable
          key={option.id}
          style={styles.option}
          onPress={() => onChange(option.id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.id }}
        >
          <Text
            style={[
              styles.optionText,
              isDark && styles.optionTextDark,
              value === option.id && (isDark ? styles.optionTextActiveDark : styles.optionTextActive),
            ]}
            numberOfLines={1}
          >
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
      padding: 2,
      alignSelf: 'center',
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
    shellDark: {
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      shadowOpacity: 0,
      elevation: 0,
    },
    indicator: {
      position: 'absolute',
      top: 2,
      left: 2,
      bottom: 2,
      borderRadius: 999,
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    indicatorDark: {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      shadowOpacity: 0,
    },
    option: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 999,
      zIndex: 1,
    },
    optionText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    optionTextDark: {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    optionTextActive: {
      color: theme.text,
    },
    optionTextActiveDark: {
      color: '#ffffff',
    },
  });

export default SegmentedToggle;
