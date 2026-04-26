import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getAvatarImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useMobileInbox } from '@/providers/mobile-inbox-provider';

export default function TabLayout() {
  const theme = useAppTheme();
  const { unreadDmCount } = useMobileInbox();
  const { currentUser } = useMobileApp();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.background,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 78,
          paddingTop: 8,
          paddingBottom: 10,
        },
      }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="video-posts"
        options={{
          title: 'Video/Posts',
          tabBarIcon: ({ color, size }) => <Ionicons name="play" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <Ionicons name="paper-plane-outline" size={size} color={color} />,
          tabBarBadge: unreadDmCount > 0 ? unreadDmCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.accent,
            color: theme.accentText,
            fontSize: 10,
            fontWeight: '800',
          },
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            currentUser.avatar ? (
              <View
                style={[
                  styles.profileTabAvatarShell,
                  {
                    width: size + 4,
                    height: size + 4,
                    borderRadius: (size + 4) / 2,
                    borderColor: focused ? theme.accent : 'transparent',
                  },
                ]}>
                <Image
                  source={getAvatarImageSource(currentUser.avatar)}
                  style={[
                    styles.profileTabAvatar,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                    },
                  ]}
                />
              </View>
            ) : (
              <Ionicons name="person-circle-outline" size={size} color={color} />
            )
          ),
        }}
      />
      <Tabs.Screen name="Discover" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="create" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  profileTabAvatarShell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  profileTabAvatar: {
    backgroundColor: 'rgba(128,128,128,0.22)',
  },
});
