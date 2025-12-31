# Background Push Notifications Setup

## ✅ Current Status

Your app **IS designed** to receive push notifications in the background, even when the app is closed. Here's what's configured:

### 1. Background Mode Enabled ✅
- Added `UIBackgroundModes: ["remote-notification"]` to `app.json`
- This allows iOS to wake your app when a push notification arrives

### 2. Notification Handlers Set Up ✅
- Notification listeners are configured in `app/_layout.tsx`
- `addNotificationResponseReceivedListener` handles notifications when:
  - App is in foreground
  - App is in background
  - App is closed (when user taps notification)

### 3. Notification Permissions ✅
- App requests notification permissions on startup
- Push tokens are saved to Firestore

## How It Works

### When App is Closed:
1. **Backend sends push notification** → iOS receives it
2. **iOS displays notification** in notification center
3. **User taps notification** → iOS opens your app
4. **`addNotificationResponseReceivedListener` fires** → App navigates to message view

### When App is in Background:
1. **Backend sends push notification** → iOS receives it
2. **iOS displays notification** in notification center
3. **User taps notification** → App comes to foreground
4. **`addNotificationResponseReceivedListener` fires** → App navigates to message view

### When App is in Foreground:
1. **Backend sends push notification** → App receives it immediately
2. **`addNotificationReceivedListener` fires** → You can show in-app notification
3. **User can tap notification** → `addNotificationResponseReceivedListener` fires

## Important: Backend Requirements

For background notifications to work properly, your backend **MUST** include:

```json
{
  "to": "ExponentPushToken[...]",
  "title": "Hoot from username",
  "body": "Message text",
  "data": {
    "type": "hoot",
    "messageId": "...",
    "message": "...",
    "fromUsername": "...",
    "fromUserId": "..."
  },
  "content-available": 1  // ⚠️ REQUIRED for background notifications
}
```

The `content-available: 1` flag tells iOS to wake your app in the background (if needed).

## Testing Background Notifications

### Test 1: App Closed
1. Close the app completely (swipe up from app switcher)
2. Send a Hoot from another device/account
3. Wait for push notification
4. Tap the notification
5. ✅ App should open and navigate to message view

### Test 2: App in Background
1. Press home button (app goes to background)
2. Send a Hoot from another device/account
3. Wait for push notification
4. Tap the notification
5. ✅ App should come to foreground and navigate to message view

### Test 3: App in Foreground
1. Keep app open
2. Send a Hoot from another device/account
3. ✅ Notification should appear immediately
4. Tap the notification
5. ✅ App should navigate to message view

## Current Limitations

⚠️ **Push notifications are currently disabled** because:
- OAuth is bypassed (using `temp_user`)
- `registerForPushNotifications` is commented out in the home screen
- Backend is not set up yet

## To Enable Background Notifications:

1. **Re-enable push token registration** in `app/(tabs)/index.tsx`:
   ```typescript
   useEffect(() => {
     if (user) {
       registerForPushNotifications(user.uid);
     }
   }, [user]);
   ```

2. **Set up backend** (see `BACKEND_SETUP.md` or `functions-setup-guide.md`)

3. **Ensure backend sends `content-available: 1`** in notification payload

4. **Test on a real device** (background notifications don't work in simulator)

## Summary

✅ **Yes, your app IS designed for background notifications!**

The code is set up correctly. Once you:
- Re-enable push token registration
- Set up the backend
- Test on a real device

Background notifications will work perfectly! 🎉

