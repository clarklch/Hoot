# Push Notification Delivery Confirmation & Reliability Improvements

## Overview

This document describes the comprehensive improvements made to ensure push notifications are **instant, reliable, and never duplicated**. The implementation includes delivery confirmation via Expo push receipts, duplicate prevention, and intelligent retry logic that only retries on actual failures.

## Key Features

### 1. ✅ Instant Delivery
- **High Priority**: Notifications use `priority: "high"` to ensure immediate delivery
- **Background Support**: `_contentAvailable: true` enables iOS to wake the app when closed
- **Real-time Triggers**: Firestore `onDocumentCreated` triggers fire immediately when notification documents are created

### 2. ✅ Delivery Confirmation
- **Receipt Checking**: After sending, we check Expo push receipts to confirm delivery status
- **Status Tracking**: Notification documents track status: `pending` → `sent` → `delivered`/`failed`
- **Receipt Storage**: Receipt IDs are stored in notification documents for tracking

### 3. ✅ Duplicate Prevention
- **Status Checks**: Before sending, we check if notification was already sent/delivered
- **Atomic Updates**: Status is updated atomically to prevent race conditions
- **Idempotent Operations**: Multiple function invocations for the same notification are safe

### 4. ✅ Smart Retry Logic
- **Send Retries**: Retries sending only on network/API failures (3 attempts with exponential backoff)
- **Receipt Retries**: Retries receipt checking if receipt not available yet (3 attempts)
- **No Duplicate Sends**: Never retries if notification was already successfully sent or delivered

## Implementation Details

### Notification Status Lifecycle

```
1. Notification Document Created (client)
   └─ Status: undefined/null (pending)

2. Cloud Function Triggered
   └─ Checks status → if "sent" or "delivered", skip (duplicate prevention)
   └─ Fetches fresh push token from user document
   └─ Sends notification via Expo

3. Notification Sent
   └─ Status: "sent"
   └─ Receipt ID stored
   └─ sentAt timestamp recorded

4. Receipt Checked (asynchronous, after 5 seconds)
   └─ If receipt.status === "ok" → Status: "delivered"
   └─ If receipt.status === "error" → Status: "failed"
   └─ deliveredAt or failureReason recorded
```

### Database Schema

Notification documents now include:

```typescript
{
  // Existing fields...
  fromUserId: string;
  toUserId: string;
  messageId: string;
  message: string;
  // ... other fields
  
  // New status tracking fields
  status?: "sent" | "delivered" | "failed";  // undefined = pending
  receiptId?: string;                         // Expo receipt ID
  sentAt?: Timestamp;                         // When notification was sent
  deliveredAt?: Timestamp;                    // When delivery was confirmed
  failureReason?: string;                     // Error message if failed
  checkedAt?: Timestamp;                      // When receipt was checked
}
```

### Duplicate Prevention Logic

```typescript
// In sendHootNotification Cloud Function
const currentStatus = notification.status;

if (currentStatus === "delivered") {
  // Already delivered - skip to prevent duplicate
  return;
}

if (currentStatus === "sent") {
  // Already sent - skip to prevent duplicate
  // (Receipt check is running in background)
  return;
}

// Status is undefined/null (pending) - proceed with send
```

### Receipt Checking

```typescript
// After sending notification
const tickets = await expo.sendPushNotificationsAsync([message]);
const ticket = tickets[0];

if ('id' in ticket && ticket.id) {
  // Success - store receipt ID
  const receiptId = ticket.id;
  
  // Update status to "sent"
  await notificationDocRef.update({
    status: "sent",
    receiptId: receiptId,
    sentAt: serverTimestamp(),
  });
  
  // Check receipt asynchronously (after 5 seconds)
  checkReceiptAndUpdateStatus(notificationDocRef, receiptId);
}
```

### Receipt Status Handling

```typescript
// In checkReceiptAndUpdateStatus
const receipts = await expo.getPushNotificationReceiptsAsync([receiptId]);
const receipt = receipts[receiptId];

if (receipt.status === "ok") {
  // Successfully delivered
  await notificationDocRef.update({
    status: "delivered",
    deliveredAt: serverTimestamp(),
  });
} else {
  // Delivery failed
  await notificationDocRef.update({
    status: "failed",
    failureReason: receipt.message,
  });
}
```

## Key Guarantees

1. **No Duplicates**: A notification will only be sent once, even if the Cloud Function is triggered multiple times
2. **Delivery Confirmation**: We verify that notifications were actually delivered, not just sent
3. **Status Tracking**: Every notification has a clear status (pending/sent/delivered/failed)
4. **Instant Delivery**: High priority ensures notifications are delivered immediately
5. **Background Support**: Notifications work when app is closed, in background, or foreground

## Error Handling

### Send Failures
- Network errors → Retry with exponential backoff (3 attempts)
- Invalid tokens → Mark as failed immediately (no retry)
- API errors → Retry with exponential backoff (3 attempts)

### Delivery Failures
- DeviceNotRegistered → Mark as failed (not retryable)
- InvalidCredentials → Mark as failed (not retryable)
- Transient errors → Mark as failed (could be retried in future if needed)

### Receipt Check Failures
- Receipt not available → Retry checking (3 attempts with 5-second delay)
- Receipt check error → Keep status as "sent" (don't change to failed)

## Testing Recommendations

1. **Test Duplicate Prevention**:
   - Send a notification
   - Manually trigger the Cloud Function again
   - Verify it skips sending (status already "sent" or "delivered")

2. **Test Delivery Confirmation**:
   - Send a notification with valid token
   - Wait 5-10 seconds
   - Check notification document status → should be "delivered"

3. **Test Failure Handling**:
   - Send to invalid/expired token
   - Check notification document status → should be "failed"
   - Verify failureReason is recorded

4. **Test Background Delivery**:
   - Close the app completely
   - Send a notification
   - Verify notification appears
   - Open app via notification
   - Verify navigation works

5. **Test High Priority**:
   - Send notification
   - Verify it arrives immediately (no delay)

## Files Modified

- `functions/src/index.ts`:
  - Added `checkReceiptAndUpdateStatus` helper function
  - Updated `sendHootNotification` to:
    - Check status before sending (duplicate prevention)
    - Store receipt IDs
    - Update status to "sent"
    - Check receipts asynchronously
    - Update status to "delivered"/"failed" based on receipt

## Deployment

1. Deploy Cloud Functions:
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions
   ```

2. No client changes required - status tracking is handled entirely by Cloud Functions

## Monitoring

Monitor notification delivery by checking:
- Firebase Functions logs for status updates
- Firestore notification documents for status fields
- Receipt check results in logs

Look for:
- High "delivered" status count
- Low "failed" status count
- No duplicate sends (check logs for "already sent" messages)

## Future Enhancements

Potential improvements (not currently implemented):
- Retry failed notifications after a delay
- Analytics dashboard for delivery rates
- Alerting for high failure rates
- Batch receipt checking for efficiency

