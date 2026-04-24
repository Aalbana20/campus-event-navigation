import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { EventRecord } from '@/types/models';

// Lightweight placeholder map. Replace this <View> with react-native-maps when
// you wire real geo + clustering. The pin layout uses a deterministic hash so
// pins stay in the same spot across re-renders, even without coordinates.
const hashToFraction = (value: string, salt: number) => {
  let hash = 0;
  const seed = `${value}-${salt}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return ((Math.abs(hash) % 1000) / 1000);
};

type EventCoordinates = {
  lat?: number;
  lng?: number;
} | null;

const getEventLatLng = (event: EventRecord): EventCoordinates => {
  const raw = (event as unknown as { locationCoordinates?: unknown }).locationCoordinates;
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number((raw as { lat?: unknown }).lat);
  const lng = Number((raw as { lng?: unknown }).lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

export default function MapScreen() {
  const router = useRouter();
  const { events: allEvents = [] } = useMobileApp();
  const [searchText, setSearchText] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const visibleEvents = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return allEvents.slice(0, 12);
    return allEvents
      .filter((event) =>
        [event.title, event.location, event.locationName, event.organizer]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 12);
  }, [allEvents, searchText]);

  const selectedEvent = useMemo(
    () => visibleEvents.find((event) => String(event.id) === selectedEventId) || null,
    [selectedEventId, visibleEvents]
  );

  return (
    <View style={styles.screen}>
      {/* Placeholder "map" surface — gradient + grid texture so it reads as a
          map without needing the native maps SDK yet. */}
      <View style={styles.mapBackdrop} pointerEvents="none">
        <View style={styles.mapGridHorizontal} />
        <View style={styles.mapGridVertical} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityLabel="Close map">
          <Ionicons name="chevron-back" size={20} color="#ffffff" />
        </Pressable>
        <View style={styles.searchField}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search this map"
            placeholderTextColor="rgba(255,255,255,0.55)"
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* Pins */}
      <View style={styles.pinLayer} pointerEvents="box-none">
        {visibleEvents.map((event) => {
          const coords = getEventLatLng(event);
          // Real coords map to (lng, lat) → (x, y) inside the surface; without
          // coords we fall back to a stable hashed position so pins don't jump.
          const xFraction = coords ? Math.min(0.92, Math.max(0.08, (coords.lng + 180) / 360)) : hashToFraction(String(event.id), 1);
          const yFraction = coords ? Math.min(0.85, Math.max(0.18, (90 - coords.lat) / 180)) : hashToFraction(String(event.id), 2);

          return (
            <Pressable
              key={String(event.id)}
              style={[
                styles.pin,
                {
                  left: `${xFraction * 100}%`,
                  top: `${yFraction * 100}%`,
                },
                String(event.id) === selectedEventId && styles.pinActive,
              ]}
              onPress={() => setSelectedEventId(String(event.id))}>
              <Ionicons name="location" size={22} color="#ffffff" />
            </Pressable>
          );
        })}
      </View>

      {/* Mini event preview card */}
      {selectedEvent ? (
        <View style={styles.previewCardWrap} pointerEvents="box-none">
          <Pressable
            style={styles.previewCard}
            onPress={() => {
              router.push({
                pathname: '/event/[id]',
                params: { id: String(selectedEvent.id) },
              });
            }}>
            <Image
              source={getEventImageSource(selectedEvent.image)}
              style={styles.previewImage}
            />
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedEvent.title || 'Campus event'}
              </Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {[selectedEvent.date, selectedEvent.time, selectedEvent.locationName]
                  .filter(Boolean)
                  .join(' · ') || 'Tap for details'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>
      ) : null}

      {/* Empty / placeholder hint */}
      {visibleEvents.length === 0 ? (
        <View style={styles.emptyState} pointerEvents="none">
          <Ionicons name="globe-outline" size={42} color="rgba(255,255,255,0.6)" />
          <Text style={styles.emptyTitle}>No events to map yet</Text>
          <Text style={styles.emptyCopy}>
            Once events have locations they'll appear as pins here.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#04060a',
  },
  mapBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a1224',
    overflow: 'hidden',
  },
  mapGridHorizontal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    // Layered shadow as a cheap "topology" texture.
    shadowColor: 'rgba(120,160,255,0.18)',
    shadowOpacity: 1,
    shadowRadius: 80,
  },
  mapGridVertical: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    shadowColor: 'rgba(90,200,180,0.14)',
    shadowOpacity: 1,
    shadowRadius: 100,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(15,15,18,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  pinLayer: {
    ...StyleSheet.absoluteFillObject,
    marginTop: 110,
    marginBottom: 160,
  },
  pin: {
    position: 'absolute',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff5a7a',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  pinActive: {
    backgroundColor: '#ffffff',
  },
  previewCardWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 36,
    zIndex: 6,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: '#0b0b0d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#1c1c20',
  },
  previewCopy: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  previewMeta: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '40%',
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyCopy: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textAlign: 'center',
  },
});
