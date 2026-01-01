# FIX: iOS Firebase Registration Error

## Error Message
```
auth/requests-from-this-ios-client-application-<empty>-are-blocked
```

## Current Status ✅
- ✅ iOS app registered in Firebase Console (`com.sendahoot.app`)
- ✅ Apple Sign-In enabled in Firebase Authentication
- ✅ Bundle ID matches in app.json (`com.sendahoot.app`)

## Root Cause
Since everything is configured correctly, the issue is likely **API Key restrictions** in Google Cloud Console. The Firebase API key might have restrictions that block iOS app requests.

## Solution: Check API Key Restrictions

### Step 1: Find Your Firebase API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project: **hoot-7fe85**
3. Go to **"APIs & Services"** → **"Credentials"**

### Step 2: Check Your API Key Restrictions
1. Look for an API key that matches your Firebase config (in `config/firebase.ts`):
   - Your API key: `AIzaSyB5xkJHtYDZYcRNoPkNvNaUi6AFMa8Rz6c`
2. **Click on the API key** to edit it
3. Scroll down to **"Application restrictions"**
4. **Check what's selected:**
   - ❌ If it says **"HTTP referrers (web sites)"** or **"IP addresses"** → This blocks iOS apps!
   - ✅ Should be **"None"** or **"iOS apps"** (if you want to restrict it)

### Step 3: Fix API Key Restrictions

**Option A: Remove Restrictions (Easiest - Recommended for Development)**
1. Under "Application restrictions", select **"None"**
2. Click **"Save"**
3. Wait 1-2 minutes for changes to propagate

**Option B: Add iOS App Restriction (More Secure)**
1. Under "Application restrictions", select **"iOS apps"**
2. Click **"Add an item"**
3. Enter your bundle ID: `com.sendahoot.app`
4. Click **"Save"**
5. Wait 1-2 minutes for changes to propagate

**⚠️ Important:** If your API key is restricted to "HTTP referrers" or "IP addresses", it will block ALL iOS app requests, causing the `<empty>` bundle ID error!

### Step 4: Verify API Restrictions Are Fixed
1. Go back to the API key details
2. Confirm "Application restrictions" shows:
   - ✅ **"None"** (if you chose Option A), OR
   - ✅ **"iOS apps"** with `com.sendahoot.app` listed (if you chose Option B)

### Step 5: Rebuild and Test
1. **Rebuild your app** (to clear any cached configurations)
2. **Try signing in again**
3. The error should be resolved!

## Additional Checks (If Still Not Working)

### Check 1: Verify Bundle ID in Built App
Sometimes the bundle ID in the built app differs from app.json. Check:
1. Open Xcode (if you have the project locally)
2. Go to your app target → General tab
3. Verify Bundle Identifier is `com.sendahoot.app`

OR if using EAS Build:
1. Check your `eas.json` build configuration
2. Verify bundle identifier matches

### Check 2: Check App Check (Advanced)
If you have App Check enabled:
1. Go to Firebase Console → **App Check**
2. Check if your iOS app is registered
3. If App Check is blocking requests, you might need to configure it properly or disable it temporarily

### Check 3: Verify You're Testing on Real Device
- TestFlight builds should work
- Physical device should work
- iOS Simulator might have limitations
- Expo Go won't work (Apple Sign-In requires native build)

## Why This Happens

When using Firebase Auth with Apple Sign-In on iOS:
1. Firebase validates the request against your iOS app registration
2. The API key restrictions control which apps can use the API key
3. If API key is restricted to "HTTP referrers" (web only), iOS apps get blocked
4. Firebase sees `<empty>` bundle ID because the request is blocked before it can read the bundle ID

## Quick Checklist

- [x] iOS app registered in Firebase Console ✅
- [x] Apple Sign-In enabled ✅
- [x] Bundle ID matches ✅
- [ ] **API Key restrictions fixed** ⚠️ **DO THIS!**
- [ ] App rebuilt after fixing API key
- [ ] Test sign-in again

## Still Having Issues?

If fixing API key restrictions doesn't work:
1. **Double-check the API key** - Make sure you're editing the correct API key (the one in your `config/firebase.ts`)
2. **Wait 2-3 minutes** after saving API key changes (they take time to propagate)
3. **Check Firebase Console → Authentication → Users** - See if any users are being created despite the error
4. **Check device logs** for more detailed error messages
5. **Try a completely fresh build** - Delete build folders and rebuild from scratch
