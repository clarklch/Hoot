// Firebase configuration
// TODO: Replace these with your Firebase project credentials
// You'll get these from Firebase Console after creating a project

import * as Notifications from 'expo-notifications';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration object
// You'll need to replace this with your actual Firebase config
// Get it from: Firebase Console > Project Settings > General > Your apps
// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5xkJHtYDZYcRNoPkNvNaUi6AFMa8Rz6c",
  authDomain: "hoot-7fe85.firebaseapp.com",
  projectId: "hoot-7fe85",
  storageBucket: "hoot-7fe85.firebasestorage.app",
  messagingSenderId: "155703291482",
  appId: "1:155703291482:web:1d7eb3334309ea7c7b7263"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Request notification permissions and get FCM token
export async function getFCMToken(): Promise<string | null> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permission not granted');
      return null;
    }

    // For Expo, we'll use Expo's push notification token instead
    // Firebase Cloud Messaging will be configured through Expo's push notification service
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

