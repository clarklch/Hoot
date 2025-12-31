import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, PanResponder, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { IconSymbol } from '@/components/ui/icon-symbol';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100; // Minimum swipe distance to dismiss

export default function MessageViewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const messageId = params.messageId as string;
  const message = params.message as string;
  const fromUsername = params.fromUsername as string;
  const fromUserId = params.fromUserId as string;
  const fromDisplayName = params.fromDisplayName as string;
  const groupId = params.groupId as string;
  const groupName = params.groupName as string;
  const isGroupMessage = params.isGroupMessage === 'true';

  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return gestureState.dy > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward movement
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
          // Fade out as user swipes down
          const progress = Math.abs(gestureState.dy) / SCREEN_HEIGHT;
          opacity.setValue(1 - progress);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SWIPE_THRESHOLD) {
          // Swipe down detected - dismiss message
          handleDismiss();
        } else {
          // Snap back to original position
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const handleDismiss = async () => {
    // Delete message immediately when dismissed
    if (messageId) {
      try {
        await deleteDoc(doc(db, 'messages', messageId));
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }

    // Animate out
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate back to home tab after dismissing
      router.replace('/(tabs)');
    });
  };

  // Auto-dismiss after viewing (optional - you can remove this if you only want manual dismiss)
  useEffect(() => {
    // Message is viewed, mark for deletion
    // The actual deletion happens when user swipes down
  }, []);

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

  return (
    <ThemedView style={styles.container}>
      <Animated.View
        style={[
          styles.messageContainer,
          {
            backgroundColor: colors.background,
            transform: [{ translateY }],
            opacity,
          },
        ]}
        {...panResponder.panHandlers}>
        <View style={styles.header}>
          <ThemedText style={styles.fromText}>
            {isGroupMessage && groupName ? (
              <>
                From: {groupName} (Group)
                {fromDisplayName && ` • ${fromDisplayName}`}
                {fromUsername && ` (@${fromUsername})`}
              </>
            ) : (
              <>
                From: {fromDisplayName || fromUsername || 'Unknown'}
                {fromUsername && ` (@${fromUsername})`}
              </>
            )}
          </ThemedText>
        </View>

        <View style={styles.messageContent}>
          <ThemedText type="title" style={styles.messageText}>
            {message}
          </ThemedText>
        </View>

        <View style={styles.footer}>
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
            <ThemedText style={styles.hintText}>
              Swipe down to dismiss
            </ThemedText>
            <View style={styles.swipeIndicator}>
              <IconSymbol name="chevron.down" size={24} color={colors.icon} />
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 300,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 20,
  },
  fromText: {
    fontSize: 14,
    opacity: 0.7,
    fontWeight: '500',
  },
  messageContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  messageText: {
    fontSize: 24,
    textAlign: 'center',
    lineHeight: 32,
    paddingHorizontal: 20,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 8,
  },
  swipeIndicator: {
    alignItems: 'center',
  },
});

