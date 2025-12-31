import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId } from '@/utils/authHelpers';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { collection, addDoc, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export default function QRScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertShown, setAlertShown] = useState(false);
  const [requestInProgress, setRequestInProgress] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const processingRef = useRef(false); // Use ref for immediate duplicate prevention
  const lastScannedDataRef = useRef<string | null>(null); // Track last scanned QR data
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Safe navigation function
  const goBack = () => {
    try {
      // Navigate to friends tab (where QR scan is accessed from)
      router.replace('/(tabs)/friends' as any);
    } catch (error) {
      console.error('Error navigating:', error);
      // Fallback navigation
      try {
        router.back();
      } catch (e) {
        console.error('Fallback navigation failed:', e);
      }
    }
  };

  useEffect(() => {
    // Request permission if not already requested
    const requestCameraPermission = async () => {
      if (!permission) {
        // Permission state not loaded yet, wait a bit
        return;
      }

      if (permission.granted) {
        // Permission is granted, camera is ready
        setCameraReady(true);
        return;
      }

      if (!permission.granted && permission.canAskAgain) {
        // Request permission
        try {
          const result = await requestPermission();
          if (result.granted) {
            setCameraReady(true);
          } else {
            Alert.alert(
              'Camera Permission Required',
              'Please enable camera access to scan QR codes.',
              [
                { text: 'Cancel', style: 'cancel', onPress: goBack },
                { text: 'OK', onPress: goBack },
              ]
            );
          }
        } catch (error) {
          console.error('Error requesting camera permission:', error);
          Alert.alert('Error', 'Failed to request camera permission');
        }
      } else if (!permission.granted && !permission.canAskAgain) {
        // Permission was denied permanently
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in Settings to scan QR codes.',
          [
            { text: 'Cancel', style: 'cancel', onPress: goBack },
            { text: 'OK', onPress: goBack },
          ]
        );
      }
    };

    requestCameraPermission();
  }, [permission, requestPermission]);

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    const data = result.data;

    // CRITICAL: Prevent multiple scans using ref (immediate, no state delay)
    if (processingRef.current || scanned || loading || alertShown) {
      return;
    }

    // Prevent scanning the same QR code data multiple times
    if (lastScannedDataRef.current === data) {
      return;
    }

    // Mark as processing immediately (before any async operations)
    processingRef.current = true;
    lastScannedDataRef.current = data;
    setScanned(true);
    setLoading(true);

    try {
      // Parse QR code data
      let qrData;
      try {
        qrData = JSON.parse(data);
      } catch (parseError) {
        processingRef.current = false;
        if (!alertShown) {
          setAlertShown(true);
          Alert.alert('Invalid QR Code', 'This QR code format is not recognized', [
            {
              text: 'OK',
              onPress: () => {
                setAlertShown(false);
                setScanned(false);
                setLoading(false);
                processingRef.current = false;
                lastScannedDataRef.current = null;
              },
            },
          ]);
        }
        return;
      }

      if (qrData.type !== 'hoot_friend_request') {
        processingRef.current = false;
        if (!alertShown) {
          setAlertShown(true);
          Alert.alert('Invalid QR Code', 'This QR code is not a Hoot friend request', [
            {
              text: 'OK',
              onPress: () => {
                setAlertShown(false);
                setScanned(false);
                setLoading(false);
                processingRef.current = false;
                lastScannedDataRef.current = null;
              },
            },
          ]);
        }
        return;
      }

      const targetUserId = qrData.userId;

      if (!targetUserId) {
        processingRef.current = false;
        if (!alertShown) {
          setAlertShown(true);
          Alert.alert('Invalid QR Code', 'This QR code does not contain user information', [
            {
              text: 'OK',
              onPress: () => {
                setAlertShown(false);
                setScanned(false);
                setLoading(false);
                processingRef.current = false;
                lastScannedDataRef.current = null;
              },
            },
          ]);
        }
        return;
      }

      // Get actual user ID
      const userId = await getCurrentUserId(user);

      // Create a unique key for this request to prevent duplicates
      const requestKey = `${userId}_${targetUserId}`;

      // Check if this exact request is already in progress
      if (requestInProgress === requestKey) {
        processingRef.current = false;
        setScanned(false);
        setLoading(false);
        lastScannedDataRef.current = null;
        return;
      }

      setRequestInProgress(requestKey);

      if (targetUserId === userId) {
        processingRef.current = false;
        if (!alertShown) {
          setAlertShown(true);
          Alert.alert('Error', 'You cannot send a friend request to yourself', [
            {
              text: 'OK',
              onPress: () => {
                setAlertShown(false);
                setScanned(false);
                setLoading(false);
                processingRef.current = false;
                lastScannedDataRef.current = null;
              },
            },
          ]);
        }
        return;
      }

      // CRITICAL: Check if friendship already exists BEFORE creating new one
      // This prevents race conditions where multiple scans happen simultaneously
      const existingQuery1 = query(
        collection(db, 'friendships'),
        where('userId', '==', userId),
        where('friendId', '==', targetUserId)
      );
      const existingQuery2 = query(
        collection(db, 'friendships'),
        where('userId', '==', targetUserId),
        where('friendId', '==', userId)
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(existingQuery1),
        getDocs(existingQuery2)
      ]);

      if (!snapshot1.empty || !snapshot2.empty) {
        // Check what type of relationship exists
        const allDocs = [...snapshot1.docs, ...snapshot2.docs];
        const hasAccepted = allDocs.some(doc => doc.data().status === 'accepted');
        const hasPending = allDocs.some(doc => doc.data().status === 'pending');

        processingRef.current = false;
        if (!alertShown) {
          setAlertShown(true);
          if (hasAccepted) {
            Alert.alert('Already Friends', 'You already have a friendship with this user', [
              {
                text: 'OK',
                onPress: () => {
                  setAlertShown(false);
                  setScanned(false);
                  setLoading(false);
                  processingRef.current = false;
                  lastScannedDataRef.current = null;
                },
              },
            ]);
          } else if (hasPending) {
            Alert.alert('Request Already Sent', 'You already have a pending friend request with this user', [
              {
                text: 'OK',
                onPress: () => {
                  setAlertShown(false);
                  setScanned(false);
                  setLoading(false);
                  processingRef.current = false;
                  lastScannedDataRef.current = null;
                },
              },
            ]);
          }
        }
        return;
      }

      // CRITICAL: Double-check before creating (prevent race condition)
      // Re-query to ensure no request was created between our check and now
      const finalCheck1 = query(
        collection(db, 'friendships'),
        where('userId', '==', userId),
        where('friendId', '==', targetUserId),
        where('status', '==', 'pending')
      );
      const finalCheck2 = query(
        collection(db, 'friendships'),
        where('userId', '==', targetUserId),
        where('friendId', '==', userId),
        where('status', '==', 'pending')
      );

      const [finalSnapshot1, finalSnapshot2] = await Promise.all([
        getDocs(finalCheck1),
        getDocs(finalCheck2)
      ]);

      if (!finalSnapshot1.empty || !finalSnapshot2.empty) {
        // A request was just created (race condition caught)
        processingRef.current = false;
        if (!alertShown) {
          setAlertShown(true);
          Alert.alert('Request Already Sent', 'A friend request to this user was just sent', [
            {
              text: 'OK',
              onPress: () => {
                setAlertShown(false);
                setScanned(false);
                setLoading(false);
                processingRef.current = false;
                lastScannedDataRef.current = null;
              },
            },
          ]);
        }
        return;
      }

      // Create friend request (only one will be created due to checks above)
      await addDoc(collection(db, 'friendships'), {
        userId: userId,
        friendId: targetUserId,
        status: 'pending',
        createdAt: new Date(),
      });

      if (!alertShown) {
        setAlertShown(true);
        Alert.alert('Success', 'Friend request sent!', [
          {
            text: 'OK',
            onPress: () => {
              setAlertShown(false);
              setRequestInProgress(null);
              processingRef.current = false;
              // Keep lastScannedDataRef to prevent re-scanning same QR
              goBack();
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error processing QR code:', error);
      processingRef.current = false;
      if (!alertShown) {
        setAlertShown(true);
        Alert.alert('Error', 'Failed to process QR code. Please try again.', [
          {
            text: 'OK',
            onPress: () => {
              setAlertShown(false);
              setScanned(false);
              setRequestInProgress(null);
              processingRef.current = false;
              lastScannedDataRef.current = null;
            },
          },
        ]);
      }
    } finally {
      setLoading(false);
      setRequestInProgress(null);
    }
  };


  // Show loading state while checking permission
  if (!permission) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.permissionText}>
            Loading camera...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Show permission request screen if permission is not granted
  if (!permission.granted || !cameraReady) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Floating back button */}
        <TouchableOpacity
          style={[styles.floatingBackButton, { top: insets.top + 10 }]}
          onPress={goBack}>
          <View style={styles.backButtonContent}>
            <IconSymbol name="chevron.left" size={24} color="#fff" />
            <ThemedText style={styles.floatingBackButtonText}>Back</ThemedText>
          </View>
        </TouchableOpacity>
        <View style={styles.permissionContainer}>
          <ThemedText style={styles.permissionText}>
            We need your permission to use the camera
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={async () => {
              try {
                const result = await requestPermission();
                if (result.granted) {
                  setCameraReady(true);
                } else {
                  Alert.alert(
                    'Permission Denied',
                    'Camera permission is required to scan QR codes. Please enable it in Settings.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                console.error('Error requesting permission:', error);
                Alert.alert('Error', 'Failed to request camera permission');
              }
            }}>
            <ThemedText style={styles.buttonText}>Grant Permission</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // Only render camera when permission is granted and camera is ready
  if (!cameraReady) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.permissionText}>
            Preparing camera...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={(scanned || loading || processingRef.current) ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      {/* Floating back button */}
      <TouchableOpacity
        style={[styles.floatingBackButton, { top: insets.top + 10 }]}
        onPress={goBack}>
        <View style={styles.backButtonContent}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
          <ThemedText style={styles.floatingBackButtonText}>Back</ThemedText>
        </View>
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <ThemedText style={styles.loadingText}>Processing...</ThemedText>
        </View>
      )}

      {!loading && (
        <View style={styles.overlay}>
          <View style={styles.scanArea} />
          <ThemedText style={styles.instruction}>
            Point your camera at a QR code
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  floatingBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  floatingBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  instruction: {
    marginTop: 32,
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

