// Notification service for handling push notifications
import * as Notifications from 'expo-notifications';
import { Platform, AppState, AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register or refresh push token for a user
 * This function intelligently refreshes tokens to prevent expiration issues
 * @param userId - The user ID to register the token for
 * @param forceRefresh - If true, always refresh the token even if it hasn't changed
 * @returns The push token string, or null if registration failed
 */
export async function registerForPushNotifications(userId: string, forceRefresh: boolean = false): Promise<string | null> {
  try {
    if (!userId || userId === 'temp_user') {
      console.log('⚠️ Cannot register push token: Invalid user ID');
      return null;
    }

    console.log('📱 Registering push token for user:', userId, forceRefresh ? '(forced refresh)' : '');
    
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Get the Expo push token
    // For Expo Go, we need a projectId. Try to get it from app.json or Constants
    let projectId: string | undefined;
    
    // Method 1: Try from Constants.expoConfig.extra.eas.projectId (from app.json)
    if (Constants.expoConfig?.extra?.eas?.projectId) {
      projectId = Constants.expoConfig.extra.eas.projectId;
    }
    // Method 2: Try from Constants.expoConfig.extra.projectId
    else if (Constants.expoConfig?.extra?.projectId) {
      projectId = Constants.expoConfig.extra.projectId;
    }
    
    // Get push token - projectId is required for Expo Go
    let tokenData;
    try {
      if (projectId && projectId !== 'YOUR_EXPO_PROJECT_ID_HERE') {
        tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      } else {
        // Try without projectId (might work in some cases, but usually fails in Expo Go)
        tokenData = await Notifications.getExpoPushTokenAsync();
      }
    } catch (error: any) {
      // If we get the projectId error, provide helpful message
      if (error.message?.includes('projectId') || error.message?.includes('No "projectId"')) {
        const errorMsg = 'Expo projectId required for push notifications.\n\n' +
          'To fix this:\n' +
          '1. Go to https://expo.dev and create a free account\n' +
          '2. Create a new project named "Hoot"\n' +
          '3. Copy the Project ID (looks like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)\n' +
          '4. Replace "YOUR_EXPO_PROJECT_ID_HERE" in app.json with your actual project ID\n' +
          '5. Restart the app';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      throw error;
    }

    const newToken = tokenData.data;

    // CRITICAL: Check if token actually changed to avoid unnecessary Firestore writes
    // This prevents unnecessary refreshes and reduces Firestore costs
    if (!forceRefresh) {
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const existingToken = userDoc.data()?.pushToken;
          
          // If token hasn't changed, just update the timestamp and return early
          if (existingToken === newToken) {
            console.log('✅ Push token unchanged, updating refresh timestamp only');
            await updateDoc(userDocRef, {
              pushTokenLastRefreshed: Timestamp.now(),
            });
            return newToken;
          }
        }
      } catch (error) {
        console.warn('Error checking existing token, proceeding with full registration:', error);
        // Continue with full registration if check fails
      }
    }

    // CRITICAL: Clear this push token from all other users' documents
    // This ensures a push token is only associated with one user at a time
    // (same device, same push token, but different users)
    console.log('🔍 Checking for other users with the same push token...');
    const usersWithSameTokenQuery = query(
      collection(db, 'users'),
      where('pushToken', '==', tokenData.data)
    );
    const usersWithSameTokenSnapshot = await getDocs(usersWithSameTokenQuery);
    
    // Clear push token from all other users with the same token (not the current user)
    const clearSameTokenPromises = usersWithSameTokenSnapshot.docs
      .filter(docSnap => docSnap.id !== userId)
      .map(async (docSnap) => {
        try {
          await updateDoc(docSnap.ref, { pushToken: null });
          console.log(`🧹 Cleared push token from user with same token: ${docSnap.id}`);
        } catch (error) {
          console.error(`Error clearing push token from user ${docSnap.id}:`, error);
        }
      });
    
    await Promise.all(clearSameTokenPromises);
    
    // ADDITIONAL SAFEGUARD: Also clear push tokens from any other users on this device
    // This prevents notifications from being sent to old test accounts
    // We'll get all users and check if they have any push token, then clear it if they're not the current user
    // Note: This is more aggressive but necessary to prevent cross-user notifications
    console.log('🔍 Clearing push tokens from all other users to prevent cross-user notifications...');
    try {
      const allUsersQuery = query(collection(db, 'users'));
      const allUsersSnapshot = await getDocs(allUsersQuery);
      
      const clearAllPromises = allUsersSnapshot.docs
        .filter(docSnap => {
          const userData = docSnap.data();
          // Only clear if user has a push token and is not the current user
          return docSnap.id !== userId && userData?.pushToken && userData.pushToken !== null;
        })
        .map(async (docSnap) => {
          try {
            await updateDoc(docSnap.ref, { pushToken: null });
            console.log(`🧹 Cleared push token from other user: ${docSnap.id}`);
          } catch (error) {
            console.error(`Error clearing push token from user ${docSnap.id}:`, error);
          }
        });
      
      await Promise.all(clearAllPromises);
      console.log('✅ Cleared push tokens from all other users');
    } catch (error) {
      console.error('Error clearing push tokens from all users:', error);
      // Don't fail the registration if this cleanup fails
    }
    
    // Now save the token for the current user with refresh timestamp
    console.log('💾 Saving push token to Firestore for user:', userId);
    await setDoc(
      doc(db, 'users', userId),
      { 
        pushToken: newToken,
        pushTokenLastRefreshed: Timestamp.now(),
      },
      { merge: true }
    );

    // Also store last refresh time in AsyncStorage for local checks
    try {
      await AsyncStorage.setItem(`pushToken_lastRefresh_${userId}`, Date.now().toString());
    } catch (error) {
      console.warn('Failed to save token refresh time to AsyncStorage:', error);
    }

    console.log('✅ Push token registered successfully for user:', userId);
    return newToken;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Check if push token needs to be refreshed based on last refresh time
 * Tokens should be refreshed:
 * - If never refreshed before
 * - If last refresh was more than 24 hours ago
 * - If forceRefresh is true
 * @param userId - The user ID to check
 * @param forceRefresh - Force refresh even if recent
 * @returns true if token should be refreshed
 */
export async function shouldRefreshPushToken(userId: string, forceRefresh: boolean = false): Promise<boolean> {
  if (forceRefresh) {
    return true;
  }

  try {
    // CRITICAL: Always check Firestore first to see if token exists
    // If token is null (was cleared by Cloud Function due to invalidity), we MUST refresh
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const existingToken = userData?.pushToken;
      
      // If token is null or missing, we MUST refresh regardless of timestamp
      if (!existingToken || existingToken === null) {
        console.log('🔄 Push token is null in Firestore, refresh required');
        return true;
      }
      
      // Token exists, check if refresh is needed based on timestamp
      const lastRefreshed = userData?.pushTokenLastRefreshed;
      
      if (lastRefreshed) {
        const lastRefreshedDate = lastRefreshed.toDate ? lastRefreshed.toDate() : new Date(lastRefreshed);
        const hoursSinceRefresh = (Date.now() - lastRefreshedDate.getTime()) / (1000 * 60 * 60);
        
        // Refresh if last refresh was more than 24 hours ago
        if (hoursSinceRefresh < 24) {
          console.log(`✅ Push token refreshed ${hoursSinceRefresh.toFixed(1)} hours ago in Firestore, skipping refresh`);
          return false;
        }
      }
    }

    // Also check AsyncStorage for quick local check (but Firestore is authoritative)
    // Only use AsyncStorage if Firestore check didn't give us a definitive answer
    const lastRefreshKey = `pushToken_lastRefresh_${userId}`;
    const lastRefreshTimeStr = await AsyncStorage.getItem(lastRefreshKey);
    
    if (lastRefreshTimeStr) {
      const lastRefreshTime = parseInt(lastRefreshTimeStr, 10);
      const hoursSinceRefresh = (Date.now() - lastRefreshTime) / (1000 * 60 * 60);
      
      // Only skip refresh if AsyncStorage says it was recent AND we don't have Firestore data
      if (hoursSinceRefresh < 24 && (!userDoc.exists() || !userDoc.data()?.pushTokenLastRefreshed)) {
        console.log(`✅ Push token refreshed ${hoursSinceRefresh.toFixed(1)} hours ago (AsyncStorage), skipping refresh`);
        return false;
      }
    }

    // If no timestamp found or it's been more than 24 hours, refresh
    console.log('🔄 Push token refresh needed (no recent refresh found or >24 hours old)');
    return true;
  } catch (error) {
    console.warn('Error checking push token refresh status, will refresh to be safe:', error);
    return true; // Refresh if we can't determine status
  }
}

/**
 * Refresh push token if needed (checks last refresh time first)
 * @param userId - The user ID to refresh token for
 * @returns The push token string, or null if refresh failed or wasn't needed
 */
export async function refreshPushTokenIfNeeded(userId: string): Promise<string | null> {
  const needsRefresh = await shouldRefreshPushToken(userId);
  
  if (!needsRefresh) {
    // Token is fresh, just return existing token from Firestore
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const existingToken = userDoc.data()?.pushToken;
        if (existingToken) {
          return existingToken;
        }
      }
    } catch (error) {
      console.warn('Error getting existing token, proceeding with refresh:', error);
    }
    
    // If we can't get existing token, proceed with refresh
    return await registerForPushNotifications(userId, false);
  }
  
  return await registerForPushNotifications(userId, false);
}

/**
 * Clear push token for a user (called on sign out)
 */
export async function clearPushToken(userId: string): Promise<void> {
  try {
    if (!userId) {
      console.log('⚠️ Cannot clear push token: No user ID provided');
      return;
    }

    console.log('🧹 Clearing push token for user:', userId);
    
    // Check if document exists before trying to update
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.log('⚠️ User document does not exist, skipping push token clear');
      return;
    }
    
    await updateDoc(userDocRef, {
      pushToken: null,
    });
    console.log('✅ Push token cleared for user:', userId);
  } catch (error: any) {
    // Handle case where document doesn't exist (e.g., during account deletion)
    if (error?.code === 'not-found' || error?.message?.includes('No document to update')) {
      console.log('⚠️ User document does not exist, skipping push token clear');
      return;
    }
    console.error('Error clearing push token:', error);
  }
}

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: any
) {
  // In production, you'd send this through Expo's push notification service
  // or Firebase Cloud Messaging
  // For now, this is a placeholder that would be called from your backend
  
  // Example: You would make an HTTP request to Expo's push notification API
  // or use Firebase Cloud Functions to send the notification
  console.log('Would send notification to:', pushToken, title, body);
}

// Store subscription objects for cleanup
let receivedSubscription: ReturnType<typeof Notifications.addNotificationReceivedListener> | null = null;
let responseSubscription: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null = null;
let isNavigating = false; // Prevent multiple navigations
const openedMessageIds = new Set<string>(); // Track which messages have been opened

// Listen for notifications when app is in foreground
export function setupNotificationListeners(navigationCallback?: (messageId: string, message: string, fromUsername: string, fromUserId: string, fromDisplayName?: string, groupId?: string, groupName?: string, isGroupMessage?: boolean) => void) {
  // Remove existing listeners first to prevent duplicates
  if (receivedSubscription) {
    receivedSubscription.remove();
  }
  if (responseSubscription) {
    responseSubscription.remove();
  }

  // Handle notifications received while app is in foreground
  receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
    // Note: We can't verify user here since we don't have access to current user
    // The Cloud Function should have already filtered by push token
  });

  // Handle user tapping on notification
  responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
    console.log('Notification response:', response);
    
    const data = response.notification.request.content.data;
    const messageId = data?.messageId;
    
    // Prevent multiple navigations for the same notification or message
    if (isNavigating) {
      console.log('Already navigating, ignoring duplicate notification tap');
      return;
    }
    
    // Prevent opening the same message multiple times
    if (messageId && openedMessageIds.has(messageId)) {
      console.log('Message already opened, ignoring duplicate notification tap:', messageId);
      return;
    }
    
    // Dismiss the notification from notification center
    if (response.notification.request.identifier) {
      await Notifications.dismissNotificationAsync(response.notification.request.identifier);
    }
    
    if (data?.type === 'hoot' && messageId && navigationCallback) {
      // Mark this message as opened
      openedMessageIds.add(messageId);
      isNavigating = true;
      
      // Navigate to message view screen
      navigationCallback(
        messageId,
        data.message || 'Hoot!',
        data.fromUsername || 'Unknown',
        data.fromUserId || '',
        data.fromDisplayName,
        data.groupId,
        data.groupName,
        data.isGroupMessage
      );
      
      // Reset navigation flag after a delay
      setTimeout(() => {
        isNavigating = false;
      }, 2000);
      
      // Remove messageId from opened set after 5 seconds (allows reopening if needed)
      setTimeout(() => {
        openedMessageIds.delete(messageId);
      }, 5000);
    }
  });
  
  // Return cleanup function
  return () => {
    if (receivedSubscription) {
      receivedSubscription.remove();
      receivedSubscription = null;
    }
    if (responseSubscription) {
      responseSubscription.remove();
      responseSubscription = null;
    }
  };
}

// Helper to create deep link for message
export function createMessageDeepLink(messageId: string, message: string, fromUsername: string, fromUserId: string, fromDisplayName?: string, groupId?: string, groupName?: string, isGroupMessage?: boolean): string {
  const params = new URLSearchParams({
    messageId,
    message,
    fromUsername,
    fromUserId,
  });
  if (fromDisplayName) {
    params.append('fromDisplayName', fromDisplayName);
  }
  if (groupId) {
    params.append('groupId', groupId);
  }
  if (groupName) {
    params.append('groupName', groupName);
  }
  if (isGroupMessage) {
    params.append('isGroupMessage', 'true');
  }
  return Linking.createURL(`/message-view?${params.toString()}`);
}

/**
 * Set up AppState listener to refresh push tokens when app comes to foreground
 * This ensures tokens are always fresh, especially after long periods of inactivity
 * @param userId - The user ID to refresh tokens for
 * @returns Cleanup function to remove the listener
 */
export function setupPushTokenRefreshOnAppState(userId: string): () => void {
  let appStateSubscription: any = null;
  let isRefreshing = false; // Prevent concurrent refreshes

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && !isRefreshing) {
      // App came to foreground - refresh token if needed
      isRefreshing = true;
      console.log('📱 App came to foreground, checking push token refresh...');
      
      try {
        await refreshPushTokenIfNeeded(userId);
      } catch (error) {
        console.error('Error refreshing push token on app state change:', error);
      } finally {
        isRefreshing = false;
      }
    }
  };

  // Subscribe to app state changes
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // Return cleanup function
  return () => {
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
  };
}

