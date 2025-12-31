/**
 * Firebase Cloud Functions for Hoot App
 * Handles push notifications for Hoots and friend requests
 */

import {setGlobalOptions} from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import {Expo} from "expo-server-sdk";
import * as logger from "firebase-functions/logger";

admin.initializeApp();

const expo = new Expo();

// Set global options for all functions
setGlobalOptions({maxInstances: 10});

// Send Hoot notifications when a notification document is created
export const sendHootNotification = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const notification = event.data?.data();
    
    if (!notification) {
      logger.warn("No notification data found");
      return;
    }
    
    const pushToken = notification.pushToken;
    const messageId = notification.messageId;
    const fromUserId = notification.fromUserId;
    const toUserId = notification.toUserId;
    
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      logger.warn("Invalid push token or not an Expo token:", pushToken);
      return;
    }
    
    // CRITICAL: Verify the push token is still valid for this user
    // This prevents sending notifications to users who have signed out
    if (toUserId) {
      try {
        const recipientDoc = await admin.firestore()
          .collection("users")
          .doc(toUserId)
          .get();
        
        if (!recipientDoc.exists) {
          logger.warn(`Recipient user ${toUserId} does not exist, skipping notification`);
          return;
        }
        
        const recipientData = recipientDoc.data();
        const currentPushToken = recipientData?.pushToken;
        
        // If the push token in the notification doesn't match the current push token,
        // the user has likely signed out or changed devices - don't send
        if (currentPushToken !== pushToken) {
          logger.info(`Push token mismatch for user ${toUserId}. User may have signed out. Skipping notification.`);
          return;
        }
      } catch (error) {
        logger.warn("Error verifying push token:", error);
        // Fail open - continue with sending if verification fails
      }
    }
    
    // Check if recipient has muted the sender
    // When User A mutes User B, the friendship document is: userId=A, friendId=B, mutedUntil=date
    // When User B sends to User A, we check: userId=A, friendId=B to see if A muted B
    if (toUserId && fromUserId) {
      try {
        const friendshipQuery = admin.firestore()
          .collection("friendships")
          .where("userId", "==", toUserId)
          .where("friendId", "==", fromUserId)
          .where("status", "==", "accepted")
          .limit(1);
        
        const friendshipSnapshot = await friendshipQuery.get();
        
        if (!friendshipSnapshot.empty) {
          const friendshipData = friendshipSnapshot.docs[0].data();
          const mutedUntil = friendshipData.mutedUntil;
          
          if (mutedUntil) {
            const mutedUntilDate = mutedUntil.toDate ? mutedUntil.toDate() : new Date(mutedUntil);
            const now = new Date();
            
            // If mute hasn't expired, don't send notification
            if (mutedUntilDate > now) {
              logger.info(`Skipping notification: Recipient ${toUserId} has muted sender ${fromUserId} until ${mutedUntilDate}`);
              return;
            }
          }
        }
      } catch (error) {
        logger.warn("Error checking mute status in Cloud Function:", error);
        // Continue with sending notification if mute check fails (fail open)
      }
    }
    
    // Get sender's display name (prefer fromDisplayName, fallback to fetching from user doc)
    let fromDisplayName = notification.fromDisplayName;
    if (!fromDisplayName && notification.fromUserId) {
      try {
        const senderDoc = await admin.firestore()
          .collection("users")
          .doc(notification.fromUserId)
          .get();
        const senderData = senderDoc.data();
        fromDisplayName = senderData?.displayName || senderData?.username || "Someone";
      } catch (error) {
        logger.warn("Error fetching sender display name:", error);
        fromDisplayName = notification.fromUsername || "Someone";
      }
    }
    
    // Check if this is a group message
    const isGroupMessage = notification.isGroupMessage || false;
    const groupName = notification.groupName || null;
    
    // Create notification title based on whether it's from a group or individual
    let notificationTitle: string;
    if (isGroupMessage && groupName) {
      notificationTitle = `Hoot from ${groupName} - ${fromDisplayName}`;
    } else {
      notificationTitle = `Hoot from ${fromDisplayName}`;
    }
    
    // Create notification message
    const message = {
      to: pushToken,
      sound: "default" as const,
      title: notificationTitle,
      body: notification.message || "Hoot!",
      data: {
        type: "hoot",
        messageId: messageId,
        message: notification.message,
        fromUserId: notification.fromUserId,
        fromUsername: notification.fromUsername,
        fromDisplayName: fromDisplayName,
        groupId: notification.groupId || null,
        groupName: groupName,
        isGroupMessage: isGroupMessage,
      },
    };

    // Send notification
    try {
      const result = await expo.sendPushNotificationsAsync([message]);
      logger.info("Notification sent successfully:", result);
    } catch (error) {
      logger.error("Error sending notification:", error);
    }
  }
);

// Send friend request notifications
export const sendFriendRequestNotification = onDocumentCreated(
  "friendships/{friendshipId}",
  async (event) => {
    const friendship = event.data?.data();
    
    if (!friendship) {
      logger.warn("No friendship data found");
      return;
    }
    
    if (friendship.status !== "pending") {
      return;
    }

    // Get the friend's user data
    const friendDoc = await admin.firestore()
      .collection("users")
      .doc(friendship.friendId)
      .get();

    if (!friendDoc.exists) {
      logger.warn("Friend document does not exist:", friendship.friendId);
      return;
    }

    const friendData = friendDoc.data();
    const pushToken = friendData?.pushToken;

    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      logger.warn("No valid push token for friend:", friendship.friendId);
      return;
    }

    // Get requester's username
    const requesterDoc = await admin.firestore()
      .collection("users")
      .doc(friendship.userId)
      .get();

    const requesterData = requesterDoc.data();
    const requesterUsername = requesterData?.username || 
                               requesterData?.displayName || 
                               "Someone";

    // Send notification
    try {
      await expo.sendPushNotificationsAsync([{
        to: pushToken,
        sound: "default" as const,
        title: "New Friend Request",
        body: `${requesterUsername} wants to be your friend`,
        data: {
          type: "friend_request",
          friendshipId: event.params.friendshipId,
          fromUserId: friendship.userId,
        },
      }]);
      logger.info("Friend request notification sent successfully");
    } catch (error) {
      logger.error("Error sending friend request notification:", error);
    }
  }
);

// ========================================================================
// CLEANUP FUNCTIONS
// ========================================================================

// Cleanup #1: Scheduled message cleanup (expired and viewed messages)
// Runs every hour to clean up messages that have expired (24+ hours old) or been viewed
export const cleanupMessages = onSchedule(
  {
    schedule: "every 1 hours", // Run every hour
    timeZone: "America/Los_Angeles", // Adjust to your timezone
  },
  async (event) => {
    logger.info("Starting scheduled message cleanup...");
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    let expiredCount = 0;
    let viewedCount = 0;

    try {
      // Clean up expired messages (expiresAt < now)
      const expiredQuery = db
        .collection("messages")
        .where("expiresAt", "<", now);

      const expiredSnapshot = await expiredQuery.get();
      const expiredDocs = expiredSnapshot.docs;

      // Process in batches of 500 (Firestore batch limit)
      for (let i = 0; i < expiredDocs.length; i += 500) {
        const batch = db.batch();
        const batchDocs = expiredDocs.slice(i, i + 500);

        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
          expiredCount++;
        });

        await batch.commit();
        logger.info(`Deleted batch of ${batchDocs.length} expired messages`);
      }

      logger.info(`Cleaned up ${expiredCount} expired messages`);

      // Clean up viewed messages (viewed === true)
      const viewedQuery = db
        .collection("messages")
        .where("viewed", "==", true);

      const viewedSnapshot = await viewedQuery.get();
      const viewedDocs = viewedSnapshot.docs;

      // Process in batches of 500 (Firestore batch limit)
      for (let i = 0; i < viewedDocs.length; i += 500) {
        const batch = db.batch();
        const batchDocs = viewedDocs.slice(i, i + 500);

        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
          viewedCount++;
        });

        await batch.commit();
        logger.info(`Deleted batch of ${batchDocs.length} viewed messages`);
      }

      logger.info(`Cleaned up ${viewedCount} viewed messages`);
      logger.info(`Message cleanup completed: ${expiredCount} expired, ${viewedCount} viewed`);
    } catch (error) {
      logger.error("Error during message cleanup:", error);
      throw error; // Re-throw to mark the function as failed
    }
  }
);

// Cleanup #2: Scheduled group mute cleanup (expired group mutes)
// Runs every hour to clear expired group mutes from the groupMutes collection
export const cleanupGroupMutes = onSchedule(
  {
    schedule: "every 1 hours", // Run every hour
    timeZone: "America/Los_Angeles", // Adjust to your timezone
  },
  async (event) => {
    logger.info("Starting scheduled group mute cleanup...");
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    let clearedCount = 0;

    try {
      // Query all group mutes that have expired (mutedUntil < now and mutedUntil is not null)
      const expiredMutesQuery = db
        .collection("groupMutes")
        .where("mutedUntil", "<", now);

      const expiredSnapshot = await expiredMutesQuery.get();
      const expiredDocs = expiredSnapshot.docs;

      // Process in batches of 500 (Firestore batch limit)
      for (let i = 0; i < expiredDocs.length; i += 500) {
        const batch = db.batch();
        const batchDocs = expiredDocs.slice(i, i + 500);

        batchDocs.forEach((doc) => {
          // Clear the mute by setting mutedUntil to null (don't delete the document)
          batch.update(doc.ref, {
            mutedUntil: null,
          });
          clearedCount++;
        });

        await batch.commit();
        logger.info(`Cleared batch of ${batchDocs.length} expired group mutes`);
      }

      logger.info(`Group mute cleanup completed: ${clearedCount} expired mutes cleared`);
    } catch (error) {
      logger.error("Error during group mute cleanup:", error);
      throw error; // Re-throw to mark the function as failed
    }
  }
);

// Cleanup #3: Scheduled notification document cleanup
// Runs every 6 hours to delete old notification documents that have already been sent
// Notifications are created when sending hoots, and after the Cloud Function sends the push notification,
// the document is no longer needed. We delete documents older than 1 hour to ensure they've been processed.
export const cleanupNotifications = onSchedule(
  {
    schedule: "every 6 hours", // Run every 6 hours
    timeZone: "America/Los_Angeles", // Adjust to your timezone
  },
  async (event) => {
    logger.info("Starting scheduled notification cleanup...");
    const db = admin.firestore();
    const oneHourAgo = admin.firestore.Timestamp.fromMillis(
      Date.now() - 60 * 60 * 1000 // 1 hour ago
    );
    let deletedCount = 0;

    try {
      // Query all notification documents older than 1 hour
      // This ensures they've had time to be processed by the sendHootNotification function
      const oldNotificationsQuery = db
        .collection("notifications")
        .where("timestamp", "<", oneHourAgo);

      const oldSnapshot = await oldNotificationsQuery.get();
      const oldDocs = oldSnapshot.docs;

      // Process in batches of 500 (Firestore batch limit)
      for (let i = 0; i < oldDocs.length; i += 500) {
        const batch = db.batch();
        const batchDocs = oldDocs.slice(i, i + 500);

        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
          deletedCount++;
        });

        await batch.commit();
        logger.info(`Deleted batch of ${batchDocs.length} old notification documents`);
      }

      logger.info(`Notification cleanup completed: ${deletedCount} old notifications deleted`);
    } catch (error) {
      logger.error("Error during notification cleanup:", error);
      throw error; // Re-throw to mark the function as failed
    }
  }
);

// Cleanup #4: Scheduled deferred missed messages cleanup
// Runs daily to delete old viewed deferred missed messages entries
// These entries track missed messages when users choose to view them later.
// After viewing, entries are marked viewed: true but not deleted, so we clean them up.
export const cleanupDeferredMissedMessages = onSchedule(
  {
    schedule: "every 24 hours", // Run daily
    timeZone: "America/Los_Angeles", // Adjust to your timezone
  },
  async (event) => {
    logger.info("Starting scheduled deferred missed messages cleanup...");
    const db = admin.firestore();
    const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(
      Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 days ago
    );
    let deletedCount = 0;

    try {
      // Query all deferred missed messages that are viewed and older than 7 days
      // We keep them for 7 days in case we need to debug or audit, then delete
      const viewedDeferredQuery = db
        .collection("deferredMissedMessages")
        .where("viewed", "==", true);

      const viewedSnapshot = await viewedDeferredQuery.get();
      const viewedDocs = viewedSnapshot.docs;

      // Filter to only include documents older than 7 days
      // We check createdAt or timestamp field if it exists
      const oldDocs = viewedDocs.filter((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt || data.timestamp;
        if (!createdAt) {
          // If no timestamp, assume it's old and delete it
          return true;
        }
        const createdAtDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        const sevenDaysAgoDate = sevenDaysAgo.toDate();
        return createdAtDate < sevenDaysAgoDate;
      });

      // Process in batches of 500 (Firestore batch limit)
      for (let i = 0; i < oldDocs.length; i += 500) {
        const batch = db.batch();
        const batchDocs = oldDocs.slice(i, i + 500);

        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
          deletedCount++;
        });

        await batch.commit();
        logger.info(`Deleted batch of ${batchDocs.length} old deferred missed messages`);
      }

      logger.info(`Deferred missed messages cleanup completed: ${deletedCount} old entries deleted`);
    } catch (error) {
      logger.error("Error during deferred missed messages cleanup:", error);
      throw error; // Re-throw to mark the function as failed
    }
  }
);
