// Service to handle message cleanup (24-hour expiration and viewed messages)
import { collection, query, where, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Clean up expired messages (older than 24 hours)
export async function cleanupExpiredMessages() {
  try {
    const now = Timestamp.now();
    const expiredQuery = query(
      collection(db, 'messages'),
      where('expiresAt', '<', now)
    );

    const snapshot = await getDocs(expiredQuery);
    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);

    console.log(`Cleaned up ${snapshot.docs.length} expired messages`);
  } catch (error) {
    console.error('Error cleaning up expired messages:', error);
  }
}

// Clean up viewed messages
export async function cleanupViewedMessages() {
  try {
    const viewedQuery = query(
      collection(db, 'messages'),
      where('viewed', '==', true)
    );

    const snapshot = await getDocs(viewedQuery);
    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);

    console.log(`Cleaned up ${snapshot.docs.length} viewed messages`);
  } catch (error) {
    console.error('Error cleaning up viewed messages:', error);
  }
}

// Mark message as viewed (will be deleted on next cleanup)
export async function markMessageAsViewed(messageId: string) {
  try {
    // Messages are deleted immediately when dismissed, but this is a backup
    // In case the deletion fails, we mark it as viewed for cleanup
    await deleteDoc(doc(db, 'messages', messageId));
  } catch (error) {
    console.error('Error marking message as viewed:', error);
  }
}

// Run cleanup periodically (call this from your app initialization)
export function startMessageCleanup() {
  // Clean up every hour
  setInterval(() => {
    cleanupExpiredMessages();
    cleanupViewedMessages();
  }, 60 * 60 * 1000); // 1 hour

  // Also run immediately
  cleanupExpiredMessages();
  cleanupViewedMessages();
}

