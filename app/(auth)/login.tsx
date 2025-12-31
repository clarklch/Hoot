import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView, Animated, Easing, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Accelerometer } from 'expo-sensors';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LoginScreen() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  
  // Animation for smooth gradient movement
  const gradientAnim1 = useRef(new Animated.Value(0)).current;
  const gradientAnim2 = useRef(new Animated.Value(0)).current;
  const gradientAnim3 = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Interactive animations for tilt and touch
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;
  const touchX = useRef(new Animated.Value(SCREEN_WIDTH / 2)).current;
  const touchY = useRef(new Animated.Value(SCREEN_HEIGHT / 2)).current;
  
  const [isTouching, setIsTouching] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  
  // Easter egg state
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isRaining, setIsRaining] = useState(false);
  const emojiRefs = useRef<Animated.Value[]>([]);
  const emojiXPositions = useRef<number[]>([]);
  const emojiSizes = useRef<number[]>([]);

  useEffect(() => {
    // Check if Apple Authentication is available
    const checkAppleAuth = async () => {
      if (Platform.OS === 'ios') {
        const available = await AppleAuthentication.isAvailableAsync();
        setIsAppleAvailable(available);
      }
    };
    checkAppleAuth();

    // Fade in animation for title
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Smooth, continuous gradient animations with different speeds and easing
    const createGradientAnimation = (animValue: Animated.Value, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createGradientAnimation(gradientAnim1, 5000);
    const anim2 = createGradientAnimation(gradientAnim2, 6000);
    const anim3 = createGradientAnimation(gradientAnim3, 7000);

    anim1.start();
    anim2.start();
    anim3.start();

    // Accelerometer subscription for tilt
    const subscription = Accelerometer.addListener(({ x, y }) => {
      // Normalize accelerometer values and animate smoothly - increased sensitivity
      Animated.spring(tiltX, {
        toValue: x * 150, // Increased scale factor for more visible tilt
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
      
      Animated.spring(tiltY, {
        toValue: y * 150,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    });

    // Set update interval for accelerometer (60fps)
    Accelerometer.setUpdateInterval(16);

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (user) {
      setIsSigningIn(false);
      // After Apple Sign-In, check if user has username
      if (!user.username) {
        // User signed in but doesn't have username - go to username creation
        router.replace('/(auth)/username');
      } else {
        // User has username - go to main app
        router.replace('/(tabs)');
      }
    }
  }, [user, router]);

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (error) {
      console.error('Sign in failed:', error);
      // You can add error handling UI here
    }
  };

  const handleContinue = async () => {
    // Trigger Sign in with Apple when Continue is clicked
    try {
      setIsSigningIn(true);
      await signIn();
    } catch (error: any) {
      console.error('Sign in failed:', error);
      setIsSigningIn(false);
      // Don't show error for user cancellation
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        // You can add error handling UI here if needed
      }
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  // Trigger emoji rain animation
  const triggerEmojiRain = () => {
    setIsRaining(true);
    const emojiCount = 30; // Number of emojis to rain
    emojiRefs.current = [];
    emojiXPositions.current = [];
    emojiSizes.current = [];
    
    // Create emojis at random X positions with varying sizes
    for (let i = 0; i < emojiCount; i++) {
      const animValue = new Animated.Value(-50); // Start above screen
      const xPosition = Math.random() * SCREEN_WIDTH;
      const size = 25 + Math.random() * 35; // Random size between 25-60 pixels
      emojiRefs.current.push(animValue);
      emojiXPositions.current.push(xPosition);
      emojiSizes.current.push(size);
      
      // Animate emoji falling
      Animated.timing(animValue, {
        toValue: SCREEN_HEIGHT + 50, // Fall to below screen
        duration: 2000 + Math.random() * 2000, // Random fall speed (2-4 seconds)
        delay: i * 50, // Stagger the emojis
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => {
        // Clean up after animation completes
        if (i === emojiCount - 1) {
          setIsRaining(false);
          emojiRefs.current = [];
          emojiXPositions.current = [];
          emojiSizes.current = [];
        }
      });
    }
  };

  // Handle touch events - with more responsive animation
  const handleTouchStart = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setIsTouching(true);
    Animated.spring(touchX, {
      toValue: locationX,
      useNativeDriver: true,
      tension: 100, // Increased for faster response
      friction: 5, // Reduced for less damping
    }).start();
    Animated.spring(touchY, {
      toValue: locationY,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
    
    // Easter egg: Track consecutive taps (only on login screen, disabled if user exists or loading)
    if (!user && !loading) {
      const currentTime = Date.now();
      const timeSinceLastTap = currentTime - lastTapTime;
      
      // Reset if more than 1 second between taps
      if (timeSinceLastTap > 1000) {
        setTapCount(1);
      } else {
        const newTapCount = tapCount + 1;
        setTapCount(newTapCount);
        
        // Trigger easter egg at 10 taps
        if (newTapCount >= 10 && !isRaining) {
          triggerEmojiRain();
          setTapCount(0); // Reset after triggering
        }
      }
      
      setLastTapTime(currentTime);
    }
  };

  const handleTouchMove = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    // Use timing for immediate response during drag
    Animated.timing(touchX, {
      toValue: locationX,
      duration: 50, // Very fast response
      useNativeDriver: true,
    }).start();
    Animated.timing(touchY, {
      toValue: locationY,
      duration: 50,
      useNativeDriver: true,
    }).start();
  };

  const handleTouchEnd = () => {
    setIsTouching(false);
    // Return to center smoothly
    Animated.spring(touchX, {
      toValue: SCREEN_WIDTH / 2,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
    Animated.spring(touchY, {
      toValue: SCREEN_HEIGHT / 2,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  // Smooth, organic movement using sine-wave-like interpolation with tilt and touch
  // Movement is limited to stay within the large gradient buffer zone
  const getSmoothX = (anim: Animated.Value, speed: number, layerIndex: number) => {
    const baseX = anim.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: [0, speed * 0.25, speed * 0.4, speed * 0.25, 0],
    });
    
    // Combine with tilt and touch - limited to stay within buffer (gradient is 2x screen size)
    // Max movement should be less than SCREEN_WIDTH/2 to never show edges
    const maxMovement = SCREEN_WIDTH * 0.4; // Safe buffer zone
    const tiltMultiplier = layerIndex === 0 ? maxMovement * 0.8 : layerIndex === 1 ? maxMovement * 0.6 : maxMovement * 0.4;
    const touchMultiplier = layerIndex === 0 ? maxMovement * 0.3 : layerIndex === 1 ? maxMovement * 0.2 : maxMovement * 0.1;
    
    // Clamp tilt values to prevent excessive movement
    const tiltOffset = Animated.multiply(
      Animated.divide(tiltX, 150), // Normalize tilt
      tiltMultiplier
    );
    const touchOffset = Animated.multiply(
      Animated.divide(
        Animated.subtract(touchX, SCREEN_WIDTH / 2),
        SCREEN_WIDTH / 2
      ),
      touchMultiplier
    );
    
    return Animated.add(baseX, Animated.add(tiltOffset, touchOffset));
  };

  const getSmoothY = (anim: Animated.Value, speed: number, layerIndex: number) => {
    const baseY = anim.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: [0, speed * 0.15, speed * 0.3, speed * 0.15, 0],
    });
    
    // Combine with tilt and touch - limited to stay within buffer
    const maxMovement = SCREEN_HEIGHT * 0.4; // Safe buffer zone
    const tiltMultiplier = layerIndex === 0 ? maxMovement * 0.8 : layerIndex === 1 ? maxMovement * 0.6 : maxMovement * 0.4;
    const touchMultiplier = layerIndex === 0 ? maxMovement * 0.3 : layerIndex === 1 ? maxMovement * 0.2 : maxMovement * 0.1;
    
    // Clamp tilt values to prevent excessive movement
    const tiltOffset = Animated.multiply(
      Animated.divide(tiltY, 150), // Normalize tilt
      tiltMultiplier
    );
    const touchOffset = Animated.multiply(
      Animated.divide(
        Animated.subtract(touchY, SCREEN_HEIGHT / 2),
        SCREEN_HEIGHT / 2
      ),
      touchMultiplier
    );
    
    return Animated.add(baseY, Animated.add(tiltOffset, touchOffset));
  };

  const getSmoothRotation = (anim: Animated.Value, layerIndex: number) => {
    const baseRotation = anim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: ['0deg', '3deg', '0deg'],
    });
    
    // Add tilt-based rotation - increased for more visible effect
    const tiltMultiplier = layerIndex === 0 ? 5 : layerIndex === 1 ? 4 : 3;
    const tiltRotation = Animated.multiply(tiltX, tiltMultiplier);
    
    // Convert to degrees and add to base rotation
    // Note: We'll use a workaround since Animated.concat doesn't work well with native driver
    // Instead, we'll increase the base rotation range based on tilt
    return baseRotation;
  };

  // Opacity for smooth blending
  const opacity1 = gradientAnim1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.7, 1, 0.7],
  });

  const opacity2 = gradientAnim2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.8, 0.6],
  });

  const opacity3 = gradientAnim3.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 0.7, 0.5],
  });

  return (
    <View 
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}>
      {/* First gradient layer - smooth diagonal movement */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: opacity1,
            transform: [
              { translateX: getSmoothX(gradientAnim1, 30, 0) },
              { translateY: getSmoothY(gradientAnim1, 20, 0) },
              { rotate: getSmoothRotation(gradientAnim1, 0) },
            ],
          },
        ]}>
        <LinearGradient
          colors={['#80C5FF', '#4DA6FF', '#1A8CFF', '#4DA6FF', '#80C5FF', '#4DA6FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { width: SCREEN_WIDTH * 2, height: SCREEN_HEIGHT * 2, marginLeft: -SCREEN_WIDTH / 2, marginTop: -SCREEN_HEIGHT / 2 }]}
        />
      </Animated.View>
      
      {/* Second gradient layer - opposite direction */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: opacity2,
            transform: [
              { translateX: getSmoothX(gradientAnim2, -25, 1) },
              { translateY: getSmoothY(gradientAnim2, -15, 1) },
              { rotate: getSmoothRotation(gradientAnim2, 1) },
            ],
          },
        ]}>
        <LinearGradient
          colors={['#4DA6FF', '#80C5FF', '#66B8FF', '#80C5FF', '#4DA6FF', '#80C5FF']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { width: SCREEN_WIDTH * 2, height: SCREEN_HEIGHT * 2, marginLeft: -SCREEN_WIDTH / 2, marginTop: -SCREEN_HEIGHT / 2 }]}
        />
      </Animated.View>
      
      {/* Third gradient layer - vertical movement */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: opacity3,
            transform: [
              { translateX: getSmoothX(gradientAnim3, 20, 2) },
              { translateY: getSmoothY(gradientAnim3, -20, 2) },
              { rotate: getSmoothRotation(gradientAnim3, 2) },
            ],
          },
        ]}>
        <LinearGradient
          colors={['#66B8FF', '#80C5FF', '#4DA6FF', '#80C5FF', '#66B8FF', '#80C5FF']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { width: SCREEN_WIDTH * 2, height: SCREEN_HEIGHT * 2, marginLeft: -SCREEN_WIDTH / 2, marginTop: -SCREEN_HEIGHT / 2 }]}
        />
      </Animated.View>

      {/* Easter Egg: Emoji Rain */}
      {isRaining && emojiRefs.current.map((animValue, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            left: emojiXPositions.current[index],
            transform: [{ translateY: animValue }],
            zIndex: 1000,
          }}>
          <Image 
            source={require('@/assets/images/hoot-emoji.png')} 
            style={{ 
              width: emojiSizes.current[index] || 40, 
              height: emojiSizes.current[index] || 40 
            }}
            resizeMode="contain"
          />
        </Animated.View>
      ))}

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 50) + 60, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        <View style={styles.emojiContainer}>
          <Image 
            source={require('@/assets/images/hoot-emoji.png')} 
            style={styles.emoji}
            resizeMode="contain"
          />
          <View style={styles.snowflakes}>
            <ThemedText style={styles.snowflake}>❄️</ThemedText>
            <ThemedText style={styles.snowflake}>❄️</ThemedText>
            <ThemedText style={styles.snowflake}>❄️</ThemedText>
          </View>
        </View>
        <Animated.View style={{ opacity: fadeAnim }}>
          <ThemedText type="title" style={styles.title}>
            Welcome to Hoot
          </ThemedText>
        </Animated.View>
        <ThemedText style={styles.subtitle}>
          Connect with friends and send them a Hoot! ❄️
        </ThemedText>

        {isAppleAvailable ? (
          <View style={styles.appleButtonContainer}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={30}
              style={styles.appleButton}
              onPress={handleContinue}
              disabled={loading || isSigningIn}
            />
            {isSigningIn && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#000" />
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, { 
              backgroundColor: colors.tint,
              shadowColor: colors.tint,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }]}
            onPress={handleContinue}
            disabled={loading || isSigningIn}>
            {isSigningIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText 
                style={styles.buttonText}
                lightColor="#fff"
                darkColor="#fff">
                Continue ❄️
              </ThemedText>
            )}
          </TouchableOpacity>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    alignItems: 'center',
  },
  emojiContainer: {
    marginTop: 20,
    marginBottom: 32,
    alignItems: 'center',
    paddingTop: 20,
  },
  emoji: {
    width: 70,
    height: 70,
    marginBottom: 16,
  },
  snowflakes: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginTop: 8,
  },
  snowflake: {
    fontSize: 24,
    opacity: 0.7,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
    paddingHorizontal: 15,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 48,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 30,
    minWidth: 220,
    alignItems: 'center',
    transform: [{ scale: 1 }],
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogo: {
    width: 24,
    height: 24,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  appleButtonContainer: {
    width: '100%',
    maxWidth: 280,
    height: 50,
    position: 'relative',
  },
  appleButton: {
    width: '100%',
    height: 50,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

