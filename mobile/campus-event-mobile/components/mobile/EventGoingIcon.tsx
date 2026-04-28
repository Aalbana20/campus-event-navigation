import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { ImageStyle, StyleProp } from 'react-native';

type EventGoingIconProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle>;
};

const encodeSvg = (value: string) => `data:image/svg+xml;utf8,${encodeURIComponent(value)}`;

const buildGoingIconUri = (color: string) =>
  encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M16 20v-1.4a4.6 4.6 0 0 0-4.6-4.6H7.6A4.6 4.6 0 0 0 3 18.6V20" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="9.5" cy="7" r="3.4" stroke="${color}" stroke-width="1.8"/>
  <path d="M21 20v-1.4a4.6 4.6 0 0 0-3.2-4.38" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 3.2a3.4 3.4 0 0 1 0 6.6" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);

export function EventGoingIcon({ size = 24, color = '#ffffff', style }: EventGoingIconProps) {
  const uri = useMemo(() => buildGoingIconUri(color), [color]);

  return (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
    />
  );
}
