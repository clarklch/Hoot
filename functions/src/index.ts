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
// CRITICAL: maxInstances limits concurrency to prevent cost overruns
// Note: minInstances and region are set per-function (v2 functions require function-level config)
setGlobalOptions({
  maxInstances: 10,
});

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
            logger.warn(`Invalid/expired push token detected for user ${toUserId}. Error: ${errorMessage}`);
            logger.warn(`Token error details:`, JSON.stringify(errorDetails));
            
            // CRITICAL: Only clear token if Expo explicitly says it's invalid
            // DeviceNotRegistered means the token is permanently invalid (app uninstalled, etc.)
            // We should clear it so the app can refresh on next open
            // However, we should be conservative - only clear on definitive errors
            const isDefinitiveError = 
              errorMessage.includes("DeviceNotRegistered") ||
              errorMessage.includes("InvalidRegistrationToken") ||
              (errorDetails as any)?.error === "DeviceNotRegistered";
            
            if (isDefinitiveError) {
              try {
                // Clear the invalid token from user's document
                // This will force the app to refresh the token on next app open
                const userDocRef = admin.firestore().collection("users").doc(toUserId);
                await userDocRef.update({
                  pushToken: null,
                  pushTokenLastRefreshed: null,
                });
                logger.info(`Cleared invalid push token for user ${toUserId} (definitive error: ${errorMessage})`);
              } catch (clearError) {
                logger.error(`Error clearing invalid push token for user ${toUserId}:`, clearError);
              }
            } else {
              // For less definitive errors (like InvalidCredentials), log but don't clear
              // The token might still be valid, just had a temporary issue
              logger.warn(`Token error for user ${toUserId} is not definitive, keeping token: ${errorMessage}`);
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
// OPTIMIZED: minInstances keeps function warm to prevent cold starts (instant delivery)
// region matches Firestore location for lowest latency
export const sendHootNotification = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    minInstances: 1, // Keep warm to eliminate cold starts for instant notifications
    region: "us-central1", // Match Firestore region for lowest latency
  },
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
    
    // OPTIMIZATION: Parallelize token fetch, mute checks, and sender name fetch for minimum latency
    // This reduces sequential waits and enables faster notification delivery
    const isGroupMessage = notification.isGroupMessage || false;
    const groupId = notification.groupId || null;
    
    // Start all parallel operations immediately
    const [recipientDocPromise, friendshipMutePromise, groupMutePromise, senderDocPromise] = await Promise.allSettled([
      // 1. Fetch recipient push token
      admin.firestore().collection("users").doc(toUserId).get(),
      // 2. Check friendship mute (only if not group message)
      !isGroupMessage && toUserId && fromUserId
        ? admin.firestore()
            .collection("friendships")
            .where("userId", "==", toUserId)
            .where("friendId", "==", fromUserId)
            .where("status", "==", "accepted")
            .limit(1)
            .get()
        : Promise.resolve(null),
      // 3. Check group mute (only if group message)
      isGroupMessage && groupId && toUserId
        ? admin.firestore()
            .collection("groupMutes")
            .where("userId", "==", toUserId)
            .where("groupId", "==", groupId)
            .limit(1)
            .get()
        : Promise.resolve(null),
      // 4. Fetch sender display name (only if not provided)
      !notification.fromDisplayName && notification.fromUserId
        ? admin.firestore().collection("users").doc(notification.fromUserId).get()
        : Promise.resolve(null),
    ]);

    // CRITICAL: Always fetch push token fresh from user document
    // This ensures we get the most up-to-date token, even if it was null when notification was created
    // This is the key to guaranteeing notifications - we don't rely on stale client-provided tokens
    let pushToken: string | null = null;
    
    if (recipientDocPromise.status === 'fulfilled' && recipientDocPromise.value) {
      const recipientDoc = recipientDocPromise.value;
      
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
      if (typeof pushToken !== 'string') {
        logger.warn(`Invalid push token type for user ${toUserId}. Expected string, got ${typeof pushToken}`);
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
        await notificationDocRef.update({
          status: "pending",
          waitingForToken: true,
          failureReason: "No valid push token - invalid format, will retry when token is refreshed",
          pendingSince: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info(`⏳ Notification ${notificationId} marked as pending - invalid token format, will retry when user ${toUserId} refreshes push token`);
        return;
      }
      
      const tokenPreview = pushToken.length > 20 ? pushToken.substring(0, 20) : pushToken;
      logger.info(`✅ Valid push token found for user ${toUserId}. Token: ${tokenPreview}...`);
    } else {
      logger.error(`Error fetching recipient document for user ${toUserId}:`, recipientDocPromise.status === 'rejected' ? recipientDocPromise.reason : 'Unknown error');
      await notificationDocRef.update({
        status: "failed",
        failureReason: "Error fetching recipient user document",
      });
      return;
    }
    
    // Check mutes using parallel results (already fetched above)
    const now = new Date();
    
    // Check friendship mute (non-group messages only)
    if (!isGroupMessage && friendshipMutePromise.status === 'fulfilled' && friendshipMutePromise.value) {
      const friendshipSnapshot = friendshipMutePromise.value;
      if (!friendshipSnapshot.empty) {
        const friendshipData = friendshipSnapshot.docs[0].data();
        const mutedUntil = friendshipData.mutedUntil;
        
        if (mutedUntil) {
          const mutedUntilDate = mutedUntil.toDate ? mutedUntil.toDate() : new Date(mutedUntil);
          if (mutedUntilDate > now) {
            logger.info(`Skipping notification: Recipient ${toUserId} has muted sender ${fromUserId} until ${mutedUntilDate}`);
            // CRITICAL: Mark as skipped so cleanup function can delete it
            await notificationDocRef.update({
              status: "skipped",
              skipReason: `Recipient muted sender until ${mutedUntilDate.toISOString()}`,
              skippedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
          }
        }
      }
    }
    
    // Check group mute (group messages only)
    if (isGroupMessage && groupMutePromise.status === 'fulfilled' && groupMutePromise.value) {
      const groupMuteSnapshot = groupMutePromise.value;
      if (!groupMuteSnapshot.empty) {
        const groupMuteData = groupMuteSnapshot.docs[0].data();
        const mutedUntil = groupMuteData.mutedUntil;
        
        if (mutedUntil) {
          const mutedUntilDate = mutedUntil.toDate ? mutedUntil.toDate() : new Date(mutedUntil);
          if (mutedUntilDate > now) {
            logger.info(`Skipping notification: Recipient ${toUserId} has muted group ${groupId} until ${mutedUntilDate}`);
            // CRITICAL: Mark as skipped so cleanup function can delete it
            await notificationDocRef.update({
              status: "skipped",
              skipReason: `Recipient muted group until ${mutedUntilDate.toISOString()}`,
              skippedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
          }
        }
      }
    }
    
    // Get sender's display name from parallel fetch (or use provided)
    let fromDisplayName = notification.fromDisplayName;
    if (!fromDisplayName && senderDocPromise.status === 'fulfilled' && senderDocPromise.value) {
      const senderDoc = senderDocPromise.value;
      if (senderDoc && senderDoc.exists) {
        const senderData = senderDoc.data();
        fromDisplayName = senderData?.displayName || senderData?.username || "Someone";
      }
    }
    if (!fromDisplayName) {
      fromDisplayName = notification.fromUsername || "Someone";
    }
    
    const groupName = notification.groupName || null;
    const notificationType = notification.type || "hoot";
    
    // Create notification title based on notification type and whether it's from a group or individual
    let notificationTitle: string;
    if (notificationType === "group_deleted") {
      notificationTitle = "Group Deleted";
    } else if (notificationType === "member_left") {
      notificationTitle = "Member Left Group";
    } else if (notificationType === "member_joined") {
      notificationTitle = "New Group Member";
    } else if (isGroupMessage && groupName) {
      // Hoot from a group
      notificationTitle = `Hoot from ${groupName} - ${fromDisplayName}`;
    } else {
      // Regular hoot from individual
      notificationTitle = `Hoot from ${fromDisplayName}`;
    }
    
    // Create notification message - OPTIMIZED for real-time delivery
    // CRITICAL: This is a REMOTE push notification via Expo Push Notification Service → APNs → iOS
    // Best practices for reliable delivery:
    // 1. title + body (alert payload) - REQUIRED - ensures iOS displays even when app closed
    // 2. sound: "default" - REQUIRED - makes notification user-visible and audible
    // 3. priority: "high" - REQUIRED - APNs prioritizes for immediate delivery
    // 4. TTL: 86400 (24 hours) - CRITICAL - ensures delivery when device comes online
    //    NOTE: TTL=0 drops notifications if device is offline! Use 24h for guaranteed delivery
    // 5. _contentAvailable: true - Allows iOS to wake app for background processing
    // Standard alert notifications with high priority are ALWAYS delivered immediately by APNs
    const message = {
      to: pushToken,
      sound: "default" as const,
      title: notificationTitle,
      body: notification.message || "Hoot!",
      priority: "high" as const,
      ttl: 86400, // 24 hours - ensures delivery when device comes online (CRITICAL for offline devices)
      _contentAvailable: true, // Expo format - enables background app wake
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
    // CRITICAL: This is a REMOTE push notification via Expo Push Notification Service → APNs → iOS
    // Remote push notifications with alerts (title/body/sound) WORK when app is fully closed
    // Requirements for iOS delivery when app is closed:
    // 1. title + body (alert payload) - REQUIRED - tells iOS to display notification even when app closed
    // 2. sound - REQUIRED - ensures notification is displayed with sound
    // 3. priority: 'high' - Ensures immediate delivery via APNs
    // 4. ttl: 86400 - CRITICAL - ensures delivery when device comes online (24 hours)
    // 5. _contentAvailable: true (Expo format) - Optional - allows iOS to wake app for background data processing
    // Note: Having title/body/sound means this is a standard alert notification (not silent)
    // Standard alert notifications are ALWAYS delivered by APNs even when app is terminated
    const message = {
      to: pushToken,
      sound: "default" as const,
      title: notificationTitle,
      body: notification.message || "Hoot!",
      priority: "high" as const,
      ttl: 86400, // 24 hours - ensures delivery when device comes online (CRITICAL for offline devices)
      _contentAvailable: true, // Expo format - allows iOS to wake app for background processing (optional)
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
    // CRITICAL: This is a REMOTE push notification via Expo Push Notification Service → APNs → iOS
    // Remote push notifications with alerts (title/body/sound) WORK when app is fully closed
    // Standard alert notifications are ALWAYS delivered by APNs even when app is terminated
    try {
      await expo.sendPushNotificationsAsync([{
        to: pushToken,
        sound: "default" as const,
        title: "New Friend Request",
        body: `${requesterUsername} wants to be your friend`,
        priority: "high" as const,
        ttl: 86400, // 24 hours - ensures delivery when device comes online
        _contentAvailable: true, // Expo format - allows iOS to wake app for background processing (optional)
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
// Runs every 6 hours to delete old notification documents that have been delivered or failed
// CRITICAL: We only delete "delivered" and "failed" notifications, NOT "pending" ones!
// Pending notifications are waiting for token refresh and must be preserved for guaranteed delivery
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
    const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(
      Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 days ago
    );
    let deletedCount = 0;
    let expiredPendingCount = 0;

    try {
      // CRITICAL: Only delete delivered/failed/sent/skipped notifications older than 1 hour
      // Do NOT delete pending notifications - they are waiting for token refresh
      // This ensures guaranteed message delivery when user opens the app
      
      // Delete delivered notifications older than 1 hour
      const deliveredQuery = db
        .collection("notifications")
        .where("status", "==", "delivered")
        .where("timestamp", "<", oneHourAgo);

      const deliveredSnapshot = await deliveredQuery.get();
      
      // Delete failed notifications older than 1 hour
      const failedQuery = db
        .collection("notifications")
        .where("status", "==", "failed")
        .where("timestamp", "<", oneHourAgo);

      const failedSnapshot = await failedQuery.get();
      
      // Delete sent (but not yet verified) notifications older than 1 hour
      // These have been handed off to Expo/APNs and don't need to be tracked
      const sentQuery = db
        .collection("notifications")
        .where("status", "==", "sent")
        .where("timestamp", "<", oneHourAgo);

      const sentSnapshot = await sentQuery.get();
      
      // Delete skipped notifications older than 1 hour
      // These were skipped due to mute settings and don't need to be kept
      const skippedQuery = db
        .collection("notifications")
        .where("status", "==", "skipped")
        .where("timestamp", "<", oneHourAgo);

      const skippedSnapshot = await skippedQuery.get();

      // Combine all deletable documents
      const allDocs = [
        ...deliveredSnapshot.docs,
        ...failedSnapshot.docs,
        ...sentSnapshot.docs,
        ...skippedSnapshot.docs,
      ];

      // Process in batches of 500 (Firestore batch limit)
      for (let i = 0; i < allDocs.length; i += 500) {
        const batch = db.batch();
        const batchDocs = allDocs.slice(i, i + 500);

        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
          deletedCount++;
        });

        await batch.commit();
        logger.info(`Deleted batch of ${batchDocs.length} processed notification documents`);
      }

      // SAFETY: Delete pending notifications older than 7 days (user likely uninstalled app)
      // This prevents infinite accumulation while still giving users a week to open the app
      const expiredPendingQuery = db
        .collection("notifications")
        .where("status", "==", "pending")
        .where("timestamp", "<", sevenDaysAgo);

      const expiredPendingSnapshot = await expiredPendingQuery.get();
      
      for (let i = 0; i < expiredPendingSnapshot.docs.length; i += 500) {
        const batch = db.batch();
        const batchDocs = expiredPendingSnapshot.docs.slice(i, i + 500);

        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
          expiredPendingCount++;
        });

        await batch.commit();
        logger.info(`Deleted batch of ${batchDocs.length} expired pending notification documents`);
      }

      logger.info(`Notification cleanup completed: ${deletedCount} processed notifications deleted, ${expiredPendingCount} expired pending notifications deleted`);
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

// CRITICAL: Update recipient's streak when they receive a message
// This tracks when a user RECEIVES a hoot (not when they send one)
// Streaks reset to 0 if 24 hours pass without receiving a hoot
export const updateRecipientStreak = onDocumentCreated(
  "messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    if (!message) {
      logger.warn("No message data found");
      return;
    }

    const fromUserId = message.fromUserId;
    const toUserId = message.toUserId;
    const isGroupMessage = message.isGroupMessage || false;
    const groupId = message.groupId || null;

    if (!fromUserId || !toUserId) {
      logger.warn("Message missing fromUserId or toUserId, skipping streak update");
      return;
    }

    // Don't update streak if user sent to themselves
    if (fromUserId === toUserId) {
      return;
    }

    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // Update recipient's friendship document (tracks when they received a hoot FROM the sender)
    try {
      // Find the recipient's friendship document (userId = recipient, friendId = sender)
      const friendshipQuery = db
        .collection("friendships")
        .where("userId", "==", toUserId)
        .where("friendId", "==", fromUserId)
        .where("status", "==", "accepted")
        .limit(1);

      const friendshipSnapshot = await friendshipQuery.get();

      if (!friendshipSnapshot.empty) {
        const friendshipDoc = friendshipSnapshot.docs[0];
        const friendshipData = friendshipDoc.data();
        const lastHootDate = friendshipData.lastHootDate;
        const currentStreak = friendshipData.streakCount || 0;

        // Calculate new streak based on consecutive days model:
        // - Same day (0-24h): keep same streak (no increment)
        // - Next day (24-48h): increment streak (earned!)
        // - Streak broken (>48h): reset to 0
        let newStreakCount = 0; // Default to 0 (first hoot or broken streak)

        if (lastHootDate) {
          let lastDate: Date;
          // Parse lastHootDate - handle both ISO string and Firestore Timestamp
          if (lastHootDate.toDate) {
            lastDate = lastHootDate.toDate();
          } else if (typeof lastHootDate === 'string') {
            if (lastHootDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              lastDate = new Date(lastHootDate + 'T00:00:00.000Z');
            } else {
              lastDate = new Date(lastHootDate);
            }
          } else {
            lastDate = new Date(); // Fallback
          }

          if (!isNaN(lastDate.getTime())) {
            const timeDiff = now.toMillis() - lastDate.getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);

            if (hoursDiff <= 24) {
              // Same day hoot - keep current streak (don't increment)
              newStreakCount = currentStreak || 0;
            } else if (hoursDiff <= 48) {
              // Next day hoot (24-48h) - increment streak!
              newStreakCount = (currentStreak || 0) + 1;
            }
            // If >48 hours, streak is broken, newStreakCount stays at 0
          }
        }

        // Update recipient's friendship document with new lastHootDate and streak
        await friendshipDoc.ref.update({
          lastHootDate: now.toDate().toISOString(), // Store as ISO string for consistency
          streakCount: newStreakCount,
        });

        logger.info(`✅ Updated recipient streak: user ${toUserId} received hoot from ${fromUserId}, streak: ${newStreakCount}`);
      }
    } catch (error) {
      logger.error(`Error updating friendship streak for recipient ${toUserId}:`, error);
    }

    // Update group streak if this is a group message
    if (isGroupMessage && groupId) {
      try {
        const groupDocRef = db.collection("groups").doc(groupId);
        const groupDoc = await groupDocRef.get();

        if (groupDoc.exists) {
          const groupData = groupDoc.data();
          if (groupData) {
            const lastHootDate = groupData.lastHootDate;
            const currentStreak = groupData.streakCount || 0;

            // Calculate new streak based on consecutive days model:
            // - Same day (0-24h): keep same streak (no increment)
            // - Next day (24-48h): increment streak (earned!)
            // - Streak broken (>48h): reset to 0
            let newStreakCount = 0;

            if (lastHootDate) {
              let lastDate: Date;
              if (lastHootDate.toDate) {
                lastDate = lastHootDate.toDate();
              } else if (typeof lastHootDate === 'string') {
                if (lastHootDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  lastDate = new Date(lastHootDate + 'T00:00:00.000Z');
                } else {
                  lastDate = new Date(lastHootDate);
                }
              } else {
                lastDate = new Date();
              }

              if (!isNaN(lastDate.getTime())) {
                const timeDiff = now.toMillis() - lastDate.getTime();
                const hoursDiff = timeDiff / (1000 * 60 * 60);

                if (hoursDiff <= 24) {
                  // Same day hoot - keep current streak (don't increment)
                  newStreakCount = currentStreak || 0;
                } else if (hoursDiff <= 48) {
                  // Next day hoot (24-48h) - increment streak!
                  newStreakCount = (currentStreak || 0) + 1;
                }
                // If >48 hours, streak is broken, newStreakCount stays at 0
              }
            }

            // Update group document
            await groupDocRef.update({
              lastHootDate: now.toDate().toISOString(),
              streakCount: newStreakCount,
            });

            logger.info(`✅ Updated group streak: group ${groupId} received hoot, streak: ${newStreakCount}`);
          }
        }
      } catch (error) {
        logger.error(`Error updating group streak for group ${groupId}:`, error);
      }
    }
  }
);

// Cleanup #6: Scheduled streak reset for broken streaks
// Runs hourly to reset streakCount to 0 for friendships and groups where lastHootDate is more than 48 hours ago
// Uses consecutive days model: users have until the next day (48h window) to maintain their streak
export const resetBrokenStreaks = onSchedule(
  {
    schedule: "every 1 hours", // Run hourly
    timeZone: "America/Los_Angeles", // Adjust to your timezone
  },
  async (event) => {
    logger.info("Starting scheduled streak reset for broken streaks...");
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    let friendshipResetCount = 0;
    let groupResetCount = 0;

    try {
      // Reset broken streaks in friendships
      logger.info("Checking friendships for broken streaks...");
      const friendshipsSnapshot = await db.collection("friendships").get();
      
      let friendshipBatch = db.batch();
      let friendshipBatchCount = 0;

      for (const doc of friendshipsSnapshot.docs) {
        const data = doc.data();
        const streakCount = data.streakCount || 0;
        const lastHootDate = data.lastHootDate;

        // Skip if streak is already 0
        if (streakCount === 0) {
          continue;
        }

        // If no lastHootDate but has streak, reset to 0 (edge case from data migration)
        if (!lastHootDate) {
          friendshipBatch.update(doc.ref, { streakCount: 0 });
          friendshipBatchCount++;
          friendshipResetCount++;

          if (friendshipBatchCount >= 500) {
            await friendshipBatch.commit();
            logger.info(`Reset batch of ${friendshipBatchCount} friendship streaks`);
            friendshipBatchCount = 0;
            friendshipBatch = db.batch();
          }
          continue;
        }

        // Parse lastHootDate - handle both ISO string and Firestore Timestamp
        let lastDate: Date;
        if (lastHootDate.toDate) {
          // Firestore Timestamp
          lastDate = lastHootDate.toDate();
        } else if (typeof lastHootDate === 'string') {
          // ISO string or date-only string (YYYY-MM-DD)
          if (lastHootDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Date-only format (backward compatibility) - treat as start of that day
            lastDate = new Date(lastHootDate + 'T00:00:00.000Z');
          } else {
            lastDate = new Date(lastHootDate);
          }
        } else {
          continue; // Invalid format, skip
        }

        // Check if date is valid
        if (isNaN(lastDate.getTime())) {
          continue; // Invalid date, skip
        }

        // Calculate time difference in hours
        const timeDiff = now.toMillis() - lastDate.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // If more than 48 hours have passed, reset streak to 0
        // (Streaks use consecutive days model: users have until the next day to maintain)
        if (hoursDiff > 48) {
          friendshipBatch.update(doc.ref, { streakCount: 0 });
          friendshipBatchCount++;
          friendshipResetCount++;

          // Commit batch if we reach the Firestore batch limit (500)
          if (friendshipBatchCount >= 500) {
            await friendshipBatch.commit();
            logger.info(`Reset batch of ${friendshipBatchCount} friendship streaks`);
            friendshipBatchCount = 0;
            friendshipBatch = db.batch(); // Create new batch
          }
        }
      }

      // Commit remaining friendship updates
      if (friendshipBatchCount > 0) {
        await friendshipBatch.commit();
        logger.info(`Reset final batch of ${friendshipBatchCount} friendship streaks`);
      }

      // Reset broken streaks in groups
      logger.info("Checking groups for broken streaks...");
      const groupsSnapshot = await db.collection("groups").get();
      
      let groupBatch = db.batch();
      let groupBatchCount = 0;

      for (const doc of groupsSnapshot.docs) {
        const data = doc.data();
        const streakCount = data.streakCount || 0;
        const lastHootDate = data.lastHootDate;

        // Skip if streak is already 0
        if (streakCount === 0) {
          continue;
        }

        // If no lastHootDate but has streak, reset to 0 (edge case from data migration)
        if (!lastHootDate) {
          groupBatch.update(doc.ref, { streakCount: 0 });
          groupBatchCount++;
          groupResetCount++;

          if (groupBatchCount >= 500) {
            await groupBatch.commit();
            logger.info(`Reset batch of ${groupBatchCount} group streaks`);
            groupBatchCount = 0;
            groupBatch = db.batch();
          }
          continue;
        }

        // Parse lastHootDate - handle both ISO string and Firestore Timestamp
        let lastDate: Date;
        if (lastHootDate.toDate) {
          // Firestore Timestamp
          lastDate = lastHootDate.toDate();
        } else if (typeof lastHootDate === 'string') {
          // ISO string or date-only string (YYYY-MM-DD)
          if (lastHootDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Date-only format (backward compatibility) - treat as start of that day
            lastDate = new Date(lastHootDate + 'T00:00:00.000Z');
          } else {
            lastDate = new Date(lastHootDate);
          }
        } else {
          continue; // Invalid format, skip
        }

        // Check if date is valid
        if (isNaN(lastDate.getTime())) {
          continue; // Invalid date, skip
        }

        // Calculate time difference in hours
        const timeDiff = now.toMillis() - lastDate.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // If more than 48 hours have passed, reset streak to 0
        // (Streaks use consecutive days model: users have until the next day to maintain)
        if (hoursDiff > 48) {
          groupBatch.update(doc.ref, { streakCount: 0 });
          groupBatchCount++;
          groupResetCount++;

          // Commit batch if we reach the Firestore batch limit (500)
          if (groupBatchCount >= 500) {
            await groupBatch.commit();
            logger.info(`Reset batch of ${groupBatchCount} group streaks`);
            groupBatchCount = 0;
            groupBatch = db.batch(); // Create new batch
          }
        }
      }

      // Commit remaining group updates
      if (groupBatchCount > 0) {
        await groupBatch.commit();
        logger.info(`Reset final batch of ${groupBatchCount} group streaks`);
      }

      logger.info(`Streak reset completed: ${friendshipResetCount} friendships reset, ${groupResetCount} groups reset`);
    } catch (error) {
      logger.error("Error during streak reset:", error);
      throw error; // Re-throw to mark the function as failed
    }
  }
);
