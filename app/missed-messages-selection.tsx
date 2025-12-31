import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import React from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getCurrentUserId } from '@/utils/authHelpers';
import { useAuth } from '@/contexts/AuthContext';

interface MissedMessageSource {
  id: string;
  friendId?: string;
  groupId?: string;
  friendDisplayName?: string;
  friendUsername?: string;
  groupName?: string;
  messageCount: number;
  muteStartTime?: Date | null;
  muteEndTime: Date;
  deferredId?: string;
}

export default function MissedMessagesSelectionScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [sources, setSources] = useState<MissedMessageSource[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshKeyRef = useRef(0);

  useEffect(() => {
    loadMissedMessageSources();
  }, []);

  // Refresh when screen comes into focus (e.g., after dismissing messages)
  useFocusEffect(
    React.useCallback(() => {
      // Force a complete refresh - clear everything and reload
      refreshKeyRef.current += 1;
      setSources([]);
      setLoading(true);
      // Longer delay to ensure Firestore updates are fully propagated
      const timer = setTimeout(() => {
        loadMissedMessageSources();
      }, 800);
      return () => clearTimeout(timer);
    }, [user])
  );

  const loadMissedMessageSources = async () => {
    try {
      setLoading(true);
      // Clear sources to show loading state
      setSources([]);
      const currentUserId = await getCurrentUserId(user);

      const now = new Date();

      // Get deferred missed messages
      const deferredQuery = query(
        collection(db, 'deferredMissedMessages'),
        where('userId', '==', currentUserId),
        where('viewed', '==', false)
      );
      const deferredSnapshot = await getDocs(deferredQuery);
      const deferredList: MissedMessageSource[] = [];

      for (const deferredDoc of deferredSnapshot.docs) {
        const data = deferredDoc.data();
        const muteEndTime = data.muteEndTime?.toDate ? data.muteEndTime.toDate() : new Date(data.muteEndTime);
        const muteStartTime = data.muteStartTime?.toDate ? data.muteStartTime.toDate() : null;

        // Verify messages still exist and haven't expired
        const messagesQuery = query(
          collection(db, 'messages'),
          where('toUserId', '==', currentUserId)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        let validCount = 0;

        messagesSnapshot.forEach((msgDoc) => {
          const msgData = msgDoc.data();
          const createdAt = msgData.createdAt?.toDate ? msgData.createdAt.toDate() : new Date(msgData.createdAt);
          const expiresAt = msgData.expiresAt?.toDate ? msgData.expiresAt.toDate() : new Date(msgData.expiresAt);

          if (expiresAt <= now) return;
          // When checking for group messages, only count group messages
          if (data.groupId) {
            if (!msgData.groupId || msgData.groupId !== data.groupId) return;
          }
          // When checking for friend messages, exclude group messages
          if (data.friendId) {
            if (msgData.groupId || msgData.isGroupMessage) return; // Exclude group messages
            if (msgData.fromUserId !== data.friendId) return;
          }
          if (muteStartTime && (createdAt < muteStartTime || createdAt > muteEndTime)) return;

          validCount++;
        });

        if (validCount > 0) {
          // Get friend/group details
          let friendDisplayName: string | undefined;
          let friendUsername: string | undefined;
          let groupName: string | undefined;

          if (data.friendId) {
            try {
              const friendDoc = await getDoc(doc(db, 'users', data.friendId));
              const friendData = friendDoc.data();
              friendDisplayName = friendData?.displayName;
              friendUsername = friendData?.username;
            } catch (error) {
              console.error('Error loading friend data:', error);
            }
          }

          if (data.groupId) {
            try {
              const groupDoc = await getDoc(doc(db, 'groups', data.groupId));
              const groupData = groupDoc.data();
              groupName = groupData?.name || data.groupName;
            } catch (error) {
              console.error('Error loading group data:', error);
            }
          }

          deferredList.push({
            id: deferredDoc.id,
            friendId: data.friendId || undefined,
            groupId: data.groupId || undefined,
            friendDisplayName,
            friendUsername,
            groupName,
            messageCount: validCount,
            muteStartTime,
            muteEndTime,
            deferredId: deferredDoc.id,
          });
        } else {
          // No valid messages, mark as viewed
          await updateDoc(doc(db, 'deferredMissedMessages', deferredDoc.id), { viewed: true });
        }
      }

      // Get all deferred messages (both viewed and unviewed) to check what's already been viewed
      const allDeferredQuery = query(
        collection(db, 'deferredMissedMessages'),
        where('userId', '==', currentUserId)
      );
      const allDeferredSnapshot = await getDocs(allDeferredQuery);
      const viewedDeferredIds = new Set<string>();
      allDeferredSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.viewed === true) {
          // Track viewed deferred entries by friendId or groupId
          if (data.friendId) {
            viewedDeferredIds.add(`friend_${data.friendId}`);
          }
          if (data.groupId) {
            viewedDeferredIds.add(`group_${data.groupId}`);
          }
        }
      });

      // Get currently muted friends and groups with missed messages
      const messagesQuery = query(
        collection(db, 'messages'),
        where('toUserId', '==', currentUserId)
      );
      const messagesSnapshot = await getDocs(messagesQuery);

      // Get friends
      const friendsQuery = query(
        collection(db, 'friendships'),
        where('userId', '==', currentUserId),
        where('status', '==', 'accepted')
      );
      const friendsSnapshot = await getDocs(friendsQuery);

      const currentList: MissedMessageSource[] = [];

      for (const friendshipDoc of friendsSnapshot.docs) {
        const friendshipData = friendshipDoc.data();
        const mutedUntil = friendshipData.mutedUntil?.toDate ? friendshipData.mutedUntil.toDate() : null;
        const muteStart = friendshipData.mutedAt?.toDate ? friendshipData.mutedAt.toDate() : null;

        if (!mutedUntil || mutedUntil <= now || !muteStart) continue;

        // Skip if this friend has already been viewed
        if (viewedDeferredIds.has(`friend_${friendshipData.friendId}`)) {
          continue;
        }

        let count = 0;
        messagesSnapshot.forEach((msgDoc) => {
          const msgData = msgDoc.data();
          const createdAt = msgData.createdAt?.toDate ? msgData.createdAt.toDate() : new Date(msgData.createdAt);
          const expiresAt = msgData.expiresAt?.toDate ? msgData.expiresAt.toDate() : new Date(msgData.expiresAt);

          if (expiresAt <= now) return;
          // Exclude group messages when counting individual friend messages
          if (msgData.groupId || msgData.isGroupMessage) return;
          if (msgData.fromUserId !== friendshipData.friendId) return;
          if (createdAt >= muteStart && createdAt <= now) {
            count++;
          }
        });

        if (count > 0) {
          // Check if already in deferred list (deferred messages take priority)
          const alreadyDeferred = deferredList.some(item => item.friendId === friendshipData.friendId);
          if (!alreadyDeferred) {
            try {
              const friendDoc = await getDoc(doc(db, 'users', friendshipData.friendId));
              const friendData = friendDoc.data();
              currentList.push({
                id: friendshipDoc.id,
                friendId: friendshipData.friendId,
                friendDisplayName: friendData?.displayName,
                friendUsername: friendData?.username,
                messageCount: count,
                muteStartTime: muteStart,
                muteEndTime: now,
              });
            } catch (error) {
              console.error('Error loading friend data:', error);
            }
          }
        }
      }

      // Get groups
      const groupsQuery = query(
        collection(db, 'groups'),
        where('memberIds', 'array-contains', currentUserId)
      );
      const groupsSnapshot = await getDocs(groupsQuery);

      for (const groupDoc of groupsSnapshot.docs) {
        const groupData = groupDoc.data();
        const mutedUntil = groupData.mutedUntil?.toDate ? groupData.mutedUntil.toDate() : null;
        const muteStart = groupData.mutedAt?.toDate ? groupData.mutedAt.toDate() : null;

        if (!mutedUntil || mutedUntil <= now || !muteStart) continue;

        // Skip if this group has already been viewed
        if (viewedDeferredIds.has(`group_${groupDoc.id}`)) {
          continue;
        }

        let count = 0;
        messagesSnapshot.forEach((msgDoc) => {
          const msgData = msgDoc.data();
          const createdAt = msgData.createdAt?.toDate ? msgData.createdAt.toDate() : new Date(msgData.createdAt);
          const expiresAt = msgData.expiresAt?.toDate ? msgData.expiresAt.toDate() : new Date(msgData.expiresAt);

          if (expiresAt <= now) return;
          if (msgData.groupId !== groupDoc.id) return;
          if (createdAt >= muteStart && createdAt <= now) {
            count++;
          }
        });

        if (count > 0) {
          // Check if already in deferred list (deferred messages take priority)
          const alreadyDeferred = deferredList.some(item => item.groupId === groupDoc.id);
          if (!alreadyDeferred) {
            currentList.push({
              id: groupDoc.id,
              groupId: groupDoc.id,
              groupName: groupData.name,
              messageCount: count,
              muteStartTime: muteStart,
              muteEndTime: now,
            });
          }
        }
      }

      // Filter out any sources with 0 messages (shouldn't happen, but safety check)
      const filteredDeferred = deferredList.filter(item => item.messageCount > 0);
      const filteredCurrent = currentList.filter(item => item.messageCount > 0);
      
      setSources([...filteredDeferred, ...filteredCurrent]);
    } catch (error) {
      console.error('Error loading missed message sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSource = async (source: MissedMessageSource) => {
    try {
      const currentUserId = await getCurrentUserId(user);
      
      // Mark as viewed immediately when clicked
      if (source.deferredId) {
        // If it has a deferredId, mark that deferred entry as viewed
        await updateDoc(doc(db, 'deferredMissedMessages', source.deferredId), { viewed: true });
      } else {
        // If no deferredId (currently muted source), create a deferred entry and mark it as viewed
        const newDeferredDoc = {
          userId: currentUserId,
          friendId: source.friendId || null,
          groupId: source.groupId || null,
          groupName: source.groupName || null,
          muteStartTime: source.muteStartTime ? Timestamp.fromDate(source.muteStartTime) : null,
          muteEndTime: Timestamp.fromDate(source.muteEndTime),
          messageCount: source.messageCount,
          createdAt: Timestamp.now(),
          viewed: true, // Mark as viewed immediately
        };
        await addDoc(collection(db, 'deferredMissedMessages'), newDeferredDoc);
      }
      
      // Remove from local state immediately for better UX
      setSources(prevSources => prevSources.filter(s => s.id !== source.id));
      
      // Navigate to view the messages
      router.push({
        pathname: '/missed-messages',
        params: {
          friendId: source.friendId || '',
          groupId: source.groupId || '',
          muteStartTime: source.muteStartTime?.toISOString() || '',
          muteEndTime: source.muteEndTime.toISOString(),
          groupName: source.groupName || '',
          deferredId: source.deferredId || '',
        },
      });
    } catch (error) {
      console.error('Error marking source as viewed:', error);
      // Still navigate even if marking as viewed fails
      router.push({
        pathname: '/missed-messages',
        params: {
          friendId: source.friendId || '',
          groupId: source.groupId || '',
          muteStartTime: source.muteStartTime?.toISOString() || '',
          muteEndTime: source.muteEndTime.toISOString(),
          groupName: source.groupName || '',
          deferredId: source.deferredId || '',
        },
      });
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.icon }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Missed Messages</ThemedText>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.loadingText}>Loading...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (sources.length === 0) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.icon }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Missed Messages</ThemedText>
        </View>
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No missed messages found</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            All messages may have expired (24 hours) or were already viewed
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.icon }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Missed Messages</ThemedText>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.subtitle}>
          Select a friend or group to view missed messages:
        </ThemedText>

        {sources.map((source) => (
          <TouchableOpacity
            key={source.id}
            style={[styles.sourceItem, { borderColor: colors.icon, backgroundColor: colors.background }]}
            onPress={() => handleSelectSource(source)}>
            <View style={styles.sourceInfo}>
              <ThemedText style={styles.sourceName}>
                {source.groupName || source.friendDisplayName || source.friendUsername || 'Unknown'}
                {source.groupName && ' (Group)'}
              </ThemedText>
              {source.friendUsername && (
                <ThemedText style={styles.sourceUsername}>@{source.friendUsername}</ThemedText>
              )}
            </View>
            <View style={styles.sourceCount}>
              <ThemedText style={[styles.countText, { color: colors.tint }]}>
                {source.messageCount}
              </ThemedText>
              <ThemedText style={styles.countLabel}>
                message{source.messageCount !== 1 ? 's' : ''}
              </ThemedText>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  sourceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sourceUsername: {
    fontSize: 14,
    opacity: 0.7,
  },
  sourceCount: {
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  countText: {
    fontSize: 24,
    fontWeight: '700',
  },
  countLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
});

