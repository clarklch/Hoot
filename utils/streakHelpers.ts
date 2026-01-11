/**
 * Helper functions for streak validation and calculation
 */

/**
 * Validates a streak based on lastHootDate
 * A streak is broken if lastHootDate is more than 1 day ago
 * @param streakCount - The current streak count from Firestore
 * @param lastHootDate - The last date a message was sent (ISO string or null)
 * @returns The validated streak count (0 if broken, original count if valid)
 */
export function validateStreak(streakCount: number | undefined, lastHootDate: string | null | undefined): number {
  // If no lastHootDate, streak is broken (no messages sent)
  if (!lastHootDate) {
    return 0;
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const lastDate = new Date(lastHootDate);
  const todayDate = new Date(today);
  
  // Calculate day difference
  const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  // If more than 1 day has passed, streak is broken
  if (daysDiff > 1) {
    return 0;
  }

  // Streak is still valid (daysDiff === 0 or daysDiff === 1)
  // Return the original streak count
  return streakCount || 0;
}

