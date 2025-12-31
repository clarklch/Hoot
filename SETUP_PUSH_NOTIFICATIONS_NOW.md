# 🚨 URGENT: Set Up Push Notifications Backend

## Why Push Notifications Aren't Working

**The Problem:**
1. ✅ Your app creates messages in Firestore
2. ✅ Your app creates notification documents in Firestore  
3. ❌ **BUT there's no backend service to actually send the push notifications**

The notification documents are sitting in Firestore, but nothing is listening to them to send the actual push notifications to devices.

---

## Quick Fix: Set Up Firebase Cloud Functions

**✅ GOOD NEWS:** You don't need to install anything globally! We'll use `npx` which runs Firebase CLI without installation.

### Step 1: Login to Firebase

Run this in your terminal (it will open a browser window):

```bash
npx firebase-tools login
```

Sign in with your Google account (the one you use for Firebase).

### Step 2: Initialize Functions in Your Project

```bash
cd /Users/clarkchung/Desktop/Hoot
npx firebase-tools init functions
```

**When prompted, choose:**
- ✅ Use an existing project → Select `hoot-7fe85` (your Firebase project)
- ✅ Language: **TypeScript**
- ✅ ESLint: **Yes**
- ✅ Install dependencies: **Yes**

### Step 4: Install Required Packages

```bash
cd functions
npm install expo-server-sdk
npm install firebase-admin
```

### Step 5: Replace Functions Code

Open `functions/src/index.ts` and replace ALL contents with:

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
      console.log('Invalid push token or not an Expo token:', pushToken);
      return null;
    }
    
    // Create notification message
    const message = {
      to: pushToken,
      sound: 'default',
      title: `Hoot from ${notification.fromUsername || 'Someone'}`,
      body: notification.message || 'Hoot!',
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
      const result = await expo.sendPushNotificationsAsync([message]);
      console.log('Notification sent successfully:', result);
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
    const requesterUsername = requesterData?.username || requesterData?.displayName || 'Someone';

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
npx firebase-tools deploy --only functions
```

This will take 2-3 minutes. You should see:
```
✔  functions[sendHootNotification] Successful create operation.
✔  functions[sendFriendRequestNotification] Successful create operation.
```

---

## Step 7: Enable Push Token Registration

I've already updated your app code to register push tokens. Now you need to:

1. **Restart your app** on both devices
2. **Grant notification permissions** when prompted
3. **Check Firestore** to verify push tokens are saved:
   - Go to Firebase Console → Firestore Database
   - Check `users` collection
   - Each user document should have a `pushToken` field

---

## Step 8: Test It!

1. **On Device A:** Send a Hoot to Device B
2. **On Device B:** You should receive a push notification! 🎉

---

## Troubleshooting

### "Firebase CLI not found"
- Use `npx firebase-tools` instead of `firebase`
- No global installation needed!

### "Not logged in"
- Run `firebase login` again

### "Functions already exist"
- That's fine! The deploy will update them

### "No push token in Firestore"
- Make sure you restarted the app after I updated the code
- Check that notification permissions were granted
- Check the console for errors

### "Function deployed but notifications not working"
- Check Firebase Console → Functions → Logs
- Look for errors in the function execution
- Verify push tokens are valid Expo tokens (start with `ExponentPushToken[...]`)

---

## What This Does

1. **`sendHootNotification`**: Automatically triggers when a new document is created in the `notifications` collection. It reads the push token and sends the notification via Expo's push service.

2. **`sendFriendRequestNotification`**: Automatically triggers when a new friendship document is created with status "pending". It sends a notification to the recipient.

---

## Cost

- **Firebase Cloud Functions Free Tier**: 2 million invocations/month (plenty for testing!)
- **Expo Push Notifications**: Free and unlimited

---

## Next Steps After Setup

1. ✅ Deploy functions
2. ✅ Restart both devices
3. ✅ Grant notification permissions
4. ✅ Test sending a Hoot
5. ✅ Verify notification received!

If you run into any issues, check the Firebase Console → Functions → Logs for error messages.

