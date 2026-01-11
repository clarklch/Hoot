/**
 * Helper functions for streak validation and calculation
 */

import { Timestamp } from 'firebase/firestore';

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
 * Validates a streak based on lastHootDate using 24-hour time windows
 * A streak is broken if lastHootDate is more than 24 hours ago (time-based, not calendar days)
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

  // If more than 24 hours have passed, streak is broken
  if (hoursDiff > 24) {
    return 0;
  }

  // Streak is still valid (within 24 hours)
  // Return the original streak count
  return streakCount || 0;
}

/**
 * Calculates the new streak count based on the time difference from last message
 * @param currentStreak - The current streak count
 * @param lastHootDate - The last timestamp a message was sent (Firestore Timestamp, ISO string, date-only string, or null)
 * @returns The new streak count (incremented if within 24 hours, reset to 1 if >24 hours)
 */
export function calculateStreak(currentStreak: number, lastHootDate: any): number {
  // If no lastHootDate, this is the first message, start at 1
  if (!lastHootDate) {
    return 1;
  }

  const lastDate = parseLastHootDate(lastHootDate);
  if (!lastDate) {
    return 1; // Invalid format, start fresh
  }

  // Check if date is valid
  if (isNaN(lastDate.getTime())) {
    return 1; // Invalid date, start fresh
  }

  const now = new Date();

  // Calculate time difference in milliseconds
  const timeDiff = now.getTime() - lastDate.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60); // Convert to hours

  // If more than 24 hours have passed, streak is broken, start at 1
  if (hoursDiff > 24) {
    return 1;
  }

  // If within 24 hours, increment the streak
  // Note: We increment even if it's been less than 24 hours since the last message
  // This allows for multiple messages in a day to maintain/increment the streak
  return (currentStreak || 0) + 1;
}

