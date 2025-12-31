# Ephemeral Messages Feature

## Overview

Hoot implements ephemeral (temporary) messaging similar to Snapchat. Messages are:
- **Never stored permanently** - Deleted immediately after viewing
- **Auto-expire after 24 hours** - Deleted automatically if not viewed
- **Viewable via push notification** - Tap notification to view
- **Dismissible with swipe-up gesture** - Swipe up to dismiss and delete

---

## How It Works

### 1. Sending a Hoot

When a user sends a Hoot:
1. Individual message documents are created in Firestore for each recipient
2. Each message has:
   - `fromUserId` - Who sent it
   - `fromUsername` - Sender's username
   - `toUserId` - Who receives it
   - `message` - The Hoot text
   - `createdAt` - When it was sent
   - `expiresAt` - 24 hours from creation
   - `viewed` - false (initially)
   - `type` - 'hoot'

3. Notification documents are created for the backend to send push notifications
4. Backend sends push notification with `messageId` included

### 2. Receiving a Hoot

When a user receives a Hoot:
1. Push notification appears with message preview
2. User taps notification
3. App navigates to message view screen
4. Message is displayed

### 3. Viewing a Hoot

When user views a message:
1. Message view screen opens (`app/message-view.tsx`)
2. Message is displayed with sender info
3. User can:
   - Read the message
   - Swipe up to dismiss
   - Message is deleted immediately when dismissed

### 4. Auto-Cleanup

Automatic cleanup runs:
- **Every hour** - Checks for expired messages (24+ hours old)
- **On app start** - Cleans up expired and viewed messages
- **On dismiss** - Message deleted immediately

---

## Database Structure

### Messages Collection

```
messages/
  {messageId}/
    fromUserId: string
    fromUsername: string
    toUserId: string
    message: string
    createdAt: Timestamp
    expiresAt: Timestamp (24 hours from createdAt)
    viewed: boolean
    type: 'hoot'
```

### Notifications Collection

```
notifications/
  {notificationId}/
    fromUserId: string
    fromUsername: string
    toUserId: string
    messageId: string (links to messages collection)
    message: string
    pushToken: string
    timestamp: Timestamp
    type: 'hoot'
```

---

## Message View Screen

Located at: `app/message-view.tsx`

### Features:
- **Swipe-up gesture** - Dismiss message
- **Auto-delete on dismiss** - Message removed from Firestore
- **Smooth animations** - Fade out and slide up
- **Full-screen modal** - Immersive viewing experience

### Gesture Handling:
- Only responds to upward swipes
- Minimum swipe distance: 100px
- Visual feedback during swipe (fade out)
- Snaps back if swipe is too short

---

## Cleanup Service

Located at: `services/messageCleanup.ts`

### Functions:

1. **cleanupExpiredMessages()**
   - Finds messages where `expiresAt < now`
   - Deletes all expired messages
   - Runs every hour

2. **cleanupViewedMessages()**
   - Finds messages where `viewed === true`
   - Deletes all viewed messages
   - Runs every hour

3. **markMessageAsViewed(messageId)**
   - Deletes message immediately
   - Used when user dismisses message

4. **startMessageCleanup()**
   - Initializes cleanup service
   - Runs cleanup immediately
   - Sets up hourly interval

---

## Push Notification Flow

### Notification Data Structure

When sending push notification, include:
```javascript
{
  type: 'hoot',
  messageId: 'abc123', // Required for navigation
  message: 'Hoot!',
  fromUsername: 'john_doe',
  fromUserId: 'user123'
}
```

### Navigation

When user taps notification:
1. Notification handler receives data
2. Extracts `messageId`, `message`, `fromUsername`, `fromUserId`
3. Navigates to `/message-view` with params
4. Message view screen loads and displays message

---

## Security Considerations

### Firestore Security Rules

You should set up security rules to:
- Only allow users to read their own messages
- Only allow deletion of messages sent to them
- Prevent unauthorized access

Example rules:
```javascript
match /messages/{messageId} {
  allow read: if request.auth != null && 
    (resource.data.toUserId == request.auth.uid || 
     resource.data.fromUserId == request.auth.uid);
  allow delete: if request.auth != null && 
    resource.data.toUserId == request.auth.uid;
  allow create: if request.auth != null && 
    request.resource.data.fromUserId == request.auth.uid;
}
```

---

## Testing

### Test Message Flow

1. **Send a Hoot**
   - Create two test accounts
   - Send Hoot from account A to account B
   - Verify message document created in Firestore

2. **Receive Notification**
   - Check that push notification is sent
   - Verify notification includes messageId

3. **View Message**
   - Tap notification
   - Verify message view screen opens
   - Verify message content is correct

4. **Dismiss Message**
   - Swipe up on message
   - Verify message is deleted from Firestore
   - Verify screen closes

5. **Test Expiration**
   - Send a message
   - Wait 24+ hours (or manually set expiresAt to past)
   - Verify cleanup service deletes message

---

## Troubleshooting

### Messages Not Deleting

- Check that `messageCleanup.ts` is being called
- Verify Firestore security rules allow deletion
- Check console for error messages

### Notifications Not Navigating

- Verify notification data includes `messageId`
- Check that `setupNotificationListeners` is called in `_layout.tsx`
- Verify router is properly configured

### Swipe Gesture Not Working

- Check that `PanResponder` is properly configured
- Verify gesture threshold is appropriate
- Test on physical device (simulators may have issues)

---

## Future Enhancements

Possible improvements:
- Message read receipts (before deletion)
- Screenshot detection
- Message preview in notification
- Group message support
- Media attachments (images, videos)

---

## Important Notes

1. **Messages are truly ephemeral** - Once deleted, they cannot be recovered
2. **24-hour expiration** - Unread messages auto-delete after 24 hours
3. **Immediate deletion** - Messages are deleted as soon as they're dismissed
4. **No message history** - There is no way to view past messages
5. **Backend required** - Push notifications require backend service (see `BACKEND_SETUP.md`)

---

This ephemeral messaging system ensures privacy and creates a unique, temporary communication experience! 🦉

