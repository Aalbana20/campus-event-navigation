import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import type { EventRecord } from '@/types/models';

export type EventCommentRecord = {
  id: string;
  authorName: string;
  authorUsername?: string;
  body: string;
  createdAt: string;
};

type EventCommentsSheetProps = {
  visible: boolean;
  event: EventRecord | null;
  comments: EventCommentRecord[];
  draft: string;
  onChangeDraft: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const formatCommentTime = (value: string) => {
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return 'Now';

  return dateValue.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function EventCommentsSheet({
  visible,
  event,
  comments,
  draft,
  onChangeDraft,
  onClose,
  onSubmit,
}: EventCommentsSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kavWrapper}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Comments</Text>
              <Text style={styles.headerMeta} numberOfLines={1}>
                {event?.title || 'Campus Event'}
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {comments.length > 0 ? (
              comments.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentName}>
                      {comment.authorUsername
                        ? `@${comment.authorUsername}`
                        : comment.authorName || 'Campus User'}
                    </Text>
                    <Text style={styles.commentTime}>{formatCommentTime(comment.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentBody}>{comment.body}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No comments yet.</Text>
                <Text style={styles.emptyCopy}>Start the conversation for this event.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={onChangeDraft}
              placeholder="Add a comment..."
              placeholderTextColor={theme.textMuted}
              style={styles.input}
              multiline
              maxLength={280}
            />
            <Pressable
              style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
              onPress={onSubmit}
              disabled={!draft.trim()}>
              <Ionicons name="send" size={16} color={draft.trim() ? theme.background : theme.textMuted} />
            </Pressable>
          </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    kavWrapper: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(6, 9, 15, 0.6)',
    },
    sheet: {
      maxHeight: '78%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 16,
    },
    handle: {
      alignSelf: 'center',
      width: 46,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 14,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 12,
    },
    headerCopy: {
      gap: 3,
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 19,
      fontWeight: '800',
    },
    headerMeta: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    list: {
      flexGrow: 0,
    },
    listContent: {
      gap: 10,
      paddingBottom: 10,
    },
    commentCard: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 5,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    commentName: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
    commentTime: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    commentBody: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '500',
    },
    emptyState: {
      paddingVertical: 26,
      alignItems: 'center',
      gap: 6,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 12,
      textAlign: 'center',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 94,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      color: theme.text,
      fontSize: 14,
      fontWeight: '500',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    sendButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    sendButtonDisabled: {
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
  });
