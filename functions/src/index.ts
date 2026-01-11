/**
 * Firebase Cloud Functions for Hoot App
 * Handles push notifications for Hoots and friend requests
 */

import {setGlobalOptions} from "firebase-functions";
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import {Expo} from "expo-server-sdk";
import * as logger from "firebase-functions/logger";

admin.initializeApp();

const expo = new Expo();

// Set global options for all functions
setGlobalOptions({maxInstances: 10});

// Helper function to retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors (e.g., invalid token)
      if (error?.message?.includes("InvalidCredentials") || 
          error?.message?.includes("DeviceNotRegistered") ||
          error?.message?.includes("invalid")) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        logger.info(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

// Helper function to check push notification receipts and update status
async function checkReceiptAndUpdateStatus(
  notificationDocRef: admin.firestore.DocumentReference,
  receiptId: string
): Promise<void> {
  const MAX_RETRY_COUNT = 3;
  const INITIAL_RECEIPT_CHECK_DELAY = 5000; // Initial delay: 5 seconds
  
  // Use loop instead of recursion to avoid stack overflow risks
  for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
    // Exponential backoff: 5s, 10s, 20s, 40s
    const delay = INITIAL_RECEIPT_CHECK_DELAY * Math.pow(2, attempt);
    
    if (attempt > 0) {
      logger.info(`Receipt ${receiptId} check attempt ${attempt + 1}/${MAX_RETRY_COUNT + 1}, waiting ${delay}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      // Check receipt status
      const receipts = await expo.getPushNotificationReceiptsAsync([receiptId]);
      const receipt = receipts[receiptId];
      
      if (!receipt) {
        // Receipt not available yet
        if (attempt < MAX_RETRY_COUNT) {
          logger.info(`Receipt ${receiptId} not available yet, will retry`);
          continue; // Retry in next iteration
        } else {
          // Max retries reached, receipt still not available
          logger.warn(`Receipt ${receiptId} not available after ${MAX_RETRY_COUNT + 1} attempts, marking as sent (assuming delivery)`);
          
          // Only update if status is still "sent" (avoid race conditions)
          const currentDoc = await notificationDocRef.get();
          const currentData = currentDoc.data();
          if (currentData?.status === "sent") {
            await notificationDocRef.update({
              checkedAt: admin.firestore.FieldValue.serverTimestamp(),
              // Note: We keep status as "sent" since we can't confirm delivery
            });
          }
          return;
        }
      }
      
      // Receipt status: 'ok' means delivered, 'error' means failed
      if (receipt.status === "ok") {
        logger.info(`Notification delivered successfully (receipt: ${receiptId})`);
        
        // Only update if status is still "sent" (avoid race conditions)
        const currentDoc = await notificationDocRef.get();
        const currentData = currentDoc.data();
        if (currentData?.status === "sent") {
          await notificationDocRef.update({
            status: "delivered",
            deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          logger.info(`Notification status already changed to ${currentData?.status}, skipping update`);
        }
        return; // Success, exit function
      } else {
        // Receipt shows an error
        const errorMessage = (receipt as any).message || "Unknown error";
        const errorDetails = (receipt as any).details || {};
        logger.warn(`Notification delivery failed (receipt: ${receiptId}): ${errorMessage}`, errorDetails);
        
        // CRITICAL: Check if error is due to invalid/expired token
        // Common Expo errors for invalid tokens:
        // - "DeviceNotRegistered" - token is invalid/expired
        // - "InvalidCredentials" - token format is invalid
        // - "MessageTooBig" - not a token issue, but handled below
        // - "MessageRateExceeded" - not a token issue, but handled below
        const isTokenError = 
          errorMessage.includes("DeviceNotRegistered") ||
          errorMessage.includes("InvalidCredentials") ||
          errorMessage.includes("NotRegistered") ||
          errorMessage.includes("InvalidRegistrationToken") ||
          (errorDetails as any)?.error === "DeviceNotRegistered";
        
        if (isTokenError) {
          // Get the notification data to find the recipient user ID
          const currentDoc = await notificationDocRef.get();
          const notificationData = currentDoc.data();
          const toUserId = notificationData?.toUserId;
          
          if (toUserId) {
            logger.warn(`Invalid/expired push token detected for user ${toUserId}. Clearing token from Firestore.`);
            
            try {
              // Clear the invalid token from user's document
              // This will force the app to refresh the token on next app open
              const userDocRef = admin.firestore().collection("users").doc(toUserId);
              await userDocRef.update({
                pushToken: null,
                pushTokenLastRefreshed: null,
              });
              logger.info(`Cleared invalid push token for user ${toUserId}`);
            } catch (clearError) {
              logger.error(`Error clearing invalid push token for user ${toUserId}:`, clearError);
            }
          }
        }
        
        // Only update if status is still "sent" (avoid race conditions)
        const currentDoc = await notificationDocRef.get();
        const currentData = currentDoc.data();
        if (currentData?.status === "sent") {
          await notificationDocRef.update({
            status: "failed",
            failureReason: errorMessage,
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          logger.info(`Notification status already changed to ${currentData?.status}, skipping update`);
        }
        return; // Error confirmed, exit function
      }
    } catch (error) {
      // Error checking receipt (network error, etc.)
      logger.error(`Error checking receipt ${receiptId} (attempt ${attempt + 1}):`, error);
      
      if (attempt < MAX_RETRY_COUNT) {
        // Retry on next iteration
        continue;
      } else {
        // Max retries reached, give up
        logger.error(`Failed to check receipt ${receiptId} after ${MAX_RETRY_COUNT + 1} attempts, keeping status as "sent"`);
        // Don't update status - keep as "sent" since we can't confirm either way
        return;
      }
    }
  }
}

// Send Hoot notifications when a notification document is created
export const sendHootNotification = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const notificationDocRef = event.data?.ref;
    const notification = event.data?.data();
    
    if (!notification || !notificationDocRef) {
      logger.warn("No notification data found");
      return;
    }
    
    const notificationId = event.params.notificationId;
    const messageId = notification.messageId;
    const fromUserId = notification.fromUserId;
    const toUserId = notification.toUserId;
    
    if (!toUserId) {
      logger.warn("No toUserId in notification, skipping");
      return;
    }
    
    // DUPLICATE PREVENTION: Check if notification was already sent
    // Status can be: undefined/null (pending), "sent", "delivered", "failed"
    // Note: onDocumentCreated only fires once per document, so we don't need complex locking
    // However, we check status to handle edge cases (e.g., document updated externally)
    const currentStatus = notification.status;
    if (currentStatus === "delivered") {
      logger.info(`Notification ${notificationId} already delivered, skipping duplicate send`);
      return;
    }
    if (currentStatus === "sent") {
      logger.info(`Notification ${notificationId} already sent (status: sent), skipping duplicate send`);
      return;
    }
    
    // CRITICAL: Always fetch push token fresh from user document
    // This ensures we get the most up-to-date token, even if it was null when notification was created
    // This is the key to guaranteeing notifications - we don't rely on stale client-provided tokens
    let pushToken: string | null = null;
    try {
      const recipientDoc = await admin.firestore()
        .collection("users")
        .doc(toUserId)
        .get();
      
      if (!recipientDoc.exists) {
        logger.warn(`Recipient user ${toUserId} does not exist, skipping notification`);
        await notificationDocRef.update({
          status: "failed",
          failureReason: "Recipient user does not exist",
        });
        return;
      }
      
      const recipientData = recipientDoc.data();
      pushToken = recipientData?.pushToken || null;
      
      // Enhanced logging to diagnose token issues
      if (!pushToken) {
        logger.warn(`No push token found for user ${toUserId}. pushToken field: ${typeof recipientData?.pushToken}, value: ${JSON.stringify(recipientData?.pushToken)}`);
        logger.warn(`User document exists: ${recipientDoc.exists}, has pushTokenLastRefreshed: ${!!recipientData?.pushTokenLastRefreshed}`);
        // CRITICAL: Mark as "pending" instead of "failed" when token is missing
        // This allows retry when user refreshes their token (guarantees delivery)
        await notificationDocRef.update({
          status: "pending",
          waitingForToken: true, // Flag to identify notifications waiting for token refresh
          failureReason: "No valid push token - token not registered, will retry when token is refreshed",
          pendingSince: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info(`⏳ Notification ${notificationId} marked as pending - will retry when user ${toUserId} refreshes push token`);
        return;
      }
      
      // Type guard: ensure pushToken is a string before checking format
      // Type guard: ensure pushToken is a string
      if (typeof pushToken !== 'string') {
        logger.warn(`Invalid push token type for user ${toUserId}. Expected string, got ${typeof pushToken}`);
        // Mark as pending to allow retry when valid token is registered
        await notificationDocRef.update({
          status: "pending",
          waitingForToken: true,
          failureReason: "No valid push token - invalid type, will retry when token is refreshed",
          pendingSince: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info(`⏳ Notification ${notificationId} marked as pending - invalid token type, will retry when user ${toUserId} refreshes push token`);
        return;
      }
      
      // Validate token format
      const isValidToken = Expo.isExpoPushToken(pushToken);
      if (!isValidToken) {
        const tokenPreview = pushToken.length > 20 ? pushToken.substring(0, 20) : pushToken;
        logger.warn(`Invalid push token format for user ${toUserId}. Token: ${tokenPreview}...`);
        // Mark as pending to allow retry when valid token is registered
        await notificationDocRef.update({
          status: "pending",
          waitingForToken: true,
          failureReason: "No valid push token - invalid format, will retry when token is refreshed",
          pendingSince: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info(`⏳ Notification ${notificationId} marked as pending - invalid token format, will retry when user ${toUserId} refreshes push token`);
        return;
      }
      
      // Token is valid - log success
      const tokenPreview = pushToken.length > 20 ? pushToken.substring(0, 20) : pushToken;
      logger.info(`✅ Valid push token found for user ${toUserId}. Token: ${tokenPreview}...`);
    } catch (error) {
      logger.error(`Error fetching push token for user ${toUserId}:`, error);
      await notificationDocRef.update({
        status: "failed",
        failureReason: `Error fetching push token: ${error}`,
      });
      return;
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
    
    // Check for group mutes (if this is a group message)
    if (notification.isGroupMessage && notification.groupId && toUserId) {
      try {
        const groupMuteQuery = admin.firestore()
          .collection("groupMutes")
          .where("userId", "==", toUserId)
          .where("groupId", "==", notification.groupId)
          .limit(1);
        
        const groupMuteSnapshot = await groupMuteQuery.get();
        
        if (!groupMuteSnapshot.empty) {
          const groupMuteData = groupMuteSnapshot.docs[0].data();
          const mutedUntil = groupMuteData.mutedUntil;
          
          if (mutedUntil) {
            const mutedUntilDate = mutedUntil.toDate ? mutedUntil.toDate() : new Date(mutedUntil);
            const now = new Date();
            
            // If mute hasn't expired, don't send notification
            if (mutedUntilDate > now) {
              logger.info(`Skipping notification: Recipient ${toUserId} has muted group ${notification.groupId} until ${mutedUntilDate}`);
              return;
            }
          }
        }
      } catch (error) {
        logger.warn("Error checking group mute status in Cloud Function:", error);
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
    // _contentAvailable: true allows iOS to wake the app in the background when closed
    // priority: 'high' ensures the notification is delivered immediately
    const message = {
      to: pushToken,
      sound: "default" as const,
      title: notificationTitle,
      body: notification.message || "Hoot!",
      priority: "high" as const,
      _contentAvailable: true, // Required for background notifications when app is closed
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

    // Send notification with retry logic for reliability
    // CRITICAL: Only retry on actual send failures, not on delivery failures
    // Delivery status is checked separately via receipts
    try {
      const tickets = await retryWithBackoff(
        () => expo.sendPushNotificationsAsync([message]),
        3, // 3 retries for sending (network errors, API failures)
        1000 // Start with 1 second delay
      );
      
      if (!tickets || tickets.length === 0) {
        throw new Error("No tickets returned from Expo push service");
      }
      
      const ticket = tickets[0];
      
      // Tickets can be success (has 'id') or error (has 'message')
      // Type guard to check if ticket has an id (success ticket)
      if ('id' in ticket && ticket.id) {
        const receiptId = ticket.id as string;
        
        // Update notification document with status and receipt ID
        await notificationDocRef.update({
          status: "sent",
          receiptId: receiptId,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        logger.info(`Notification sent successfully to ${toUserId} (messageId: ${messageId}, receiptId: ${receiptId})`);
        
        // Check receipt asynchronously (don't await - let it run in background)
        // This verifies delivery status and updates the notification document
        checkReceiptAndUpdateStatus(notificationDocRef, receiptId).catch((error) => {
          logger.error(`Error in receipt check for ${receiptId}:`, error);
        });
      } else {
        // Ticket indicates an error during send
        const errorMessage = ('message' in ticket ? ticket.message : 'Unknown error') || 'Unknown error';
        logger.error(`Notification send failed immediately for ${toUserId} (messageId: ${messageId}): ${errorMessage}`);
        
        await notificationDocRef.update({
          status: "failed",
          failureReason: errorMessage,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      
    } catch (error: any) {
      logger.error(`Failed to send notification to ${toUserId} (messageId: ${messageId}) after retries:`, error);
      
      // Update notification document with failure status
      await notificationDocRef.update({
        status: "failed",
        failureReason: error?.message || "Unknown error",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

// Helper function to retry a pending notification (used when push token is refreshed)
async function retryPendingNotification(
  notificationDocRef: admin.firestore.DocumentReference,
  pushToken: string
): Promise<void> {
  try {
    const notificationDoc = await notificationDocRef.get();
    if (!notificationDoc.exists) {
      logger.warn(`Notification ${notificationDocRef.id} does not exist, skipping retry`);
      return;
    }

    const notification = notificationDoc.data();
    if (!notification) {
      logger.warn(`Notification ${notificationDocRef.id} has no data, skipping retry`);
      return;
    }

    // Only retry if status is "pending" and waitingForToken is true
    if (notification.status !== "pending" || !notification.waitingForToken) {
      logger.info(`Notification ${notificationDocRef.id} is not pending (status: ${notification.status}), skipping retry`);
      return;
    }

    const messageId = notification.messageId;
    const fromUserId = notification.fromUserId;
    const toUserId = notification.toUserId;
    const fromDisplayName = notification.fromDisplayName;
    const isGroupMessage = notification.isGroupMessage || false;
    const groupName = notification.groupName || null;

    if (!toUserId || !pushToken) {
      logger.warn(`Invalid notification data for ${notificationDocRef.id}, skipping retry`);
      return;
    }

    // Get sender's display name (prefer fromDisplayName, fallback to fetching from user doc)
    let displayName = fromDisplayName;
    if (!displayName && fromUserId) {
      try {
        const senderDoc = await admin.firestore()
          .collection("users")
          .doc(fromUserId)
          .get();
        const senderData = senderDoc.data();
        displayName = senderData?.displayName || senderData?.username || "Someone";
      } catch (error) {
        logger.warn("Error fetching sender display name for retry:", error);
        displayName = notification.fromUsername || "Someone";
      }
    }

    // Create notification title based on whether it's from a group or individual
    let notificationTitle: string;
    if (isGroupMessage && groupName) {
      notificationTitle = `Hoot from ${groupName} - ${displayName}`;
    } else {
      notificationTitle = `Hoot from ${displayName}`;
    }

    // Create notification message
    const message = {
      to: pushToken,
      sound: "default" as const,
      title: notificationTitle,
      body: notification.message || "Hoot!",
      priority: "high" as const,
      _contentAvailable: true,
      data: {
        type: "hoot",
        messageId: messageId,
        message: notification.message,
        fromUserId: notification.fromUserId,
        fromUsername: notification.fromUsername,
        fromDisplayName: displayName,
        groupId: notification.groupId || null,
        groupName: groupName,
        isGroupMessage: isGroupMessage,
      },
    };

    // Send notification with retry logic
    try {
      const tickets = await retryWithBackoff(
        () => expo.sendPushNotificationsAsync([message]),
        3,
        1000
      );

      if (!tickets || tickets.length === 0) {
        throw new Error("No tickets returned from Expo push service");
      }

      const ticket = tickets[0];

      if ('id' in ticket && ticket.id) {
        const receiptId = ticket.id as string;

        // Update notification document with status and receipt ID
        await notificationDocRef.update({
          status: "sent",
          receiptId: receiptId,
          waitingForToken: admin.firestore.FieldValue.delete(), // Remove waiting flag
          pendingSince: admin.firestore.FieldValue.delete(), // Remove pending timestamp
          retriedAt: admin.firestore.FieldValue.serverTimestamp(),
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info(`✅ Pending notification ${notificationDocRef.id} retried successfully (receiptId: ${receiptId})`);

        // Check receipt asynchronously
        checkReceiptAndUpdateStatus(notificationDocRef, receiptId).catch((error) => {
          logger.error(`Error in receipt check for ${receiptId}:`, error);
        });
      } else {
        // Ticket indicates an error during send
        const errorMessage = ('message' in ticket ? ticket.message : 'Unknown error') || 'Unknown error';
        logger.error(`Notification retry failed immediately for ${notificationDocRef.id}: ${errorMessage}`);

        await notificationDocRef.update({
          status: "failed",
          failureReason: errorMessage,
          waitingForToken: admin.firestore.FieldValue.delete(),
          pendingSince: admin.firestore.FieldValue.delete(),
          retriedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error: any) {
      logger.error(`Failed to retry pending notification ${notificationDocRef.id} after retries:`, error);

      await notificationDocRef.update({
        status: "failed",
        failureReason: error?.message || "Unknown error",
        waitingForToken: admin.firestore.FieldValue.delete(),
        pendingSince: admin.firestore.FieldValue.delete(),
        retriedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    logger.error(`Error in retryPendingNotification for ${notificationDocRef.id}:`, error);
  }
}

// CRITICAL: Retry pending notifications when a user's push token is refreshed
// This ensures notifications are delivered when user opens app after token expiration
export const retryPendingNotificationsOnTokenRefresh = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    const userId = event.params.userId;

    if (!beforeData || !afterData) {
      logger.warn(`No data for user ${userId} update, skipping retry check`);
      return;
    }

    // Check if push token was just set (changed from null/undefined to a value)
    const beforeToken = beforeData?.pushToken || null;
    const afterToken = afterData?.pushToken || null;

    // Only retry if token was just set (not cleared)
    if (!afterToken || afterToken === beforeToken) {
      // Token unchanged or cleared, no need to retry
      return;
    }

    // Token was just set, find all pending notifications waiting for this user's token
    logger.info(`🔄 Push token refreshed for user ${userId}, checking for pending notifications to retry...`);

    try {
      const pendingNotificationsQuery = admin.firestore()
        .collection("notifications")
        .where("toUserId", "==", userId)
        .where("status", "==", "pending")
        .where("waitingForToken", "==", true);

      const pendingSnapshot = await pendingNotificationsQuery.get();

      if (pendingSnapshot.empty) {
        logger.info(`No pending notifications found for user ${userId}`);
        return;
      }

      logger.info(`Found ${pendingSnapshot.size} pending notifications for user ${userId}, retrying...`);

      // Retry all pending notifications with the new token
      const retryPromises = pendingSnapshot.docs.map((doc) => {
        return retryPendingNotification(doc.ref, afterToken);
      });

      await Promise.all(retryPromises);

      logger.info(`✅ Retry completed for ${pendingSnapshot.size} pending notifications for user ${userId}`);
    } catch (error) {
      logger.error(`Error retrying pending notifications for user ${userId}:`, error);
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

    // CRITICAL: Verify the push token is still valid for this user
    // This prevents sending notifications to users who have signed out
    // If pushToken is null or invalid, the user has signed out - don't send
    if (!pushToken || pushToken === null || !Expo.isExpoPushToken(pushToken)) {
      logger.info(`Push token is null or invalid for user ${friendship.friendId}. User may have signed out. Skipping friend request notification.`);
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
    // _contentAvailable: true allows iOS to wake the app in the background when closed
    // priority: 'high' ensures the notification is delivered immediately
    try {
      await expo.sendPushNotificationsAsync([{
        to: pushToken,
        sound: "default" as const,
        title: "New Friend Request",
        body: `${requesterUsername} wants to be your friend`,
        priority: "high" as const,
        _contentAvailable: true, // Required for background notifications when app is closed
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

// Cleanup #4: Scheduled push token cleanup for inactive users
// Runs every 6 hours to clear push tokens from users who haven't been active recently
// This prevents notifications from being sent to old test accounts or inactive users
export const cleanupInactivePushTokens = onSchedule(
  {
    schedule: "every 6 hours", // Run every 6 hours
    timeZone: "America/Los_Angeles", // Adjust to your timezone
  },
  async (event) => {
    logger.info("Starting scheduled push token cleanup for inactive users...");
    // Note: This is a placeholder function. The main cleanup happens in the client
    // when users sign in (registerForPushNotifications clears tokens from other users).
    // This can be enhanced in the future to track user activity and clear tokens
    // from users who haven't been active recently.
    logger.info("Push token cleanup: Main cleanup handled by client on sign-in");
    logger.info("Push token cleanup completed (placeholder - can be enhanced)");
  }
);

// Cleanup #5: Scheduled deferred missed messages cleanup
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
