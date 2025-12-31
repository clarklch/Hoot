import { useState, useEffect, useRef } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, PanResponder, Dimensions, LayoutAnimation, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useRouter } from 'expo-router';
import { checkForAllMissedMessages as checkMissedMessagesUtil } from '@/utils/missedMessages';
import { isFriendMuted, isGroupMuted, getMuteStatusText, getGroupMuteStatusText } from '@/utils/muteHelpers';
import { getCurrentUserId as getCurrentUserIdUtil } from '@/utils/authHelpers';
import { fuzzyMatch } from '@/utils/searchHelpers';
import { MuteModal } from '@/components/MuteModal';
import { FriendItem } from '@/components/FriendItem';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { Friend, Group, GroupActivity } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

// ============================================================================
// FRIENDS SCREEN - Main component for managing friends, groups, and requests
// ============================================================================

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'groups'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false); // Track initial friends load
  const [requests, setRequests] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [friendsSearchTerm, setFriendsSearchTerm] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestInProgress, setRequestInProgress] = useState<string | null>(null); // Track requests in progress
  const [editingGroup, setEditingGroup] = useState<string | null>(null); // Track which group is being edited
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]); // Track selected friends to add
  const [groupFriendSearch, setGroupFriendSearch] = useState(''); // Search term for filtering friends in group add
  const [viewingGroupMembers, setViewingGroupMembers] = useState<string | null>(null); // Track which group's members are being viewed
  const [groupMembers, setGroupMembers] = useState<{ [groupId: string]: Friend[] }>({}); // Cache of group member details
  const [viewingGroupActivity, setViewingGroupActivity] = useState<string | null>(null); // Track which group's activity is being viewed
  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [selectedFriendForMute, setSelectedFriendForMute] = useState<Friend | null>(null);
  const [selectedGroupForMute, setSelectedGroupForMute] = useState<Group | null>(null);
  const [isMutingGroup, setIsMutingGroup] = useState(false);
  const [customMuteHours, setCustomMuteHours] = useState('24');
  const [friendsSortBy, setFriendsSortBy] = useState<'displayName' | 'username' | 'favorites' | 'muted' | 'streak' | 'none'>('none');
  const [groupsSortBy, setGroupsSortBy] = useState<'name' | 'favorites' | 'muted' | 'members' | 'created' | 'none'>('none');
  const [groupActivities, setGroupActivities] = useState<{ [groupId: string]: GroupActivity[] }>({}); // Cache of group activities
  const [showAddFriends, setShowAddFriends] = useState(false); // Toggle for Add Friends tools
  const [selectedActivity, setSelectedActivity] = useState<GroupActivity | null>(null); // Selected activity for details view

  const params = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // iOS-only: Layout animations work smoothly by default
  // Set initial tab based on route params (e.g., ?tab=groups)
  useEffect(() => {
    if (params?.tab === 'groups') {
      setActiveTab('groups');
    } else if (params?.tab === 'friends') {
      setActiveTab('friends');
    }
  }, [params?.tab]);


  // Helper function to check if friend is muted

  // Filter friends based on search term
  const filteredFriends = friends.filter(friend => {
    if (!friendsSearchTerm.trim()) return true;

    const displayName = (friend.friendDisplayName || '').toLowerCase();
    const username = (friend.friendUsername || '').toLowerCase();
    const searchTerm = friendsSearchTerm.toLowerCase().trim();

    return fuzzyMatch(displayName, searchTerm) || fuzzyMatch(username, searchTerm);
  });

  // Sort friends based on selected sort option
  const sortedFriends = [...filteredFriends].sort((a, b) => {
    if (friendsSortBy === 'none') return 0;

    if (friendsSortBy === 'favorites') {
      // Favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    }

    if (friendsSortBy === 'muted') {
      // Muted first
      const aMuted = isFriendMuted(a);
      const bMuted = isFriendMuted(b);
      if (aMuted && !bMuted) return -1;
      if (!aMuted && bMuted) return 1;
      return 0;
    }

    if (friendsSortBy === 'displayName') {
      const aName = (a.friendDisplayName || a.friendUsername || '').toLowerCase();
      const bName = (b.friendDisplayName || b.friendUsername || '').toLowerCase();
      return aName.localeCompare(bName);
    }

    if (friendsSortBy === 'username') {
      const aUsername = (a.friendUsername || '').toLowerCase();
      const bUsername = (b.friendUsername || '').toLowerCase();
      return aUsername.localeCompare(bUsername);
    }

    if (friendsSortBy === 'streak') {
      // Sort by streak count (highest first)
      const aStreak = a.streakCount || 0;
      const bStreak = b.streakCount || 0;
      if (aStreak !== bStreak) {
        return bStreak - aStreak; // Descending order (highest first)
      }
      // If streaks are equal, maintain original order
      return 0;
    }

    return 0;
  });

  // Sort groups based on selected sort option
  const sortedGroups = [...groups].sort((a, b) => {
    if (groupsSortBy === 'none') return 0;

    if (groupsSortBy === 'favorites') {
      // Favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    }

    if (groupsSortBy === 'muted') {
      // Muted first
      const aMuted = isGroupMuted(a);
      const bMuted = isGroupMuted(b);
      if (aMuted && !bMuted) return -1;
      if (!aMuted && bMuted) return 1;
      return 0;
    }

    if (groupsSortBy === 'name') {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      return aName.localeCompare(bName);
    }

    if (groupsSortBy === 'members') {
      // Sort by member count (highest first)
      const aMembers = (a.memberIds || []).length;
      const bMembers = (b.memberIds || []).length;
      if (aMembers !== bMembers) {
        return bMembers - aMembers; // Descending order (highest first)
      }
      return 0;
    }

    if (groupsSortBy === 'created') {
      // Sort by creation date (newest first)
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate; // Descending order (newest first)
    }

    return 0;
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right: go to Hoot
          router.push('/(tabs)');
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left: go to Settings
          router.push('/(tabs)/settings');
        }
      },
    })
  ).current;

  // Get current user ID with fallback to AsyncStorage
  const getCurrentUserId = async (): Promise<string> => {
    return getCurrentUserIdUtil(user);
  };

  useEffect(() => {
    // Temporarily allow without user - OAuth bypass
    loadFriends();
    loadRequests();
    loadGroups();
    // if (user) {
    //   loadFriends();
    //   loadRequests();
    //   loadGroups();
    //     }
  }, [user]);

  // ========================================================================
  // DATA REFRESH ON FOCUS
  // ========================================================================
  // Set up real-time listeners for friend requests
  useEffect(() => {
    const currentUserId = user?.uid;
    if (!currentUserId) return;

    // Set up listener for incoming requests (where current user is the friendId)
    const incomingQuery = query(
      collection(db, 'friendships'),
      where('friendId', '==', currentUserId),
      where('status', '==', 'pending')
    );
    const incomingUnsubscribe = onSnapshot(incomingQuery, (snapshot) => {
      // Reload requests when incoming requests change
      loadRequests();
    }, (error) => {
      console.error('Error listening to incoming requests:', error);
    });

    // Set up listener for outgoing requests (where current user is the userId)
    const outgoingQuery = query(
      collection(db, 'friendships'),
      where('userId', '==', currentUserId),
      where('status', '==', 'pending')
    );
    const outgoingUnsubscribe = onSnapshot(outgoingQuery, (snapshot) => {
      // Reload requests when outgoing requests change
      loadRequests();
    }, (error) => {
      console.error('Error listening to outgoing requests:', error);
    });

    // Cleanup listeners on unmount
    return () => {
      incomingUnsubscribe();
      outgoingUnsubscribe();
    };
  }, [user?.uid]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Temporarily allow without user - OAuth bypass
      loadFriends();
      loadRequests();
      loadGroups().then(() => {
        // Reload activities for any groups that have their activity tab open
        // This ensures new activities (like name changes) appear immediately
        if (viewingGroupActivity) {
          loadGroupActivities(viewingGroupActivity);
        }
        // Also reload activities for all groups that have been loaded before
        // This ensures activities are fresh when user opens the activity tab
        Object.keys(groupActivities).forEach(groupId => {
          loadGroupActivities(groupId);
        });
      });
      // if (user) {
      //   loadFriends();
      //   loadRequests();
      //   loadGroups();
      // }
    }, [user, viewingGroupActivity, groupActivities])
  );

  // Periodic check to update mute status when mutes expire (check every 10 seconds for real-time updates)
  useEffect(() => {
    // Check every 10 seconds for expired mutes to make it more responsive
    const muteCheckInterval = setInterval(() => {
      const now = new Date();
      let hasExpiredMutes = false;

      // Check friends
      setFriends(prevFriends => {
        const updatedFriends = prevFriends.map(friend => {
          if (friend.mutedUntil) {
            const mutedUntilDate = new Date(friend.mutedUntil);
            // If mute has expired, clear it and update Firestore
            if (mutedUntilDate <= now) {
              hasExpiredMutes = true;
              // Also update Firestore to clear the mute
              const friendshipDoc = doc(db, 'friendships', friend.id);
              updateDoc(friendshipDoc, {
                mutedUntil: null,
              }).catch(error => {
                console.error('Error clearing expired mute in Firestore:', error);
              });
              return { ...friend, mutedUntil: null };
            }
          }
          return friend;
        });

        // Only update state if there were expired mutes
        if (hasExpiredMutes) {
          return updatedFriends;
        }
        return prevFriends;
      });

      // Check groups - clear expired per-user mutes
      const currentUserId = user?.uid || '';
      if (currentUserId) {
        setGroups(prevGroups => {
          const expiredGroups: Group[] = [];
          prevGroups.forEach(group => {
            if (group.mutedUntil) {
              const mutedUntilDate = new Date(group.mutedUntil);
              if (mutedUntilDate <= now) {
                expiredGroups.push(group);
                // Clear the per-user mute setting in groupMutes collection
                const groupMutesQuery = query(
                  collection(db, 'groupMutes'),
                  where('userId', '==', currentUserId),
                  where('groupId', '==', group.id)
                );
                getDocs(groupMutesQuery).then(groupMutesSnapshot => {
                  const muteDoc = groupMutesSnapshot.docs[0];
                  if (muteDoc) {
                    updateDoc(muteDoc.ref, {
                      mutedUntil: null,
                    }).catch(error => {
                      console.error('Error clearing expired group mute in Firestore:', error);
                    });
                  }
                }).catch(error => {
                  console.error('Error querying group mutes:', error);
                });
              }
            }
          });

          // Only update state if there were expired mutes
          if (expiredGroups.length > 0) {
            return prevGroups.map(group => {
              if (expiredGroups.some(eg => eg.id === group.id)) {
                return { ...group, mutedUntil: null };
              }
              return group;
            });
          }
          return prevGroups;
        });
      }
    }, 10000); // Check every 10 seconds for more real-time updates

    return () => {
      clearInterval(muteCheckInterval);
    };
  }, []);

  const loadFriends = async () => {
    // Temporarily disabled - OAuth bypass
    // if (!user) return;

    // Use actual user ID with fallback
    const currentUserId = await getCurrentUserId();

    try {
      const friendsQuery = query(
        collection(db, 'friendships'),
        where('userId', '==', currentUserId),
        where('status', '==', 'accepted')
      );
      const snapshot = await getDocs(friendsQuery);

      const friendsList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const friendDoc = await getDoc(doc(db, 'users', data.friendId));
          const friendData = friendDoc.data();

          return {
            id: docSnap.id,
            friendId: data.friendId,
            friendUsername: friendData?.username,
            friendDisplayName: friendData?.displayName,
            status: data.status,
            isIncoming: false,
            isFavorite: data.isFavorite || false,
            mutedUntil: data.mutedUntil ? data.mutedUntil.toDate() : null,
            streakCount: data.streakCount || 0,
            lastHootDate: data.lastHootDate || null,
          };
        })
      );

      setFriends(friendsList);
      setFriendsLoaded(true);
    } catch (error) {
      console.error('Error loading friends:', error);
      setFriendsLoaded(true);
    }
  };

  const loadRequests = async () => {
    // Temporarily disabled - OAuth bypass
    // if (!user) return;

    // Use actual user ID with fallback
    const currentUserId = await getCurrentUserId();

    try {
      // Incoming requests
      const incomingQuery = query(
        collection(db, 'friendships'),
        where('friendId', '==', currentUserId),
        where('status', '==', 'pending')
      );
      const incomingSnapshot = await getDocs(incomingQuery);

      const incomingRequests = await Promise.all(
        incomingSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const requesterDoc = await getDoc(doc(db, 'users', data.userId));
          const requesterData = requesterDoc.data();

          return {
            id: docSnap.id,
            friendId: data.userId,
            friendUsername: requesterData?.username,
            friendDisplayName: requesterData?.displayName,
            status: data.status,
            isIncoming: true,
          };
        })
      );

      // Outgoing requests
      const outgoingQuery = query(
        collection(db, 'friendships'),
        where('userId', '==', currentUserId),
        where('status', '==', 'pending')
      );
      const outgoingSnapshot = await getDocs(outgoingQuery);

      const outgoingRequests = await Promise.all(
        outgoingSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const friendDoc = await getDoc(doc(db, 'users', data.friendId));
          const friendData = friendDoc.data();

          return {
            id: docSnap.id,
            friendId: data.friendId,
            friendUsername: friendData?.username,
            friendDisplayName: friendData?.displayName,
            status: data.status,
            isIncoming: false,
          };
        })
      );

      setRequests([...incomingRequests, ...outgoingRequests]);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const loadGroups = async () => {
    // Temporarily disabled - OAuth bypass
    // if (!user) return;

    // Use actual user ID with fallback
    const currentUserId = await getCurrentUserId();

    try {
      const groupsQuery = query(
        collection(db, 'groups'),
        where('memberIds', 'array-contains', currentUserId)
      );
      const snapshot = await getDocs(groupsQuery);
      const groupsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          memberIds: data.memberIds || [],
          createdBy: data.createdBy,
          createdAt: data.createdAt ? data.createdAt.toDate() : undefined,
          isFavorite: data.isFavorite || false,
          streakCount: data.streakCount || 0,
          lastHootDate: data.lastHootDate || null,
        };
      }) as Group[];

      // Load per-user mute settings for all groups
      const groupMutesQuery = query(
        collection(db, 'groupMutes'),
        where('userId', '==', currentUserId)
      );
      const groupMutesSnapshot = await getDocs(groupMutesQuery);
      const groupMutesMap = new Map<string, { mutedUntil: Date | null; mutedAt: Date | null }>();

      groupMutesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        groupMutesMap.set(data.groupId, {
          mutedUntil: data.mutedUntil ? data.mutedUntil.toDate() : null,
          mutedAt: data.mutedAt ? data.mutedAt.toDate() : null,
        });
      });

      // Merge mute settings into groups
      const groupsWithMutes = groupsList.map(group => {
        const muteData = groupMutesMap.get(group.id);
        return {
          ...group,
          mutedUntil: muteData?.mutedUntil || null,
        };
      });

      setGroups(groupsWithMutes);

      // Load member details for all groups
      await loadGroupMembersDetails(groupsWithMutes);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadGroupMembersDetails = async (groupsList: Group[]) => {
    try {
      const membersMap: { [groupId: string]: Friend[] } = {};

      for (const group of groupsList) {
        const memberIds = group.memberIds || [];
        const memberDetails: Friend[] = [];

        for (const memberId of memberIds) {
          try {
            const userDoc = await getDoc(doc(db, 'users', memberId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              memberDetails.push({
                id: memberId,
                friendId: memberId,
                friendUsername: userData.username,
                friendDisplayName: userData.displayName,
                status: 'accepted',
                isIncoming: false,
              });
            }
          } catch (error) {
            console.error(`Error loading member ${memberId}:`, error);
          }
        }

        membersMap[group.id] = memberDetails;
      }

      setGroupMembers(membersMap);
    } catch (error) {
      console.error('Error loading group members details:', error);
    }
  };

  // ========================================================================
  // FRIEND REQUEST FUNCTIONS
  // ========================================================================
  const searchAndSendRequest = async () => {
    // Trim whitespace from the search input
    const trimmedUsername = searchUsername.trim();

    if (!trimmedUsername) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    // Prevent multiple simultaneous requests
    if (loading) return;

    // Get actual user ID
    const currentUserId = await getCurrentUserId();

    // Create a unique key for this request to prevent duplicates (using trimmed username)
    const requestKey = `${currentUserId}_${trimmedUsername.toLowerCase()}`;

    // Check if this exact request is already in progress
    if (requestInProgress === requestKey) {
      Alert.alert('Please wait', 'Friend request is already being processed');
      return;
    }

    setRequestInProgress(requestKey);
    setLoading(true);

    try {
      // Find user by username (using trimmed and lowercased username)
      const usernameDoc = await getDoc(doc(db, 'usernames', trimmedUsername.toLowerCase()));

      if (!usernameDoc.exists()) {
        Alert.alert('Not Found', 'User not found');
        setLoading(false);
        return;
      }

      const targetUserId = usernameDoc.data().userId;

      if (targetUserId === currentUserId) {
        Alert.alert('Error', 'You cannot send a friend request to yourself');
        setLoading(false);
        return;
      }

      // Check if friendship already exists in either direction (pending or accepted)
      const existingQuery1 = query(
        collection(db, 'friendships'),
        where('userId', '==', currentUserId),
        where('friendId', '==', targetUserId)
      );
      const existingQuery2 = query(
        collection(db, 'friendships'),
        where('userId', '==', targetUserId),
        where('friendId', '==', currentUserId)
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(existingQuery1),
        getDocs(existingQuery2)
      ]);

      if (!snapshot1.empty || !snapshot2.empty) {
        // Check what type of relationship exists
        const allDocs = [...snapshot1.docs, ...snapshot2.docs];
        const hasAccepted = allDocs.some(doc => doc.data().status === 'accepted');
        const hasPending = allDocs.some(doc => doc.data().status === 'pending');

        if (hasAccepted) {
          Alert.alert('Already Friends', 'You already have a friendship with this user');
        } else if (hasPending) {
          Alert.alert('Request Already Sent', 'You already have a pending friend request with this user');
        }
        setLoading(false);
        return;
      }

      // Create friend request
      await addDoc(collection(db, 'friendships'), {
        userId: currentUserId,
        friendId: targetUserId,
        status: 'pending',
        createdAt: new Date(),
      });

      console.log('✅ Friend request sent successfully!');
      console.log('📝 Check Firestore Console > friendships collection to verify');
      Alert.alert('Success! ✅', `Friend request sent to @${trimmedUsername}!`);
      setSearchUsername('');
      loadRequests();
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setLoading(false);
      setRequestInProgress(null);
    }
  };

  const handleAcceptRequest = async (requestId: string, friendId: string) => {
    // Get actual user ID
    const currentUserId = await getCurrentUserId();

    try {
      // Get the request document to find the requester's ID
      const requestDoc = await getDoc(doc(db, 'friendships', requestId));
      if (!requestDoc.exists()) {
        Alert.alert('Error', 'Friend request not found');
        return;
      }

      const requestData = requestDoc.data();
      const requesterId = requestData.userId; // The person who sent the request (e.g., bob)

      // Check if reverse friendship already exists in either direction (prevent duplicates)
      const existingReverseQuery1 = query(
        collection(db, 'friendships'),
        where('userId', '==', currentUserId),
        where('friendId', '==', requesterId),
        where('status', '==', 'accepted')
      );
      const existingReverseQuery2 = query(
        collection(db, 'friendships'),
        where('userId', '==', requesterId),
        where('friendId', '==', currentUserId),
        where('status', '==', 'accepted')
      );

      const [reverseSnapshot1, reverseSnapshot2] = await Promise.all([
        getDocs(existingReverseQuery1),
        getDocs(existingReverseQuery2)
      ]);

      // If friendship already exists in either direction, just update the request and return
      if (!reverseSnapshot1.empty || !reverseSnapshot2.empty) {
        await updateDoc(doc(db, 'friendships', requestId), {
          status: 'accepted',
        });
        loadFriends();
        loadRequests();
        return;
      }

      // Update the incoming request to accepted
      // This document (requesterId -> currentUserId) will show in requester's friends list
      await updateDoc(doc(db, 'friendships', requestId), {
        status: 'accepted',
      });

      // Check if reverse friendship (currentUserId -> requesterId) already exists
      // This is needed so the accepter (alice) can see the requester (bob) in their friends list
      const checkReverseQuery = query(
        collection(db, 'friendships'),
        where('userId', '==', currentUserId),
        where('friendId', '==', requesterId)
      );
      const checkReverseSnapshot = await getDocs(checkReverseQuery);

      // Only create reverse friendship if it doesn't exist
      // The original request document (requesterId -> currentUserId) is already updated above
      // We only need the reverse (currentUserId -> requesterId) if it doesn't exist
      if (checkReverseSnapshot.empty) {
        await addDoc(collection(db, 'friendships'), {
          userId: currentUserId,
          friendId: requesterId,
          status: 'accepted',
          createdAt: new Date(),
        });
      }

      loadFriends();
      loadRequests();
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'friendships', requestId));
      loadRequests();
    } catch (error) {
      console.error('Error declining request:', error);
      Alert.alert('Error', 'Failed to decline friend request');
    }
  };

  const handleCancelRequest = async (requestId: string, friendId: string) => {
    try {
      // Get the friend's display name for the alert
      const friendDoc = await getDoc(doc(db, 'users', friendId));
      const friendData = friendDoc.data();
      const friendName = friendData?.displayName || friendData?.username || 'user';

      await deleteDoc(doc(db, 'friendships', requestId));
      Alert.alert('Success', `Friend request to ${friendName} cancelled`);
      loadRequests();
    } catch (error) {
      console.error('Error cancelling request:', error);
      Alert.alert('Error', 'Failed to cancel friend request');
    }
  };

  // ========================================================================
  // FAVORITE FUNCTIONS
  // ========================================================================
  const handleToggleFavorite = async (friend: Friend) => {
    try {
      const currentUserId = await getCurrentUserId();
      const friendshipDoc = doc(db, 'friendships', friend.id);
      const newFavoriteStatus = !friend.isFavorite;

      // Update UI immediately for better responsiveness
      setFriends(prevFriends =>
        prevFriends.map(f =>
          f.id === friend.id
            ? { ...f, isFavorite: newFavoriteStatus }
            : f
        )
      );

      // Update in Firestore
      await updateDoc(friendshipDoc, {
        isFavorite: newFavoriteStatus,
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Revert UI change on error
      setFriends(prevFriends =>
        prevFriends.map(f =>
          f.id === friend.id
            ? { ...f, isFavorite: friend.isFavorite }
            : f
        )
      );
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  // ========================================================================
  // MUTE FUNCTIONS
  // ========================================================================
  const handleMuteFriend = (friend: Friend) => {
    setSelectedFriendForMute(friend);
    setSelectedGroupForMute(null);
    setIsMutingGroup(false);
    setCustomMuteHours('24');
    setMuteModalVisible(true);
  };

  const handleMuteGroup = (group: Group) => {
    setSelectedGroupForMute(group);
    setSelectedFriendForMute(null);
    setIsMutingGroup(true);
    setCustomMuteHours('24');
    setMuteModalVisible(true);
  };

  const handleMuteDuration = async (durationHours: number | null, indefinite: boolean = false) => {

    if (isMutingGroup && selectedGroupForMute) {
      try {
        const currentUserId = await getCurrentUserId();

        // Get existing mute setting for this user and group
        const groupMutesQuery = query(
          collection(db, 'groupMutes'),
          where('userId', '==', currentUserId),
          where('groupId', '==', selectedGroupForMute.id)
        );
        const groupMutesSnapshot = await getDocs(groupMutesQuery);
        const existingMuteDoc = groupMutesSnapshot.docs[0];
        const previousMutedUntil = existingMuteDoc?.data()?.mutedUntil ? existingMuteDoc.data().mutedUntil.toDate() : null;
        const muteStartTime = previousMutedUntil ? null : new Date(); // Only set if wasn't muted before

        let mutedUntil: Date | null = null;
        if (indefinite) {
          mutedUntil = new Date();
          mutedUntil.setFullYear(mutedUntil.getFullYear() + 100);
        } else if (durationHours !== null) {
          mutedUntil = new Date();
          mutedUntil.setHours(mutedUntil.getHours() + durationHours);
        }

        // Update per-user mute setting in groupMutes collection
        if (existingMuteDoc) {
          // Update existing mute document
          await updateDoc(existingMuteDoc.ref, {
            mutedUntil: mutedUntil ? Timestamp.fromDate(mutedUntil) : null,
            mutedAt: mutedUntil && !previousMutedUntil && muteStartTime ? Timestamp.fromDate(muteStartTime) : (mutedUntil ? existingMuteDoc.data().mutedAt : null),
          });
        } else {
          // Create new mute document
          await addDoc(collection(db, 'groupMutes'), {
            userId: currentUserId,
            groupId: selectedGroupForMute.id,
            mutedUntil: mutedUntil ? Timestamp.fromDate(mutedUntil) : null,
            mutedAt: mutedUntil && muteStartTime ? Timestamp.fromDate(muteStartTime) : null,
          });
        }

        // Then update local state - this ensures Firestore is updated first
        setGroups(prevGroups =>
          prevGroups.map(g =>
            g.id === selectedGroupForMute.id
              ? { ...g, mutedUntil }
              : g
          )
        );

        setMuteModalVisible(false);
        const groupId = selectedGroupForMute.id;
        const groupName = selectedGroupForMute.name;
        setSelectedGroupForMute(null);
        setIsMutingGroup(false);

        if (durationHours === null && !indefinite) {
          // Unmuting - check for missed messages
          // Use mutedAt from the existing mute document as the start time
          const existingMuteData = existingMuteDoc?.data();
          const muteStart = existingMuteData?.mutedAt ? existingMuteData.mutedAt.toDate() : null;
          await checkAndShowMissedMessages(null, groupId, muteStart, new Date(), groupName);
        } else if (indefinite) {
          Alert.alert('Success', 'Group muted indefinitely');
        } else {
          const durationText = durationHours === 1 ? '1 hour' : durationHours === 24 ? '1 day' : `${durationHours} hours`;
          Alert.alert('Success', `Group muted for ${durationText}`);
        }
      } catch (error) {
        console.error('Error muting group:', error);
        Alert.alert('Error', 'Failed to update mute status');
      }
      return;
    }

    if (!selectedFriendForMute) return;

    try {
      const currentUserId = await getCurrentUserId();
      const friendshipDoc = doc(db, 'friendships', selectedFriendForMute.id);
      const friendshipData = (await getDoc(friendshipDoc)).data();
      const previousMutedUntil = friendshipData?.mutedUntil ? friendshipData.mutedUntil.toDate() : null;
      const muteStartTime = previousMutedUntil ? null : new Date(); // Only set if wasn't muted before

      let mutedUntil: Date | null = null;
      if (indefinite) {
        // Set to a far future date (100 years from now) to represent indefinite mute
        mutedUntil = new Date();
        mutedUntil.setFullYear(mutedUntil.getFullYear() + 100);
      } else if (durationHours !== null) {
        mutedUntil = new Date();
        mutedUntil.setHours(mutedUntil.getHours() + durationHours);
      }

      // Update Firestore first to ensure data is persisted
      await updateDoc(friendshipDoc, {
        mutedUntil: mutedUntil ? Timestamp.fromDate(mutedUntil) : null,
        mutedAt: mutedUntil && !previousMutedUntil && muteStartTime ? Timestamp.fromDate(muteStartTime) : (mutedUntil ? friendshipData?.mutedAt : null),
      });

      // Then update local state - this ensures Firestore is updated first
      setFriends(prevFriends =>
        prevFriends.map(f =>
          f.id === selectedFriendForMute.id
            ? { ...f, mutedUntil }
            : f
        )
      );

      setMuteModalVisible(false);
      const friendId = selectedFriendForMute.friendId;
      setSelectedFriendForMute(null);

      if (durationHours === null && !indefinite) {
        // Unmuting - check for missed messages
        // Use mutedAt as the start time (when mute was first applied)
        const muteStart = friendshipData?.mutedAt ? friendshipData.mutedAt.toDate() : null;
        await checkAndShowMissedMessages(friendId, null, muteStart, new Date());
      } else if (indefinite) {
        Alert.alert('Success', 'Friend muted indefinitely');
      } else {
        const durationText = durationHours === 1 ? '1 hour' : durationHours === 24 ? '1 day' : `${durationHours} hours`;
        Alert.alert('Success', `Friend muted for ${durationText}`);
      }
    } catch (error) {
      console.error('Error muting friend:', error);
      Alert.alert('Error', 'Failed to update mute status');
    }
  };

  // ========================================================================
  // MISSED MESSAGES FUNCTIONS
  // ========================================================================
  const checkForAllMissedMessages = async () => {
    await checkMissedMessagesUtil(null, friends, groups, router, getCurrentUserId);
  };

  const checkAndShowMissedMessages = async (
    friendId: string | null,
    groupId: string | null,
    muteStartTime: Date | null,
    muteEndTime: Date,
    groupName?: string
  ) => {
    try {
      const currentUserId = await getCurrentUserId();
      const now = new Date();

      // Simplified query - just get all messages for this user
      // We'll filter by expiresAt, friend/group, and mute period in memory to avoid index requirements
      const messagesQuery = query(
        collection(db, 'messages'),
        where('toUserId', '==', currentUserId)
      );

      const snapshot = await getDocs(messagesQuery);
      const missedMessages: any[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

        // Filter by expiration - only include messages that haven't expired
        if (expiresAt <= now) {
          return;
        }

        // Filter by friend/group - ensure group messages are not conflated with individual friend messages
        if (groupId && groupId !== '') {
          // When viewing group messages, only show group messages for this specific group
          if (!data.groupId || data.groupId !== groupId) {
            return;
          }
        }
        if (friendId && friendId !== '') {
          // When viewing individual friend messages, exclude group messages
          // Only show direct messages from this friend (not group messages)
          if (data.groupId || data.isGroupMessage) {
            return; // Exclude group messages
          }
          if (data.fromUserId !== friendId) {
            return;
          }
        }

        // Only include messages created during the mute period
        if (muteStartTime) {
          // If we have a mute start time, check if message was created during the mute period
          if (createdAt >= muteStartTime && createdAt <= muteEndTime) {
            missedMessages.push(docSnap.id);
          }
        } else {
          // If no mute start time (indefinite mute or old mute without mutedAt), 
          // check if message was created before unmute (use a reasonable window, e.g., last 7 days)
          const sevenDaysAgo = new Date(muteEndTime.getTime() - (7 * 24 * 60 * 60 * 1000));
          if (createdAt >= sevenDaysAgo && createdAt <= muteEndTime) {
            missedMessages.push(docSnap.id);
          }
        }
      });

      if (missedMessages.length > 0) {
        // Automatically navigate to view missed messages - no "Later" option
        router.push({
          pathname: '/missed-messages',
          params: {
            friendId: friendId || '',
            groupId: groupId || '',
            muteStartTime: muteStartTime?.toISOString() || '',
            muteEndTime: muteEndTime.toISOString(),
            groupName: groupName || '',
          },
        });
      } else {
        Alert.alert('Success', 'No missed messages found. All messages may have expired (24 hours).');
      }
    } catch (error) {
      console.error('Error checking missed messages:', error);
      // Don't show error to user, just continue with unmute
    }
  };

  const handleCustomMute = () => {
    const hours = parseInt(customMuteHours);
    if (isNaN(hours) || hours <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid number of hours');
      return;
    }
    handleMuteDuration(hours);
  };


  const handleToggleGroupFavorite = async (group: Group) => {
    try {
      const newFavoriteStatus = !group.isFavorite;

      setGroups(prevGroups =>
        prevGroups.map(g =>
          g.id === group.id
            ? { ...g, isFavorite: newFavoriteStatus }
            : g
        )
      );

      await updateDoc(doc(db, 'groups', group.id), {
        isFavorite: newFavoriteStatus,
      });
    } catch (error) {
      console.error('Error toggling group favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const handleRemoveFriend = (friend: Friend) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.friendUsername || 'this friend'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get actual user ID
              const currentUserId = await getCurrentUserId();

              // Delete both friendship documents
              const friendshipsQuery = query(
                collection(db, 'friendships'),
                where('userId', 'in', [currentUserId, friend.friendId]),
                where('friendId', 'in', [currentUserId, friend.friendId])
              );
              const snapshot = await getDocs(friendshipsQuery);

              await Promise.all(
                snapshot.docs.map(docSnap => deleteDoc(docSnap.ref))
              );

              loadFriends();
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    // Get actual user ID
    const currentUserId = await getCurrentUserId();

    setLoading(true);

    try {
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: newGroupName,
        memberIds: [currentUserId],
        createdBy: currentUserId,
        createdAt: new Date(),
      });

      // Record group creation activity
      const currentUser = user?.username || 'You';
      await addDoc(collection(db, 'groupActivities'), {
        groupId: groupRef.id,
        type: 'group_created',
        userId: currentUserId,
        username: currentUser,
        timestamp: new Date(),
      });

      Alert.alert('Success', 'Group created! 🥳');
      setNewGroupName('');
      setShowCreateGroup(false);
      loadGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group ❌');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriendsToGroup = async (groupId: string) => {
    if (selectedFriends.length === 0) {
      Alert.alert('No Friends Selected', 'Please select at least one friend to add');
      return;
    }

    setLoading(true);

    try {
      const currentUserId = await getCurrentUserId();
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) {
        Alert.alert('Error', 'Group not found');
        setLoading(false);
        return;
      }

      const currentMemberIds = groupDoc.data().memberIds || [];
      const newMemberIds = [...new Set([...currentMemberIds, ...selectedFriends])]; // Remove duplicates

      await updateDoc(doc(db, 'groups', groupId), {
        memberIds: newMemberIds,
      });

      // Record activity for each added member
      const currentUserDisplayName = user?.displayName || user?.username || 'You';
      for (const friendId of selectedFriends) {
        const friend = friends.find(f => f.friendId === friendId);
        const friendDisplayName = friend?.friendDisplayName || friend?.friendUsername || 'Unknown';
        const friendUsername = friend?.friendUsername || '';

        await addDoc(collection(db, 'groupActivities'), {
          groupId: groupId,
          type: 'member_added',
          userId: currentUserId,
          username: currentUserDisplayName,
          userDisplayName: currentUserDisplayName,
          targetUserId: friendId,
          targetUsername: friendDisplayName,
          targetDisplayName: friendDisplayName,
          targetUsernameOnly: friendUsername,
          timestamp: new Date(),
        });
      }

      Alert.alert('Success', `Added ${selectedFriends.length} friend(s) to group! 🎉`);
      setSelectedFriends([]);
      setEditingGroup(null);
      loadGroups();
      // Reload activities if viewing
      if (viewingGroupActivity === groupId) {
        loadGroupActivities(groupId);
      }
    } catch (error) {
      console.error('Error adding friends to group:', error);
      Alert.alert('Error', 'Failed to add friends to group ❌');
    } finally {
      setLoading(false);
    }
  };

  const handleDisbandGroup = async (groupId: string, groupName: string) => {
    Alert.alert(
      'Disband the Parliament',
      `Are you sure you want to disband "${groupName}"? This will permanently delete the group and all its activity. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disband',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const currentUserId = await getCurrentUserId();
              const groupDoc = await getDoc(doc(db, 'groups', groupId));

              if (!groupDoc.exists()) {
                Alert.alert('Error', 'Group not found');
                setLoading(false);
                return;
              }

              // Verify user is the creator
              if (groupDoc.data().createdBy !== currentUserId) {
                Alert.alert('Error', 'Only the group creator can disband the group');
                setLoading(false);
                return;
              }

              // Delete all group activities first
              const activitiesQuery = query(
                collection(db, 'groupActivities'),
                where('groupId', '==', groupId)
              );
              const activitiesSnapshot = await getDocs(activitiesQuery);
              await Promise.all(
                activitiesSnapshot.docs.map(docSnap => deleteDoc(docSnap.ref))
              );

              // Delete the group
              await deleteDoc(doc(db, 'groups', groupId));

              Alert.alert('Success', 'Group disbanded! 👋');
              loadGroups();
            } catch (error) {
              console.error('Error disbanding group:', error);
              Alert.alert('Error', 'Failed to disband group ❌');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRemoveMemberFromGroup = async (groupId: string, memberId: string, memberUsername: string) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberUsername} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const currentUserId = await getCurrentUserId();
              const groupDoc = await getDoc(doc(db, 'groups', groupId));
              if (!groupDoc.exists()) {
                Alert.alert('Error', 'Group not found');
                setLoading(false);
                return;
              }

              const currentMemberIds = groupDoc.data().memberIds || [];
              const newMemberIds = currentMemberIds.filter((id: string) => id !== memberId);

              await updateDoc(doc(db, 'groups', groupId), {
                memberIds: newMemberIds,
              });

              // Record activity
              const currentUserDisplayName = user?.displayName || user?.username || 'You';
              const memberDoc = await getDoc(doc(db, 'users', memberId));
              const memberData = memberDoc.data();
              const memberDisplayName = memberData?.displayName || memberUsername;
              const memberUsernameOnly = memberData?.username || '';

              await addDoc(collection(db, 'groupActivities'), {
                groupId: groupId,
                type: 'member_removed',
                userId: currentUserId,
                username: currentUserDisplayName,
                userDisplayName: currentUserDisplayName,
                targetUserId: memberId,
                targetUsername: memberDisplayName,
                targetDisplayName: memberDisplayName,
                targetUsernameOnly: memberUsernameOnly,
                timestamp: new Date(),
              });

              Alert.alert('Success', `${memberUsername} removed from group! 👋`);
              loadGroups();
              // Reload members and activities if viewing
              if (viewingGroupMembers === groupId) {
                loadGroupMembersDetails([groups.find(g => g.id === groupId)!]);
              }
              if (viewingGroupActivity === groupId) {
                loadGroupActivities(groupId);
              }
            } catch (error) {
              console.error('Error removing member from group:', error);
              Alert.alert('Error', 'Failed to remove member ❌');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const loadGroupActivities = async (groupId: string) => {
    try {
      const activitiesQuery = query(
        collection(db, 'groupActivities'),
        where('groupId', '==', groupId)
      );
      const snapshot = await getDocs(activitiesQuery);
      const activities = snapshot.docs.map(doc => {
        const data = doc.data();
        let timestamp = new Date();
        if (data.timestamp) {
          // Handle Firestore Timestamp
          if (data.timestamp.toDate) {
            timestamp = data.timestamp.toDate();
          } else if (data.timestamp instanceof Date) {
            timestamp = data.timestamp;
          } else if (typeof data.timestamp === 'string') {
            timestamp = new Date(data.timestamp);
          }
        }
        return {
          id: doc.id,
          ...data,
          timestamp: timestamp,
        } as GroupActivity;
      });

      // Sort by timestamp (newest first)
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setGroupActivities(prev => ({
        ...prev,
        [groupId]: activities,
      }));
    } catch (error) {
      console.error('Error loading group activities:', error);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const pendingRequestsCount = requests.filter(r => r.isIncoming && r.status === 'pending').length;

  const handleToggleAddFriends = () => {
    // Smoothly animate layout change for expand/collapse
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAddFriends(prev => !prev);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]} {...panResponder.panHandlers}>
      <View style={[styles.tabs, { paddingTop: insets.top + 60 }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && { borderBottomColor: colors.tint, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('friends')}>
          <ThemedText style={styles.tabText}>Friends</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && { borderBottomColor: colors.tint, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('groups')}>
          <ThemedText style={styles.tabText}>Groups</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && { borderBottomColor: colors.tint, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('requests')}>
          <View style={styles.tabWithBadge}>
            <ThemedText style={styles.tabText}>Requests</ThemedText>
            {pendingRequestsCount > 0 && (
              <View style={[styles.badge, { backgroundColor: '#ff4444' }]}>
                <ThemedText style={styles.badgeText}>{pendingRequestsCount}</ThemedText>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'friends' && (
          <View>
            {/* Add Friends Toggle */}
            <TouchableOpacity
              style={[styles.addFriendsToggleButton, { backgroundColor: colors.tint }]}
              onPress={handleToggleAddFriends}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.addFriendsToggleText}>
                {showAddFriends ? 'Hide Add Friends' : 'Add Friends'}
              </ThemedText>
            </TouchableOpacity>

            {/* Add Friends content - layout animates via LayoutAnimation */}
            {showAddFriends && (
              <View style={styles.addFriendsSection}>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={[
                      styles.searchInput,
                      {
                        color: '#000',
                        borderColor: colors.icon,
                        backgroundColor: '#fff',
                      },
                    ]}
                    placeholder="Search by username"
                    placeholderTextColor={colors.icon}
                    value={searchUsername}
                    onChangeText={(text) => {
                      // Trim leading/trailing spaces as user types (but allow spaces in middle for now)
                      // We'll trim fully when searching
                      setSearchUsername(text);
                    }}
                    onSubmitEditing={searchAndSendRequest}
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <TouchableOpacity
                    style={[styles.searchButton, { backgroundColor: colors.tint }]}
                    onPress={searchAndSendRequest}
                    disabled={loading}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <ThemedText style={styles.searchButtonText}>Add ❄️</ThemedText>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.qrButton, { borderColor: colors.tint }]}
                  onPress={() => {
                    try {
                      router.push('/qr-scan' as any);
                    } catch (error) {
                      console.error('Error navigating to QR scan:', error);
                      Alert.alert('Error', 'Failed to open QR scanner');
                    }
                  }}>
                  <IconSymbol name="qrcode.viewfinder" size={20} color={colors.tint} />
                  <ThemedText style={[styles.qrButtonText, { color: colors.tint }]}>
                    Scan QR Code ❄️
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.qrButton, { borderColor: colors.tint, marginTop: 8 }]}
                  onPress={() => {
                    try {
                      router.push('/qr-generate' as any);
                    } catch (error) {
                      console.error('Error navigating to QR generate:', error);
                      Alert.alert('Error', 'Failed to open QR generator');
                    }
                  }}>
                  <IconSymbol name="qrcode" size={20} color={colors.tint} />
                  <ThemedText style={[styles.qrButtonText, { color: colors.tint }]}>
                    Generate My QR Code ❄️
                  </ThemedText>
                </TouchableOpacity>

              </View>
            )}

            {/* Friends Search and Sort */}
            {friends.length > 0 && (
              <View>
                <View style={styles.friendsSearchContainer}>
                  <TextInput
                    style={[
                      styles.friendsSearchInput,
                      {
                        color: '#000',
                        borderColor: colors.icon,
                        backgroundColor: '#fff',
                      },
                    ]}
                    placeholder="Search friends by name or username..."
                    placeholderTextColor={colors.icon}
                    value={friendsSearchTerm}
                    onChangeText={setFriendsSearchTerm}
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {friendsSearchTerm.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearSearchButton}
                      onPress={() => setFriendsSearchTerm('')}>
                      <ThemedText style={[styles.clearSearchText, { color: colors.icon }]}>✕</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Sort Filter */}
                <View style={styles.sortContainer}>
                  <View style={styles.sortButtonsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.sortButton,
                        {
                          borderColor: colors.icon,
                          backgroundColor: friendsSortBy === 'none' ? colors.tint : '#fff',
                        }
                      ]}
                      onPress={() => setFriendsSortBy('none')}>
                      <ThemedText style={[
                        styles.sortButtonText,
                        { color: friendsSortBy === 'none' ? '#fff' : '#000' }
                      ]}>
                        None
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sortButton,
                        {
                          borderColor: colors.icon,
                          backgroundColor: friendsSortBy === 'displayName' ? colors.tint : '#fff',
                        }
                      ]}
                      onPress={() => setFriendsSortBy('displayName')}>
                      <ThemedText style={[
                        styles.sortButtonText,
                        { color: friendsSortBy === 'displayName' ? '#fff' : '#000' }
                      ]}>
                        Name
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sortButton,
                        {
                          borderColor: colors.icon,
                          backgroundColor: friendsSortBy === 'username' ? colors.tint : '#fff',
                        }
                      ]}
                      onPress={() => setFriendsSortBy('username')}>
                      <ThemedText style={[
                        styles.sortButtonText,
                        { color: friendsSortBy === 'username' ? '#fff' : '#000' }
                      ]}>
                        @
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sortButton,
                        {
                          borderColor: colors.icon,
                          backgroundColor: friendsSortBy === 'favorites' ? colors.tint : '#fff',
                        }
                      ]}
                      onPress={() => setFriendsSortBy('favorites')}>
                      <IconSymbol
                        name="heart.fill"
                        size={16}
                        color={friendsSortBy === 'favorites' ? '#fff' : colors.tint}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sortButton,
                        {
                          borderColor: colors.icon,
                          backgroundColor: friendsSortBy === 'muted' ? colors.tint : '#fff',
                        }
                      ]}
                      onPress={() => setFriendsSortBy('muted')}>
                      <IconSymbol
                        name={friendsSortBy === 'muted' ? "bell.slash.fill" : "bell.slash"}
                        size={16}
                        color={friendsSortBy === 'muted' ? '#fff' : '#ff9500'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sortButton,
                        {
                          borderColor: colors.icon,
                          backgroundColor: friendsSortBy === 'streak' ? colors.tint : '#fff',
                        }
                      ]}
                      onPress={() => setFriendsSortBy('streak')}>
                      <ThemedText style={[
                        styles.sortButtonText,
                        { color: friendsSortBy === 'streak' ? '#fff' : '#000', fontSize: 14 }
                      ]}>
                        🔥
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Friends list / loading / empty states */}
            {!friendsLoaded && friends.length === 0 ? (
              // While the initial friends list is loading, don't flash an empty state
              <ThemedView style={styles.emptyState}>
                <ActivityIndicator color={colors.tint} />
                <ThemedText style={[styles.emptyText, { marginTop: 8 }]}>
                  Loading friends...
                </ThemedText>
              </ThemedView>
            ) : friends.length === 0 ? (
              <ThemedView style={styles.emptyState}>
                <Image
                  source={require('@/assets/images/hoot-emoji.png')}
                  style={styles.emptyEmoji}
                  resizeMode="contain"
                />
                <ThemedText style={styles.emptyText}>No friends yet ❄️</ThemedText>
              </ThemedView>
            ) : sortedFriends.length === 0 ? (
              <ThemedView style={styles.emptyState}>
                <ThemedText style={styles.emptyText}>
                  No friends found matching "{friendsSearchTerm}" ❄️
                </ThemedText>
              </ThemedView>
            ) : (
              sortedFriends.map((friend) => (
                <FriendItem
                  key={friend.id}
                  friend={friend}
                  colors={colors}
                  styles={styles}
                  onToggleFavorite={handleToggleFavorite}
                  onMute={handleMuteFriend}
                  onRemove={handleRemoveFriend}
                />
              ))
            )}
          </View>
        )}

        {activeTab === 'requests' && (
          <View>
            {requests.length === 0 ? (
              <ThemedView style={styles.emptyState}>
                <Image
                  source={require('@/assets/images/hoot-emoji.png')}
                  style={styles.emptyEmoji}
                  resizeMode="contain"
                />
                <ThemedText style={styles.emptyText}>No pending requests ❄️</ThemedText>
              </ThemedView>
            ) : (
              requests.map((request) => (
                <View key={request.id} style={[styles.requestItem, { borderColor: colors.icon }]}>
                  <View style={styles.requestInfo}>
                    <ThemedText style={[styles.requestName, { color: '#000' }]}>
                      {request.friendDisplayName || request.friendUsername || 'Unknown'}
                      {request.isIncoming ? ' wants to be your friend' : ' (Pending)'}
                    </ThemedText>
                    {request.friendUsername && (
                      <ThemedText style={styles.requestUsername}>
                        @{request.friendUsername}
                      </ThemedText>
                    )}
                  </View>
                  {request.isIncoming ? (
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[styles.acceptButton, { backgroundColor: colors.tint }]}
                        onPress={() => handleAcceptRequest(request.id, request.friendId)}>
                        <ThemedText style={styles.acceptButtonText}>Accept</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.declineButton, { backgroundColor: '#ff4444' }]}
                        onPress={() => handleDeclineRequest(request.id)}>
                        <ThemedText style={styles.declineButtonText}>Decline</ThemedText>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[styles.cancelButton, { backgroundColor: '#ff9500' }]}
                        onPress={() => handleCancelRequest(request.id, request.friendId)}>
                        <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'groups' && (
          <View>
            <TouchableOpacity
              style={[styles.createGroupButton, { backgroundColor: colors.tint }]}
              onPress={() => setShowCreateGroup(!showCreateGroup)}>
              <ThemedText style={styles.createGroupButtonText}>
                {showCreateGroup ? 'Cancel' : '+ Create Group'}
              </ThemedText>
            </TouchableOpacity>

            {/* Groups Sort Options */}
            {groups.length > 0 && (
              <View style={styles.sortContainer}>
                <View style={styles.sortButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      {
                        borderColor: colors.icon,
                        backgroundColor: groupsSortBy === 'none' ? colors.tint : '#fff',
                      }
                    ]}
                    onPress={() => setGroupsSortBy('none')}>
                    <ThemedText style={[
                      styles.sortButtonText,
                      { color: groupsSortBy === 'none' ? '#fff' : '#000' }
                    ]}>
                      None
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      {
                        borderColor: colors.icon,
                        backgroundColor: groupsSortBy === 'name' ? colors.tint : '#fff',
                      }
                    ]}
                    onPress={() => setGroupsSortBy('name')}>
                    <ThemedText style={[
                      styles.sortButtonText,
                      { color: groupsSortBy === 'name' ? '#fff' : '#000' }
                    ]}>
                      Name
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      {
                        borderColor: colors.icon,
                        backgroundColor: groupsSortBy === 'favorites' ? colors.tint : '#fff',
                      }
                    ]}
                    onPress={() => setGroupsSortBy('favorites')}>
                    <IconSymbol
                      name="heart.fill"
                      size={16}
                      color={groupsSortBy === 'favorites' ? '#fff' : colors.tint}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      {
                        borderColor: colors.icon,
                        backgroundColor: groupsSortBy === 'muted' ? colors.tint : '#fff',
                      }
                    ]}
                    onPress={() => setGroupsSortBy('muted')}>
                    <IconSymbol
                      name={groupsSortBy === 'muted' ? "bell.slash.fill" : "bell.slash"}
                      size={16}
                      color={groupsSortBy === 'muted' ? '#fff' : '#ff9500'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      {
                        borderColor: colors.icon,
                        backgroundColor: groupsSortBy === 'members' ? colors.tint : '#fff',
                      }
                    ]}
                    onPress={() => setGroupsSortBy('members')}>
                    <ThemedText style={[
                      styles.sortButtonText,
                      { color: groupsSortBy === 'members' ? '#fff' : '#000', fontSize: 14 }
                    ]}>
                      👥
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      {
                        borderColor: colors.icon,
                        backgroundColor: groupsSortBy === 'created' ? colors.tint : '#fff',
                      }
                    ]}
                    onPress={() => setGroupsSortBy('created')}>
                    <ThemedText style={[
                      styles.sortButtonText,
                      { color: groupsSortBy === 'created' ? '#fff' : '#000', fontSize: 14 }
                    ]}>
                      🆕
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {showCreateGroup && (
              <View style={styles.createGroupForm}>
                <TextInput
                  style={[
                    styles.groupInput,
                    {
                      color: colors.text,
                      borderColor: colors.icon,
                      backgroundColor: colors.background,
                    },
                  ]}
                  placeholder="Group name"
                  placeholderTextColor={colors.icon}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                />
                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: colors.tint }]}
                  onPress={createGroup}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <ThemedText style={styles.createButtonText}>Create</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {groups.length === 0 ? (
              <ThemedView style={styles.emptyState}>
                <Image
                  source={require('@/assets/images/hoot-emoji.png')}
                  style={styles.emptyEmoji}
                  resizeMode="contain"
                />
                <ThemedText style={styles.emptyText}>No groups yet ❄️</ThemedText>
              </ThemedView>
            ) : (
              sortedGroups.map((group) => {
                const isEditing = editingGroup === group.id;
                const groupMemberIds = group.memberIds || [];
                const availableFriends = friends.filter(friend => !groupMemberIds.includes(friend.friendId));

                // Filter friends based on search term
                const filteredFriends = availableFriends.filter(friend => {
                  if (!groupFriendSearch.trim()) return true;
                  const searchTerm = groupFriendSearch.trim().toLowerCase();
                  const username = (friend.friendUsername || '').toLowerCase();
                  const displayName = (friend.friendDisplayName || '').toLowerCase();
                  return username.includes(searchTerm) || displayName.includes(searchTerm);
                });

                const isViewingMembers = viewingGroupMembers === group.id;
                const isViewingActivity = viewingGroupActivity === group.id;
                const members = groupMembers[group.id] || [];
                const activities = groupActivities[group.id] || [];
                const currentUserId = user?.uid || '';
                const isGroupCreator = currentUserId === group.createdBy;

                return (
                  <View key={group.id} style={[styles.groupItem, { borderColor: colors.icon }]}>
                    <View style={styles.groupHeader}>
                      <View style={styles.groupHeaderContent}>
                        <View style={styles.groupInfo}>
                          <ThemedText style={styles.groupName}>{group.name}</ThemedText>
                          <View style={styles.groupInfoRow}>
                            <TouchableOpacity
                              onPress={() => {
                                if (isViewingMembers) {
                                  setViewingGroupMembers(null);
                                } else {
                                  setViewingGroupMembers(group.id);
                                  setViewingGroupActivity(null);
                                  // Load members if not already loaded
                                  if (!groupMembers[group.id]) {
                                    loadGroupMembersDetails([group]);
                                  }
                                }
                              }}>
                              <ThemedText style={styles.groupMembers}>
                                {group.memberIds.length} member(s) {isViewingMembers ? '▼' : '▶'}
                              </ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                if (isViewingActivity) {
                                  setViewingGroupActivity(null);
                                } else {
                                  setViewingGroupActivity(group.id);
                                  setViewingGroupMembers(null);
                                  // Load activities if not already loaded
                                  if (!groupActivities[group.id]) {
                                    loadGroupActivities(group.id);
                                  }
                                }
                              }}>
                              <ThemedText style={[styles.groupActivityLink, { color: colors.tint }]}>
                                Activity {isViewingActivity ? '▼' : '▶'}
                              </ThemedText>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={styles.groupActionsColumn}>
                          <View style={styles.groupActionButtonsRow}>
                            <TouchableOpacity
                              style={styles.favoriteButton}
                              onPress={() => handleToggleGroupFavorite(group)}>
                              <IconSymbol
                                name={group.isFavorite ? "heart.fill" : "heart"}
                                size={24}
                                color={group.isFavorite ? colors.tint : colors.icon}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.muteButton}
                              onPress={() => handleMuteGroup(group)}>
                              <IconSymbol
                                name={isGroupMuted(group) ? "bell.slash.fill" : "bell.slash"}
                                size={24}
                                color={isGroupMuted(group) ? '#ff9500' : colors.icon}
                              />
                              {isGroupMuted(group) && (
                                <ThemedText style={styles.muteStatusText}>
                                  {getGroupMuteStatusText(group)}
                                </ThemedText>
                              )}
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={[styles.addFriendsButton, { backgroundColor: colors.tint }]}
                            onPress={() => {
                              if (isEditing) {
                                setEditingGroup(null);
                                setSelectedFriends([]);
                                setGroupFriendSearch('');
                              } else {
                                setEditingGroup(group.id);
                                setSelectedFriends([]);
                                setGroupFriendSearch('');
                              }
                            }}>
                            <ThemedText style={styles.addFriendsButtonText} numberOfLines={1}>
                              {isEditing ? 'Cancel' : '+ Add Friends'}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {isViewingMembers && (
                      <View style={styles.groupMembersSection}>
                        {members.length === 0 ? (
                          <ThemedText style={styles.noMembersText}>
                            Loading members... ❄️
                          </ThemedText>
                        ) : (
                          <>
                            <ThemedText style={styles.membersListTitle}>
                              Members ({members.length}):
                            </ThemedText>
                            {members.map((member) => {
                              const canRemove = currentUserId && (currentUserId === group.createdBy || currentUserId === member.friendId);

                              return (
                                <View key={member.id} style={[styles.memberItem, { borderColor: colors.icon }]}>
                                  <View style={styles.memberInfo}>
                                    <View style={styles.memberNameRow}>
                                      <ThemedText style={styles.memberName}>
                                        {member.friendDisplayName || member.friendUsername || 'Unknown'}
                                      </ThemedText>
                                      {member.friendId === group.createdBy && (
                                        <View style={[styles.ownerTag, { backgroundColor: colors.tint }]}>
                                          <ThemedText style={styles.ownerTagText}>Owner</ThemedText>
                                        </View>
                                      )}
                                    </View>
                                    {member.friendUsername && (
                                      <ThemedText style={styles.memberUsername}>
                                        @{member.friendUsername}
                                      </ThemedText>
                                    )}
                                  </View>
                                  {canRemove && (
                                    <TouchableOpacity
                                      style={[styles.removeMemberButton, { backgroundColor: '#ff4444' }]}
                                      onPress={() => handleRemoveMemberFromGroup(
                                        group.id,
                                        member.friendId,
                                        member.friendDisplayName || member.friendUsername || 'Unknown'
                                      )}>
                                      <ThemedText style={styles.removeMemberButtonText}>Remove</ThemedText>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              );
                            })}
                            {isGroupCreator && (
                              <TouchableOpacity
                                style={[styles.disbandMemberButton, { backgroundColor: '#ff4444', borderColor: '#ff4444' }]}
                                onPress={() => handleDisbandGroup(group.id, group.name)}>
                                <ThemedText style={styles.disbandMemberButtonText}>
                                  Disband Parliament
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    )}

                    {isViewingActivity && (
                      <View style={styles.groupActivitySection}>
                        {activities.length === 0 ? (
                          <ThemedText style={styles.noActivityText}>
                            No activity yet ❄️
                          </ThemedText>
                        ) : (
                          <>
                            <ThemedText style={styles.activityListTitle}>
                              Activity:
                            </ThemedText>
                            {activities.slice(0, 5).map((activity) => (
                              <TouchableOpacity
                                key={activity.id}
                                style={[styles.activityItem, { borderColor: colors.icon }]}
                                onPress={() => setSelectedActivity(activity)}>
                                <ThemedText style={styles.activityText}>
                                  {activity.type === 'group_created' && (
                                    <>Group created by {activity.userDisplayName || activity.username || 'Unknown'}</>
                                  )}
                                  {activity.type === 'member_added' && (
                                    <>{activity.userDisplayName || activity.username || 'Unknown'} added {activity.targetDisplayName || activity.targetUsername || 'Unknown'}</>
                                  )}
                                  {activity.type === 'member_removed' && (
                                    <>{activity.userDisplayName || activity.username || 'Unknown'} removed {activity.targetDisplayName || activity.targetUsername || 'Unknown'}</>
                                  )}
                                  {activity.type === 'display_name_changed' && (
                                    <>{activity.userDisplayName || activity.username || 'Unknown'} changed their name from "{activity.oldDisplayName || 'Unknown'}" to "{activity.newDisplayName || 'Unknown'}"</>
                                  )}
                                  {activity.type === 'group_renamed' && (
                                    <>{activity.userDisplayName || activity.username || 'Unknown'} renamed the group from "{activity.oldGroupName || 'Unknown'}" to "{activity.newGroupName || 'Unknown'}"</>
                                  )}
                                </ThemedText>
                                <ThemedText style={styles.activityTimestamp}>
                                  {activity.timestamp.toLocaleDateString()} {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                            {activities.length > 5 && (
                              <TouchableOpacity
                                style={[styles.viewMoreButton, { borderColor: colors.tint }]}
                                onPress={() => {
                                  try {
                                    // Navigate to full-screen activity view
                                    router.push({
                                      pathname: '/group-activity',
                                      params: { groupId: group.id },
                                    } as any);
                                  } catch (error) {
                                    console.error('Error navigating to group activity:', error);
                                    Alert.alert('Error', 'Failed to open group activity');
                                  }
                                }}>
                                <ThemedText style={[styles.viewMoreButtonText, { color: colors.tint }]}>
                                  View All {activities.length} Activities ▶
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    )}

                    {isEditing && (
                      <View style={styles.addFriendsSection}>
                        {availableFriends.length === 0 ? (
                          <ThemedText style={styles.noFriendsText}>
                            All your friends are already in this group ❄️
                          </ThemedText>
                        ) : (
                          <>
                            <ThemedText style={styles.selectFriendsTitle}>
                              Select friends to add:
                            </ThemedText>
                            <TextInput
                              style={[
                                styles.groupFriendSearchInput,
                                {
                                  color: '#000',
                                  borderColor: colors.icon,
                                  backgroundColor: '#fff',
                                },
                              ]}
                              placeholder="Search friends..."
                              placeholderTextColor={colors.icon}
                              value={groupFriendSearch}
                              onChangeText={setGroupFriendSearch}
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                            {filteredFriends.length === 0 ? (
                              <ThemedText style={styles.noFriendsText}>
                                No friends found matching "{groupFriendSearch}" ❄️
                              </ThemedText>
                            ) : (
                              filteredFriends.map((friend) => (
                                <TouchableOpacity
                                  key={friend.id}
                                  style={[
                                    styles.friendSelectItem,
                                    {
                                      backgroundColor: selectedFriends.includes(friend.friendId)
                                        ? colors.tint
                                        : '#fff',
                                      borderColor: selectedFriends.includes(friend.friendId)
                                        ? colors.tint
                                        : colors.icon,
                                    },
                                  ]}
                                  onPress={() => toggleFriendSelection(friend.friendId)}>
                                  <View style={styles.friendSelectInfo}>
                                    <ThemedText
                                      style={[
                                        styles.friendSelectText,
                                        {
                                          color: selectedFriends.includes(friend.friendId)
                                            ? '#fff'
                                            : colors.text,
                                        },
                                      ]}>
                                      {friend.friendDisplayName || friend.friendUsername || 'Unknown'}
                                    </ThemedText>
                                    {friend.friendUsername && (
                                      <ThemedText
                                        style={[
                                          styles.friendSelectUsername,
                                          {
                                            color: selectedFriends.includes(friend.friendId)
                                              ? '#fff'
                                              : colors.text,
                                          },
                                        ]}>
                                        @{friend.friendUsername}
                                      </ThemedText>
                                    )}
                                  </View>
                                  {selectedFriends.includes(friend.friendId) && (
                                    <ThemedText style={styles.checkmark}>✓</ThemedText>
                                  )}
                                </TouchableOpacity>
                              ))
                            )}
                            <TouchableOpacity
                              style={[
                                styles.confirmAddButton,
                                {
                                  backgroundColor: colors.tint,
                                  opacity: selectedFriends.length === 0 ? 0.5 : 1,
                                },
                              ]}
                              onPress={() => handleAddFriendsToGroup(group.id)}
                              disabled={selectedFriends.length === 0 || loading}>
                              {loading ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <ThemedText style={styles.confirmAddButtonText}>
                                  Add {selectedFriends.length > 0 ? `${selectedFriends.length} ` : ''}Friend{selectedFriends.length !== 1 ? 's' : ''} ❄️
                                </ThemedText>
                              )}
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Mute Modal */}
      <MuteModal
        visible={muteModalVisible}
        onClose={() => {
          setMuteModalVisible(false);
          setSelectedFriendForMute(null);
          setSelectedGroupForMute(null);
          setIsMutingGroup(false);
        }}
        selectedFriend={selectedFriendForMute}
        selectedGroup={selectedGroupForMute}
        isMutingGroup={isMutingGroup}
        customMuteHours={customMuteHours}
        onCustomMuteHoursChange={setCustomMuteHours}
        onMuteDuration={handleMuteDuration}
        onCustomMute={handleCustomMute}
      />

      {/* Activity Details Modal */}
      <Modal
        visible={selectedActivity !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedActivity(null)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            {selectedActivity && (
              <>
                <ThemedText style={styles.modalTitle}>Activity Details</ThemedText>

                <View style={styles.activityDetailSection}>
                  <ThemedText style={styles.activityDetailLabel}>User:</ThemedText>
                  <ThemedText style={styles.activityDetailValue}>
                    {selectedActivity.userDisplayName || 'Unknown'}
                    {selectedActivity.username && ` (@${selectedActivity.username})`}
                  </ThemedText>
                </View>

                {selectedActivity.targetUserId && (
                  <View style={styles.activityDetailSection}>
                    <ThemedText style={styles.activityDetailLabel}>
                      {selectedActivity.type === 'member_added' || selectedActivity.type === 'member_removed' ? 'Target User:' : 'User:'}
                    </ThemedText>
                    <ThemedText style={styles.activityDetailValue}>
                      {selectedActivity.targetDisplayName || selectedActivity.targetUsername || 'Unknown'}
                      {selectedActivity.targetUsername && ` (@${selectedActivity.targetUsername})`}
                      {selectedActivity.targetUsernameOnly && !selectedActivity.targetUsername && ` (@${selectedActivity.targetUsernameOnly})`}
                    </ThemedText>
                  </View>
                )}

                <View style={styles.activityDetailSection}>
                  <ThemedText style={styles.activityDetailLabel}>Activity:</ThemedText>
                  <ThemedText style={styles.activityDetailValue}>
                    {selectedActivity.type === 'group_created' && 'Group created'}
                    {selectedActivity.type === 'member_added' && 'Member added'}
                    {selectedActivity.type === 'member_removed' && 'Member removed'}
                    {selectedActivity.type === 'display_name_changed' && 'Display name changed'}
                    {selectedActivity.type === 'group_renamed' && 'Group renamed'}
                  </ThemedText>
                </View>

                {selectedActivity.type === 'display_name_changed' && (
                  <View style={styles.activityDetailSection}>
                    <ThemedText style={styles.activityDetailLabel}>Name Change:</ThemedText>
                    <ThemedText style={styles.activityDetailValue}>
                      "{selectedActivity.oldDisplayName || 'Unknown'}" → "{selectedActivity.newDisplayName || 'Unknown'}"
                    </ThemedText>
                  </View>
                )}

                {selectedActivity.type === 'group_renamed' && (
                  <View style={styles.activityDetailSection}>
                    <ThemedText style={styles.activityDetailLabel}>Group Name Change:</ThemedText>
                    <ThemedText style={styles.activityDetailValue}>
                      "{selectedActivity.oldGroupName || 'Unknown'}" → "{selectedActivity.newGroupName || 'Unknown'}"
                    </ThemedText>
                  </View>
                )}

                <View style={styles.activityDetailSection}>
                  <ThemedText style={styles.activityDetailLabel}>Date & Time:</ThemedText>
                  <ThemedText style={styles.activityDetailValue}>
                    {selectedActivity.timestamp.toLocaleDateString()} {selectedActivity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </ThemedText>
                </View>

                <TouchableOpacity
                  style={[styles.modalCancelButton, { borderColor: colors.icon, marginTop: 20 }]}
                  onPress={() => setSelectedActivity(null)}>
                  <ThemedText style={[styles.modalCancelText, { color: colors.icon }]}>
                    Close
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 20,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 20,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  searchButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  friendsSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
    position: 'relative',
  },
  friendsSearchInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    paddingRight: 40,
    fontSize: 15,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  clearSearchButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    fontSize: 18,
    fontWeight: '600',
  },
  sortContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  sortButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    height: 32,
    maxWidth: '100%',
    display: 'flex',
  },
  sortButtonText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    flexShrink: 0,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    gap: 10,
    marginBottom: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  friendInfo: {
    flex: 1,
    paddingRight: 10,
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favoriteButton: {
    padding: 4,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 3,
  },
  friendUsername: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
    color: '#000',
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  removeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  muteButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  muteStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ff9500',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: '#000',
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 24,
    textAlign: 'center',
    color: '#000',
  },
  muteOptionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  muteOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  customMuteContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  customMuteLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  customMuteInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  customMuteButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  customMuteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  unmuteButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  unmuteButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  requestItem: {
    padding: 20,
    borderWidth: 2,
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  requestInfo: {
    flex: 1,
    marginBottom: 12,
    paddingRight: 10,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  requestUsername: {
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.7,
    color: '#000',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  declineButton: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  declineButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#ff9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  createGroupButton: {
    padding: 18,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  createGroupButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  createGroupForm: {
    marginBottom: 16,
  },
  groupInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  createButton: {
    padding: 14,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  groupItem: {
    padding: 10,
    borderWidth: 1.5,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  groupHeader: {
    marginBottom: 0,
  },
  groupHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
    width: '100%',
  },
  groupInfo: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  groupActionsColumn: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    flexShrink: 0,
    maxWidth: '45%',
  },
  groupActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  viewMembersButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 2,
    backgroundColor: '#fff',
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  viewMembersButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  groupMembersSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  membersListTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: '#000',
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 5,
    backgroundColor: '#f8f9fa',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  ownerTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
  },
  ownerTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  memberUsername: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
    color: '#000',
  },
  removeMemberButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  removeMemberButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  disbandMemberButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  disbandMemberButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  noMembersText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  groupActivitySection: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  activityListTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: '#000',
  },
  activityItem: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 5,
    backgroundColor: '#f8f9fa',
  },
  activityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
    lineHeight: 18,
  },
  activityTimestamp: {
    fontSize: 11,
    opacity: 0.6,
    color: '#000',
  },
  activityDetailSection: {
    marginBottom: 16,
  },
  activityDetailLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  activityDetailValue: {
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  noActivityText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  groupName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    color: '#000',
    letterSpacing: -0.2,
  },
  groupInfoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  groupMembers: {
    fontSize: 13,
    opacity: 0.8,
    color: '#000',
    fontWeight: '500',
  },
  groupActivityLink: {
    fontSize: 13,
    opacity: 0.8,
    fontWeight: '600',
  },
  addFriendsButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    width: '100%',
    maxWidth: 140,
  },
  addFriendsButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  disbandButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  disbandButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  addFriendsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  selectFriendsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  friendSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 15,
    borderWidth: 2,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  friendSelectInfo: {
    flex: 1,
  },
  friendSelectText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  friendSelectUsername: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  confirmAddButton: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmAddButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  noFriendsText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  groupFriendSearchInput: {
    borderWidth: 2,
    borderRadius: 15,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyEmoji: {
    width: 50,
    height: 50,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
  signOutContainer: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  signOutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 2,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addFriendsToggleButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  addFriendsToggleText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  viewMoreButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  viewMoreButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

