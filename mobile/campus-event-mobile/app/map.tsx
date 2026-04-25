import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';

import { useAppTheme } from '@/lib/app-theme';
import { getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { EventRecord } from '@/types/models';

type EventCoordinates = {
  latitude: number;
  longitude: number;
};

type MappedEvent = {
  event: EventRecord;
  coordinate: EventCoordinates;
};

const isMappedEvent = (value: MappedEvent | null): value is MappedEvent =>
  Boolean(value);

const DEFAULT_REGION: Region = {
  latitude: 38.2104,
  longitude: -75.685,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

const getEventCoordinates = (event: EventRecord): EventCoordinates | null => {
  const raw = (event as unknown as { locationCoordinates?: unknown }).locationCoordinates;
  if (!raw || typeof raw !== 'object') {
    // TODO: If a shared geocoding service is added, resolve text-only
    // locations here and cache coordinates with the event. For now, skip
    // address-only events so the map never crashes or guesses locations.
    return null;
  }

  const latitude = Number(
    (raw as { latitude?: unknown; lat?: unknown }).latitude ??
      (raw as { latitude?: unknown; lat?: unknown }).lat
  );
  const longitude = Number(
    (raw as { longitude?: unknown; lng?: unknown }).longitude ??
      (raw as { longitude?: unknown; lng?: unknown }).lng
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
};

const buildInitialRegion = (mappedEvents: MappedEvent[]): Region => {
  if (!mappedEvents.length) return DEFAULT_REGION;

  const latitudes = mappedEvents.map((item) => item.coordinate.latitude);
  const longitudes = mappedEvents.map((item) => item.coordinate.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(0.018, (maxLatitude - minLatitude) * 1.9 || 0.025),
    longitudeDelta: Math.max(0.018, (maxLongitude - minLongitude) * 1.9 || 0.025),
  };
};

export default function MapScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { events: allEvents = [], savedEventIds, toggleSaveEvent } = useMobileApp();
  const [searchText, setSearchText] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const mappedEvents = useMemo<MappedEvent[]>(() => {
    const query = searchText.trim().toLowerCase();

    return allEvents
      .map((event) => {
        const coordinate = getEventCoordinates(event);
        return coordinate ? { event, coordinate } : null;
      })
      .filter(isMappedEvent)
      .filter((item) => {
        if (!query) return true;
        return [
          item.event.title,
          item.event.location,
          item.event.locationName,
          item.event.locationAddress,
          item.event.organizer,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
  }, [allEvents, searchText]);

  const selectedMappedEvent = useMemo(
    () => mappedEvents.find((item) => String(item.event.id) === selectedEventId) || null,
    [mappedEvents, selectedEventId]
  );
  const selectedEvent = selectedMappedEvent?.event || null;
  const initialRegion = useMemo(() => buildInitialRegion(mappedEvents), [mappedEvents]);
  const hasMappedEvents = mappedEvents.length > 0;
  const selectedEventIsSaved = selectedEvent
    ? savedEventIds.includes(String(selectedEvent.id))
    : false;

  const handleViewEvent = () => {
    if (!selectedEvent) return;
    router.push({
      pathname: '/event/[id]',
      params: { id: String(selectedEvent.id) },
    });
  };

  const handleToggleRsvp = () => {
    if (!selectedEvent) return;
    void toggleSaveEvent(String(selectedEvent.id));
  };

  return (
    <View style={styles.screen}>
      <MapView
        key={`${mappedEvents.length}-${initialRegion.latitude}-${initialRegion.longitude}`}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        userInterfaceStyle="dark"
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass
        showsScale={false}
        toolbarEnabled={false}
        onPress={() => setSelectedEventId(null)}>
        {mappedEvents.map(({ event, coordinate }) => {
          const isActive = String(event.id) === selectedEventId;

          return (
            <Marker
              key={String(event.id)}
              coordinate={coordinate}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges
              onPress={(pressEvent) => {
                pressEvent.stopPropagation();
                setSelectedEventId(String(event.id));
              }}>
              <View style={[styles.eventMarker, isActive && styles.eventMarkerActive]}>
                <View
                  style={[
                    styles.markerPreviewCard,
                    isActive && styles.markerPreviewCardActive,
                  ]}>
                  <Image
                    source={getEventImageSource(event.image)}
                    style={styles.markerPreviewImage}
                  />
                  <Text style={styles.markerPreviewTitle} numberOfLines={2}>
                    {event.title || 'Campus event'}
                  </Text>
                </View>

                <View style={styles.pinWrap}>
                  <View style={[styles.pinDrop, isActive && styles.pinDropActive]}>
                    <View style={styles.pinCenter} />
                  </View>
                  <View style={[styles.pinShadow, isActive && styles.pinShadowActive]} />
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityLabel="Close map">
          <Ionicons name="chevron-back" size={21} color="#ffffff" />
        </Pressable>

        <View style={styles.searchField}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.62)" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search event locations"
            placeholderTextColor="rgba(255,255,255,0.62)"
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>
      </View>

      <View style={styles.mapPill} pointerEvents="none">
        <Ionicons name="location" size={14} color="#ffffff" />
        <Text style={styles.mapPillText}>
          {mappedEvents.length} event {mappedEvents.length === 1 ? 'pin' : 'pins'}
        </Text>
      </View>

      {!hasMappedEvents ? (
        <View style={styles.emptyState} pointerEvents="none">
          <View style={styles.emptyIcon}>
            <Ionicons name="map-outline" size={30} color="#ffffff" />
          </View>
          <Text style={styles.emptyTitle}>No events on the map yet</Text>
          <Text style={styles.emptyCopy}>Events with locations will appear here.</Text>
        </View>
      ) : null}

      {selectedEvent ? (
        <View style={styles.previewWrap} pointerEvents="box-none">
          <View style={styles.previewSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.previewTopRow}>
              <Image
                source={getEventImageSource(selectedEvent.image)}
                style={styles.previewImage}
              />

              <View style={styles.previewCopy}>
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {selectedEvent.title || 'Campus event'}
                </Text>
                <Text style={styles.previewMeta} numberOfLines={1}>
                  {[selectedEvent.date, selectedEvent.time].filter(Boolean).join(' · ') ||
                    'Date TBA'}
                </Text>
                <Text style={styles.previewLocation} numberOfLines={1}>
                  {selectedEvent.locationName ||
                    selectedEvent.location ||
                    selectedEvent.locationAddress ||
                    'Campus location'}
                </Text>
              </View>
            </View>

            {selectedEvent.description ? (
              <Text style={styles.previewDescription} numberOfLines={2}>
                {selectedEvent.description}
              </Text>
            ) : null}

            <View style={styles.previewActions}>
              <Pressable
                style={[styles.previewButton, styles.secondaryPreviewButton]}
                onPress={handleToggleRsvp}>
                <Ionicons
                  name={selectedEventIsSaved ? 'checkmark-circle' : 'add-circle-outline'}
                  size={17}
                  color="#ffffff"
                />
                <Text style={styles.secondaryPreviewButtonText}>
                  {selectedEventIsSaved ? 'Going' : 'RSVP'}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.previewButton, styles.primaryPreviewButton]}
                onPress={handleViewEvent}>
                <Text style={styles.primaryPreviewButtonText}>View details</Text>
                <Ionicons name="chevron-forward" size={17} color="#000000" />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: '#000000',
    },
    header: {
      paddingTop: 56,
      paddingHorizontal: 14,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      zIndex: 5,
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.64)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    searchField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 42,
      paddingHorizontal: 14,
      borderRadius: 21,
      backgroundColor: 'rgba(12,12,14,0.82)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    searchInput: {
      flex: 1,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
      paddingVertical: 0,
    },
    eventMarker: {
      width: 94,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ scale: 1 }],
    },
    eventMarkerActive: {
      transform: [{ scale: 1.08 }],
    },
    markerPreviewCard: {
      width: 78,
      minHeight: 76,
      padding: 5,
      borderRadius: 13,
      backgroundColor: 'rgba(11,11,13,0.94)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      gap: 4,
      shadowColor: '#000000',
      shadowOpacity: 0.36,
      shadowRadius: 13,
      shadowOffset: { width: 0, height: 7 },
      elevation: 10,
    },
    markerPreviewCardActive: {
      borderColor: 'rgba(255,255,255,0.72)',
      shadowColor: '#ff375f',
      shadowOpacity: 0.52,
      shadowRadius: 16,
    },
    markerPreviewImage: {
      width: 66,
      height: 42,
      borderRadius: 9,
      backgroundColor: theme.surfaceAlt,
    },
    markerPreviewTitle: {
      width: '100%',
      color: '#ffffff',
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '900',
      textAlign: 'center',
    },
    pinWrap: {
      height: 33,
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginTop: -1,
    },
    pinDrop: {
      width: 28,
      height: 28,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 4,
      backgroundColor: '#ff2d55',
      borderWidth: 2,
      borderColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate: '45deg' }],
      shadowColor: '#ff2d55',
      shadowOpacity: 0.42,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    pinDropActive: {
      backgroundColor: '#ffffff',
      borderColor: '#ff2d55',
    },
    pinCenter: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.34)',
    },
    pinShadow: {
      width: 18,
      height: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.32)',
      marginTop: -2,
      transform: [{ scaleX: 1.15 }],
    },
    pinShadowActive: {
      backgroundColor: 'rgba(255,45,85,0.38)',
    },
    mapPill: {
      position: 'absolute',
      top: 112,
      left: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.58)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    mapPillText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },
    emptyState: {
      position: 'absolute',
      left: 28,
      right: 28,
      top: '38%',
      alignItems: 'center',
      gap: 8,
      padding: 22,
      borderRadius: 26,
      backgroundColor: 'rgba(0,0,0,0.68)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    emptyTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyCopy: {
      color: 'rgba(255,255,255,0.68)',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    previewWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 14,
      paddingBottom: 30,
      zIndex: 8,
    },
    previewSheet: {
      padding: 14,
      borderRadius: 28,
      backgroundColor: 'rgba(12,12,14,0.96)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      shadowColor: '#000000',
      shadowOpacity: 0.4,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 14 },
      elevation: 16,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 42,
      height: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.22)',
      marginBottom: 13,
    },
    previewTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    previewImage: {
      width: 76,
      height: 76,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
    },
    previewCopy: {
      flex: 1,
      gap: 4,
    },
    previewTitle: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '900',
      lineHeight: 21,
    },
    previewMeta: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 13,
      fontWeight: '700',
    },
    previewLocation: {
      color: 'rgba(255,255,255,0.58)',
      fontSize: 13,
      fontWeight: '700',
    },
    previewDescription: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 13,
      lineHeight: 18,
      marginTop: 12,
    },
    previewActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    previewButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    secondaryPreviewButton: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    secondaryPreviewButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
    },
    primaryPreviewButton: {
      backgroundColor: '#ffffff',
    },
    primaryPreviewButtonText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '900',
    },
  });
