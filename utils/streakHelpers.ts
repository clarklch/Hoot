/**
 * Helper functions for streak validation and calculation
 */

import { Timestamp, doc, runTransaction } from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Converts lastHootDate from various formats to a Date object
 * Handles: Firestore Timestamp, ISO string, date-only string (YYYY-MM-DD), or null
 */
function parseLastHootDate(lastHootDate: any): Date | null {
  if (!lastHootDate) {
    return null;
  }

  // Handle Firestore Timestamp (client SDK)
  if (lastHootDate && typeof lastHootDate === 'object' && 'toDate' in lastHootDate) {
    return lastHootDate.toDate();
  }

  // Handle Firestore Timestamp (admin SDK - serverTimestamp type)
  if (lastHootDate && typeof lastHootDate === 'object' && 'seconds' in lastHootDate) {
    return new Date(lastHootDate.seconds * 1000 + (lastHootDate.nanoseconds || 0) / 1000000);
  }

  // Handle string formats
  if (typeof lastHootDate === 'string') {
    // If it's just a date (YYYY-MM-DD), convert to start of that day for backward compatibility
    if (lastHootDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Date(lastHootDate + 'T00:00:00.000Z');
    }
    // ISO string format
    return new Date(lastHootDate);
  }

  return null;
}

/**
 * Validates a streak based on lastHootDate using consecutive days model
 * A streak is broken if lastHootDate is more than 48 hours ago
 * (Users have until the next day to send a hoot and maintain their streak)
 * @param streakCount - The current streak count from Firestore
 * @param lastHootDate - The last timestamp a message was sent (Firestore Timestamp, ISO string, date-only string, or null)
 * @returns The validated streak count (0 if broken, original count if valid)
 */
export function validateStreak(streakCount: number | undefined, lastHootDate: any): number {
  // If no lastHootDate, streak is broken (no messages sent)
  if (!lastHootDate) {
    return 0;
  }

  const lastDate = parseLastHootDate(lastHootDate);
  if (!lastDate) {
    return 0; // Invalid format or null
  }

  // Check if date is valid
  if (isNaN(lastDate.getTime())) {
    return 0; // Invalid date
  }

  const now = new Date();

  // Calculate time difference in milliseconds
  const timeDiff = now.getTime() - lastDate.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60); // Convert to hours

  // If more than 48 hours have passed, streak is broken
  // (Consecutive days model: users have until the next day to maintain)
  if (hoursDiff > 48) {
    return 0;
  }

  // Streak is still valid (within 48 hours window)
  // Return the original streak count
  return streakCount || 0;
}

/**
 * Calculates the new streak count based on consecutive days model:
 * - Same day (0-24h): keep same streak (no increment)
 * - Next day (24-48h): increment streak (earned!)
 * - Streak broken (>48h): reset to 0
 * @param currentStreak - The current streak count
 * @param lastHootDate - The last timestamp a message was sent (Firestore Timestamp, ISO string, date-only string, or null)
 * @returns The new streak count
 */
export function calculateStreak(currentStreak: number, lastHootDate: any): number {
  // If no lastHootDate, this is the first message, start at 0
  if (!lastHootDate) {
    return 0;
  }

  const lastDate = parseLastHootDate(lastHootDate);
  if (!lastDate) {
    return 0; // Invalid format, start fresh
  }

  // Check if date is valid
  if (isNaN(lastDate.getTime())) {
    return 0; // Invalid date, start fresh
  }

  const now = new Date();

  // Calculate time difference in milliseconds
  const timeDiff = now.getTime() - lastDate.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60); // Convert to hours

  if (hoursDiff <= 24) {
    // Same day hoot - keep current streak (don't increment)
    return currentStreak || 0;
  } else if (hoursDiff <= 48) {
    // Next day hoot (24-48h) - increment streak!
    return (currentStreak || 0) + 1;
  }

  // More than 48 hours - streak is broken, reset to 0
  return 0;
}

/**
 * Syncs a broken streak to Firestore by setting streakCount to 0
 * Uses a transaction to avoid race conditions with new messages arriving
 * Call this when the client detects a streak should be reset but Firestore hasn't been updated yet
 * This ensures the database stays in sync even if the scheduled cleanup job hasn't run
 * @param collection - The Firestore collection ('friendships' or 'groups')
 * @param documentId - The document ID to update
 * @param rawStreakCount - The raw streak count from Firestore (as we read it)
 * @param originalLastHootDate - The last hoot date from Firestore (as we read it)
 * @returns Promise that resolves when sync is complete (or immediately if no sync needed)
 */
export async function syncBrokenStreak(
  collection: 'friendships' | 'groups',
  documentId: string,
  rawStreakCount: number,
  originalLastHootDate: any
): Promise<void> {
  // Only sync if there's a streak to reset
  if (rawStreakCount <= 0) {
    return;
  }

  // Calculate if streak is broken
  const validatedStreak = validateStreak(rawStreakCount, originalLastHootDate);

  // If validated streak is 0 but raw is > 0, sync the reset to Firestore
  if (validatedStreak === 0 && rawStreakCount > 0) {
    try {
      const docRef = doc(db, collection, documentId);

      // Use a transaction to avoid race condition with new messages
      // Only reset if lastHootDate hasn't changed (no new messages arrived)
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) {
          return; // Document no longer exists
        }

        const currentData = docSnap.data();
        const currentLastHootDate = currentData?.lastHootDate;
        const currentStreakCount = currentData?.streakCount || 0;

        // Normalize dates for comparison
        const originalDateStr = originalLastHootDate ? String(originalLastHootDate) : null;
        const currentDateStr = currentLastHootDate ? String(currentLastHootDate) : null;

        // Only reset if:
        // 1. lastHootDate hasn't changed (no new message arrived)
        // 2. streakCount is still > 0 (hasn't been reset by server already)
        if (originalDateStr === currentDateStr && currentStreakCount > 0) {
          // Re-validate with current data to be safe
          const stillBroken = validateStreak(currentStreakCount, currentLastHootDate) === 0;
          if (stillBroken) {
            transaction.update(docRef, { streakCount: 0 });
            console.log(`Synced broken streak for ${collection}/${documentId}: ${currentStreakCount} -> 0`);
          }
        } else {
          // lastHootDate changed or streak already reset, skip sync
          console.log(`Skipping streak sync for ${collection}/${documentId}: state changed (new message arrived or already reset)`);
        }
      });
    } catch (error) {
      // Log but don't throw - this is a background sync operation
      console.error(`Failed to sync broken streak for ${collection}/${documentId}:`, error);
    }
  }
}

/**
 * Validates and optionally syncs a streak
 * This is a convenience function that validates the streak AND syncs to Firestore if broken
 * Use this when fetching friends/groups to ensure database consistency
 * @param collection - The Firestore collection ('friendships' or 'groups')
 * @param documentId - The document ID
 * @param rawStreakCount - The raw streak count from Firestore
 * @param lastHootDate - The last hoot date from Firestore
 * @returns The validated streak count (0 if broken, original count if valid)
 */
export function validateAndSyncStreak(
  collection: 'friendships' | 'groups',
  documentId: string,
  rawStreakCount: number,
  lastHootDate: any
): number {
  const validatedStreak = validateStreak(rawStreakCount, lastHootDate);

  // If streak is broken, sync to Firestore in the background (fire-and-forget)
  if (validatedStreak === 0 && rawStreakCount > 0) {
    syncBrokenStreak(collection, documentId, rawStreakCount, lastHootDate).catch(() => {
      // Already logged in syncBrokenStreak
    });
  }

  return validatedStreak;
}

