import { useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  Pressable,
  type GestureResponderEvent,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { getAvatarImageSource } from '@/lib/mobile-media';
import { openMobileProfile } from '@/lib/mobile-profile-navigation';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { ProfileRecord } from '@/types/models';

type ProfileLike = Partial<Pick<ProfileRecord, 'id' | 'username' | 'name' | 'avatar'>>;

type ProfileAvatarLinkProps = {
  profile?: ProfileLike | null;
  avatar?: string | null;
  style?: StyleProp<ImageStyle>;
  pressableStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function ProfileAvatarLink({
  profile,
  avatar,
  style,
  pressableStyle,
  disabled = false,
}: ProfileAvatarLinkProps) {
  const router = useRouter();
  const { currentUser } = useMobileApp();
  const label = profile?.username || profile?.name || 'profile';
  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    openMobileProfile({ router, currentUser, profile });
  };

  return (
    <Pressable
      style={pressableStyle}
      disabled={disabled || (!profile?.id && !profile?.username)}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label} profile`}>
      <Image source={getAvatarImageSource(avatar || profile?.avatar)} style={style} />
    </Pressable>
  );
}
