# Push Token Persistence - How It Works

## ✅ Yes, Push Tokens Remain Valid When App is Closed

### How It Works

1. **Token is Stored in Firestore (Cloud Database)**
   - When user grants notification permissions, token is saved to: `users/{userId}/pushToken`
   - This is a **cloud database entry**, not just device storage
   - Token persists permanently in Firestore until explicitly cleared

2. **Cloud Function Fetches Token from Firestore**
   - When someone sends a Hoot, the Cloud Function runs
   - It reads the recipient's `pushToken` directly from Firestore
   - This works **even if the recipient's app is completely closed**

3. **Token Validity**
   - Expo push tokens remain valid indefinitely
   - They only become invalid if:
     - App is uninstalled/reinstalled
     - Device is restored from backup
     - User explicitly signs out (token is cleared)

### Current Implementation

#### Token Registration (Happens When App Opens)
```typescript
// In app/_layout.tsx - when app opens and user is authenticated
registerForPushNotifications(userId)

// Also in app/(tabs)/index.tsx - when user reaches home screen
registerForPushNotifications(userId)
```

#### Token Storage
```typescript
// In services/notifications.ts
await setDoc(
  doc(db, 'users', userId),
  { pushToken: tokenData.data },
  { merge: true }  // ← This persists to Firestore permanently
);
```

#### Token Usage (Cloud Function)
```typescript
// In functions/src/index.ts
const recipientDoc = await admin.firestore()
  .collection("users")
  .doc(toUserId)
  .get();
  
pushToken = recipientData?.pushToken || null;
// ← Reads from Firestore, works even if app is closed
```

### Timeline Example

**Scenario: User closes app for 2 hours**

1. **T=0: User closes app**
   - Token is stored in Firestore ✅
   - Token remains in Firestore database ✅

2. **T=1 hour: Someone sends them a Hoot**
   - Cloud Function runs
   - Fetches token from Firestore ✅
   - Sends notification to Expo ✅
   - User receives notification ✅
   - **App is still closed, but notification works!**

3. **T=2 hours: User opens app**
   - Token is refreshed/updated in Firestore
   - Ensures token is current
   - Token persists again when app closes

### Why Tokens Work When App is Closed

- **Firestore is a cloud database** - not device storage
- **Cloud Functions run on Firebase servers** - not on user's device
- **Token lookup is independent of app state** - Firestore read works regardless
- **Expo push service delivers notifications** - via APNs (iOS) or FCM (Android)

### What Our Changes Ensure

1. **Token is always up-to-date** - Refreshed when app opens
2. **Token persists in Firestore** - Saved with `{ merge: true }`
3. **Token is never cleared** - Only cleared on explicit sign out
4. **Cloud Function can always fetch it** - Reads directly from Firestore

### Testing Verification

To verify tokens work when app is closed:

1. **User A**: Opens app, grants permissions (token saved to Firestore)
2. **User A**: Closes app completely (force quit)
3. **Wait**: 2 hours (or any amount of time)
4. **User B**: Sends Hoot to User A
5. **Expected**: User A receives push notification ✅
6. **Verify**: Check Firestore - token should still be in `users/{userId}/pushToken`

### Important Notes

- ✅ Tokens **DO** persist when app is closed
- ✅ Tokens **DO** work for notifications when app is closed
- ✅ Cloud Function **CAN** fetch tokens from Firestore when app is closed
- ✅ Token refresh on app open ensures tokens are current (defense in depth)

### If Tokens Weren't Working Before

If you experienced issues where tokens didn't work after app was closed, it might have been because:
1. Tokens weren't being saved to Firestore properly
2. Tokens were being cleared somehow (but we only clear on sign out)
3. Cloud Function wasn't running correctly

Our current implementation ensures:
- Tokens are saved to Firestore (persistent)
- Tokens are refreshed on app open (ensures they're current)
- Tokens are only cleared on sign out (preserved otherwise)

## ✅ Conclusion

**Yes, push tokens remain valid and work when the app is closed for hours/days/weeks.** They're stored in Firestore (cloud database), so the Cloud Function can always fetch them to send notifications.

