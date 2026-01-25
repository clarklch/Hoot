import { useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80; // Reduced threshold for easier dismissal
const VELOCITY_THRESHOLD = 500; // Also dismiss if velocity is high enough

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

  const translateY = useSharedValue(0);
  const isDismissing = useSharedValue(false);
  const shimmerProgress = useSharedValue(0);
  const dismissHandled = useRef(false);

  const navigateBack = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  const handleDismiss = useCallback(async () => {
    // Prevent multiple dismiss calls
    if (dismissHandled.current) return;
    dismissHandled.current = true;

    // Delete message immediately when dismissed
    if (messageId) {
      try {
        await deleteDoc(doc(db, 'messages', messageId));
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }

    // Navigate back to home tab after dismissing
    navigateBack();
  }, [messageId, navigateBack]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow downward movement (positive Y)
      if (event.translationY > 0 && !isDismissing.value) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (isDismissing.value) return;

      // Dismiss if dragged past threshold OR if velocity is high enough
      const shouldDismiss =
        event.translationY > SWIPE_THRESHOLD ||
        (event.velocityY > VELOCITY_THRESHOLD && event.translationY > 20);

      if (shouldDismiss) {
        isDismissing.value = true;
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
          runOnJS(handleDismiss)();
        });
      } else {
        // Snap back with spring animation
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        });
      }
    });

  const animatedContainerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, SCREEN_HEIGHT * 0.3],
      [1, 0.3],
      Extrapolation.CLAMP
    );

    const scale = interpolate(
      translateY.value,
      [0, SCREEN_HEIGHT * 0.3],
      [1, 0.95],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateY: translateY.value },
        { scale },
      ],
      opacity,
    };
  });

  // Shimmer animation for swipe prompt
  useEffect(() => {
    const animateShimmer = () => {
      shimmerProgress.value = withTiming(1, { duration: 1500 }, () => {
        shimmerProgress.value = withTiming(0, { duration: 1500 }, () => {
          runOnJS(animateShimmer)();
        });
      });
    };
    animateShimmer();
  }, [shimmerProgress]);

  const shimmerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      shimmerProgress.value,
      [0, 0.5, 1],
      [0.4, 1, 0.4]
    );
    const translateYShimmer = interpolate(
      shimmerProgress.value,
      [0, 0.5, 1],
      [0, -4, 0]
    );
    return {
      opacity,
      transform: [{ translateY: translateYShimmer }],
    };
  });

  return (
    <ThemedView style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.messageContainer,
            { backgroundColor: colors.background },
            animatedContainerStyle,
          ]}>
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
            <Animated.View style={shimmerStyle}>
              <ThemedText style={styles.hintText}>
                Swipe down to dismiss
              </ThemedText>
              <View style={styles.swipeIndicator}>
                <IconSymbol name="chevron.down" size={24} color={colors.icon} />
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
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

