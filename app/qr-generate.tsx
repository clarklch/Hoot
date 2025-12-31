import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Share, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import QRCode from 'react-native-qrcode-svg';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function QRGenerateScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const [qrData, setQrData] = useState<string>('');
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Temporarily allow without user - OAuth bypass
    // Use mock data if no user
    const userId = user?.uid || 'temp_user';
    const username = user?.username || 'temp_user';
    
    // Generate QR code data with user ID and username
    const data = JSON.stringify({
      type: 'hoot_friend_request',
      userId: userId,
      username: username,
    });
    setQrData(data);
  }, [user]);

  // Shimmer animation for swipe prompt
  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Add me on Hoot! Username: ${user?.username || 'temp_user'}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Temporarily disabled - OAuth bypass
  // if (!user?.username) {
  //   return (
  //     <ThemedView style={styles.container}>
  //       <ThemedText>Please set up your username first</ThemedText>
  //     </ThemedView>
  //   );
  // }

  return (
    <ThemedView style={styles.container}>
      {/* Swipe down prompt with shimmer */}
      <View style={[styles.swipePrompt, { paddingTop: insets.top + 12 }]}>
        <Animated.View
          style={{
            opacity: shimmerAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.4, 1, 0.4],
            }),
            transform: [
              {
                translateY: shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -2, 0],
                }),
              },
            ],
          }}>
          <View style={styles.swipePromptContent}>
            <IconSymbol name="chevron.down" size={16} color={colors.icon} />
            <ThemedText style={[styles.swipePromptText, { color: colors.icon }]}>
              Swipe down to dismiss
            </ThemedText>
          </View>
        </Animated.View>
      </View>

      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          My QR Code
        </ThemedText>
        <ThemedText style={styles.instruction}>
          Share this QR code with friends to let them add you
        </ThemedText>

        <View style={[styles.qrContainer, { backgroundColor: '#fff' }]}>
          {qrData ? (
            <QRCode
              value={qrData}
              size={250}
              color="#000000"
              backgroundColor="#fff"
            />
          ) : (
            <ThemedText>Loading...</ThemedText>
          )}
        </View>

        <ThemedText style={styles.usernameText}>
          @{user?.username || 'temp_user'}
        </ThemedText>

        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: colors.tint }]}
          onPress={handleShare}>
          <IconSymbol name="square.and.arrow.up" size={20} color="#000" />
          <ThemedText style={styles.shareButtonText}>Share Username</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  swipePrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  swipePromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swipePromptText: {
    fontSize: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  instruction: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
  },
  qrContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  usernameText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    gap: 8,
  },
  shareButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});

