import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function Index() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    // Wait for auth state to be determined before routing
    if (loading) {
      console.log('⏳ Waiting for auth state to load...');
      return;
    }

    console.log('🔐 Auth state loaded:', {
      hasUser: !!user,
      hasUsername: !!user?.username,
      currentSegment: segments[0],
    });

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!user) {
      // User is not signed in, redirect to login (welcome screen)
      console.log('➡️ Routing to login (no user)');
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (user && !user.username) {
      // User is signed in but doesn't have username - go to username creation
      console.log('➡️ Routing to username creation');
      if (!inAuthGroup || segments[1] !== 'username') {
        router.replace('/(auth)/username');
      }
    } else if (user && user.username && !inTabsGroup && !inAuthGroup) {
      // User is signed in and has username, redirect to tabs
      console.log('➡️ Routing to tabs (user authenticated)');
      router.replace('/(tabs)');
    } else {
      console.log('✅ Already on correct screen');
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

