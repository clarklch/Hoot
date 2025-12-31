import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, PanResponder, Dimensions, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, deleteDoc, Timestamp, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '@/config/firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

export default function SettingsScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [defaultHootText, setDefaultHootText] = useState('Hoot!');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [funStats, setFunStats] = useState({
    totalHoots: 0,
    totalCharacters: 0,
    mostHootsInDay: 0,
    favoriteDay: '',
    topRecipient: { name: '', count: 0 },
  });
  const { user, signOut, updateUser } = useAuth();
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
        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right: go to Friends
          router.push('/(tabs)/friends');
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left: go to Hoot
          router.push('/(tabs)');
        }
      },
    })
  ).current;

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const currentUserId = user?.uid || await AsyncStorage.getItem('hoot_userId') || 'temp_user';
        const userDoc = await getDoc(doc(db, 'users', currentUserId));
        const userData = userDoc.data();
        setDisplayName(userData?.displayName || user?.displayName || '');
        setUsername(userData?.username || user?.username || '');
        setDefaultHootText(userData?.defaultHootText || 'Hoot!');
        
        // Load fun stats
        const totalHoots = userData?.hootCount || 0;
        const totalCharacters = userData?.totalCharacters || 0;
        const dailyCounts = userData?.dailyHootCounts || {};
        const dayOfWeekCounts = userData?.dayOfWeekCounts || {};
        const recipientCounts = userData?.recipientCounts || {};
        
        // Find most hoots in a day
        const mostHootsInDay = Math.max(...Object.values(dailyCounts), 0);
        
        // Find favorite day of week
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let favoriteDay = '';
        let maxDayCount = 0;
        dayNames.forEach(day => {
          const count = dayOfWeekCounts[day] || 0;
          if (count > maxDayCount) {
            maxDayCount = count;
            favoriteDay = day;
          }
        });
        
        // Find top recipient
        let topRecipientId = '';
        let topRecipientCount = 0;
        Object.entries(recipientCounts).forEach(([recipientId, count]) => {
          if ((count as number) > topRecipientCount) {
            topRecipientCount = count as number;
            topRecipientId = recipientId;
          }
        });
        
        // Get recipient name
        let topRecipientName = '';
        if (topRecipientId) {
          try {
            const recipientDoc = await getDoc(doc(db, 'users', topRecipientId));
            const recipientData = recipientDoc.data();
            topRecipientName = recipientData?.displayName || recipientData?.username || 'Unknown';
          } catch (error) {
            console.error('Error loading top recipient:', error);
            topRecipientName = 'Unknown';
          }
        }
        
        setFunStats({
          totalHoots,
          totalCharacters,
          mostHootsInDay,
          favoriteDay: favoriteDay || 'N/A',
          topRecipient: {
            name: topRecipientName || 'N/A',
            count: topRecipientCount,
          },
        });
      } catch (error) {
        console.error('Error loading user data:', error);
        setDisplayName(user?.displayName || '');
        setUsername(user?.username || '');
        setDefaultHootText('Hoot!');
      } finally {
        setInitialLoading(false);
      }
    };
    loadUserData();
  }, [user]);

  // Refresh stats when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const refreshStats = async () => {
        try {
          const currentUserId = user?.uid || await AsyncStorage.getItem('hoot_userId') || 'temp_user';
          const userDoc = await getDoc(doc(db, 'users', currentUserId));
          const userData = userDoc.data();
          
          if (!userData) return;
          
          const totalHoots = userData?.hootCount || 0;
          const totalCharacters = userData?.totalCharacters || 0;
          const dailyCounts = userData?.dailyHootCounts || {};
          const dayOfWeekCounts = userData?.dayOfWeekCounts || {};
          const recipientCounts = userData?.recipientCounts || {};
          
          // Find most hoots in a day
          const mostHootsInDay = Math.max(...Object.values(dailyCounts), 0);
          
          // Find favorite day of week
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          let favoriteDay = '';
          let maxDayCount = 0;
          dayNames.forEach(day => {
            const count = dayOfWeekCounts[day] || 0;
            if (count > maxDayCount) {
              maxDayCount = count;
              favoriteDay = day;
            }
          });
          
          // Find top recipient
          let topRecipientId = '';
          let topRecipientCount = 0;
          Object.entries(recipientCounts).forEach(([recipientId, count]) => {
            if ((count as number) > topRecipientCount) {
              topRecipientCount = count as number;
              topRecipientId = recipientId;
            }
          });
          
          // Get recipient name
          let topRecipientName = '';
          if (topRecipientId) {
            try {
              const recipientDoc = await getDoc(doc(db, 'users', topRecipientId));
              const recipientData = recipientDoc.data();
              topRecipientName = recipientData?.displayName || recipientData?.username || 'Unknown';
            } catch (error) {
              console.error('Error loading top recipient:', error);
              topRecipientName = 'Unknown';
            }
          }
          
          setFunStats({
            totalHoots,
            totalCharacters,
            mostHootsInDay,
            favoriteDay: favoriteDay || 'N/A',
            topRecipient: {
              name: topRecipientName || 'N/A',
              count: topRecipientCount,
            },
          });
        } catch (error) {
          console.error('Error refreshing stats:', error);
        }
      };
      
      refreshStats();
    }, [user])
  );

  const handleSaveDisplayName = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const currentUserId = user?.uid || await AsyncStorage.getItem('hoot_userId') || 'temp_user';
      
      // Get current user data to find old display name
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const userData = userDoc.data();
      const oldDisplayName = userData?.displayName || user?.displayName || '';

      // Only proceed if the name actually changed
      if (oldDisplayName === trimmedName) {
        Alert.alert('No Changes', 'Display name is the same');
        setLoading(false);
        return;
      }

      // Update user document in Firestore
      await setDoc(doc(db, 'users', currentUserId), {
        displayName: trimmedName,
      }, { merge: true });

      // Update local auth context
      await updateUser({ displayName: trimmedName });

      // Find all groups the user is in
      const groupsQuery = query(
        collection(db, 'groups'),
        where('memberIds', 'array-contains', currentUserId)
      );
      const groupsSnapshot = await getDocs(groupsQuery);

      // Create activity entries for each group
      const activityPromises = groupsSnapshot.docs.map(async (groupDoc) => {
        const groupId = groupDoc.id;
        const currentUserUsername = userData?.username || user?.username || 'Unknown';
        
        await addDoc(collection(db, 'groupActivities'), {
          groupId: groupId,
          type: 'display_name_changed',
          userId: currentUserId,
          username: currentUserUsername,
          userDisplayName: trimmedName, // New display name
          oldDisplayName: oldDisplayName,
          newDisplayName: trimmedName,
          timestamp: new Date(),
        });
      });

      await Promise.all(activityPromises);

      Alert.alert('Success', 'Display name updated! Your groups have been notified.');
    } catch (error) {
      console.error('Error updating display name:', error);
      Alert.alert('Error', 'Failed to update display name. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDefaultHootText = async () => {
    const trimmedText = defaultHootText.trim();
    if (!trimmedText) {
      Alert.alert('Error', 'Default Hoot text cannot be empty');
      return;
    }

    if (trimmedText.length > 100) {
      Alert.alert('Error', 'Default Hoot text cannot exceed 100 characters');
      return;
    }

    setLoading(true);
    try {
      const currentUserId = user?.uid || await AsyncStorage.getItem('hoot_userId') || 'temp_user';
      
      // Get current user data
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const userData = userDoc.data();
      const oldDefaultText = userData?.defaultHootText || 'Hoot!';

      // Only proceed if the text actually changed
      if (oldDefaultText === trimmedText) {
        Alert.alert('No Changes', 'Default Hoot text is already the same');
        setLoading(false);
        return;
      }

      // Update user document in Firestore
      await setDoc(doc(db, 'users', currentUserId), {
        defaultHootText: trimmedText,
      }, { merge: true });

      // Update local auth context
      await updateUser({ defaultHootText: trimmedText });

      Alert.alert('Success', 'Default Hoot text updated! 🎉');
    } catch (error) {
      console.error('Error updating default Hoot text:', error);
      Alert.alert('Error', 'Failed to update default Hoot text. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaultHootText = async () => {
    setLoading(true);
    try {
      const currentUserId = user?.uid || await AsyncStorage.getItem('hoot_userId') || 'temp_user';
      
      // Update user document in Firestore
      await setDoc(doc(db, 'users', currentUserId), {
        defaultHootText: 'Hoot!',
      }, { merge: true });

      // Update local state
      setDefaultHootText('Hoot!');

      // Update local auth context
      await updateUser({ defaultHootText: 'Hoot!' });

      Alert.alert('Success', 'Default Hoot text reset to "Hoot!" ❄️');
    } catch (error) {
      console.error('Error resetting default Hoot text:', error);
      Alert.alert('Error', 'Failed to reset default Hoot text. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      '⚠️ WARNING: This will permanently delete your account and all associated data. This action cannot be undone.\n\nThis includes:\n• Your profile\n• All friendships\n• All groups you created\n• All messages\n• All activity history\n\nAre you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'This is your last chance. Your account will be permanently deleted. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    setLoading(true);
                    try {
                      const currentUserId = user?.uid || await AsyncStorage.getItem('hoot_userId') || 'temp_user';
                      
                      // 1. Delete user document
                      const userDocRef = doc(db, 'users', currentUserId);
                      await deleteDoc(userDocRef);
                      
                      // 2. Delete username entry
                      if (username) {
                        const usernameDocRef = doc(db, 'usernames', username.toLowerCase());
                        await deleteDoc(usernameDocRef).catch(() => {
                          // Username might not exist, continue
                        });
                      }
                      
                      // 3. Delete all friendships (both directions)
                      const friendshipsQuery1 = query(
                        collection(db, 'friendships'),
                        where('userId', '==', currentUserId)
                      );
                      const friendshipsQuery2 = query(
                        collection(db, 'friendships'),
                        where('friendId', '==', currentUserId)
                      );
                      const [snapshot1, snapshot2] = await Promise.all([
                        getDocs(friendshipsQuery1),
                        getDocs(friendshipsQuery2)
                      ]);
                      const allFriendships = [...snapshot1.docs, ...snapshot2.docs];
                      await Promise.all(allFriendships.map(docSnap => deleteDoc(docSnap.ref)));
                      
                      // 4. Handle groups - remove user from groups or delete if creator
                      const groupsQuery = query(
                        collection(db, 'groups'),
                        where('memberIds', 'array-contains', currentUserId)
                      );
                      const groupsSnapshot = await getDocs(groupsQuery);
                      const groupPromises = groupsSnapshot.docs.map(async (groupDoc) => {
                        const groupData = groupDoc.data();
                        if (groupData.createdBy === currentUserId) {
                          // User is creator - delete the entire group
                          const groupId = groupDoc.id;
                          
                          // Delete all group activities
                          const activitiesQuery = query(
                            collection(db, 'groupActivities'),
                            where('groupId', '==', groupId)
                          );
                          const activitiesSnapshot = await getDocs(activitiesQuery);
                          await Promise.all(activitiesSnapshot.docs.map(docSnap => deleteDoc(docSnap.ref)));
                          
                          // Delete the group
                          await deleteDoc(groupDoc.ref);
                        } else {
                          // User is member - remove from group
                          await updateDoc(groupDoc.ref, {
                            memberIds: arrayRemove(currentUserId)
                          });
                          
                          // Log activity for remaining members
                          await addDoc(collection(db, 'groupActivities'), {
                            groupId: groupDoc.id,
                            type: 'member_removed',
                            userId: currentUserId,
                            username: username || 'Unknown',
                            userDisplayName: displayName || username || 'Unknown',
                            timestamp: new Date(),
                          });
                        }
                      });
                      await Promise.all(groupPromises);
                      
                      // 5. Delete all group activities created by user
                      const userActivitiesQuery = query(
                        collection(db, 'groupActivities'),
                        where('userId', '==', currentUserId)
                      );
                      const userActivitiesSnapshot = await getDocs(userActivitiesQuery);
                      await Promise.all(userActivitiesSnapshot.docs.map(docSnap => deleteDoc(docSnap.ref)));
                      
                      // 6. Delete all messages sent by or to the user
                      const messagesFromQuery = query(
                        collection(db, 'messages'),
                        where('fromUserId', '==', currentUserId)
                      );
                      const messagesToQuery = query(
                        collection(db, 'messages'),
                        where('toUserId', '==', currentUserId)
                      );
                      const [messagesFromSnapshot, messagesToSnapshot] = await Promise.all([
                        getDocs(messagesFromQuery),
                        getDocs(messagesToQuery)
                      ]);
                      const allMessages = [...messagesFromSnapshot.docs, ...messagesToSnapshot.docs];
                      await Promise.all(allMessages.map(docSnap => deleteDoc(docSnap.ref)));
                      
                      // 7. Delete all notifications related to the user
                      const notificationsFromQuery = query(
                        collection(db, 'notifications'),
                        where('fromUserId', '==', currentUserId)
                      );
                      const notificationsToQuery = query(
                        collection(db, 'notifications'),
                        where('toUserId', '==', currentUserId)
                      );
                      const [notificationsFromSnapshot, notificationsToSnapshot] = await Promise.all([
                        getDocs(notificationsFromQuery),
                        getDocs(notificationsToQuery)
                      ]);
                      const allNotifications = [...notificationsFromSnapshot.docs, ...notificationsToSnapshot.docs];
                      await Promise.all(allNotifications.map(docSnap => deleteDoc(docSnap.ref)));
                      
                      // 8. Clear AsyncStorage
                      await AsyncStorage.removeItem('hoot_userId');
                      await AsyncStorage.removeItem('hoot_username');
                      
                      // 9. Sign out
                      await signOut();
                      
                      Alert.alert(
                        'Account Deleted',
                        'Your account and all associated data have been permanently deleted.',
                        [
                          {
                            text: 'OK',
                            onPress: () => {
                              router.replace('/(auth)/login');
                            }
                          }
                        ]
                      );
                    } catch (error) {
                      console.error('Error deleting account:', error);
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                      setLoading(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  if (initialLoading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
        {...panResponder.panHandlers}
        showsVerticalScrollIndicator={true}>
        <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Settings ❄️
        </ThemedText>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Display Name</ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Change how your name appears to friends and in groups
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                color: '#000',
                borderColor: colors.icon,
                backgroundColor: '#fff',
              },
            ]}
            placeholder="Enter display name"
            placeholderTextColor={colors.icon}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={50}
            editable={!loading}
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          <TouchableOpacity
            style={[
              styles.saveButtonFullWidth,
              {
                backgroundColor: colors.tint,
                opacity: loading ? 0.6 : 1,
                marginTop: 16,
              },
            ]}
            onPress={handleSaveDisplayName}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Default Hoot Text</ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Set the default text that appears in the Hoot input field
          </ThemedText>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#000',
                  borderColor: colors.icon,
                  backgroundColor: '#fff',
                },
              ]}
              placeholder="Enter default Hoot text"
              placeholderTextColor={colors.icon}
              value={defaultHootText}
              onChangeText={setDefaultHootText}
              maxLength={100}
              editable={!loading}
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <ThemedText style={[styles.characterCount, { color: colors.icon }]}>
              {defaultHootText.length}/100
            </ThemedText>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.resetButton,
                {
                  borderColor: colors.icon,
                  opacity: loading ? 0.6 : 1,
                },
              ]}
              onPress={handleResetDefaultHootText}
              disabled={loading}>
              <ThemedText style={[styles.resetButtonText, { color: colors.icon }]} numberOfLines={1}>
                Reset
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: colors.tint,
                  opacity: loading ? 0.6 : 1,
                },
              ]}
              onPress={handleSaveDefaultHootText}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.saveButtonText} numberOfLines={1}>
                  Save Changes
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          {username && (
            <View style={styles.usernameContainer}>
              <ThemedText style={styles.usernameLabel}>Username:</ThemedText>
              <ThemedText style={styles.usernameValue}>@{username}</ThemedText>
            </View>
          )}
          <TouchableOpacity
            style={[styles.signOutButton, { borderColor: colors.icon }]}
            onPress={handleSignOut}
            disabled={loading}>
            <ThemedText style={[styles.signOutText, { color: colors.icon }]}>
              Sign Out
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteAccountButton, { borderColor: '#ff4444' }]}
            onPress={handleDeleteAccount}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#ff4444" />
            ) : (
              <ThemedText style={[styles.deleteAccountText, { color: '#ff4444' }]}>
                Delete Account
              </ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Fun Stats 🎉</ThemedText>
          <View style={styles.funStatsContainer}>
            <View style={styles.statContent}>
              <View style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Total Hoots Sent:</ThemedText>
                <ThemedText style={styles.statValue}>{funStats.totalHoots.toLocaleString()}</ThemedText>
              </View>
              <View style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Total Characters Sent:</ThemedText>
                <ThemedText style={styles.statValue}>{funStats.totalCharacters.toLocaleString()}</ThemedText>
              </View>
              <View style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Most Hoots in a Day:</ThemedText>
                <ThemedText style={styles.statValue}>{funStats.mostHootsInDay}</ThemedText>
              </View>
              <View style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Favorite Day to Hoot:</ThemedText>
                <ThemedText style={styles.statValue}>{funStats.favoriteDay}</ThemedText>
              </View>
              <View style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Top Recipient:</ThemedText>
                <ThemedText style={styles.statValue}>
                  {funStats.topRecipient.name} ({funStats.topRecipient.count} {funStats.topRecipient.count === 1 ? 'hoot' : 'hoots'})
                </ThemedText>
              </View>
            </View>
            {funStats.totalHoots < 50 && (
              <>
                <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                <View style={styles.unlockOverlay}>
                  <ThemedText style={styles.unlockTitle}>🔒 Locked</ThemedText>
                  <ThemedText style={styles.unlockText}>
                    Send {50 - funStats.totalHoots} more {50 - funStats.totalHoots === 1 ? 'hoot' : 'hoots'} to unlock your stats!
                  </ThemedText>
                </View>
              </>
            )}
          </View>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>About</ThemedText>
          <ThemedText style={styles.aboutText}>
            Hoot v1.0.0{'\n'}
            Connect with friends and send them a Hoot! ❄️
          </ThemedText>
        </ThemedView>
      </ThemedView>
      </ScrollView>
      <LinearGradient
        colors={[
          colorScheme === 'dark' ? 'rgba(30, 42, 58, 1)' : 'rgba(248, 249, 250, 1)',
          colorScheme === 'dark' ? 'rgba(30, 42, 58, 1)' : 'rgba(248, 249, 250, 1)',
          colorScheme === 'dark' ? 'rgba(30, 42, 58, 0.9)' : 'rgba(248, 249, 250, 0.9)',
          colorScheme === 'dark' ? 'rgba(30, 42, 58, 0.5)' : 'rgba(248, 249, 250, 0.5)',
          colorScheme === 'dark' ? 'rgba(30, 42, 58, 0)' : 'rgba(248, 249, 250, 0)',
        ]}
        locations={[0, 0.2, 0.4, 0.7, 1]}
        style={[styles.fadeOverlay, { top: insets.top + 50 }]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 32,
    textAlign: 'center',
    letterSpacing: -0.5,
    paddingHorizontal: 10,
  },
  section: {
    marginBottom: 32,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    color: '#000',
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
    color: '#000',
  },
  usernameContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  usernameLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 6,
    color: '#000',
  },
  usernameValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  inputContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  input: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    paddingBottom: 32,
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '48%',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  saveButtonFullWidth: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    width: '100%',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    width: '48%',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  signOutButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
  },
  deleteAccountButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 12,
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    textAlign: 'right',
    flex: 1,
  },
  funStatsContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
  },
  statContent: {
    position: 'relative',
  },
  blurredContent: {
    opacity: 0.3,
  },
  unlockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
  },
  unlockTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  unlockText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  aboutText: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
    color: '#000',
  },
  characterCount: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 11,
    opacity: 0.5,
    fontWeight: '500',
  },
  fadeOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 25,
    zIndex: 999,
  },
});

