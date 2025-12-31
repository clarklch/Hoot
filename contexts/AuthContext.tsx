import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { 
  signInWithCredential, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  OAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Notifications from 'expo-notifications';
import { auth, db } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearPushToken } from '@/services/notifications';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  username?: string;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const notificationCleanupRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    // Firebase Auth automatically persists sessions on native platforms
    // onAuthStateChanged will restore the user session when app restarts
    // This listener fires immediately with the current auth state when added
    console.log('🔐 Setting up Firebase Auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔐 Auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
      
      if (firebaseUser) {
        console.log('✅ Firebase Auth session restored for user:', firebaseUser.uid);
        
        // Fetch user data from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.data();
          
          // If user document doesn't exist, create it with Apple account info
          if (!userData) {
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || null,
              photoURL: firebaseUser.photoURL || null,
            }, { merge: true });
          }
          
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: userData?.displayName || firebaseUser.displayName,
            username: userData?.username,
            photoURL: firebaseUser.photoURL,
          });
          
          console.log('✅ User state restored:', {
            uid: firebaseUser.uid,
            username: userData?.username || 'none',
            displayName: userData?.displayName || firebaseUser.displayName || 'none',
          });
          
          // Clear all pending notifications when user signs in
          // This prevents old notifications from previous users from appearing
          try {
            await Notifications.dismissAllNotificationsAsync();
            console.log('✅ Cleared all pending notifications on sign in');
          } catch (notifError) {
            console.log('Note: Could not clear notifications on sign in');
          }
        } catch (error) {
          console.error('❌ Error restoring user data:', error);
          // Still set user even if Firestore fetch fails
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            username: undefined,
            photoURL: firebaseUser.photoURL,
          });
        }
      } else {
        // User signed out - clear everything
        console.log('ℹ️ No user signed in');
        setUser(null);
        
        // Clean up notification listeners
        if (notificationCleanupRef.current) {
          notificationCleanupRef.current();
          notificationCleanupRef.current = null;
        }
      }
      
      // Only set loading to false after we've processed the auth state
      setLoading(false);
      console.log('✅ Auth state loading complete');
    });
    
    return () => {
      console.log('🧹 Cleaning up auth state listener');
      unsubscribe();
      // Clean up notification listeners on unmount
      if (notificationCleanupRef.current) {
        notificationCleanupRef.current();
        notificationCleanupRef.current = null;
      }
    };
  }, []);

  const signIn = async () => {
    try {
      // Check if Apple Authentication is available (iOS 13+)
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      
      if (!isAvailable) {
        throw new Error('Sign in with Apple is not available on this device. Please update to iOS 13 or later.');
      }

      console.log('🍎 Starting Sign in with Apple...');
      
      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('✅ Apple authentication successful');
      console.log('   User ID:', credential.user);
      console.log('   Email:', credential.email || 'Not provided (user chose to hide)');
      console.log('   Full Name:', credential.fullName);

      // Create Firebase credential from Apple ID token
      const { identityToken } = credential;
      
      if (!identityToken) {
        throw new Error('No identity token received from Apple');
      }

      console.log('🔑 Creating Firebase credential with Apple identity token...');
      
      // Create OAuth provider for Apple
      const appleProvider = new OAuthProvider('apple.com');
      
      // For iOS native Sign in with Apple, we don't need a nonce
      // The nonce is only required for web-based OAuth flows
      const firebaseCredential = appleProvider.credential({
        idToken: identityToken,
        // Don't pass rawNonce for native iOS Sign in with Apple
      });

      console.log('🔥 Signing in with Firebase credential...');
      
      // Sign in to Firebase with Apple credential
      const userCredential = await signInWithCredential(auth, firebaseCredential);
      
      console.log('✅ Firebase sign-in successful!');
      
      const firebaseUser = userCredential.user;
      if (firebaseUser) {
        console.log('👤 User signed in:', firebaseUser.email || 'Email hidden', firebaseUser.uid);
        
        // Get or create user document in Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = userDoc.data();
        
        // If user document doesn't exist, this is a new user (or account was deleted)
        // They should be treated as a new user and prompted to create a username
        const isNewUser = !userDoc.exists() || !userData;
        
        // Prepare user data - use Apple's full name if available and not already set
        const displayName = credential.fullName 
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
          : userData?.displayName || firebaseUser.displayName || null;
        
        // Update or create user document with Apple account info
        // For new users (or deleted accounts), username will be null so they're prompted to create one
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          email: firebaseUser.email || credential.email || userData?.email || null,
          displayName: displayName,
          photoURL: firebaseUser.photoURL || userData?.photoURL || null,
          username: userData?.username || null, // Will be null for new/deleted users - triggers username creation
        }, { merge: true });
        
        if (isNewUser) {
          console.log('🆕 New user detected - will be prompted to create username');
        }
        
        console.log('✅ User document updated in Firestore');
      }
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      
      // Handle user cancellation gracefully
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('ℹ️ User cancelled Sign in with Apple');
        return; // Don't throw error for cancellation
      }
      
      // Re-throw other errors
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const currentUserId = user?.uid;
      
      // CRITICAL: Remove push token from Firestore BEFORE signing out
      // This prevents notifications from being sent to the old user
      if (currentUserId) {
        try {
          await clearPushToken(currentUserId);
        } catch (tokenError) {
          console.error('Error clearing push token:', tokenError);
          // Continue with sign out even if token clearing fails
        }
      }
      
      // Clean up notification listeners
      if (notificationCleanupRef.current) {
        console.log('🧹 Cleaning up notification listeners');
        notificationCleanupRef.current();
        notificationCleanupRef.current = null;
      }
      
      // Clear all pending notifications from device notification center
      // This prevents old user's notifications from appearing
      try {
        await Notifications.dismissAllNotificationsAsync();
        console.log('✅ Cleared all pending notifications');
      } catch (notifError) {
        console.log('Note: Could not clear notifications (expected in some environments)');
      }
      
      // Clear user state
      setUser(null);
      
      // Clear stored user data
      try {
        await AsyncStorage.removeItem('hoot_userId');
        await AsyncStorage.removeItem('hoot_username');
      } catch (storageError) {
        console.log('Note: Could not clear storage (expected in some environments)');
      }
      
      // Sign out from Firebase
      try {
        await firebaseSignOut(auth);
        console.log('✅ Signed out successfully - push token cleared and notifications stopped');
      } catch (firebaseError) {
        console.error('Firebase sign out error:', firebaseError);
        // Still clear user state even if Firebase sign out fails
      }
    } catch (error) {
      console.error('Sign out error:', error);
      // Always clear user state even if there's an error
      setUser(null);
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    // Allow creating user if it doesn't exist (for temp users)
    const userId = user?.uid || updates.uid;
    if (!userId) return;
    
    try {
      await setDoc(doc(db, 'users', userId), updates, { merge: true });

      // Update state - create user if it doesn't exist
      if (user) {
        setUser({ ...user, ...updates });
      } else if (updates.uid) {
        // Create new user object
        setUser({
          uid: updates.uid,
          email: updates.email || null,
          displayName: updates.displayName || null,
          username: updates.username,
          photoURL: updates.photoURL || null,
        });
      }
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
