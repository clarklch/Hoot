# Push Notification Reliability Improvements

## Overview

This document explains the improvements made to ensure **every hoot message guarantees a push notification** is sent to target users in real-time and consistently.

## Problems Identified

1. **No notification document created if pushToken was null**: If a recipient didn't have a push token registered at send time, no notification document was created, meaning no notification would ever be sent.

2. **Stale push tokens**: The client was reading push tokens from recipient documents at send time, which could be stale or outdated.

3. **No retry mechanism**: If Expo's push notification API failed, there was no retry logic.

4. **Non-atomic operations**: Message and notification documents were created separately, potentially causing inconsistencies.

5. **Client-side dependency**: Notification creation depended on client-side logic, which could fail silently.

## Solutions Implemented

### 1. Always Create Notification Documents ✅

**Change**: Modified `sendHoot` function in `app/(tabs)/index.tsx` to **always create notification documents**, even if `pushToken` is null initially.

**Why this works**:
- Every message now has a corresponding notification document
- The Cloud Function will fetch the push token fresh from the user document
- If a user registers for push notifications after receiving a message, they'll still get notified when the function runs
- This guarantees that every message triggers a notification attempt

**Code Location**: `app/(tabs)/index.tsx` lines 532-583 (group messages) and 605-658 (individual messages)

### 2. Fetch Push Token Fresh in Cloud Function ✅

**Change**: Updated `sendHootNotification` Cloud Function to **always fetch the push token fresh** from the user document, instead of relying on the client-provided token.

**Why this works**:
- Eliminates stale token issues
- If a user's push token was updated between message creation and notification processing, we get the latest token
- Even if the notification document was created with a null/old token, we fetch the current one
- Ensures we're always using the most up-to-date push token

**Code Location**: `functions/src/index.ts` lines 42-67

### 3. Retry Logic with Exponential Backoff ✅

**Change**: Added `retryWithBackoff` helper function that retries failed notification sends up to 3 times with exponential backoff (1s, 2s, 4s delays).

**Why this works**:
- Handles transient network errors and API rate limits
- Increases reliability for temporary failures
- Uses exponential backoff to avoid overwhelming the API
- Still fails fast for permanent errors (e.g., invalid credentials)

**Code Location**: `functions/src/index.ts` lines 18-43 and usage at line 202

### 4. Atomic Batch Writes ✅

**Change**: Modified message creation to use Firestore batch writes, ensuring message and notification documents are created atomically.

**Why this works**:
- Either both documents are created, or neither is created
- Prevents inconsistencies where a message exists but no notification document was created
- Uses `serverTimestamp()` for consistent timestamping
- Reduces race conditions

**Code Location**: `app/(tabs)/index.tsx` lines 547-583 (group messages) and 620-658 (individual messages)

### 5. Enhanced Error Handling and Logging ✅

**Change**: Added comprehensive error logging throughout the notification flow, including:
- Logging when push tokens are missing
- Logging retry attempts
- Logging successful sends with message and user IDs
- Better error messages for debugging

**Why this works**:
- Makes it easier to debug notification issues
- Provides visibility into the notification pipeline
- Helps identify patterns in failures

**Code Location**: `functions/src/index.ts` throughout the `sendHootNotification` function

### 6. Group Mute Checking ✅

**Change**: Added group mute checking in the Cloud Function to respect group-level mutes.

**Why this works**:
- Ensures notifications respect user preferences
- Prevents notifications when users have muted specific groups
- Maintains consistency with individual friend mutes

**Code Location**: `functions/src/index.ts` lines 134-161

## Flow Diagram

### Before (Issues)
```
User sends Hoot
  ↓
Client reads recipient pushToken (may be null/stale)
  ↓
If pushToken exists → Create notification document
If pushToken is null → NO notification document created ❌
  ↓
Cloud Function runs (if notification doc exists)
  ↓
Uses client-provided pushToken (may be stale) ❌
  ↓
Send notification (no retry on failure) ❌
```

### After (Fixed)
```
User sends Hoot
  ↓
Create message document
  ↓
Create notification document (ALWAYS, even if pushToken is null) ✅
  ↓
Both created atomically in batch write ✅
  ↓
Cloud Function triggers on notification document creation
  ↓
Fetch pushToken FRESH from user document ✅
  ↓
Check mutes (friend and group)
  ↓
Send notification with retry logic (3 attempts, exponential backoff) ✅
  ↓
Comprehensive logging for debugging ✅
```

## Key Guarantees

1. **Every message creates a notification document**: No message can be sent without triggering a notification attempt.

2. **Fresh push tokens**: The Cloud Function always fetches the latest push token, eliminating stale token issues.

3. **Retry on failure**: Transient failures are automatically retried, increasing reliability.

4. **Atomic operations**: Message and notification documents are created together, preventing inconsistencies.

5. **Real-time delivery**: Firestore triggers fire immediately when documents are created, ensuring fast delivery.

## Testing Recommendations

1. **Test with null push token**: Send a message to a user who hasn't registered for push notifications yet, then have them register. The notification should still be sent.

2. **Test token updates**: Update a user's push token, then send them a message. The notification should use the new token.

3. **Test network failures**: Simulate network failures to verify retry logic works correctly.

4. **Test batch writes**: Verify that message and notification documents are always created together.

5. **Test group mutes**: Verify that group-muted users don't receive notifications.

## Deployment Notes

- No breaking changes - this is backward compatible
- Cloud Functions will need to be redeployed for the changes to take effect
- Client app updates will apply to new message sends immediately

## Performance Considerations

- Batch writes are efficient and reduce the number of database operations
- Retry logic adds minimal delay (max 7 seconds total for 3 retries) only on failures
- Fresh token fetching adds one database read per notification, which is necessary for reliability
- All operations are optimized for Firestore best practices

