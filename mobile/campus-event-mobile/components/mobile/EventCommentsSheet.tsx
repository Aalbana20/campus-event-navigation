import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getAvatarImageSource } from '@/lib/mobile-media';
import type { EventRecord } from '@/types/models';

export type EventCommentRecord = {
  id: string;
  authorName: string;
  authorUsername?: string;
  authorAvatar?: string;
  authorId?: string;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  parentId?: string | null;
};

type EventCommentsSheetProps = {
  visible: boolean;
  event: EventRecord | null;
  comments: EventCommentRecord[];
  draft: string;
  currentUserId?: string;
  onChangeDraft: (value: string) => void;
  onClose: () => void;
  onSubmit: (parentId?: string | null) => void;
  onToggleLike?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
};

const formatCommentTime = (value: string) => {
  const now = new Date();
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return 'Now';
  const diffInSeconds = Math.floor((now.getTime() - dateValue.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;
  const diffInWeeks = Math.floor(diffInDays / 7);
  return `${diffInWeeks}w`;
};

export function EventCommentsSheet({
  visible,
  event,
  comments,
  draft,
  currentUserId,
  onChangeDraft,
  onClose,
  onSubmit,
  onToggleLike,
  onDeleteComment,
}: EventCommentsSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  const [replyingTo, setReplyingTo] = useState<EventCommentRecord | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [actionSheetComment, setActionSheetComment] = useState<EventCommentRecord | null>(null);

  const topLevelComments = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments]
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, EventCommentRecord[]>();
    comments.forEach((c) => {
      if (c.parentId) {
        const list = map.get(c.parentId) || [];
        list.push(c);
        map.set(c.parentId, list);
      }
    });
    return map;
  }, [comments]);

  const toggleThread = (commentId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const handleClose = () => {
    setReplyingTo(null);
    onClose();
  };

  const handleSubmit = () => {
    const targetParentId = replyingTo?.parentId ? replyingTo.parentId : replyingTo?.id || null;
    onSubmit(targetParentId);
    setReplyingTo(null);
  };

  const closeActionSheet = () => setActionSheetComment(null);

  const handleCopyComment = async (comment: EventCommentRecord) => {
    try {
      await Clipboard.setStringAsync(comment.body);
    } catch (copyError) {
      console.warn('Could not copy comment:', copyError);
    }
    closeActionSheet();
  };

  const handleShareComment = async (comment: EventCommentRecord) => {
    try {
      await Share.share({
        message: `${comment.authorUsername ? `@${comment.authorUsername}: ` : ''}${comment.body}`,
      });
    } catch (shareError) {
      console.warn('Could not share comment:', shareError);
    }
    closeActionSheet();
  };

  const handleDeleteFromSheet = (comment: EventCommentRecord) => {
    Alert.alert(
      'Delete comment?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteComment?.(comment.id);
            closeActionSheet();
          },
        },
      ]
    );
  };

  const handleReportComment = (comment: EventCommentRecord) => {
    Alert.alert('Thanks for reporting', `We'll review @${comment.authorUsername || comment.authorName}'s comment.`);
    closeActionSheet();
  };

  const handleSaveComment = (comment: EventCommentRecord) => {
    Alert.alert('Saved', `"${comment.body.slice(0, 40)}" saved.`);
    closeActionSheet();
  };

  const renderCommentRow = (comment: EventCommentRecord, isReply = false) => {
    const isAuthor = event?.createdBy === comment.authorUsername;
    return (
      <Pressable
        key={comment.id}
        style={[styles.commentRow, isReply && styles.replyRow]}
        onLongPress={() => setActionSheetComment(comment)}
        delayLongPress={220}>
        <Image
          source={getAvatarImageSource(comment.authorAvatar)}
          style={isReply ? styles.replyAvatar : styles.commentAvatar}
        />
        <View style={styles.commentBubble}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentName} numberOfLines={1}>
              {comment.authorUsername
                ? `@${comment.authorUsername}`
                : comment.authorName || 'Campus User'}
            </Text>
            {isAuthor && <Text style={styles.authorBadge}>Creator</Text>}
          </View>
          <Text style={styles.commentBody}>{comment.body}</Text>
          <View style={styles.commentFooter}>
            <Text style={styles.commentTime}>
              {formatCommentTime(comment.createdAt)}
            </Text>
            <Pressable onPress={() => setReplyingTo(comment)} hitSlop={15}>
              <Text style={styles.replyAction}>Reply</Text>
            </Pressable>
          </View>
        </View>
        <Pressable
          style={styles.likeButton}
          onPress={() => onToggleLike?.(comment.id)}
          hitSlop={8}
          accessibilityLabel={comment.likedByMe ? 'Unlike comment' : 'Like comment'}>
          <Ionicons
            name={comment.likedByMe ? 'heart' : 'heart-outline'}
            size={18}
            color={comment.likedByMe ? theme.accent : theme.textMuted}
          />
          <Text
            style={[
              styles.likeCount,
              comment.likedByMe && { color: theme.accent },
            ]}>
            {comment.likeCount > 0 ? comment.likeCount : ''}
          </Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kavWrapper}>
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Comments</Text>
              <Text style={styles.headerMeta} numberOfLines={1}>
                {event?.title || 'Campus Event'}
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {topLevelComments.length > 0 ? (
              topLevelComments.map((comment) => {
                const replies = repliesByParent.get(comment.id) || [];
                const hasReplies = replies.length > 0;
                const isExpanded = expandedThreads.has(comment.id);

                return (
                  <View key={comment.id}>
                    {renderCommentRow(comment)}
                    {hasReplies && !isExpanded && (
                      <Pressable style={styles.viewRepliesBtn} onPress={() => toggleThread(comment.id)}>
                        <Text style={styles.viewRepliesText}>
                          — View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                        </Text>
                      </Pressable>
                    )}
                    {isExpanded && (
                      <View style={styles.repliesContainer}>
                        {replies.map((reply) => renderCommentRow(reply, true))}
                        <Pressable style={styles.viewRepliesBtn} onPress={() => toggleThread(comment.id)}>
                          <Text style={styles.viewRepliesText}>— Hide replies</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No comments yet.</Text>
                <Text style={styles.emptyCopy}>Start the conversation for this event.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputContainer}>
            {replyingTo && (
              <View style={styles.replyingToBanner}>
                <Text style={styles.replyingToText}>
                  Replying to @{replyingTo.authorUsername || replyingTo.authorName}
                </Text>
                <Pressable onPress={() => setReplyingTo(null)} hitSlop={15}>
                  <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                </Pressable>
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                value={draft}
                onChangeText={onChangeDraft}
                placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
                placeholderTextColor={theme.textMuted}
                style={styles.input}
                multiline
                maxLength={280}
              />
              <Pressable
                style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
                onPress={handleSubmit}
                disabled={!draft.trim()}>
                <Ionicons name="send" size={16} color={draft.trim() ? theme.background : theme.textMuted} />
              </Pressable>
            </View>
          </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      <Modal
        visible={Boolean(actionSheetComment)}
        transparent
        animationType="fade"
        onRequestClose={closeActionSheet}>
        <Pressable style={styles.actionSheetOverlay} onPress={closeActionSheet}>
          <Pressable style={styles.actionSheet} onPress={() => {}}>
            <View style={styles.actionSheetHandle} />
            {actionSheetComment ? (
              (() => {
                const comment = actionSheetComment;
                const isOwnComment = Boolean(
                  currentUserId && comment.authorId && comment.authorId === currentUserId
                );

                const items = isOwnComment
                  ? [
                      { key: 'delete', label: 'Delete', icon: 'trash-outline' as const, tone: 'danger' as const, onPress: () => handleDeleteFromSheet(comment) },
                      { key: 'copy', label: 'Copy', icon: 'copy-outline' as const, tone: 'default' as const, onPress: () => handleCopyComment(comment) },
                      { key: 'save', label: 'Save comment', icon: 'bookmark-outline' as const, tone: 'default' as const, onPress: () => handleSaveComment(comment) },
                    ]
                  : [
                      { key: 'share', label: 'Share', icon: 'share-outline' as const, tone: 'default' as const, onPress: () => handleShareComment(comment) },
                      { key: 'copy', label: 'Copy', icon: 'copy-outline' as const, tone: 'default' as const, onPress: () => handleCopyComment(comment) },
                      { key: 'report', label: 'Report', icon: 'flag-outline' as const, tone: 'danger' as const, onPress: () => handleReportComment(comment) },
                    ];

                return items.map((item) => (
                  <Pressable
                    key={item.key}
                    style={styles.actionSheetItem}
                    onPress={item.onPress}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={item.tone === 'danger' ? theme.danger : theme.text}
                    />
                    <Text
                      style={[
                        styles.actionSheetItemLabel,
                        item.tone === 'danger' && { color: theme.danger },
                      ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ));
              })()
            ) : null}
            <Pressable style={styles.actionSheetCancel} onPress={closeActionSheet}>
              <Text style={styles.actionSheetCancelLabel}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    commentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 8,
    },
    replyRow: {
      paddingLeft: 46,
      paddingVertical: 6,
    },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
    },
    replyAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
    },
    commentBubble: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    commentName: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    authorBadge: {
      fontSize: 11,
      color: theme.accent,
      fontWeight: '800',
      marginLeft: 4,
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
    commentFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 12,
    },
    replyAction: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    viewRepliesBtn: {
      marginLeft: 56,
      paddingVertical: 6,
      paddingBottom: 10,
    },
    viewRepliesText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    repliesContainer: {
    },
    likeButton: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 2,
      minWidth: 28,
      gap: 2,
    },
    likeCount: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '700',
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
    inputContainer: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 10,
    },
    replyingToBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      paddingBottom: 8,
    },
    replyingToText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
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
    actionSheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(6, 9, 15, 0.5)',
    },
    actionSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderTopWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 28,
      gap: 4,
    },
    actionSheetHandle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 10,
    },
    actionSheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: theme.surfaceAlt,
      marginBottom: 6,
    },
    actionSheetItemLabel: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    actionSheetCancel: {
      marginTop: 6,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionSheetCancelLabel: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
  });
