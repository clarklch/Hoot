import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { setupNotificationListeners, registerForPushNotifications } from '@/services/notifications';
import { startMessageCleanup } from '@/services/messageCleanup';

export const unstable_settings = {
  initialRouteName: 'index',
};

function RootLayoutNav() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Only set up notification listeners if user is authenticated
    // This ensures notifications are only processed for the current user
    if (!user?.uid) {
      console.log('⚠️ Skipping notification listener setup: No authenticated user');
      return;
    }

    const currentUserId = user.uid;
    console.log('🔔 Setting up notification listeners for user:', currentUserId);

    // CRITICAL: Register push token immediately when app opens (if user is authenticated)
    // This ensures tokens are always fresh and available, even if user hasn't opened app in a while
    // Tokens are stored in Firestore and persist, but we refresh them to ensure they're valid
    registerForPushNotifications(currentUserId).catch((error) => {
      console.error('Error registering push token on app open:', error);
      // Don't block app if token registration fails
    });

    // Set up notification listeners with user validation
    const cleanup = setupNotificationListeners((messageId, message, fromUsername, fromUserId, fromDisplayName, groupId, groupName, isGroupMessage) => {
      // CRITICAL: Verify this notification is FROM another user TO the current user
      // Notifications should be FROM other users, not from the current user
      if (!fromUserId || fromUserId === currentUserId) {
        console.log('⚠️ Ignoring notification - invalid fromUserId or notification from self');
        return;
      }
      
      // This is a valid notification FROM another user TO the current user
      console.log('✅ Processing notification from', fromUsername, 'to current user', currentUserId);

      // Use replace instead of push to prevent multiple instances
      router.replace({
        pathname: '/message-view',
        params: {
          messageId,
          message,
          fromUsername,
          fromUserId,
          fromDisplayName: fromDisplayName || '',
          groupId: groupId || '',
          groupName: groupName || '',
          isGroupMessage: isGroupMessage ? 'true' : 'false',
        },
      });
    });

    // Start message cleanup service
    startMessageCleanup();

    // Cleanup listeners on unmount or when user changes
    return () => {
      console.log('🧹 Cleaning up notification listeners');
      if (cleanup) {
        cleanup();
      }
    };
  }, [router, user?.uid]); // Re-setup when user changes

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="group-activity" options={{ headerShown: false }} />
      <Stack.Screen name="message-view" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="missed-messages" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="missed-messages-selection" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="qr-generate" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="qr-scan" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="admin" options={{ presentation: 'modal', title: 'Database Stats' }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootLayoutNav />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
