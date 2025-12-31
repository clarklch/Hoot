import { Alert } from 'react-native';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Router } from 'expo-router';

interface Friend {
  id: string;
  friendId: string;
  mutedUntil?: Date | null;
}

interface Group {
  id: string;
  name: string;
  mutedUntil?: Date | null;
}

interface MissedMessageItem {
  friendId?: string;
  groupId?: string;
  friend?: Friend;
  group?: Group;
  count: number;
}

/**
 * Checks for missed messages from muted friends and groups
 * Also checks for deferred missed messages (when user selected "Later")
 * @param currentUserId - The current user's ID
 * @param friends - Array of friend objects
 * @param groups - Array of group objects
 * @param router - Router instance for navigation
 * @param getCurrentUserId - Optional function to get current user ID (for friends.tsx compatibility)
 */
export async function checkForAllMissedMessages(
  currentUserId: string | null | undefined,
  friends: Friend[],
  groups: Group[],
  router: Router,
  getCurrentUserId?: () => Promise<string>
): Promise<void> {
  try {
    // Handle different ways of getting user ID
    let userId = currentUserId;
    if (!userId && getCurrentUserId) {
      userId = await getCurrentUserId();
    }
    if (!userId) {
      return;
    }

    const now = new Date();

    // First, check for deferred missed messages (from "Later" selections)
    const deferredQuery = query(
      collection(db, 'deferredMissedMessages'),
      where('userId', '==', userId),
      where('viewed', '==', false)
    );
    const deferredSnapshot = await getDocs(deferredQuery);
    const deferredList: Array<{
      id: string;
      friendId?: string | null;
      groupId?: string | null;
      groupName?: string | null;
      muteStartTime?: Date | null;
      muteEndTime: Date;
      messageCount: number;
      friend?: Friend;
      group?: Group;
    }> = [];

    for (const deferredDoc of deferredSnapshot.docs) {
      const data = deferredDoc.data();
      const muteEndTime = data.muteEndTime?.toDate ? data.muteEndTime.toDate() : new Date(data.muteEndTime);
      const muteStartTime = data.muteStartTime?.toDate ? data.muteStartTime.toDate() : null;

      // Verify messages still exist and haven't expired
      const messagesQuery = query(
        collection(db, 'messages'),
        where('toUserId', '==', userId)
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      let validCount = 0;

      messagesSnapshot.forEach((msgDoc) => {
        const msgData = msgDoc.data();
        const createdAt = msgData.createdAt?.toDate ? msgData.createdAt.toDate() : new Date(msgData.createdAt);
        const expiresAt = msgData.expiresAt?.toDate ? msgData.expiresAt.toDate() : new Date(msgData.expiresAt);

        if (expiresAt <= now) return;
        if (data.groupId && msgData.groupId !== data.groupId) return;
        if (data.friendId && msgData.fromUserId !== data.friendId) return;
        if (muteStartTime && (createdAt < muteStartTime || createdAt > muteEndTime)) return;

        validCount++;
      });

      if (validCount > 0) {
        const friend = data.friendId ? friends.find(f => f.friendId === data.friendId) : undefined;
        const group = data.groupId ? groups.find(g => g.id === data.groupId) : undefined;
        deferredList.push({
          id: deferredDoc.id,
          friendId: data.friendId || null,
          groupId: data.groupId || null,
          groupName: data.groupName || null,
          muteStartTime,
          muteEndTime,
          messageCount: validCount,
          friend,
          group,
        });
      } else {
        // No valid messages, mark as viewed
        await updateDoc(doc(db, 'deferredMissedMessages', deferredDoc.id), { viewed: true });
      }
    }

    // Get all currently muted friends
    const mutedFriends = friends.filter(f => {
      if (!f.mutedUntil) return false;
      return new Date(f.mutedUntil) > now;
    });

    // Get all currently muted groups
    const mutedGroups = groups.filter(g => {
      if (!g.mutedUntil) return false;
      return new Date(g.mutedUntil) > now;
    });

    // Get all messages for this user
    const messagesQuery = query(
      collection(db, 'messages'),
      where('toUserId', '==', userId)
    );

    const snapshot = await getDocs(messagesQuery);
    const missedMessagesList: MissedMessageItem[] = [];

    // Check each muted friend
    for (const friend of mutedFriends) {
      const friendshipDoc = doc(db, 'friendships', friend.id);
      const friendshipData = (await getDoc(friendshipDoc)).data();
      const muteStart = friendshipData?.mutedAt ? friendshipData.mutedAt.toDate() : null;
      if (!muteStart) continue;

      let count = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

        if (expiresAt <= now) return;
        // Exclude group messages when counting individual friend messages
        if (data.groupId || data.isGroupMessage) return;
        if (data.fromUserId !== friend.friendId) return;
        if (createdAt >= muteStart && createdAt <= now) {
          count++;
        }
      });

      if (count > 0) {
        missedMessagesList.push({ friendId: friend.friendId, friend, count });
      }
    }

    // Check each muted group
    for (const group of mutedGroups) {
      const groupDoc = doc(db, 'groups', group.id);
      const groupData = (await getDoc(groupDoc)).data();
      const muteStart = groupData?.mutedAt ? groupData.mutedAt.toDate() : null;
      if (!muteStart) continue;

      let count = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

        if (expiresAt <= now) return;
        if (data.groupId !== group.id) return;
        if (createdAt >= muteStart && createdAt <= now) {
          count++;
        }
      });

      if (count > 0) {
        missedMessagesList.push({ groupId: group.id, group, count });
      }
    }

    // Combine deferred and current missed messages
    const allMissedMessages = [
      ...deferredList.map(item => ({
        friendId: item.friendId || undefined,
        groupId: item.groupId || undefined,
        friend: item.friend,
        group: item.group,
        count: item.messageCount,
        deferredId: item.id,
      })),
      ...missedMessagesList,
    ];

    if (allMissedMessages.length === 0) {
      Alert.alert('No Missed Messages', 'You don\'t have any missed messages from muted friends or groups.');
      return;
    }

    // Always navigate to selection screen so user can choose which user/group to view
    // Use replace to ensure only one instance is ever open
    // This will replace the current screen if already on selection, or navigate to it if not
    router.replace('/missed-messages-selection');
  } catch (error) {
    console.error('Error checking for missed messages:', error);
    Alert.alert('Error', 'Failed to check for missed messages');
  }
}

