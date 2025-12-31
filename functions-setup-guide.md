# Quick Functions Setup

After running `firebase init functions`, replace the contents of `functions/src/index.ts` with this code:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Expo } from 'expo-server-sdk';

admin.initializeApp();

const expo = new Expo();

// Send Hoot notifications when a notification document is created
export const sendHootNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    
    const pushToken = notification.pushToken;
    const messageId = notification.messageId;
    
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      console.log('Invalid push token or not an Expo token');
      return null;
    }
    
    // Create notification message
    const message = {
      to: pushToken,
      sound: 'default',
      title: `Hoot from ${notification.fromUsername}`,
      body: notification.message,
      data: {
        type: 'hoot',
        messageId: messageId,
        message: notification.message,
        fromUserId: notification.fromUserId,
        fromUsername: notification.fromUsername,
      },
    };

    // Send notification
    try {
      await expo.sendPushNotificationsAsync([message]);
      console.log('Notification sent successfully');
    } catch (error) {
      console.error('Error sending notification:', error);
    }

    return null;
  });

// Send friend request notifications
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

## Next Steps

1. Save this code to `functions/src/index.ts`
2. Run `firebase deploy --only functions`
3. Test by sending a Hoot!

