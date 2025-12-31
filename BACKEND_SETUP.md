# Backend Setup for Push Notifications

## Overview

Your Hoot app stores notification data in Firestore, but to actually send push notifications, you'll need a backend service. This guide explains two options:

1. **Firebase Cloud Functions** (Recommended - Free tier available)
2. **Custom Node.js Server** (More control, requires hosting)

---

## Option 1: Firebase Cloud Functions (Recommended)

Firebase Cloud Functions can automatically send push notifications when new documents are created in Firestore.

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

### Step 3: Initialize Functions

```bash
firebase init functions
```

Choose:
- TypeScript (recommended)
- ESLint: Yes
- Install dependencies: Yes

### Step 4: Install Dependencies

```bash
cd functions
npm install expo-server-sdk
npm install firebase-admin
```

### Step 5: Create Notification Function

Create `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Expo } from 'expo-server-sdk';

admin.initializeApp();

const expo = new Expo();

export const sendHootNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    
    // Each notification document now contains a single pushToken and messageId
    const pushToken = notification.pushToken;
    const messageId = notification.messageId;
    
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      return null;
    }
    
    // Create message
    const message = {
      to: pushToken,
      sound: 'default',
      title: `Hoot from ${notification.fromUsername}`,
      body: notification.message,
      data: {
        type: 'hoot',
        messageId: messageId, // Important: Include messageId for navigation
        message: notification.message,
        fromUserId: notification.fromUserId,
        fromUsername: notification.fromUsername,
      },
    };

    // Send notification
    try {
      await expo.sendPushNotificationsAsync([message]);
    } catch (error) {
      console.error('Error sending notification:', error);
    }

    return null;
  });

    // Send notifications in batches
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notifications:', error);
      }
    }

    return null;
  });

export const sendFriendRequestNotification = functions.firestore
  .document('friendships/{friendshipId}')
  .onCreate(async (snap, context) => {
    const friendship = snap.data();
    
    if (friendship.status !== 'pending') {
      return null;
    }

    // Get the friend's user data
    const friendDoc = await admin.firestore()
      .collection('users')
      .doc(friendship.friendId)
      .get();

    if (!friendDoc.exists) {
      return null;
    }

    const friendData = friendDoc.data();
    const pushToken = friendData?.pushToken;

    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      return null;
    }

    // Get requester's username
    const requesterDoc = await admin.firestore()
      .collection('users')
      .doc(friendship.userId)
      .get();

    const requesterData = requesterDoc.data();
    const requesterUsername = requesterData?.username || 'Someone';

    // Send notification
    try {
      await expo.sendPushNotificationsAsync([{
        to: pushToken,
        sound: 'default',
        title: 'New Friend Request',
        body: `${requesterUsername} wants to be your friend`,
        data: {
          type: 'friend_request',
          friendshipId: context.params.friendshipId,
          fromUserId: friendship.userId,
        },
      }]);
    } catch (error) {
      console.error('Error sending friend request notification:', error);
    }

    return null;
  });
```

### Step 6: Deploy Functions

```bash
firebase deploy --only functions
```

---

## Option 2: Custom Node.js Server

If you prefer more control, you can create a custom server.

### Step 1: Create Server File

Create `server/index.js`:

```javascript
const express = require('express');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');

const app = express();
app.use(express.json());

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const expo = new Expo();

// Endpoint to send Hoot notifications
app.post('/send-hoot', async (req, res) => {
  const { pushTokens, message, fromUsername } = req.body;

  const messages = pushTokens
    .filter(token => Expo.isExpoPushToken(token))
    .map(token => ({
      to: token,
      sound: 'default',
      title: `Hoot from ${fromUsername}`,
      body: message,
    }));

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to send friend request notifications
app.post('/send-friend-request', async (req, res) => {
  const { pushToken, requesterUsername } = req.body;

  if (!Expo.isExpoPushToken(pushToken)) {
    return res.status(400).json({ error: 'Invalid push token' });
  }

  try {
    await expo.sendPushNotificationsAsync([{
      to: pushToken,
      sound: 'default',
      title: 'New Friend Request',
      body: `${requesterUsername} wants to be your friend`,
      data: {
        type: 'friend_request',
        requesterUsername: requesterUsername,
      },
    }]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to send Hoot notifications (updated to include messageId)
app.post('/send-hoot', async (req, res) => {
  const { pushTokens, message, fromUsername, messageId, fromUserId } = req.body;

  const messages = pushTokens
    .filter(token => Expo.isExpoPushToken(token))
    .map(token => ({
      to: token,
      sound: 'default',
      title: `Hoot from ${fromUsername}`,
      body: message,
      data: {
        type: 'hoot',
        messageId: messageId, // Important: Include messageId for navigation
        message: message,
        fromUsername: fromUsername,
        fromUserId: fromUserId,
      },
    }));

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 2: Get Firebase Service Account Key

1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate new private key"
3. Save as `server/serviceAccountKey.json` (keep this secret!)

### Step 3: Install Dependencies

```bash
cd server
npm install express firebase-admin expo-server-sdk
```

### Step 4: Update App to Call Server

In your app, instead of storing in Firestore, make HTTP requests to your server.

---

## Testing Push Notifications

### Get Expo Push Token

1. Run your app
2. Check the console for the push token
3. Use Expo's push notification tool: [expo.dev/notifications](https://expo.dev/notifications)

### Send Test Notification

```bash
curl -H "Content-Type: application/json" \
  -X POST https://exp.host/--/api/v2/push/send \
  -d '{
    "to": "ExponentPushToken[YOUR_TOKEN]",
    "title": "Test",
    "body": "This is a test notification"
  }'
```

---

## Production Considerations

1. **Rate Limiting**: Implement rate limiting to prevent abuse
2. **Error Handling**: Handle failed notifications gracefully
3. **Retry Logic**: Retry failed notifications
4. **Analytics**: Track notification delivery rates
5. **Security**: Protect your server endpoints with authentication

---

## Cost Considerations

- **Firebase Cloud Functions**: Free tier includes 2 million invocations/month
- **Expo Push Notifications**: Free for unlimited notifications
- **Custom Server**: Hosting costs (Heroku, AWS, etc.)

---

## Next Steps

1. Choose your backend option
2. Set up the service
3. Test with a few devices
4. Monitor for errors
5. Scale as needed

Good luck! 🚀

