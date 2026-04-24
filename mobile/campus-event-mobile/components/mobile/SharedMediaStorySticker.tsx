import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { StyleSheet, View } from 'react-native';

type SharedMediaStoryStickerProps = {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  width: number;
  aspectRatio: number;
  shouldPlay?: boolean;
};

export function SharedMediaStorySticker({
  mediaUrl,
  mediaType,
  width,
  aspectRatio,
  shouldPlay = true,
}: SharedMediaStoryStickerProps) {
  const height = width * aspectRatio;
  const radius = Math.max(22, width * 0.08);
  const player = useVideoPlayer(mediaType === 'video' ? mediaUrl : null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  React.useEffect(() => {
    if (mediaType !== 'video' || !player) return;
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [mediaType, player, shouldPlay]);

  return (
    <View style={[styles.shell, { width, height, borderRadius: radius }]}>
      {mediaType === 'video' ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      ) : (
        <ExpoImage source={{ uri: mediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <View style={styles.stroke} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    backgroundColor: '#090a0f',
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
  stroke: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});
