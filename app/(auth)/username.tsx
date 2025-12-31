import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function UsernameScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const { user, updateUser, loading } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, []);

  // Redirect to login if user is not authenticated
  // Redirect to main app if user already has a username
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    } else if (!loading && user && user.username) {
      // User already has a username, redirect to main app
      router.replace('/(tabs)');
    }
  }, [user, loading, router]);

  const validateUsername = (text: string): boolean => {
    // Username rules: 3-20 characters, alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(text);
  };

  const checkUsernameAvailability = async (usernameToCheck: string): Promise<boolean> => {
    try {
      if (!usernameToCheck.trim() || !validateUsername(usernameToCheck)) {
        return false;
      }
      const usernameDoc = await getDoc(doc(db, 'usernames', usernameToCheck.toLowerCase()));
      return !usernameDoc.exists();
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  };

  // Real-time username availability check with debouncing
  const handleUsernameChange = (text: string) => {
    setUsername(text);
    setError('');
    setUsernameAvailable(null);

    // Clear existing timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    // Only check if username is valid format
    if (!text.trim()) {
      return;
    }

    // Don't check availability if format is invalid - just reset the state
    if (!validateUsername(text)) {
      setUsernameAvailable(null);
      return;
    }

    // Debounce: wait 500ms after user stops typing
    checkTimeoutRef.current = setTimeout(async () => {
      setCheckingAvailability(true);
      const isAvailable = await checkUsernameAvailability(text);
      setUsernameAvailable(isAvailable);
      setCheckingAvailability(false);
    }, 500);
  };

  const handleCreateUsername = async () => {
    if (!displayName.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }

    if (!validateUsername(username)) {
      setError('Username must be 3-20 characters and contain only letters, numbers, and underscores');
      return;
    }

    setChecking(true);
    setError('');

    try {
      console.log('🔥 Testing Firebase connection...');
      const isAvailable = await checkUsernameAvailability(username);
      console.log('✅ Firebase connection successful! Username check completed.');
      
      if (!isAvailable) {
        // Username already exists - show error (don't log them in)
        setError('This username is already taken. Please choose a different one.');
        setChecking(false);
        setUsernameAvailable(false);
        return;
      }

      // User must be authenticated via Google Sign-In
      if (!user || !user.uid) {
        setError('Please sign in with Google first.');
        setChecking(false);
        return;
      }

      // Prevent users who already have a username from creating another one
      if (user.username) {
        setError('You already have a username. Cannot create another one.');
        setChecking(false);
        router.replace('/(tabs)');
        return;
      }

      const userId = user.uid;

      console.log('📝 Creating new username in Firestore...');
      // Create username document
      await setDoc(doc(db, 'usernames', username.toLowerCase()), {
        userId: userId,
        createdAt: new Date(),
      });
      console.log('✅ Username document created successfully!');

      // Update user document with username and display name
      await setDoc(doc(db, 'users', userId), {
        username: username,
        usernameLowercase: username.toLowerCase(),
        email: user.email || '',
        displayName: displayName.trim(),
        photoURL: user.photoURL || null,
      }, { merge: true });
      console.log('✅ User document created successfully!');

      // Store userId and username in AsyncStorage for persistence
      try {
        await AsyncStorage.setItem('hoot_userId', userId);
        await AsyncStorage.setItem('hoot_username', username);
        console.log('✅ User ID stored in AsyncStorage');
      } catch (storageError) {
        console.log('Note: Could not store user ID (expected in some environments)');
      }

      // Update auth context with username and display name
      await updateUser({ 
        username, 
        displayName: displayName.trim() 
      });

      console.log('🎉 Firebase is working! Username created successfully.');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('❌ Firebase Error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      setError('Failed to create username. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <TouchableOpacity 
          style={[styles.backButton, { top: Math.max(insets.top, 40) + 10 }]}
          onPress={() => {
            router.replace('/(auth)/login');
          }}>
          <IconSymbol name="chevron.left" size={20} color="#000" />
          <ThemedText style={styles.backButtonText}>Back</ThemedText>
        </TouchableOpacity>
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 40) + 20, paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
        <View style={styles.emojiContainer}>
          <Image 
            source={require('@/assets/images/hoot-emoji.png')} 
            style={styles.emoji}
            resizeMode="contain"
          />
        </View>
        <ThemedText type="title" style={styles.title}>
          Create Your Profile
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Set up your username and display name ❄️
        </ThemedText>

        <View style={styles.inputContainer}>
          <ThemedText style={styles.inputLabel}>Username</ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                color: '#000',
                borderColor: error ? '#ff4444' : colors.icon,
                backgroundColor: '#fff',
                shadowColor: colors.icon,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }
            ]}
            placeholder="Enter username"
            placeholderTextColor={colors.icon}
            value={username}
            onChangeText={handleUsernameChange}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 200, animated: true });
              }, 100);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            editable={!checking}
          />
          <View style={styles.usernameStatusContainer}>
            {checkingAvailability ? (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.tint} />
                <ThemedText style={styles.statusText}>Checking availability...</ThemedText>
              </View>
            ) : usernameAvailable === true && username.trim() ? (
              <View style={styles.statusRow}>
                <IconSymbol name="checkmark.circle.fill" size={16} color="#4CAF50" />
                <ThemedText style={[styles.statusText, { color: '#4CAF50' }]}>Username available</ThemedText>
              </View>
            ) : usernameAvailable === false && username.trim() && validateUsername(username) ? (
              <View style={styles.statusRow}>
                <IconSymbol name="xmark.circle.fill" size={16} color="#ff4444" />
                <ThemedText style={[styles.statusText, { color: '#ff4444' }]}>Username taken</ThemedText>
              </View>
            ) : null}
          </View>
          {error ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : (
            <ThemedText style={styles.hintText}>
              3-20 characters, letters, numbers, and underscores only. Must be unique.
            </ThemedText>
          )}
        </View>

        <View style={styles.inputContainer}>
          <ThemedText style={styles.inputLabel}>Display Name</ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                color: '#000',
                borderColor: error && !username.trim() ? '#ff4444' : colors.icon,
                backgroundColor: '#fff',
                shadowColor: colors.icon,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }
            ]}
            placeholder="Enter your display name"
            placeholderTextColor={colors.icon}
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              setError('');
            }}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 300, animated: true });
              }, 100);
            }}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={50}
            editable={!checking}
          />
          <ThemedText style={styles.hintText}>
            This is how your name appears to others
          </ThemedText>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            { 
              backgroundColor: colors.tint,
              opacity: checking || !username.trim() || !displayName.trim() ? 0.6 : 1,
              shadowColor: colors.tint,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }
          ]}
          onPress={handleCreateUsername}
          disabled={checking || !username.trim() || !displayName.trim() || checkingAvailability}>
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Continue ❄️</ThemedText>
          )}
        </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: '100%',
  },
  content: {
    width: '100%',
    maxWidth: 400,
  },
  emojiContainer: {
    marginTop: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  emoji: {
    width: 70,
    height: 70,
    marginBottom: 8,
  },
  snowflake: {
    fontSize: 32,
    opacity: 0.8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
    paddingHorizontal: 10,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#fff',
  },
  input: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 18,
    fontSize: 18,
    marginBottom: 8,
    fontWeight: '500',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 8,
  },
  usernameStatusContainer: {
    marginTop: 8,
    minHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 30,
    alignItems: 'center',
    minWidth: 220,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
});

