import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { setupNotificationListeners } from '@/services/notifications';
import { startMessageCleanup } from '@/services/messageCleanup';

export const unstable_settings = {
  initialRouteName: 'index',
};

function RootLayoutNav() {
  const router = useRouter();

  useEffect(() => {
    // Set up notification listeners
    const cleanup = setupNotificationListeners((messageId, message, fromUsername, fromUserId, fromDisplayName, groupId, groupName, isGroupMessage) => {
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

    // Cleanup listeners on unmount
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [router]);

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
