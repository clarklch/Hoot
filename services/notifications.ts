// Notification service for handling push notifications
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import * as Linking from 'expo-linking';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {
    if (!userId || userId === 'temp_user') {
      console.log('⚠️ Cannot register push token: Invalid user ID');
      return null;
    }

    console.log('📱 Registering push token for user:', userId);
    
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

    // CRITICAL: Only save token for the current user
    // This ensures old users' tokens are replaced when a new user signs in
    console.log('💾 Saving push token to Firestore for user:', userId);
    await setDoc(
      doc(db, 'users', userId),
      { pushToken: tokenData.data },
      { merge: true }
    );

    console.log('✅ Push token registered successfully for user:', userId);
    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
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
    await updateDoc(doc(db, 'users', userId), {
      pushToken: null,
    });
    console.log('✅ Push token cleared for user:', userId);
  } catch (error) {
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

