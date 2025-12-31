import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Gets the current user ID with fallback to AsyncStorage
 * This is useful for OAuth bypass scenarios or when user object might not be immediately available
 * 
 * @param user - Optional user object with uid property (from AuthContext)
 * @returns Promise<string> - The user ID, or 'temp_user' as last resort
 */
export async function getCurrentUserId(user?: { uid?: string } | null): Promise<string> {
  if (user?.uid) {
    return user.uid;
  }
  // Fallback to AsyncStorage
  try {
    const storedUserId = await AsyncStorage.getItem('hoot_userId');
    if (storedUserId) {
      return storedUserId;
    }
  } catch (error) {
    console.error('Error getting user ID from storage:', error);
  }
  // Last resort fallback
  return 'temp_user';
}

