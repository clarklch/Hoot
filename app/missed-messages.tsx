import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, PanResponder, Dimensions, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { collection, query, where, getDocs, deleteDoc, doc, Timestamp, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getCurrentUserId } from '@/utils/authHelpers';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 150;

interface MissedMessage {
  id: string;
  message: string;
  fromUserId: string;
  fromUsername?: string;
  fromDisplayName?: string;
  createdAt: Date;
  expiresAt: Date;
  groupId?: string;
  groupName?: string;
  isGroupMessage?: boolean;
}

export default function MissedMessagesScreen() {
  const params = useLocalSearchParams<{
    friendId?: string;
    groupId?: string;
    muteStartTime?: string;
    muteEndTime?: string;
    deferredId?: string;
    groupName?: string;
  }>();
  
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<MissedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    loadMissedMessages();
  }, []);

  const loadMissedMessages = async () => {
    try {
      setLoading(true);
      const currentUserId = await getCurrentUserId(null);
      
      if (!params.friendId && !params.groupId) {
        Alert.alert('Error', 'No friend or group specified');
        router.back();
        return;
      }

      const muteStartTime = params.muteStartTime ? new Date(params.muteStartTime) : null;
      const muteEndTime = params.muteEndTime ? new Date(params.muteEndTime) : new Date();
      const now = new Date();

      // Simplified query - just get all messages for this user
      // We'll filter by expiresAt, friend/group, and mute period in memory to avoid index requirements
      const messagesQuery = query(
        collection(db, 'messages'),
        where('toUserId', '==', currentUserId)
      );

      if (!params.friendId && !params.groupId) {
        Alert.alert('Error', 'No friend or group specified');
        router.back();
        return;
      }

      const snapshot = await getDocs(messagesQuery);
      const loadedMessages: MissedMessage[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

        // Filter by expiration - only include messages that haven't expired
        if (expiresAt <= now) {
          return;
        }

        // Filter by friend/group - ensure group messages are not conflated with individual friend messages
        if (params.groupId && params.groupId !== '') {
          // When viewing group messages, only show group messages for this specific group
          if (!data.groupId || data.groupId !== params.groupId) {
            return;
          }
        }
        if (params.friendId && params.friendId !== '') {
          // When viewing individual friend messages, exclude group messages
          // Only show direct messages from this friend (not group messages)
          if (data.groupId || data.isGroupMessage) {
            return; // Exclude group messages
          }
          if (data.fromUserId !== params.friendId) {
            return;
          }
        }

        // Only include messages created during the mute period
        if (muteStartTime && createdAt < muteStartTime) {
          return; // Message was sent before mute started
        }
        if (createdAt > muteEndTime) {
          return; // Message was sent after mute ended
        }

        loadedMessages.push({
          id: docSnap.id,
          message: data.message || '',
          fromUserId: data.fromUserId || '',
          fromUsername: data.fromUsername,
          fromDisplayName: data.fromDisplayName,
          createdAt,
          expiresAt,
          groupId: data.groupId,
          groupName: data.groupName,
          isGroupMessage: data.isGroupMessage || false,
        });
      });

      // Sort by creation date (newest first)
      loadedMessages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading missed messages:', error);
      Alert.alert('Error', 'Failed to load missed messages');
    } finally {
      setLoading(false);
    }
  };


  const handleDismissAll = async () => {
    if (messages.length === 0 || dismissing) return;

    setDismissing(true);
    try {
      // Delete all messages from Firestore
      const deletePromises = messages.map(msg => deleteDoc(doc(db, 'messages', msg.id)));
      await Promise.all(deletePromises);

      // Mark deferred missed message as viewed if applicable
      const updatePromises: Promise<any>[] = [];
      
      if (params.deferredId) {
        updatePromises.push(
          updateDoc(doc(db, 'deferredMissedMessages', params.deferredId), { viewed: true })
            .catch(error => console.error('Error marking deferred as viewed:', error))
        );
      } else {
        // If no deferredId passed, try to find and mark the deferred message
        try {
          const currentUserId = await getCurrentUserId(null);
          const deferredQuery = query(
            collection(db, 'deferredMissedMessages'),
            where('userId', '==', currentUserId),
            where('viewed', '==', false)
          );
          const deferredSnapshot = await getDocs(deferredQuery);
          
          for (const deferredDoc of deferredSnapshot.docs) {
            const data = deferredDoc.data();
            const matchesFriend = params.friendId && data.friendId === params.friendId;
            const matchesGroup = params.groupId && data.groupId === params.groupId;
            
            if (matchesFriend || matchesGroup) {
              updatePromises.push(
                updateDoc(doc(db, 'deferredMissedMessages', deferredDoc.id), { viewed: true })
                  .catch(error => console.error('Error marking deferred as viewed:', error))
              );
              break;
            }
          }
        } catch (error) {
          console.error('Error finding deferred message:', error);
        }
      }

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      // Also handle currently muted friends/groups - mark any deferred messages as viewed
      // OR create a deferred entry if one doesn't exist (for currently muted sources)
      try {
        const currentUserId = await getCurrentUserId(null);
        const deferredQuery = query(
          collection(db, 'deferredMissedMessages'),
          where('userId', '==', currentUserId),
          where('viewed', '==', false)
        );
        const deferredSnapshot = await getDocs(deferredQuery);
        
        const additionalUpdates: Promise<any>[] = [];
        let foundDeferred = false;
        
        for (const deferredDoc of deferredSnapshot.docs) {
          const data = deferredDoc.data();
          const matchesFriend = params.friendId && data.friendId === params.friendId;
          const matchesGroup = params.groupId && data.groupId === params.groupId;
          
          if (matchesFriend || matchesGroup) {
            foundDeferred = true;
            additionalUpdates.push(
              updateDoc(doc(db, 'deferredMissedMessages', deferredDoc.id), { viewed: true })
                .catch(error => console.error('Error marking deferred as viewed:', error))
            );
          }
        }
        
        // If no deferred entry exists for this friend/group, create one and mark it as viewed
        // This ensures currently muted sources are also tracked and will disappear from selection
        if (!foundDeferred && (params.friendId || params.groupId)) {
          const muteStartTime = params.muteStartTime ? Timestamp.fromDate(new Date(params.muteStartTime)) : null;
          const muteEndTime = params.muteEndTime ? Timestamp.fromDate(new Date(params.muteEndTime)) : Timestamp.now();
          
          const newDeferredDoc = {
            userId: currentUserId,
            friendId: params.friendId || null,
            groupId: params.groupId || null,
            groupName: params.groupName || null,
            muteStartTime: muteStartTime,
            muteEndTime: muteEndTime,
            messageCount: messages.length,
            createdAt: Timestamp.now(),
            viewed: true, // Mark as viewed immediately since messages are dismissed
          };
          
          await addDoc(collection(db, 'deferredMissedMessages'), newDeferredDoc);
        }
        
        await Promise.all(additionalUpdates);
      } catch (error) {
        console.error('Error marking deferred messages:', error);
      }

      // Short delay to ensure Firestore updates are propagated
      await new Promise(resolve => setTimeout(resolve, 300));

      // Navigate back to friends tab
      router.back();
      
      // Show success message after navigation
      setTimeout(() => {
        Alert.alert('Success', `Dismissed ${messages.length} missed message${messages.length !== 1 ? 's' : ''}`);
      }, 200);
    } catch (error) {
      console.error('Error dismissing messages:', error);
      Alert.alert('Error', 'Failed to dismiss messages');
      setDismissing(false);
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only respond to downward swipes, and only if it's a significant downward movement
      // This allows ScrollView to work normally for scrolling up/down
      return gestureState.dy > 20 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 2;
    },
    onPanResponderMove: (_, gestureState) => {
      // Visual feedback could be added here if needed
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > SWIPE_THRESHOLD) {
        // Swipe down to dismiss all
        handleDismissAll();
      }
    },
  });

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m ago`;
    }
    return `${diffMins}m ago`;
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <ThemedText style={styles.loadingText}>Loading missed messages...</ThemedText>
      </ThemedView>
    );
  }

  if (messages.length === 0) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.icon }]}>
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
        <ThemedText style={styles.headerTitle}>
          {messages.length} Missed Message{messages.length !== 1 ? 's' : ''}
        </ThemedText>
      </View>

      <ScrollView 
        style={styles.messagesList} 
        contentContainerStyle={styles.messagesContent}
        scrollEnabled={true}
        nestedScrollEnabled={true}>
        <View style={[styles.allMessagesCard, { borderColor: colors.icon, backgroundColor: colors.background }]}>
          {messages.map((msg, index) => (
            <View key={msg.id} style={styles.messageItem}>
              <View style={styles.messageHeader}>
                <ThemedText style={styles.fromText}>
                  {msg.isGroupMessage && msg.groupName
                    ? `From: ${msg.groupName} (Group) • ${msg.fromDisplayName || msg.fromUsername || 'Unknown'} (@${msg.fromUsername || 'unknown'})`
                    : `From: ${msg.fromDisplayName || msg.fromUsername || 'Unknown'}${msg.fromUsername ? ` (@${msg.fromUsername})` : ''}`}
                </ThemedText>
                <ThemedText style={styles.timeText}>{formatTime(msg.createdAt)}</ThemedText>
              </View>
              <ThemedText style={styles.messageText}>{msg.message}</ThemedText>
              {index < messages.length - 1 && <View style={[styles.separator, { borderColor: colors.icon }]} />}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom, borderTopColor: colors.icon }]} {...panResponder.panHandlers}>
        <ThemedText style={styles.swipeHint}>
          Swipe down to dismiss all messages
        </ThemedText>
        <IconSymbol name="chevron.down" size={20} color={colors.icon} />
      </View>
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
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
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
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  allMessagesCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageItem: {
    marginBottom: 16,
  },
  messageCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  fromText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  separator: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  swipeHint: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
});

