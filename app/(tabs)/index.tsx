import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image, Keyboard, PanResponder, Dimensions, KeyboardAvoidingView, Platform, Animated, Modal } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { isFriendMuted, isGroupMuted } from '@/utils/muteHelpers';
import React from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from '@/services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Friend, Group } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

// ============================================================================
// HOOT SCREEN - Main component for sending Hoots
// ============================================================================

export default function HomeScreen() {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================
  const { user } = useAuth();
  const [hootText, setHootText] = useState('Hoot!');
  const [defaultHootText, setDefaultHootText] = useState('Hoot!');
  const [sendMode, setSendMode] = useState<'all' | 'users' | 'groups'>('all');

  // Load last selected send mode, groups, and users on mount
  useEffect(() => {
    const loadLastSelections = async () => {
      try {
        // Load send mode
        const lastSendMode = await AsyncStorage.getItem('hoot_lastSendMode');
        if (lastSendMode && (lastSendMode === 'all' || lastSendMode === 'users' || lastSendMode === 'groups')) {
          setSendMode(lastSendMode as 'all' | 'users' | 'groups');
        }

        // Load favorite order
        const savedOrder = await AsyncStorage.getItem('hoot_favoriteOrder');
        if (savedOrder) {
          setFavoriteOrder(JSON.parse(savedOrder));
        }

        // Load favorite group order
        const savedGroupOrder = await AsyncStorage.getItem('hoot_favoriteGroupOrder');
        if (savedGroupOrder) {
          setFavoriteGroupOrder(JSON.parse(savedGroupOrder));
        }

        // Load favorites mode preference
        const savedFavoritesMode = await AsyncStorage.getItem('hoot_favoritesMode');
        if (savedFavoritesMode === 'friends' || savedFavoritesMode === 'groups') {
          setFavoritesMode(savedFavoritesMode);
        }

        // Load selected groups
        const savedGroups = await AsyncStorage.getItem('hoot_selectedGroups');
        if (savedGroups) {
          try {
            const parsedGroups = JSON.parse(savedGroups);
            if (Array.isArray(parsedGroups)) {
              setSelectedGroups(parsedGroups);
            }
          } catch (e) {
            console.error('Error parsing saved groups:', e);
          }
        }

        // Load selected users
        const savedUsers = await AsyncStorage.getItem('hoot_selectedUsers');
        if (savedUsers) {
          try {
            const parsedUsers = JSON.parse(savedUsers);
            if (Array.isArray(parsedUsers)) {
              setSelectedUsers(parsedUsers);
            }
          } catch (e) {
            console.error('Error parsing saved users:', e);
          }
        }
      } catch (error) {
        console.error('Error loading last selections:', error);
      }
    };
    loadLastSelections();
  }, []);

  // Helper function to update send mode and save to AsyncStorage
  const updateSendMode = async (mode: 'all' | 'users' | 'groups') => {
    setSendMode(mode);
    try {
      await AsyncStorage.setItem('hoot_lastSendMode', mode);
    } catch (error) {
      console.error('Error saving send mode:', error);
    }

    // Sync favorites mode with send mode
    if (mode === 'users') {
      setFavoritesMode('friends');
      await AsyncStorage.setItem('hoot_favoritesMode', 'friends');
    } else if (mode === 'groups') {
      setFavoritesMode('groups');
      await AsyncStorage.setItem('hoot_favoritesMode', 'groups');
    }
  };
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // Mute modal state
  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [selectedFriendForMute, setSelectedFriendForMute] = useState<Friend | null>(null);
  const [selectedGroupForMute, setSelectedGroupForMute] = useState<Group | null>(null);
  const [isMutingGroup, setIsMutingGroup] = useState(false);
  const [customMuteHours, setCustomMuteHours] = useState('24');

  // Sync favorites mode with send mode
  useEffect(() => {
    if (sendMode === 'users' && favoritesMode !== 'friends') {
      setFavoritesMode('friends');
      AsyncStorage.setItem('hoot_favoritesMode', 'friends');
    } else if (sendMode === 'groups' && favoritesMode !== 'groups') {
      setFavoritesMode('groups');
      AsyncStorage.setItem('hoot_favoritesMode', 'groups');
    }
  }, [sendMode]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteOrder, setFavoriteOrder] = useState<string[]>([]);
  const [favoriteGroupOrder, setFavoriteGroupOrder] = useState<string[]>([]);
  const [favoritesMode, setFavoritesMode] = useState<'friends' | 'groups'>('friends');
  const scrollViewRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const hootEmojiOpacity = useRef(new Animated.Value(1)).current;
  const hootEmojiTranslateX = useRef(new Animated.Value(0)).current;
  const hootEmojiTranslateY = useRef(new Animated.Value(0)).current;
  const hootEmojiRotation = useRef(new Animated.Value(0)).current;
  const searchInputY = useRef<number>(0);
  const firstResultY = useRef<number>(0);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left: go to Friends
          router.push('/(tabs)/friends');
        }
      },
    })
  ).current;

  // Update favorite order when friends change
  useEffect(() => {
    const favoriteFriends = friends.filter(f => f.isFavorite);
    if (favoriteFriends.length === 0) {
      if (favoriteOrder.length > 0) {
        setFavoriteOrder([]);
        AsyncStorage.setItem('hoot_favoriteOrder', JSON.stringify([]));
      }
      return;
    }

    const currentOrder = favoriteOrder.length > 0 ? favoriteOrder : [];
    const validOrder = currentOrder.filter(id =>
      favoriteFriends.some(f => f.friendId === id)
    );
    const newFavorites = favoriteFriends
      .filter(f => !currentOrder.includes(f.friendId))
      .map(f => f.friendId);

    if (newFavorites.length > 0) {
      const updatedOrder = [...validOrder, ...newFavorites];
      setFavoriteOrder(updatedOrder);
      AsyncStorage.setItem('hoot_favoriteOrder', JSON.stringify(updatedOrder));
    } else if (validOrder.length < currentOrder.length) {
      // Some favorites were removed, update order
      setFavoriteOrder(validOrder);
      AsyncStorage.setItem('hoot_favoriteOrder', JSON.stringify(validOrder));
    }
  }, [friends.map(f => f.id + (f.isFavorite ? 'fav' : '')).join(',')]);

  // Update favorite group order when groups change
  useEffect(() => {
    const favoriteGroups = groups.filter(g => g.isFavorite);
    if (favoriteGroups.length === 0) {
      if (favoriteGroupOrder.length > 0) {
        setFavoriteGroupOrder([]);
        AsyncStorage.setItem('hoot_favoriteGroupOrder', JSON.stringify([]));
      }
      return;
    }

    const currentOrder = favoriteGroupOrder.length > 0 ? favoriteGroupOrder : [];
    const validOrder = currentOrder.filter(id =>
      favoriteGroups.some(g => g.id === id)
    );
    const newFavorites = favoriteGroups
      .filter(g => !currentOrder.includes(g.id))
      .map(g => g.id);

    if (newFavorites.length > 0) {
      const updatedOrder = [...validOrder, ...newFavorites];
      setFavoriteGroupOrder(updatedOrder);
      AsyncStorage.setItem('hoot_favoriteGroupOrder', JSON.stringify(updatedOrder));
    } else if (validOrder.length < currentOrder.length) {
      // Some favorites were removed, update order
      setFavoriteGroupOrder(validOrder);
      AsyncStorage.setItem('hoot_favoriteGroupOrder', JSON.stringify(validOrder));
    }
  }, [groups.map(g => g.id + (g.isFavorite ? 'fav' : '')).join(',')]);

  useEffect(() => {
    loadFriendsAndGroups();
    // Register for push notifications - ONLY for authenticated users
    const registerPushToken = async () => {
      // CRITICAL: Only register if we have a valid authenticated user
      if (user?.uid) {
        console.log('📱 Registering push token for authenticated user:', user.uid);
        await registerForPushNotifications(user.uid);
      } else {
        console.log('⚠️ Skipping push token registration: No authenticated user');
      }
    };
    registerPushToken();
  }, [user]);

  // Refresh groups and friends when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadFriendsAndGroups();
      // Also refresh default Hoot text in case it was changed in settings
      const refreshDefaultText = async () => {
        try {
          const currentUserId = user?.uid || await AsyncStorage.getItem('hoot_userId') || 'temp_user';
          const userDoc = await getDoc(doc(db, 'users', currentUserId));
          const userData = userDoc.data();
          const customDefault = userData?.defaultHootText || 'Hoot!';
          setDefaultHootText(customDefault);
        } catch (error) {
          console.error('Error refreshing default Hoot text:', error);
        }
      };
      refreshDefaultText();
    }, [user])
  );

  const loadFriendsAndGroups = async () => {
    try {
      // Get current user ID
      const currentUserId = user?.uid || await AsyncStorage.getItem('hoot_userId') || 'temp_user';

      // Load user's default Hoot text and hoot count
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUserId));
        const userData = userDoc.data();
        const customDefault = userData?.defaultHootText || 'Hoot!';
        setDefaultHootText(customDefault);
        // Set initial hoot text to the custom default
        setHootText(customDefault);
      } catch (error) {
        console.error('Error loading user data:', error);
      }

      // Load friends with display names
      const friendsQuery = query(
        collection(db, 'friendships'),
        where('userId', '==', currentUserId),
        where('status', '==', 'accepted')
      );
      const friendsSnapshot = await getDocs(friendsQuery);
      const friendsList = await Promise.all(
        friendsSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const friendDoc = await getDoc(doc(db, 'users', data.friendId));
          const friendData = friendDoc.data();
          return {
            id: docSnap.id,
            friendId: data.friendId,
            friendUsername: friendData?.username,
            friendDisplayName: friendData?.displayName,
            isFavorite: data.isFavorite || false,
            mutedUntil: data.mutedUntil ? data.mutedUntil.toDate() : null,
            streakCount: data.streakCount || 0,
            lastHootDate: data.lastHootDate || null,
          };
        })
      );

      setFriends(friendsList);

      // Load groups with streak data
      const groupsQuery = query(
        collection(db, 'groups'),
        where('memberIds', 'array-contains', currentUserId)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsList = groupsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          memberIds: data.memberIds || [],
          streakCount: data.streakCount || 0,
          lastHootDate: data.lastHootDate || null,
          isFavorite: data.isFavorite || false,
        };
      }) as Group[];

      // Load per-user mute settings for all groups
      const groupMutesQuery = query(
        collection(db, 'groupMutes'),
        where('userId', '==', currentUserId)
      );
      const groupMutesSnapshot = await getDocs(groupMutesQuery);
      const groupMutesMap = new Map<string, Date | null>();

      groupMutesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        groupMutesMap.set(data.groupId, data.mutedUntil ? data.mutedUntil.toDate() : null);
      });

      // Merge mute settings into groups
      const groupsWithMutes = groupsList.map(group => ({
        ...group,
        mutedUntil: groupMutesMap.get(group.id) || null,
      }));

      setGroups(groupsWithMutes);
    } catch (error) {
      console.error('Error loading friends and groups:', error);
    }
  };

  const animateHootEmoji = () => {
    // Generate random angle only for top half of button (not bottom)
    // Top half: from -π/2 (up) to π/2 (down), but we want to avoid bottom
    // So we'll use angles from -π (left) to 0 (right) and 0 to π (but avoiding bottom)
    // Actually, simpler: use angles from -π to 0 (left to right, top half)
    // This covers: left (-π), up-left, up, up-right, right (0)
    // To also include some right-side angles, we can use: -π to π but exclude angles that point down
    // Best approach: use angles from -π to 0 (covers left, up, right in top half)
    const angle = -Math.PI + Math.random() * Math.PI; // Range: -π to 0 (left to right, top half only)
    // Random distance between 80 and 120 pixels
    const distance = 80 + Math.random() * 40;
    const translateX = Math.cos(angle) * distance;
    const translateY = Math.sin(angle) * distance;

    // Calculate rotation so bottom of image faces center
    // When emoji is at (translateX, translateY), the center is at (0, 0)
    // Angle from emoji position back to center = atan2(-translateY, -translateX)
    // Image's natural bottom points down (90 degrees in React Native, where 0° = right, 90° = down)
    // To make bottom point toward center, rotate by: angleToCenter - 90
    const angleToCenter = Math.atan2(-translateY, -translateX);
    // Convert to degrees: angleToCenter (rad) -> degrees, then subtract 90 so bottom points toward center
    const rotationDegrees = ((angleToCenter * 180) / Math.PI) - 90;

    // Start with emoji hidden behind button (only head visible)
    // The button is 120x120, emoji is 60x60, so center is at (30, 30)
    // To show only half the emoji peeking out max, we need to move it up
    // Half of 60px emoji = 30px, so move up by 30px to show only half
    // This distance should always be consistent relative to button center
    const peekDistance = -30; // Always peek out exactly 30px (half emoji height)

    // Reset values - start hidden behind button (only head visible)
    // Keep opacity at 1 so it's visible, just positioned behind
    hootEmojiOpacity.setValue(1);
    hootEmojiTranslateX.setValue(0);
    hootEmojiTranslateY.setValue(peekDistance);
    hootEmojiRotation.setValue(0);

    // Animation sequence:
    // 1. Peek out (translateY from peekDistance to 0, maintaining consistent distance from center)
    // 2. Slide out in random direction while rotating
    // 3. Slide back while rotating back
    // 4. Hide again (translateY back to peekDistance)
    Animated.sequence([
      // Peek out - always to the same position (centered)
      Animated.timing(hootEmojiTranslateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      // Slide out
      Animated.parallel([
        Animated.timing(hootEmojiTranslateX, {
          toValue: translateX,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(hootEmojiTranslateY, {
          toValue: translateY,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(hootEmojiRotation, {
          toValue: rotationDegrees,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Slide back
      Animated.parallel([
        Animated.timing(hootEmojiTranslateX, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(hootEmojiTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(hootEmojiRotation, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Hide again - always return to the same peek distance
      Animated.parallel([
        Animated.timing(hootEmojiTranslateY, {
          toValue: peekDistance,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(hootEmojiOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };


  const sendHoot = async () => {
    if (hootText.trim().length === 0) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setLoading(true);

    try {
      let recipients: string[] = [];

      if (sendMode === 'all') {
        // Get all friend IDs
        recipients = friends.map(f => f.friendId);
      } else if (sendMode === 'users') {
        // Get selected user IDs
        recipients = selectedUsers;
        if (selectedUsers.length === 0) {
          Alert.alert('No Recipients', 'Please select friends to send a Hoot');
          setLoading(false);
          return;
        }
      } else if (sendMode === 'groups') {
        // Check if any groups are selected
        if (selectedGroups.length === 0) {
          Alert.alert('No Recipients', 'Please select groups to send a Hoot');
          setLoading(false);
          return;
        }
      }

      // Track which groups were selected (for display purposes)
      let groupInfo: { id: string; name: string }[] = [];
      if (sendMode === 'groups' && selectedGroups.length > 0) {
        groupInfo = selectedGroups
          .map(groupId => {
            const group = groups.find(g => g.id === groupId);
            return group ? { id: group.id, name: group.name } : null;
          })
          .filter((g): g is { id: string; name: string } => g !== null);
      }

      if (sendMode === 'all' && recipients.length === 0) {
        Alert.alert('No Recipients', 'Please add friends to send a Hoot');
        setLoading(false);
        return;
      }

      // Get sender's display name
      const currentUserId = user?.uid || await AsyncStorage.getItem('hoot_userId') || 'temp_user';
      const senderDoc = await getDoc(doc(db, 'users', currentUserId));
      const senderData = senderDoc.data();
      const fromDisplayName = senderData?.displayName || senderData?.username || 'Someone';

      // Note: Muting only prevents receiving push notifications, not sending hoots
      // The Cloud Function will check if recipients have muted the sender and skip notifications accordingly
      // But we still create the message and notification documents so users can see the hoots in the app

      // For groups mode, create separate messages for each group
      // This ensures each group's missed messages are independent
      if (sendMode === 'groups' && groupInfo.length > 0) {
        const allMessagePromises: Promise<any>[] = [];

        // For each group, create messages for all members of that group
        for (const group of groupInfo) {
          const groupObj = groups.find(g => g.id === group.id);
          if (!groupObj) continue;

          // Get members of this specific group, excluding the sender
          const groupMembers = groupObj.memberIds.filter(memberId => memberId !== currentUserId);
          if (groupMembers.length === 0) continue;

          // Get recipient data for this group's members
          const recipientDocs = await Promise.all(
            groupMembers.map(memberId => getDoc(doc(db, 'users', memberId)))
          );

          // Create message documents for each member of this group
          const messagePromises = recipientDocs.map(async (recipientDoc, index) => {
            if (!recipientDoc.exists()) return null;

            const recipientData = recipientDoc.data();
            const recipientId = groupMembers[index];
            const pushToken = recipientData?.pushToken;

            // Calculate expiration time (24 hours from now)
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            // Temporarily use mock user data - OAuth bypass
            const fromUserId = user?.uid || 'temp_user';
            const fromUsername = user?.username || 'temp_user';

            // Create message document tagged with THIS specific group
            const messageDoc = await addDoc(collection(db, 'messages'), {
              fromUserId: fromUserId,
              fromUsername: fromUsername,
              fromDisplayName: fromDisplayName,
              toUserId: recipientId,
              message: hootText,
              createdAt: new Date(),
              expiresAt: expiresAt,
              viewed: false,
              type: 'hoot',
              groupId: group.id, // Tag with THIS specific group
              groupName: group.name,
              isGroupMessage: true,
            });

            // Store notification data for backend to send push notification
            if (pushToken) {
              await addDoc(collection(db, 'notifications'), {
                fromUserId: fromUserId,
                fromUsername: fromUsername,
                fromDisplayName: fromDisplayName,
                toUserId: recipientId,
                messageId: messageDoc.id,
                message: hootText,
                pushToken: pushToken,
                timestamp: new Date(),
                type: 'hoot',
                groupId: group.id, // Tag with THIS specific group
                groupName: group.name,
                isGroupMessage: true,
              });
            }

            return { messageId: messageDoc.id, recipientId, pushToken };
          });

          allMessagePromises.push(...messagePromises);
        }

        await Promise.all(allMessagePromises);
      } else {
        // For 'all' or 'users' mode, use the original logic
        // Filter out the sender from recipients (don't send notification to yourself)
        recipients = recipients.filter(recipientId => recipientId !== currentUserId);

        if (recipients.length === 0) {
          Alert.alert('No Recipients', 'You cannot send a Hoot to yourself');
          setLoading(false);
          return;
        }

        // Get recipient data and create individual message documents
        const recipientDocs = await Promise.all(
          recipients.map(recipientId => getDoc(doc(db, 'users', recipientId)))
        );

        // Create message documents for each recipient
        const messagePromises = recipientDocs.map(async (recipientDoc, index) => {
          if (!recipientDoc.exists()) return null;

          const recipientData = recipientDoc.data();
          const recipientId = recipients[index];
          const pushToken = recipientData?.pushToken;

          // Calculate expiration time (24 hours from now)
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);

          // Temporarily use mock user data - OAuth bypass
          const fromUserId = user?.uid || 'temp_user';
          const fromUsername = user?.username || 'temp_user';

          // Create message document
          const messageDoc = await addDoc(collection(db, 'messages'), {
            fromUserId: fromUserId,
            fromUsername: fromUsername,
            fromDisplayName: fromDisplayName,
            toUserId: recipientId,
            message: hootText,
            createdAt: new Date(),
            expiresAt: expiresAt,
            viewed: false,
            type: 'hoot',
            groupId: null,
            groupName: null,
            isGroupMessage: false,
          });

          // Store notification data for backend to send push notification
          // Include messageId so notification can navigate to message view
          if (pushToken) {
            await addDoc(collection(db, 'notifications'), {
              fromUserId: fromUserId,
              fromUsername: fromUsername,
              fromDisplayName: fromDisplayName,
              toUserId: recipientId,
              messageId: messageDoc.id,
              message: hootText,
              pushToken: pushToken,
              timestamp: new Date(),
              type: 'hoot',
              groupId: null,
              groupName: null,
              isGroupMessage: false,
            });
          }

          return { messageId: messageDoc.id, recipientId, pushToken };
        });

        await Promise.all(messagePromises);
      }

      // Trigger hoot emoji animation only after successful send
      animateHootEmoji();

      // Update streaks for selected users and groups
      const today = new Date().toISOString().split('T')[0];

      // Update streaks for selected users
      if (sendMode === 'users' && selectedUsers.length > 0) {
        await Promise.all(
          selectedUsers.map(async (userId) => {
            try {
              // Find the friendship document
              const friendshipQuery = query(
                collection(db, 'friendships'),
                where('userId', '==', currentUserId),
                where('friendId', '==', userId),
                where('status', '==', 'accepted')
              );
              const friendshipSnapshot = await getDocs(friendshipQuery);

              if (!friendshipSnapshot.empty) {
                const friendshipDoc = friendshipSnapshot.docs[0];
                const friendshipData = friendshipDoc.data();
                const lastHootDate = friendshipData.lastHootDate;
                let newStreakCount = 1;

                if (lastHootDate) {
                  const lastDate = new Date(lastHootDate);
                  const todayDate = new Date(today);
                  const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

                  if (daysDiff === 1) {
                    // Consecutive day - increment streak
                    newStreakCount = (friendshipData.streakCount || 0) + 1;
                  } else if (daysDiff === 0) {
                    // Same day - keep current streak
                    newStreakCount = friendshipData.streakCount || 0;
                  }
                  // If daysDiff > 1, streak is broken, start at 1
                }

                await updateDoc(friendshipDoc.ref, {
                  streakCount: newStreakCount,
                  lastHootDate: today,
                });

                // Update local state
                setFriends(prevFriends =>
                  prevFriends.map(f =>
                    f.friendId === userId
                      ? { ...f, streakCount: newStreakCount, lastHootDate: today }
                      : f
                  )
                );
              }
            } catch (error) {
              console.error(`Error updating streak for user ${userId}:`, error);
            }
          })
        );
      }

      // Update streaks for selected groups
      if (sendMode === 'groups' && selectedGroups.length > 0) {
        await Promise.all(
          selectedGroups.map(async (groupId) => {
            try {
              const groupDoc = doc(db, 'groups', groupId);
              const groupData = (await getDoc(groupDoc)).data();

              if (groupData) {
                const lastHootDate = groupData.lastHootDate;
                let newStreakCount = 1;

                if (lastHootDate) {
                  const lastDate = new Date(lastHootDate);
                  const todayDate = new Date(today);
                  const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

                  if (daysDiff === 1) {
                    // Consecutive day - increment streak
                    newStreakCount = (groupData.streakCount || 0) + 1;
                  } else if (daysDiff === 0) {
                    // Same day - keep current streak
                    newStreakCount = groupData.streakCount || 0;
                  }
                  // If daysDiff > 1, streak is broken, start at 1
                }

                await updateDoc(groupDoc, {
                  streakCount: newStreakCount,
                  lastHootDate: today,
                });

                // Update local state
                setGroups(prevGroups =>
                  prevGroups.map(g =>
                    g.id === groupId
                      ? { ...g, streakCount: newStreakCount, lastHootDate: today }
                      : g
                  )
                );
              }
            } catch (error) {
              console.error(`Error updating streak for group ${groupId}:`, error);
            }
          })
        );
      }

      // Update fun stats in user document
      try {
        const userDocRef = doc(db, 'users', currentUserId);
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Get current user data to update stats
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data() || {};

        // Calculate stats
        const currentHootCount = userData.hootCount || 0;
        const currentTotalChars = userData.totalCharacters || 0;
        const dailyCounts = userData.dailyHootCounts || {};
        const dayOfWeekCounts = userData.dayOfWeekCounts || {};
        const recipientCounts = userData.recipientCounts || {};

        // Update daily count
        const todayCount = (dailyCounts[dateKey] || 0) + 1;
        const newDailyCounts = { ...dailyCounts, [dateKey]: todayCount };

        // Update day of week count
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
        const dayCount = (dayOfWeekCounts[dayName] || 0) + 1;
        const newDayOfWeekCounts = { ...dayOfWeekCounts, [dayName]: dayCount };

        // Update recipient counts
        const newRecipientCounts = { ...recipientCounts };
        recipients.forEach(recipientId => {
          newRecipientCounts[recipientId] = (newRecipientCounts[recipientId] || 0) + 1;
        });

        // Update user document with all stats
        await updateDoc(userDocRef, {
          hootCount: increment(1),
          totalCharacters: increment(hootText.length),
          dailyHootCounts: newDailyCounts,
          dayOfWeekCounts: newDayOfWeekCounts,
          recipientCounts: newRecipientCounts,
        });
      } catch (error) {
        console.error('Error updating fun stats:', error);
      }

      setHootText(defaultHootText);
    } catch (error) {
      console.error('Error sending Hoot:', error);
      Alert.alert('Error', 'Failed to send Hoot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = async (groupId: string) => {
    const newGroups = selectedGroups.includes(groupId)
      ? selectedGroups.filter(id => id !== groupId)
      : [...selectedGroups, groupId];
    setSelectedGroups(newGroups);
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem('hoot_selectedGroups', JSON.stringify(newGroups));
    } catch (error) {
      console.error('Error saving selected groups:', error);
    }
  };

  const toggleUser = async (userId: string) => {
    const newUsers = selectedUsers.includes(userId)
      ? selectedUsers.filter(id => id !== userId)
      : [...selectedUsers, userId];
    setSelectedUsers(newUsers);
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem('hoot_selectedUsers', JSON.stringify(newUsers));
    } catch (error) {
      console.error('Error saving selected users:', error);
    }
  };



  // Filter friends and groups based on search query, then sort to show selected first (maintaining selection order)
  const filteredFriends = friends
    .filter(friend => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.trim().toLowerCase();
      const username = (friend.friendUsername || '').toLowerCase();
      const displayName = (friend.friendDisplayName || '').toLowerCase();
      return username.includes(query) || displayName.includes(query);
    })
    .sort((a, b) => {
      const aSelected = selectedUsers.includes(a.friendId);
      const bSelected = selectedUsers.includes(b.friendId);

      // If both are selected, maintain their order in selectedUsers array
      if (aSelected && bSelected) {
        const aIndex = selectedUsers.indexOf(a.friendId);
        const bIndex = selectedUsers.indexOf(b.friendId);
        return aIndex - bIndex;
      }

      // Selected items come first
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      // Both unselected - maintain original order
      return 0;
    });

  const filteredGroups = groups
    .filter(group => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.trim().toLowerCase();
      return group.name.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const aSelected = selectedGroups.includes(a.id);
      const bSelected = selectedGroups.includes(b.id);

      // If both are selected, maintain their order in selectedGroups array
      if (aSelected && bSelected) {
        const aIndex = selectedGroups.indexOf(a.id);
        const bIndex = selectedGroups.indexOf(b.id);
        return aIndex - bIndex;
      }

      // Selected items come first
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      // Both unselected - maintain original order
      return 0;
    });

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        {...panResponder.panHandlers}>
        <ThemedView style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40, backgroundColor: colors.background }]}>
          <View style={styles.titleContainer}>
            <Image
              source={require('@/assets/images/hoot-emoji.png')}
              style={styles.emoji}
              resizeMode="contain"
            />
            <View style={styles.snowflakesRow}>
              <ThemedText style={styles.snowflake}>❄️</ThemedText>
              <ThemedText style={styles.snowflake}>❄️</ThemedText>
            </View>
            <ThemedText type="title" style={styles.title}>
              Send a Hoot
            </ThemedText>
          </View>

          {/* ================================================================
              INPUT SECTION
              ================================================================ */}
          <ThemedView style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#000',
                  borderColor: colors.icon,
                  backgroundColor: '#fff',
                  shadowColor: colors.icon,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 6,
                },
              ]}
              placeholder="Hoot!"
              placeholderTextColor={colors.icon}
              value={hootText}
              onChangeText={(text) => {
                if (text.length <= 100) {
                  const defaultText = defaultHootText.trim();

                  // If text is exactly the default text, keep it as is (user hasn't started typing yet)
                  if (text === defaultText) {
                    setHootText(text);
                    return;
                  }

                  // If text starts with default text and user is adding characters
                  if (text.startsWith(defaultText) && text.length > defaultText.length) {
                    const afterDefault = text.substring(defaultText.length);

                    // If there's no space after the default text, add one
                    if (afterDefault && !afterDefault.startsWith(' ')) {
                      setHootText(defaultText + ' ' + afterDefault);
                      return;
                    }
                  }

                  setHootText(text);
                }
              }}
              multiline
              numberOfLines={1}
              maxLength={100}
              editable={!loading}
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <ThemedText style={[styles.charCount, { color: colors.icon }]}>
              {hootText.length}/100
            </ThemedText>
          </ThemedView>

          {/* ================================================================
              SEND BUTTON SECTION
              ================================================================ */}
          <View style={styles.sendButtonContainer}>
            <Animated.View
              style={[
                styles.hootEmoji,
                {
                  opacity: hootEmojiOpacity,
                  transform: [
                    { translateX: hootEmojiTranslateX },
                    { translateY: hootEmojiTranslateY },
                    {
                      rotate: hootEmojiRotation.interpolate({
                        inputRange: [0, 360],
                        outputRange: ['0deg', '360deg'],
                      })
                    },
                  ],
                },
              ]}
              pointerEvents="none">
              <Image
                source={require('@/assets/images/hoot-emoji.png')}
                style={styles.hootEmojiImage}
                resizeMode="contain"
              />
            </Animated.View>
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.sendButton,
                {
                  backgroundColor: colors.tint,
                  opacity: 1, // Always maintain full opacity
                  shadowColor: colors.tint,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 10,
                },
              ]}
              onPress={sendHoot}
              disabled={loading}>
              {loading ? (
                <ThemedText style={styles.sendingButtonText}>Sending...</ThemedText>
              ) : (
                <View style={styles.sendButtonTextContainer}>
                  <ThemedText style={styles.sendButtonText}>Send</ThemedText>
                  <ThemedText style={styles.sendButtonText}>Hoot</ThemedText>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <ThemedView style={styles.sendModeContainer}>
            <ThemedText style={styles.sendModeTitle}>Send to: ❄️</ThemedText>
            <View style={styles.sendModeButtons}>
              <TouchableOpacity
                style={[
                  styles.sendModeButton,
                  {
                    backgroundColor: sendMode === 'users' ? colors.tint : '#fff',
                    borderColor: sendMode === 'users' ? colors.tint : colors.icon,
                  },
                ]}
                onPress={async () => {
                  await updateSendMode('users');
                  setSelectedGroups([]);
                  setSearchQuery('');
                  // Clear groups from storage when switching to users mode
                  try {
                    await AsyncStorage.setItem('hoot_selectedGroups', JSON.stringify([]));
                  } catch (error) {
                    console.error('Error clearing groups:', error);
                  }
                }}>
                <ThemedText
                  style={[
                    styles.sendModeButtonText,
                    { color: sendMode === 'users' ? '#fff' : colors.text },
                  ]}>
                  Select Friends
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sendModeButton,
                  {
                    backgroundColor: sendMode === 'groups' ? colors.tint : '#fff',
                    borderColor: sendMode === 'groups' ? colors.tint : colors.icon,
                  },
                ]}
                onPress={async () => {
                  await updateSendMode('groups');
                  setSelectedUsers([]);
                  setSearchQuery('');
                  // Clear users from storage when switching to groups mode
                  try {
                    await AsyncStorage.setItem('hoot_selectedUsers', JSON.stringify([]));
                  } catch (error) {
                    console.error('Error clearing users:', error);
                  }
                }}>
                <ThemedText
                  style={[
                    styles.sendModeButtonText,
                    { color: sendMode === 'groups' ? '#fff' : colors.text },
                  ]}>
                  Groups
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sendModeButton,
                  {
                    backgroundColor: sendMode === 'all' ? colors.tint : '#fff',
                    borderColor: sendMode === 'all' ? colors.tint : colors.icon,
                  },
                ]}
                onPress={async () => {
                  await updateSendMode('all');
                  setSelectedUsers([]);
                  setSelectedGroups([]);
                  setSearchQuery('');
                  // Clear both from storage when switching to all mode
                  try {
                    await AsyncStorage.setItem('hoot_selectedUsers', JSON.stringify([]));
                    await AsyncStorage.setItem('hoot_selectedGroups', JSON.stringify([]));
                  } catch (error) {
                    console.error('Error clearing selections:', error);
                  }
                }}>
                <ThemedText
                  style={[
                    styles.sendModeButtonText,
                    { color: sendMode === 'all' ? '#fff' : colors.text },
                  ]}>
                  All Friends
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>

          {/* Quick Select Favorites - Combined Friends and Groups */}
          {(() => {
            const favoriteFriends = friends.filter(f => f.isFavorite);
            const favoriteGroups = groups.filter(g => g.isFavorite);

            // Show section only if there are favorites in either category
            if (favoriteFriends.length === 0 && favoriteGroups.length === 0) return null;

            // Determine which mode to show based on sendMode
            let displayMode: 'friends' | 'groups' = favoritesMode;
            if (sendMode === 'users' && favoriteFriends.length > 0) {
              displayMode = 'friends';
            } else if (sendMode === 'groups' && favoriteGroups.length > 0) {
              displayMode = 'groups';
            }

            // Sort favorites based on saved order
            const sortedFavorites = [...favoriteFriends].sort((a, b) => {
              const indexA = favoriteOrder.indexOf(a.friendId);
              const indexB = favoriteOrder.indexOf(b.friendId);

              // If both are in the order, sort by their position
              if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
              }
              // If only A is in the order, A comes first
              if (indexA !== -1) return -1;
              // If only B is in the order, B comes first
              if (indexB !== -1) return 1;
              // If neither is in the order, maintain original order
              return 0;
            });

            const sortedFavoriteGroups = [...favoriteGroups].sort((a, b) => {
              const indexA = favoriteGroupOrder.indexOf(a.id);
              const indexB = favoriteGroupOrder.indexOf(b.id);

              // If both are in the order, sort by their position
              if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
              }
              // If only A is in the order, A comes first
              if (indexA !== -1) return -1;
              // If only B is in the order, B comes first
              if (indexB !== -1) return 1;
              // If neither is in the order, maintain original order
              return 0;
            });

            const handleDragEnd = async ({ data }: { data: Friend[] }) => {
              const newOrder = data.map(f => f.friendId);
              setFavoriteOrder(newOrder);
              await AsyncStorage.setItem('hoot_favoriteOrder', JSON.stringify(newOrder));
            };

            const handleGroupDragEnd = async ({ data }: { data: Group[] }) => {
              const newOrder = data.map(g => g.id);
              setFavoriteGroupOrder(newOrder);
              await AsyncStorage.setItem('hoot_favoriteGroupOrder', JSON.stringify(newOrder));
            };

            const renderFavoriteItem = ({ item, drag, isActive }: RenderItemParams<Friend>) => {
              return (
                <ScaleDecorator>
                  <TouchableOpacity
                    style={[
                      styles.favoriteChip,
                      {
                        backgroundColor: selectedUsers.includes(item.friendId)
                          ? colors.tint
                          : '#fff',
                        borderColor: selectedUsers.includes(item.friendId)
                          ? colors.tint
                          : colors.icon,
                        opacity: isActive ? 0.5 : 1,
                      },
                    ]}
                    onLongPress={drag}
                    onPress={() => {
                      // Auto-select "Select Friends" mode if not already
                      if (sendMode !== 'users') {
                        updateSendMode('users');
                      }
                      toggleUser(item.friendId);
                    }}
                    disabled={isActive}>
                    <View style={styles.favoriteChipContent}>
                      <ThemedText
                        style={[
                          styles.favoriteChipText,
                          {
                            color: selectedUsers.includes(item.friendId)
                              ? '#fff'
                              : '#000',
                          },
                        ]}>
                        {item.friendDisplayName || item.friendUsername || 'Unknown'}
                      </ThemedText>
                      {(item.streakCount || 0) > 0 && (
                        <ThemedText
                          style={[
                            styles.favoriteStreakText,
                            {
                              color: selectedUsers.includes(item.friendId)
                                ? '#fff'
                                : colors.tint,
                            },
                          ]}>
                          🔥 {(item.streakCount || 0)}
                        </ThemedText>
                      )}
                    </View>
                  </TouchableOpacity>
                </ScaleDecorator>
              );
            };

            const renderFavoriteGroupItem = ({ item, drag, isActive }: RenderItemParams<Group>) => {
              return (
                <ScaleDecorator>
                  <TouchableOpacity
                    style={[
                      styles.favoriteChip,
                      {
                        backgroundColor: selectedGroups.includes(item.id)
                          ? colors.tint
                          : '#fff',
                        borderColor: selectedGroups.includes(item.id)
                          ? colors.tint
                          : colors.icon,
                        opacity: isActive ? 0.5 : 1,
                      },
                    ]}
                    onLongPress={drag}
                    onPress={() => {
                      // Auto-select "Groups" mode if not already
                      if (sendMode !== 'groups') {
                        updateSendMode('groups');
                      }
                      toggleGroup(item.id);
                    }}
                    disabled={isActive}>
                    <View style={styles.favoriteChipContent}>
                      <ThemedText
                        style={[
                          styles.favoriteChipText,
                          {
                            color: selectedGroups.includes(item.id)
                              ? '#fff'
                              : '#000',
                          },
                        ]}>
                        {item.name}
                      </ThemedText>
                      {(item.streakCount || 0) > 0 && (
                        <ThemedText
                          style={[
                            styles.favoriteStreakText,
                            {
                              color: selectedGroups.includes(item.id)
                                ? '#fff'
                                : colors.tint,
                            },
                          ]}>
                          🔥 {(item.streakCount || 0)}
                        </ThemedText>
                      )}
                    </View>
                  </TouchableOpacity>
                </ScaleDecorator>
              );
            };

            return (
              <ThemedView style={styles.favoritesContainer}>
                <View style={styles.favoritesTitleRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText style={styles.favoritesTitle}>Favorites</ThemedText>
                    <IconSymbol name="heart.fill" size={18} color={colors.tint} />
                  </View>
                  {favoriteFriends.length > 0 && favoriteGroups.length > 0 && (
                    <View style={styles.favoritesToggleContainer}>
                      <TouchableOpacity
                        style={[
                          styles.favoritesToggleButton,
                          {
                            backgroundColor: displayMode === 'friends' ? colors.tint : '#fff',
                            borderColor: displayMode === 'friends' ? colors.tint : colors.icon,
                          },
                        ]}
                        onPress={async () => {
                          setFavoritesMode('friends');
                          await AsyncStorage.setItem('hoot_favoritesMode', 'friends');
                          // Sync send mode to match
                          if (sendMode !== 'users') {
                            await updateSendMode('users');
                          }
                        }}>
                        <ThemedText
                          style={[
                            styles.favoritesToggleText,
                            {
                              color: displayMode === 'friends' ? '#fff' : '#000',
                            },
                          ]}>
                          Friends
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.favoritesToggleButton,
                          {
                            backgroundColor: displayMode === 'groups' ? colors.tint : '#fff',
                            borderColor: displayMode === 'groups' ? colors.tint : colors.icon,
                          },
                        ]}
                        onPress={async () => {
                          setFavoritesMode('groups');
                          await AsyncStorage.setItem('hoot_favoritesMode', 'groups');
                          // Sync send mode to match
                          if (sendMode !== 'groups') {
                            await updateSendMode('groups');
                          }
                        }}>
                        <ThemedText
                          style={[
                            styles.favoritesToggleText,
                            {
                              color: displayMode === 'groups' ? '#fff' : '#000',
                            },
                          ]}>
                          Groups
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <GestureHandlerRootView>
                  {displayMode === 'friends' && favoriteFriends.length > 0 ? (
                    <DraggableFlatList
                      data={sortedFavorites}
                      onDragEnd={handleDragEnd}
                      keyExtractor={(item) => item.friendId}
                      renderItem={renderFavoriteItem}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.favoritesScrollContent}
                    />
                  ) : displayMode === 'groups' && favoriteGroups.length > 0 ? (
                    <DraggableFlatList
                      data={sortedFavoriteGroups}
                      onDragEnd={handleGroupDragEnd}
                      keyExtractor={(item) => item.id}
                      renderItem={renderFavoriteGroupItem}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.favoritesScrollContent}
                    />
                  ) : (
                    <ThemedText style={styles.emptyFavoritesText}>
                      No {displayMode === 'friends' ? 'favorite friends' : 'favorite groups'} yet ❄️
                    </ThemedText>
                  )}
                </GestureHandlerRootView>
              </ThemedView>
            );
          })()}

          {/* ================================================================
              SELECTION LIST SECTION (Friends/Groups)
              ================================================================ */}
          {(sendMode === 'users' || sendMode === 'groups') && (
            <ThemedView style={styles.selectionContainer}>
              <ThemedText style={styles.selectionTitle}>
                {sendMode === 'users' ? 'Select Friends' : 'Select Groups'} ❄️
              </ThemedText>
              <View
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  searchInputY.current = y;
                }}>
                <TextInput
                  ref={searchInputRef}
                  style={[
                    styles.searchInput,
                    {
                      color: '#000',
                      borderColor: colors.icon,
                      backgroundColor: '#fff',
                    },
                  ]}
                  placeholder="Search..."
                  placeholderTextColor={colors.icon}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => {
                    // Scroll to show search input and first result when focused
                    setTimeout(() => {
                      // Calculate scroll position to show search input and first result
                      // Account for keyboard height (approximately 300-350px) and show first result
                      const scrollOffset = Math.max(0, searchInputY.current - 250);
                      scrollViewRef.current?.scrollTo({
                        y: scrollOffset,
                        animated: true
                      });
                    }, 300);
                  }}
                />
              </View>

              <ScrollView
                style={styles.selectionList}
                nestedScrollEnabled
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled">
                {sendMode === 'users' && (
                  <>
                    {filteredFriends.length === 0 ? (
                      <ThemedText style={styles.emptySelectionText}>
                        {searchQuery ? 'No friends found' : 'No friends yet ❄️'}
                      </ThemedText>
                    ) : (
                      filteredFriends.map((friend, index) => (
                        <TouchableOpacity
                          key={friend.id}
                          onLayout={index === 0 ? (event) => {
                            const { y } = event.nativeEvent.layout;
                            firstResultY.current = searchInputY.current + y;
                          } : undefined}
                          style={[
                            styles.selectionItem,
                            {
                              backgroundColor: selectedUsers.includes(friend.friendId)
                                ? colors.tint
                                : '#fff',
                              borderColor: selectedUsers.includes(friend.friendId)
                                ? colors.tint
                                : colors.icon,
                            },
                          ]}
                          onPress={() => toggleUser(friend.friendId)}>
                          <View style={styles.selectionItemInfo}>
                            <ThemedText
                              style={[
                                styles.selectionItemName,
                                {
                                  color: selectedUsers.includes(friend.friendId)
                                    ? '#fff'
                                    : '#000',
                                },
                              ]}>
                              {friend.friendDisplayName || friend.friendUsername || 'Unknown'}
                            </ThemedText>
                            {friend.friendUsername && (
                              <ThemedText
                                style={[
                                  styles.selectionItemUsername,
                                  {
                                    color: selectedUsers.includes(friend.friendId)
                                      ? '#fff'
                                      : '#000',
                                  },
                                ]}>
                                @{friend.friendUsername}
                              </ThemedText>
                            )}
                          </View>
                          <View style={styles.selectionItemRight}>
                            {(friend.streakCount || 0) > 0 && (
                              <ThemedText
                                style={[
                                  styles.streakText,
                                  {
                                    color: selectedUsers.includes(friend.friendId)
                                      ? '#fff'
                                      : colors.tint,
                                  },
                                ]}>
                                🔥 {(friend.streakCount || 0)}
                              </ThemedText>
                            )}
                            {isFriendMuted(friend) && (
                              <IconSymbol
                                name="bell.slash.fill"
                                size={18}
                                color={selectedUsers.includes(friend.friendId) ? '#fff' : '#ff9500'}
                              />
                            )}
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </>
                )}

                {sendMode === 'groups' && (
                  <>
                    {filteredGroups.length === 0 ? (
                      <ThemedText style={styles.emptySelectionText}>
                        {searchQuery ? 'No groups found' : 'No groups yet. Create groups from the Friends page ❄️'}
                      </ThemedText>
                    ) : (
                      filteredGroups.map((group) => (
                        <TouchableOpacity
                          key={group.id}
                          style={[
                            styles.selectionItem,
                            {
                              backgroundColor: selectedGroups.includes(group.id)
                                ? colors.tint
                                : '#fff',
                              borderColor: selectedGroups.includes(group.id)
                                ? colors.tint
                                : colors.icon,
                            },
                          ]}
                          onPress={() => toggleGroup(group.id)}>
                          <View style={styles.selectionItemInfo}>
                            <ThemedText
                              style={[
                                styles.selectionItemName,
                                {
                                  color: selectedGroups.includes(group.id) ? '#fff' : '#000',
                                },
                              ]}>
                              {group.name}
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.selectionItemUsername,
                                {
                                  color: selectedGroups.includes(group.id) ? '#fff' : '#000',
                                },
                              ]}>
                              {group.memberIds.length} member(s)
                            </ThemedText>
                          </View>
                          <View style={styles.selectionItemRight}>
                            {(group.streakCount || 0) > 0 && (
                              <ThemedText
                                style={[
                                  styles.streakText,
                                  {
                                    color: selectedGroups.includes(group.id)
                                      ? '#fff'
                                      : colors.tint,
                                  },
                                ]}>
                                🔥 {(group.streakCount || 0)}
                              </ThemedText>
                            )}
                            {isGroupMuted(group) && (
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setSelectedGroupForMute(group);
                                  setSelectedFriendForMute(null);
                                  setIsMutingGroup(true);
                                  setCustomMuteHours('24');
                                  setMuteModalVisible(true);
                                }}>
                                <IconSymbol
                                  name="bell.slash.fill"
                                  size={18}
                                  color={selectedGroups.includes(group.id) ? '#fff' : '#ff9500'}
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </>
                )}
              </ScrollView>
            </ThemedView>
          )}

        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 0,
  },
  content: {
    padding: 24,
    minHeight: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
    paddingTop: 10,
  },
  emoji: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  snowflakesRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  snowflake: {
    fontSize: 20,
    opacity: 0.7,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
    paddingHorizontal: 10,
  },
  hootCounter: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 24,
    color: '#000',
  },
  inputContainer: {
    marginBottom: 24,
    position: 'relative',
  },
  input: {
    borderWidth: 2,
    borderRadius: 24,
    padding: 20,
    paddingBottom: 32,
    fontSize: 18,
    minHeight: 50,
    maxHeight: 200,
    textAlignVertical: 'top',
    fontWeight: '500',
  },
  charCount: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 11,
    opacity: 0.5,
    fontWeight: '500',
  },
  favoritesContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  favoritesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  favoritesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  favoritesToggleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  favoritesToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  favoritesToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyFavoritesText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  favoritesScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  favoriteChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  favoriteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    marginRight: 8,
    gap: 6,
  },
  favoriteChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  favoriteStreakText: {
    fontSize: 11,
    fontWeight: '600',
  },
  favoriteCheckmark: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  sendModeContainer: {
    marginBottom: 24,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sendModeTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
    color: '#000',
  },
  sendModeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  sendModeButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  sendModeButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  selectionContainer: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    marginBottom: 14,
    fontWeight: '500',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectionList: {
    maxHeight: 280,
  },
  selectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  selectionItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  selectionItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectionItemUsername: {
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    color: '#000',
  },
  emptySelectionText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 14,
    padding: 24,
    fontStyle: 'italic',
    color: '#000',
  },
  sendButtonContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
    position: 'relative',
    width: 120,
    height: 120,
    alignSelf: 'center',
  },
  hootEmoji: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    // Button is 120x120, emoji is 60x60
    // To center emoji on button: (120-60)/2 = 30 from each edge
    top: 30,
    left: 30,
    zIndex: 0, // Behind the button but visible
  },
  hootEmojiImage: {
    width: 60,
    height: 60,
  },
  sendButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 1,
    position: 'relative',
  },
  sendButtonTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 32,
  },
  sendingButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 24,
  },
});
