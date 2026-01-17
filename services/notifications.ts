// Notification service for handling push notifications
// RESTRUCTURED: Comprehensive push token management with persistent tokens and live notifications
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

// Storage key for last token verification
const LAST_TOKEN_VERIFICATION_KEY = 'pushToken_lastVerification';

/**
 * Get the current Expo push token from the device
 * This always gets the freshest token from Expo's service
 */
async function getCurrentExpoPushToken(): Promise<string | null> {
  try {
    // Get projectId from app.json
    let projectId: string | undefined;
    
    if (Constants.expoConfig?.extra?.eas?.projectId) {
      projectId = Constants.expoConfig.extra.eas.projectId;
    } else if (Constants.expoConfig?.extra?.projectId) {
      projectId = Constants.expoConfig.extra.projectId;
    }
    
    // Get push token - projectId is required for Expo
    let tokenData;
    if (projectId && projectId !== 'YOUR_EXPO_PROJECT_ID_HERE') {
      tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    } else {
      tokenData = await Notifications.getExpoPushTokenAsync();
    }
    
    return tokenData.data;
  } catch (error: any) {
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
}

/**
 * Register or refresh push token for a user
 * BEST PRACTICE: Always verify current device token matches stored token
 * This ensures tokens are persistent and always up-to-date
 * @param userId - The user ID to register the token for
 * @param forceUpdate - If true, always update Firestore even if token hasn't changed
 * @returns The push token string, or null if registration failed
 */
export async function registerForPushNotifications(
  userId: string, 
  forceUpdate: boolean = false
): Promise<string | null> {
  try {
    if (!userId || userId === 'temp_user') {
      console.log('⚠️ Cannot register push token: Invalid user ID');
      return null;
    }

    console.log('📱 [Token Registration] Starting for user:', userId, forceUpdate ? '(forced update)' : '');
    
    // Step 1: Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.error(`❌ [Token Registration] Push notification permissions not granted for user ${userId}. Status: ${finalStatus}`);
      console.error('💡 User needs to grant notification permissions in device settings');
      return null;
    }

    // Step 2: Get current device token (always fresh from Expo)
    let currentToken: string;
    try {
      currentToken = await getCurrentExpoPushToken() as string;
      if (!currentToken) {
        throw new Error('Failed to get push token from Expo');
      }
    } catch (error: any) {
      console.error(`❌ [Token Registration] Error getting Expo push token for user ${userId}:`, error.message || error);
      return null;
    }

    // Step 3: Check stored token in Firestore to see if update is needed
    let needsUpdate = forceUpdate;
    let storedToken: string | null = null;
    
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        storedToken = userDoc.data()?.pushToken || null;
        
        // Update needed if:
        // 1. No token stored (first time or was cleared)
        // 2. Token changed (system refresh, app reinstall, etc.)
        // 3. Force update requested
        if (!storedToken || storedToken !== currentToken) {
          needsUpdate = true;
          console.log(`🔄 [Token Registration] Token change detected for user ${userId}`);
          if (storedToken) {
            console.log(`   Old token: ${storedToken.substring(0, 20)}...`);
          }
          console.log(`   New token: ${currentToken.substring(0, 20)}...`);
        } else {
          console.log(`✅ [Token Registration] Token unchanged for user ${userId}, skipping update`);
        }
      } else {
        // User document doesn't exist - create it with token
        needsUpdate = true;
        console.log(`📝 [Token Registration] User document doesn't exist, creating with token`);
      }
    } catch (error) {
      console.warn('⚠️ [Token Registration] Error checking stored token, proceeding with update:', error);
      needsUpdate = true;
    }

    // Step 4: Update Firestore if needed
    if (needsUpdate) {
      // CRITICAL: Clear this push token from all other users' documents
      // This ensures a push token is only associated with one user at a time
      // (same device, same push token, but different users)
      console.log('🔍 [Token Registration] Checking for other users with the same push token...');
      try {
        const usersWithSameTokenQuery = query(
          collection(db, 'users'),
          where('pushToken', '==', currentToken)
        );
        const usersWithSameTokenSnapshot = await getDocs(usersWithSameTokenQuery);
        
        // Clear push token from all other users with the same token
        const clearSameTokenPromises = usersWithSameTokenSnapshot.docs
          .filter(docSnap => docSnap.id !== userId)
          .map(async (docSnap) => {
            try {
              await updateDoc(docSnap.ref, { 
                pushToken: null,
                pushTokenLastRefreshed: null,
              });
              console.log(`🧹 [Token Registration] Cleared push token from user ${docSnap.id}`);
            } catch (error) {
              console.error(`❌ [Token Registration] Error clearing push token from user ${docSnap.id}:`, error);
            }
          });
        
        await Promise.all(clearSameTokenPromises);
      } catch (error) {
        console.warn('⚠️ [Token Registration] Error checking for duplicate tokens, continuing:', error);
      }
      
      // Save the token for the current user
      console.log('💾 [Token Registration] Saving push token to Firestore for user:', userId);
      try {
        await setDoc(
          doc(db, 'users', userId),
          { 
            pushToken: currentToken,
            pushTokenLastRefreshed: Timestamp.now(),
          },
          { merge: true }
        );
        console.log('✅ [Token Registration] Push token saved successfully');
      } catch (error) {
        console.error(`❌ [Token Registration] Error saving token to Firestore:`, error);
        throw error;
      }
    } else {
      // Token unchanged but update timestamp for tracking
      try {
        await updateDoc(doc(db, 'users', userId), {
          pushTokenLastRefreshed: Timestamp.now(),
        });
        console.log('✅ [Token Registration] Token timestamp updated');
      } catch (error) {
        // Non-critical error, log and continue
        console.warn('⚠️ [Token Registration] Error updating token timestamp:', error);
      }
    }

    // Step 5: Store last verification time locally for quick checks
    try {
      await AsyncStorage.setItem(`${LAST_TOKEN_VERIFICATION_KEY}_${userId}`, Date.now().toString());
    } catch (error) {
      console.warn('⚠️ [Token Registration] Failed to save verification time to AsyncStorage:', error);
    }

    console.log('✅ [Token Registration] Completed successfully for user:', userId);
    return currentToken;
  } catch (error) {
    console.error(`❌ [Token Registration] Error registering push token for user ${userId}:`, error);
    console.error('Error details:', error instanceof Error ? error.message : JSON.stringify(error));
    return null;
  }
}

/**
 * Verify and refresh push token if needed
 * BEST PRACTICE: Always verify token on app startup and key events
 * This ensures tokens are always current and persistent
 * @param userId - The user ID to verify token for
 * @returns The push token string, or null if verification failed
 */
export async function verifyAndRefreshPushToken(userId: string): Promise<string | null> {
  console.log(`🔄 [Token Verification] Verifying push token for user: ${userId}`);
  
  try {
    // Always verify token is current - don't rely on timestamps
    // This ensures we catch token changes from system refreshes, app reinstalls, etc.
    return await registerForPushNotifications(userId, false);
  } catch (error) {
    console.error(`❌ [Token Verification] Error verifying push token:`, error);
    return null;
  }
}

// Legacy function for backward compatibility - now uses verifyAndRefreshPushToken
export async function refreshPushTokenIfNeeded(userId: string): Promise<string | null> {
  return verifyAndRefreshPushToken(userId);
}

// Global concurrency protection for token operations
const activeTokenOperations = new Map<string, Promise<string | null>>();

/**
 * Safely verify and refresh push token with concurrency protection
 * Prevents multiple simultaneous token operations for the same user
 * @param userId - The user ID to verify token for
 * @returns The push token string, or null if verification failed
 */
export async function safeVerifyAndRefreshPushToken(userId: string): Promise<string | null> {
  // Check if operation is already in progress
  const existingOperation = activeTokenOperations.get(userId);
  if (existingOperation) {
    console.log(`⏳ [Token Verification] Token operation already in progress for user ${userId}, waiting...`);
    try {
      return await existingOperation;
    } catch (error) {
      console.error('❌ [Token Verification] Error waiting for existing operation:', error);
      // Continue to start a new operation if the existing one failed
    }
  }
  
  // Start new operation (protected by concurrency guard)
  const operationPromise = (async () => {
    try {
      return await verifyAndRefreshPushToken(userId);
    } finally {
      // Remove from active operations map when done
      activeTokenOperations.delete(userId);
    }
  })();
  
  // Store the promise in the active operations map
  activeTokenOperations.set(userId, operationPromise);
  
  return operationPromise;
}

/**
 * Clear push token for a user (called on sign out)
 */
export async function clearPushToken(userId: string): Promise<void> {
  try {
    if (!userId) {
      console.log('⚠️ [Token Clear] Cannot clear push token: No user ID provided');
      return;
    }

    console.log('🧹 [Token Clear] Clearing push token for user:', userId);
    
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.log('⚠️ [Token Clear] User document does not exist, skipping push token clear');
      return;
    }
    
    await updateDoc(userDocRef, {
      pushToken: null,
      pushTokenLastRefreshed: null,
    });
    
    // Clear local verification time
    try {
      await AsyncStorage.removeItem(`${LAST_TOKEN_VERIFICATION_KEY}_${userId}`);
    } catch (error) {
      // Non-critical error
    }
    
    console.log('✅ [Token Clear] Push token cleared for user:', userId);
  } catch (error: any) {
    if (error?.code === 'not-found' || error?.message?.includes('No document to update')) {
      console.log('⚠️ [Token Clear] User document does not exist, skipping push token clear');
      return;
    }
    console.error('❌ [Token Clear] Error clearing push token:', error);
  }
}

// Placeholder function for sending push notifications (handled by Cloud Function)
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: any
) {
  // Notifications are sent via Cloud Functions when notification documents are created
  console.log('📤 [Send Notification] Notification would be sent to:', pushToken.substring(0, 20) + '...', title, body);
}

// Store subscription objects for cleanup
let receivedSubscription: ReturnType<typeof Notifications.addNotificationReceivedListener> | null = null;
let responseSubscription: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null = null;
// Store token subscription per-user to avoid conflicts when users change
const pushTokenSubscriptions = new Map<string, ReturnType<typeof Notifications.addPushTokenListener>>();
let isNavigating = false;
const openedMessageIds = new Set<string>();

/**
 * Set up push token listener to detect system token refreshes
 * CRITICAL: This ensures we catch token changes immediately when Expo/APNs refreshes them
 * @param userId - The user ID to register token refreshes for
 * @returns Cleanup function to remove the listener
 */
function setupPushTokenListener(userId: string): () => void {
  console.log('🔔 [Token Listener] Setting up push token listener for user:', userId);
  
  // Remove existing listener for this user if any
  const existingSubscription = pushTokenSubscriptions.get(userId);
  if (existingSubscription) {
    existingSubscription.remove();
    pushTokenSubscriptions.delete(userId);
  }
  
  // Listen for token changes from Expo's push notification service
  // This fires when the system refreshes the token (e.g., after app reinstall, OS update, etc.)
  const subscription = Notifications.addPushTokenListener(async (tokenData) => {
    const newToken = tokenData.data;
    console.log('🔄 [Token Listener] Push token refreshed by system! New token:', newToken.substring(0, 20) + '...');
    
    // Immediately register the new token with our backend
    try {
      await registerForPushNotifications(userId, true); // Force update since system told us token changed
      console.log('✅ [Token Listener] New token registered successfully');
    } catch (error) {
      console.error('❌ [Token Listener] Error registering new token:', error);
    }
  });
  
  // Store subscription per-user
  pushTokenSubscriptions.set(userId, subscription);
  
  // Return cleanup function
  return () => {
    const subscriptionToRemove = pushTokenSubscriptions.get(userId);
    if (subscriptionToRemove) {
      subscriptionToRemove.remove();
      pushTokenSubscriptions.delete(userId);
      console.log('🧹 [Token Listener] Push token listener removed for user:', userId);
    }
  };
}

/**
 * Global navigation callback for notification taps
 */
let globalNavigationCallback: ((
  messageId: string, 
  message: string, 
  fromUsername: string, 
  fromUserId: string, 
  fromDisplayName?: string, 
  groupId?: string, 
  groupName?: string, 
  isGroupMessage?: boolean
) => void) | null = null;

/**
 * Listen for notifications when app is in foreground
 */
export function setupNotificationListeners(
  navigationCallback?: (
    messageId: string, 
    message: string, 
    fromUsername: string, 
    fromUserId: string, 
    fromDisplayName?: string, 
    groupId?: string, 
    groupName?: string, 
    isGroupMessage?: boolean
  ) => void
) {
  // Store navigation callback globally for use in notification handlers
  globalNavigationCallback = navigationCallback || null;
  // Remove existing listeners first to prevent duplicates
  if (receivedSubscription) {
    receivedSubscription.remove();
  }
  if (responseSubscription) {
    responseSubscription.remove();
  }

  // Handle notifications received while app is in foreground
  receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 [Notification] Received while app in foreground:', notification);
  });

  // Handle user tapping on notification
  responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
    console.log('👆 [Notification] User tapped notification:', response);
    
    const data = response.notification.request.content.data;
    const messageId = data?.messageId;
    
    // Prevent multiple navigations
    if (isNavigating) {
      console.log('⚠️ [Notification] Already navigating, ignoring duplicate notification tap');
      return;
    }
    
    if (messageId && openedMessageIds.has(messageId)) {
      console.log('⚠️ [Notification] Message already opened, ignoring duplicate tap:', messageId);
      return;
    }
    
    // Dismiss the notification from notification center
    if (response.notification.request.identifier) {
      await Notifications.dismissNotificationAsync(response.notification.request.identifier);
    }
    
    if (data?.type === 'hoot' && messageId && globalNavigationCallback) {
      openedMessageIds.add(messageId);
      isNavigating = true;
      
      globalNavigationCallback(
        messageId,
        data.message || 'Hoot!',
        data.fromUsername || 'Unknown',
        data.fromUserId || '',
        data.fromDisplayName,
        data.groupId,
        data.groupName,
        data.isGroupMessage
      );
      
      setTimeout(() => {
        isNavigating = false;
      }, 2000);
      
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

/**
 * Set up comprehensive push notification system for a user
 * This sets up all listeners: token refresh, notification received, and app state changes
 * @param userId - The user ID to set up notifications for
 * @param navigationCallback - Optional callback for handling notification taps
 * @returns Cleanup function to remove all listeners
 */
export function setupPushNotificationSystem(
  userId: string,
  navigationCallback?: (
    messageId: string, 
    message: string, 
    fromUsername: string, 
    fromUserId: string, 
    fromDisplayName?: string, 
    groupId?: string, 
    groupName?: string, 
    isGroupMessage?: boolean
  ) => void
): () => void {
  console.log('🚀 [Notification System] Setting up comprehensive push notification system for user:', userId);
  
  // Cleanup functions
  const cleanupFunctions: (() => void)[] = [];
  
  // 1. Set up push token listener (detects system token refreshes)
  const cleanupTokenListener = setupPushTokenListener(userId);
  cleanupFunctions.push(cleanupTokenListener);
  
  // 2. Set up notification listeners (foreground and tap handlers)
  const cleanupNotificationListeners = setupNotificationListeners(navigationCallback);
  if (cleanupNotificationListeners) {
    cleanupFunctions.push(cleanupNotificationListeners);
  }
  
  // 3. Set up AppState listener to verify token when app comes to foreground
  let appStateSubscription: any = null;
  let isVerifying = false;
  
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && !isVerifying) {
      isVerifying = true;
      console.log('📱 [App State] App came to foreground, verifying push token...');
      
      try {
        await safeVerifyAndRefreshPushToken(userId);
      } catch (error) {
        console.error('❌ [App State] Error verifying push token:', error);
      } finally {
        isVerifying = false;
      }
    }
  };
  
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  cleanupFunctions.push(() => {
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
  });
  
  // Return combined cleanup function
  return () => {
    console.log('🧹 [Notification System] Cleaning up push notification system');
    cleanupFunctions.forEach(cleanup => cleanup());
  };
}

// Legacy function for backward compatibility
export function setupPushTokenRefreshOnAppState(userId: string): () => void {
  // This is now handled by setupPushNotificationSystem
  // Return a no-op cleanup for backward compatibility
  console.warn('⚠️ setupPushTokenRefreshOnAppState is deprecated, use setupPushNotificationSystem instead');
  return () => {};
}

// Helper to create deep link for message
export function createMessageDeepLink(
  messageId: string, 
  message: string, 
  fromUsername: string, 
  fromUserId: string, 
  fromDisplayName?: string, 
  groupId?: string, 
  groupName?: string, 
  isGroupMessage?: boolean
): string {
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
