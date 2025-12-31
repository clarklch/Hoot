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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user data from Firestore
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
      } else {
        // User signed out - clear everything
        setUser(null);
        
        // Clean up notification listeners
        if (notificationCleanupRef.current) {
          notificationCleanupRef.current();
          notificationCleanupRef.current = null;
        }
      }
      setLoading(false);
    });
    
    return () => {
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
      const firebaseCredential = appleProvider.credential({
        idToken: identityToken,
        rawNonce: credential.nonce || undefined,
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
        
        // Prepare user data - use Apple's full name if available and not already set
        const displayName = credential.fullName 
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
          : userData?.displayName || firebaseUser.displayName || null;
        
        // Update or create user document with Apple account info
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          email: firebaseUser.email || credential.email || userData?.email || null,
          displayName: displayName,
          photoURL: firebaseUser.photoURL || userData?.photoURL || null,
          username: userData?.username || null, // Preserve existing username if any
        }, { merge: true });
        
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
