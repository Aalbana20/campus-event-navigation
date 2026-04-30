import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/app-theme';

type GeminiFlyerGeneratorProps = {
  eventTitle?: string;
  eventDescription?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  onClose: () => void;
  onSelectFlyer: (imageUri: string, generatedAsset?: ImagePicker.ImagePickerAsset) => void;
};

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

const runtimeEnv =
  typeof process !== 'undefined'
    ? (process.env as Record<string, string | undefined>)
    : {};

const GEMINI_API_KEY = runtimeEnv.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';

const getReferenceMimeType = (asset: ImagePicker.ImagePickerAsset) =>
  asset.mimeType || 'image/jpeg';

const getImageExtension = (mimeType: string) => {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
};

const buildGeminiPrompt = ({
  prompt,
  eventTitle,
  eventDescription,
  eventDate,
  eventTime,
  eventLocation,
}: {
  prompt: string;
  eventTitle?: string;
  eventDescription?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
}) => {
  const eventDetails = [
    eventTitle ? `Title: ${eventTitle}` : '',
    eventDate ? `Date: ${eventDate}` : '',
    eventTime ? `Time: ${eventTime}` : '',
    eventLocation ? `Location: ${eventLocation}` : '',
    eventDescription ? `Description: ${eventDescription}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'Create a polished premium campus event flyer in a vertical 2:3 ratio.',
    'The exact intended output size is 1080 x 1620 px.',
    'Keep important text away from the edges so it fits an event card cleanly.',
    eventDetails ? `Event details:\n${eventDetails}` : '',
    `User request: ${prompt}`,
  ]
    .filter(Boolean)
    .join('\n\n');
};

const readReferencePart = async (
  asset: ImagePicker.ImagePickerAsset
): Promise<GeminiPart | null> => {
  if (!asset.uri) return null;

  const data = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    inlineData: {
      mimeType: getReferenceMimeType(asset),
      data,
    },
  };
};

const writeGeneratedFlyerFile = async (base64Data: string, mimeType: string) => {
  const extension = getImageExtension(mimeType);
  const fileName = `gemini-flyer-${Date.now()}.${extension}`;
  const fileUri = `${FileSystem.cacheDirectory || ''}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    asset: {
      uri: fileUri,
      width: 1080,
      height: 1620,
      fileName,
      mimeType,
    } as ImagePicker.ImagePickerAsset,
    fileUri,
  };
};

export function GeminiFlyerGenerator({
  eventTitle,
  eventDescription,
  eventDate,
  eventTime,
  eventLocation,
  onClose,
  onSelectFlyer,
}: GeminiFlyerGeneratorProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const previewWidth = Math.min(width - 64, 340);
  const [prompt, setPrompt] = useState('');
  const [referenceAssets, setReferenceAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [generatedImageUri, setGeneratedImageUri] = useState('');
  const [generatedFlyerAsset, setGeneratedFlyerAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  const pickReferenceImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to add reference images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets.length) return;

    setReferenceAssets((currentAssets) => [...currentAssets, ...result.assets].slice(0, 4));
    setStatusMessage(`${result.assets.length} reference image${result.assets.length === 1 ? '' : 's'} added.`);
  };

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setStatusMessage('Describe the flyer you want to create.');
      return;
    }

    if (!GEMINI_API_KEY) {
      setStatusMessage('Gemini API key is not configured yet.');
      Alert.alert('Gemini', 'Gemini API key is not configured yet.');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('Generating flyer...');

    try {
      const referenceParts = (
        await Promise.all(referenceAssets.map((asset) => readReferencePart(asset)))
      ).filter(Boolean) as GeminiPart[];
      const parts: GeminiPart[] = [
        {
          text: buildGeminiPrompt({
            prompt: trimmedPrompt,
            eventTitle,
            eventDescription,
            eventDate,
            eventTime,
            eventLocation,
          }),
        },
        ...referenceParts,
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini request failed with ${response.status}`);
      }

      const payload = await response.json();
      const responseParts = payload?.candidates?.[0]?.content?.parts ?? [];
      const imagePart = responseParts.find(
        (part: { inlineData?: { data?: string }; inline_data?: { data?: string } }) =>
          part.inlineData?.data || part.inline_data?.data
      );
      const inlineData = imagePart?.inlineData || imagePart?.inline_data;

      if (!inlineData?.data) {
        setStatusMessage('Gemini did not return an image yet. Try a more specific prompt.');
        return;
      }

      const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
      const generatedFile = await writeGeneratedFlyerFile(inlineData.data, mimeType);
      setGeneratedImageUri(generatedFile.fileUri);
      setGeneratedFlyerAsset(generatedFile.asset);
      setStatusMessage('Flyer generated. Use it when you are ready.');
    } catch {
      setStatusMessage('Gemini could not generate a flyer right now.');
      Alert.alert('Gemini', 'Gemini could not generate a flyer right now.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'android' ? 'height' : undefined}
      keyboardVerticalOffset={0}
      style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) }]}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <Ionicons name="chevron-back" size={25} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Generate Flyer</Text>
        <Pressable style={styles.historyButton} onPress={() => setHistoryVisible(true)}>
          <Ionicons name="time-outline" size={15} color={theme.text} />
          <Text style={styles.historyText}>History</Text>
        </Pressable>
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 18) + 24 },
        ]}>
        <Text style={styles.helperText}>
          Use Gemini to create the perfect flyer for your event.
        </Text>

        <View style={[styles.previewBox, { width: previewWidth, height: previewWidth * 1.5 }]}>
          {generatedImageUri ? (
            <Image source={{ uri: generatedImageUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.previewEmpty}>
              <Text style={styles.previewEmptyText}>Your generated flyer will appear here</Text>
            </View>
          )}
        </View>

        {generatedImageUri ? (
          <Pressable
            style={styles.useFlyerButton}
            onPress={() => onSelectFlyer(generatedImageUri, generatedFlyerAsset || undefined)}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
            <Text style={styles.useFlyerText}>Use flyer</Text>
          </Pressable>
        ) : null}

        <View style={styles.uploadNote}>
          <View style={styles.uploadNoteTitleRow}>
            <Ionicons name="cloud-upload-outline" size={17} color={theme.text} />
            <Text style={styles.uploadNoteTitle}>Upload image</Text>
            <Text style={styles.uploadNoteOptional}>(optional)</Text>
          </View>
          <Text style={styles.uploadNoteText}>
            Add reference images to help Gemini understand your vision.
          </Text>
        </View>

        <View style={styles.promptBox}>
          <Text style={styles.promptTitle}>Ask Gemini</Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            multiline
            placeholder="Describe the flyer you want to create..."
            placeholderTextColor="rgba(245,247,251,0.54)"
            style={styles.promptInput}
            textAlignVertical="top"
          />
          <View style={styles.promptToolbar}>
            <View style={styles.promptToolbarLeft}>
              <Pressable style={styles.iconButton} onPress={() => void pickReferenceImages()}>
                <Ionicons name="add" size={25} color={theme.text} />
              </Pressable>
              <Pressable
                style={styles.iconButton}
                onPress={() => setStatusMessage('Flyer settings are coming soon.')}>
                <Ionicons name="options-outline" size={22} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.promptToolbarRight}>
              <View style={styles.proPill}>
                <Text style={styles.proText}>Pro</Text>
              </View>
              <Pressable
                style={styles.roundControl}
                onPress={() => setStatusMessage('Voice prompts are coming soon.')}>
                <Ionicons name="mic-outline" size={22} color={theme.text} />
              </Pressable>
              <Pressable
                style={[styles.sendButton, isGenerating && styles.sendButtonDisabled]}
                disabled={isGenerating}
                onPress={() => void handleGenerate()}>
                <Ionicons name="send" size={20} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>

        {referenceAssets.length > 0 ? (
          <Text style={styles.referenceCount}>
            {referenceAssets.length} reference image{referenceAssets.length === 1 ? '' : 's'} attached
          </Text>
        ) : null}

        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

        <Text style={styles.footerText}>
          Gemini will generate your flyer in the exact event card size.
        </Text>
      </ScrollView>

      <Modal
        visible={historyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.historyBackdrop}>
          <View style={styles.historySheet}>
            <Text style={styles.historyTitle}>History</Text>
            <Text style={styles.historyEmpty}>No generated flyers yet.</Text>
            <Pressable style={styles.historyCloseButton} onPress={() => setHistoryVisible(false)}>
              <Text style={styles.historyCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: '#020305',
    },
    header: {
      minHeight: 82,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(24,27,34,0.84)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    headerTitle: {
      position: 'absolute',
      left: 86,
      right: 86,
      bottom: 13,
      color: theme.text,
      fontSize: 21,
      fontWeight: '900',
      textAlign: 'center',
    },
    historyButton: {
      minHeight: 34,
      paddingHorizontal: 11,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: 'rgba(24,27,34,0.84)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    historyText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    content: {
      flexGrow: 1,
      alignItems: 'center',
      paddingHorizontal: 22,
      gap: 18,
    },
    helperText: {
      color: 'rgba(245,247,251,0.7)',
      fontSize: 16,
      lineHeight: 22,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 4,
    },
    previewBox: {
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: 'rgba(18,21,28,0.88)',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: 'rgba(245,247,251,0.36)',
    },
    previewEmpty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      backgroundColor: 'rgba(26,30,37,0.72)',
    },
    previewEmptyText: {
      color: 'rgba(245,247,251,0.34)',
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      textAlign: 'center',
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    useFlyerButton: {
      minHeight: 44,
      paddingHorizontal: 18,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.accent,
      shadowColor: theme.accent,
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    useFlyerText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
    },
    uploadNote: {
      alignItems: 'center',
      gap: 3,
      marginTop: -4,
    },
    uploadNoteTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    uploadNoteTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '900',
    },
    uploadNoteOptional: {
      color: 'rgba(245,247,251,0.74)',
      fontSize: 13,
      fontWeight: '600',
    },
    uploadNoteText: {
      color: 'rgba(245,247,251,0.66)',
      fontSize: 12,
      lineHeight: 16,
      textAlign: 'center',
    },
    promptBox: {
      width: '100%',
      minHeight: 132,
      borderRadius: 24,
      paddingHorizontal: 15,
      paddingTop: 13,
      paddingBottom: 12,
      gap: 7,
      backgroundColor: 'rgba(12,14,20,0.98)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    promptTitle: {
      color: 'rgba(245,247,251,0.84)',
      fontSize: 17,
      fontWeight: '800',
    },
    promptInput: {
      minHeight: 34,
      maxHeight: 82,
      padding: 0,
      color: theme.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '500',
    },
    promptToolbar: {
      marginTop: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    promptToolbarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    promptToolbarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    proPill: {
      minWidth: 52,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    proText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    roundControl: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    sendButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(115,115,122,0.72)',
    },
    sendButtonDisabled: {
      opacity: 0.54,
    },
    referenceCount: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
      marginTop: -6,
    },
    statusText: {
      color: 'rgba(245,247,251,0.72)',
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: -8,
    },
    footerText: {
      color: 'rgba(245,247,251,0.6)',
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      marginTop: -4,
    },
    historyBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'rgba(0,0,0,0.72)',
    },
    historySheet: {
      width: '100%',
      borderRadius: 26,
      padding: 22,
      alignItems: 'center',
      gap: 14,
      backgroundColor: 'rgba(18,21,28,0.98)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    historyTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '900',
    },
    historyEmpty: {
      color: 'rgba(245,247,251,0.68)',
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    historyCloseButton: {
      marginTop: 4,
      minHeight: 42,
      paddingHorizontal: 18,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    historyCloseText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
    },
  });
