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
  // Track if we just signed in to prevent onAuthStateChanged from overwriting state
  const justSignedInRef = React.useRef<string | null>(null);

  useEffect(() => {
    // Firebase Auth automatically persists sessions on native platforms
    // onAuthStateChanged will restore the user session when app restarts
    // This listener fires immediately with the current auth state when added
    console.log('🔐 Setting up Firebase Auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔐 Auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
      
      if (firebaseUser) {
        const isJustSignedIn = justSignedInRef.current === firebaseUser.uid;
        
        if (isJustSignedIn) {
          console.log('⏭️ onAuthStateChanged: signIn() is handling state update, but ensuring state is set as fallback');
        }
        
        console.log('✅ Firebase Auth session detected for user:', firebaseUser.uid);
        console.log('   Email:', firebaseUser.email || 'No email');
        console.log('   Display name:', firebaseUser.displayName || 'No display name');
        
        // Fetch user data from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.data();
          
          console.log('📄 Firestore user document:', userDoc.exists() ? 'exists' : 'does not exist');
          
          // If user document doesn't exist, create it with Apple account info
          if (!userData) {
            console.log('📝 Creating new user document in Firestore...');
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || null,
              photoURL: firebaseUser.photoURL || null,
              // username is intentionally omitted for new users
            }, { merge: true });
            console.log('✅ User document created');
          }
          
          const userState = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: userData?.displayName || firebaseUser.displayName,
            username: userData?.username, // Will be undefined for new users
            photoURL: firebaseUser.photoURL,
          };
          
          console.log('👤 Setting user state from onAuthStateChanged:', {
            uid: userState.uid,
            hasEmail: !!userState.email,
            hasDisplayName: !!userState.displayName,
            hasUsername: !!userState.username,
            isJustSignedIn: isJustSignedIn,
          });
          
          // Always set user state - even if signIn() is handling it, this ensures it's set
          // React will handle deduplication if the state is the same
          setUser(userState);
          
          console.log('✅ User state restored:', {
            uid: firebaseUser.uid,
            username: userData?.username || 'none (new user)',
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
          console.error('   Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
          // Still set user even if Firestore fetch fails
          const fallbackUserState = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            username: undefined,
            photoURL: firebaseUser.photoURL,
          };
          console.log('⚠️ Using fallback user state (Firestore fetch failed)');
          setUser(fallbackUserState);
        }
      } else {
        // User signed out - clear everything
        console.log('ℹ️ No user signed in - clearing user state');
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
      let credential;
      try {
        credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
      } catch (appleError: any) {
        console.error('❌ Apple authentication failed:', appleError);
        if (appleError.code === 'ERR_REQUEST_CANCELED') {
          console.log('ℹ️ User cancelled Sign in with Apple');
          return;
        }
        throw appleError;
      }

      console.log('✅ Apple authentication successful');
      console.log('   User ID:', credential.user);
      console.log('   Email:', credential.email || 'Not provided (user chose to hide)');
      console.log('   Full Name:', credential.fullName);
      console.log('   Has identity token:', !!credential.identityToken);

      // Create Firebase credential from Apple ID token
      const { identityToken } = credential;
      
      if (!identityToken) {
        console.error('❌ No identity token received from Apple');
        throw new Error('No identity token received from Apple. Please try again.');
      }

      console.log('🔑 Creating Firebase credential with Apple identity token...');
      console.log('   Identity token length:', identityToken.length);
      
      // Create OAuth provider for Apple
      let firebaseCredential;
      try {
        const appleProvider = new OAuthProvider('apple.com');
        
        // For iOS native Sign in with Apple, we don't need a nonce
        // The nonce is only required for web-based OAuth flows
        firebaseCredential = appleProvider.credential({
          idToken: identityToken,
          // Don't pass rawNonce for native iOS Sign in with Apple
        });
        console.log('✅ Firebase credential created successfully');
      } catch (credError: any) {
        console.error('❌ Failed to create Firebase credential:', credError);
        console.error('   Error code:', credError.code);
        console.error('   Error message:', credError.message);
        throw new Error(`Failed to create Firebase credential: ${credError.message || credError.code || 'Unknown error'}`);
      }

      console.log('🔥 Signing in with Firebase credential...');
      console.log('   Auth instance:', !!auth);
      
      // CRITICAL: Set the ref BEFORE signInWithCredential to prevent race condition
      // onAuthStateChanged fires when signInWithCredential completes, so we need the ref set first
      // We'll get the UID from the credential result, but for now we'll set it after
      // Actually, we can't set it yet because we don't have the UID. Let's use a different approach:
      // Set a flag that we're in the sign-in process, then check it in onAuthStateChanged
      
      // Sign in to Firebase with Apple credential
      let userCredential;
      let firebaseUser;
      try {
        userCredential = await signInWithCredential(auth, firebaseCredential);
        console.log('✅ Firebase sign-in successful!');
        
        firebaseUser = userCredential.user;
        // Set ref IMMEDIATELY after signInWithCredential - onAuthStateChanged fires synchronously
        if (firebaseUser) {
          justSignedInRef.current = firebaseUser.uid;
          console.log('🔒 Set justSignedInRef to prevent onAuthStateChanged race condition');
        }
      } catch (firebaseError: any) {
        console.error('❌ Firebase sign-in failed:', firebaseError);
        console.error('   Error code:', firebaseError.code);
        console.error('   Error message:', firebaseError.message);
        console.error('   Full error:', JSON.stringify(firebaseError, null, 2));
        
        // Provide helpful error messages
        if (firebaseError.code === 'auth/operation-not-allowed') {
          throw new Error('Apple Sign-In is not enabled in Firebase. Please enable it in Firebase Console > Authentication > Sign-in method > Apple.');
        } else if (firebaseError.code === 'auth/invalid-credential') {
          throw new Error('Invalid Apple credential. Please try signing in again.');
        } else if (firebaseError.code === 'auth/credential-already-in-use') {
          throw new Error('This Apple account is already linked to another account.');
        }
        throw new Error(`Firebase sign-in failed: ${firebaseError.message || firebaseError.code || 'Unknown error'}`);
      }
      
      if (!firebaseUser) {
        console.error('❌ No user returned from Firebase sign-in');
        throw new Error('No user returned from Firebase sign-in');
      }
      
      // Ensure ref is set (should already be set, but double-check)
      if (!justSignedInRef.current) {
        justSignedInRef.current = firebaseUser.uid;
        console.log('🔒 Set justSignedInRef as fallback');
      }
      
      console.log('👤 User signed in:', {
        uid: firebaseUser.uid,
        email: firebaseUser.email || 'Email hidden',
        displayName: firebaseUser.displayName || 'No display name',
      });
      
      // Get or create user document in Firestore
      let userDoc;
      let userData;
      try {
        userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        userData = userDoc.data();
        console.log('📄 Firestore user document:', userDoc.exists() ? 'exists' : 'does not exist');
      } catch (firestoreError: any) {
        console.error('❌ Error fetching user document:', firestoreError);
        // Continue even if Firestore fetch fails - we'll create the document
      }
      
      // If user document doesn't exist, this is a new user (or account was deleted)
      // They should be treated as a new user and prompted to create a username
      const isNewUser = !userDoc?.exists() || !userData;
      
      // Prepare user data - use Apple's full name if available and not already set
      const displayName = credential.fullName 
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : userData?.displayName || firebaseUser.displayName || null;
      
      // Update or create user document with Apple account info
      // For new users, we should NOT write username field (omit it entirely)
      // This ensures onAuthStateChanged reads it as undefined, not null
      const finalUsername = userData?.username; // Will be undefined for new users
      
      try {
        // Build user document - only include username if it exists
        const userDocData: any = {
          email: firebaseUser.email || credential.email || userData?.email || null,
          displayName: displayName,
          photoURL: firebaseUser.photoURL || userData?.photoURL || null,
        };
        
        // Only add username field if it exists (for existing users)
        // For new users, omit the field entirely so it reads as undefined
        if (finalUsername) {
          userDocData.username = finalUsername;
        }
        
        await setDoc(doc(db, 'users', firebaseUser.uid), userDocData, { merge: true });
        console.log('✅ User document updated in Firestore', {
          hasUsername: !!finalUsername,
          isNewUser: isNewUser,
        });
      } catch (firestoreError: any) {
        console.error('❌ Error updating user document:', firestoreError);
        // Continue even if Firestore update fails - we'll still set the user state
      }
      
      // CRITICAL: Immediately update local user state so navigation can happen
      // This ensures the login screen can navigate to username screen right away
      // Note: onAuthStateChanged will also fire and update the state, but we set it here
      // immediately so navigation can happen without waiting for the listener
      const userState = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || credential.email || null,
        displayName: displayName,
        username: finalUsername, // Will be undefined for new users (not null)
        photoURL: firebaseUser.photoURL || null,
      };
      
      console.log('👤 Setting user state from signIn():', {
        uid: userState.uid,
        hasEmail: !!userState.email,
        hasDisplayName: !!userState.displayName,
        hasUsername: !!userState.username,
        usernameValue: userState.username,
      });
      
      // Set user state immediately - this will trigger navigation in login screen
      // The onAuthStateChanged listener will also fire, but we've set justSignedInRef
      // to prevent it from overwriting our state during navigation
      setUser(userState);
      
      // Clear loading state to allow navigation
      setLoading(false);
      
      // Clear the ref after a delay to allow onAuthStateChanged to work normally for future auth changes
      setTimeout(() => {
        justSignedInRef.current = null;
      }, 2000);
      
      if (isNewUser) {
        console.log('🆕 New user detected - will be prompted to create username');
        console.log('   Navigation should trigger automatically when user state is set');
      } else {
        console.log('👋 Returning user - username:', finalUsername || 'none');
      }
      
      console.log('✅ Sign-in process complete - user state updated');
      console.log('   User state:', JSON.stringify(userState, null, 2));
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // Handle user cancellation gracefully
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('ℹ️ User cancelled Sign in with Apple');
        return; // Don't throw error for cancellation
      }
      
      // Re-throw other errors so they can be handled by the UI
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
