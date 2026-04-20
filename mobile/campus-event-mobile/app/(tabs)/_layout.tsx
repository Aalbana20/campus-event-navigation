import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { useAppTheme } from '@/lib/app-theme';
import { useMobileInbox } from '@/providers/mobile-inbox-provider';

export default function TabLayout() {
  const theme = useAppTheme();
  const { unreadDmCount } = useMobileInbox();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.background,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.text,
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
          title: 'DMs',
          tabBarIcon: ({ color, size }) => <Ionicons name="paper-plane-outline" size={size} color={color} />,
          tabBarBadge: unreadDmCount > 0 ? unreadDmCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.text,
            color: theme.background,
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
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="Discover" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="create" options={{ href: null }} />
    </Tabs>
  );
}
