import React from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const featuredEvent = {
  image:
    'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
  going: 124,
  mutuals: 18,
};

export default function DiscoverScreen() {
  const { height } = useWindowDimensions();
  const cardHeight = Math.max(360, Math.min(height * 0.85, height - 240, 760));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
        </View>

        <View style={styles.cardWrapper}>
          <ImageBackground
            source={{ uri: featuredEvent.image }}
            style={[styles.card, { height: cardHeight }]}
            imageStyle={styles.cardImage}>
            <View style={styles.imageOverlay} />

            <View style={styles.badges}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{featuredEvent.going} going</Text>
              </View>

              <View style={styles.badge}>
                <Text style={styles.badgeText}>{featuredEvent.mutuals} mutuals</Text>
              </View>
            </View>
          </ImageBackground>
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.actionButton, styles.rejectButton]}>
            <Text style={[styles.actionText, styles.rejectText]}>↺</Text>
          </Pressable>

          <Pressable style={[styles.actionButton, styles.acceptButton]}>
            <Text style={[styles.actionText, styles.acceptText]}>↻</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#05070b',
  },
  container: {
    flex: 1,
    backgroundColor: '#05070b',
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#121722',
  },
  cardImage: {
    borderRadius: 30,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 7, 11, 0.22)',
  },
  badges: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    alignItems: 'flex-end',
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(8, 11, 16, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 24,
  },
  actionButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d1118',
    borderWidth: 1,
  },
  rejectButton: {
    borderColor: 'rgba(255, 107, 107, 0.32)',
  },
  acceptButton: {
    borderColor: 'rgba(76, 217, 123, 0.32)',
  },
  actionText: {
    fontSize: 36,
    fontWeight: '700',
  },
  rejectText: {
    color: '#ff6b6b',
  },
  acceptText: {
    color: '#4cd97b',
  },
});
