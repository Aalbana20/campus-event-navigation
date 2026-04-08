import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/app-theme';

type AppScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
};

export function AppScreen({ children, style, edges = ['top'] }: AppScreenProps) {
  const theme = useAppTheme();

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: theme.background }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
