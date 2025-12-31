# iOS-Only Setup Guide

Since you're building an iOS app only, here are the iOS-specific considerations:

## ✅ Good News: Firebase Config is the Same!

The Firebase configuration you use is the **same for iOS, Android, and Web**. You don't need different configs - the web SDK works perfectly for iOS through Expo.

---

## Firebase Setup (Same as Web)

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project (same as web setup)
3. Get your Firebase config (same config object)

### Step 2: Add iOS App to Firebase

Even though you're using Expo, you should still add an iOS app to Firebase:

1. In Firebase Console, click the **gear icon ⚙️** > **Project settings**
2. Scroll to **"Your apps"** section
3. Click **"Add app"** > **iOS icon** (Apple logo)
4. **Bundle ID**: You'll get this from Expo later, but for now use: `com.hoot.app`
   - You can change this later in `app.json`
5. **App nickname**: "Hoot iOS"
6. Click **"Register app"**
7. **Download `GoogleService-Info.plist`** - You might not need this with Expo, but keep it safe

**Note:** The Firebase config you use in your code is still the **web config** (from the web app you created). The iOS app registration is mainly for analytics and some native features.

---

## Google Sign-In Setup (iOS-Specific)

### Step 1: Create iOS OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **"APIs & Services"** > **"Credentials"**
4. Click **"Create Credentials"** > **"OAuth client ID"**
5. Application type: **iOS**
6. Name: **"Hoot iOS"**
7. **Bundle ID**: This must match your app's bundle ID
   - Check `app.json` for your bundle identifier
   - Or use: `com.hoot.app` (you can set this in `app.json`)
8. Click **"Create"**
9. **Copy the Client ID** - this is your `iosClientId`

### Step 2: Update Your App Config

1. Open `app.json`
2. Make sure you have an iOS bundle identifier:
   ```json
   "ios": {
     "bundleIdentifier": "com.hoot.app",
     "supportsTablet": true
   }
   ```

3. Open `contexts/AuthContext.tsx`
4. Update the OAuth config:
   ```typescript
   const [request, response, promptAsync] = Google.useAuthRequest({
     iosClientId: 'YOUR_IOS_CLIENT_ID', // Use iOS client ID
     webClientId: 'YOUR_WEB_CLIENT_ID', // Still needed for Expo
   });
   ```

**Important:** You still need the `webClientId` because Expo uses web-based authentication internally, even on iOS.

---

## Push Notifications (iOS-Specific)

### iOS Push Notifications Setup

For iOS, you have two options:

#### Option A: Expo Push Notifications (Easier - Recommended)

Expo handles iOS push notifications for you:
1. No additional setup needed initially
2. Works with Expo's push notification service
3. When you're ready to publish, you'll need:
   - Apple Developer account ($99/year)
   - APNs (Apple Push Notification service) certificates

#### Option B: Firebase Cloud Messaging (More Complex)

If you want to use Firebase Cloud Messaging directly:
1. You'll need APNs certificates
2. Upload them to Firebase Console
3. More complex setup

**Recommendation:** Start with Expo Push Notifications (Option A). You can switch later if needed.

---

## App Configuration for iOS

### Update `app.json`

Make sure your `app.json` has iOS-specific settings:

```json
{
  "expo": {
    "name": "Hoot",
    "slug": "Hoot",
    "ios": {
      "bundleIdentifier": "com.hoot.app",
      "supportsTablet": true,
      "infoPlist": {
        "NSPhotoLibraryUsageDescription": "We need access to your photos to share images.",
        "NSCameraUsageDescription": "We need access to your camera to scan QR codes."
      }
    }
  }
}
```

**Bundle Identifier:** This must be unique. Use reverse domain notation:
- `com.yourname.hoot`
- `com.hoot.app`
- `io.hoot.app`

**Important:** The bundle identifier in `app.json` must match:
- The bundle ID in your iOS OAuth client
- The bundle ID you'll use when publishing to App Store

---

## Testing on iOS

### Option 1: Expo Go (Easiest for Testing)

1. Install **Expo Go** from the App Store
2. Run `npm start`
3. Scan QR code with Expo Go
4. **Note:** Some features might be limited in Expo Go

### Option 2: iOS Simulator (Mac Only)

1. Install Xcode from Mac App Store
2. Run: `npm run ios`
3. This opens iOS Simulator

### Option 3: Development Build (Best for Full Testing)

1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. Configure: `eas build:configure`
4. Build for iOS: `eas build --platform ios`
5. Install on your device via TestFlight or direct install

---

## What's Different for iOS-Only?

### ✅ Same (No Changes Needed):
- Firebase config (use web config)
- Firestore database setup
- Authentication setup
- Most of the app code

### ⚠️ Different (iOS-Specific):
- **Bundle Identifier** - Must be set in `app.json`
- **OAuth Client** - Use iOS client ID (but still need web client ID)
- **Push Notifications** - Use Expo's service (easier) or FCM with APNs
- **App Store** - Need Apple Developer account ($99/year) to publish
- **Permissions** - Need to declare camera/photo permissions in `app.json`

---

## Quick Checklist for iOS

- [ ] Firebase project created
- [ ] Web app added to Firebase (for config)
- [ ] iOS app added to Firebase (for analytics)
- [ ] Bundle identifier set in `app.json`
- [ ] iOS OAuth client created (with matching bundle ID)
- [ ] Web OAuth client created (still needed)
- [ ] OAuth client IDs updated in `contexts/AuthContext.tsx`
- [ ] Firebase config updated in `config/firebase.ts`
- [ ] Camera permissions added to `app.json` (for QR scanning)
- [ ] Test on iOS Simulator or Expo Go

---

## Publishing to App Store (Later)

When you're ready to publish:

1. **Get Apple Developer Account** ($99/year)
2. **Create App Store listing**
3. **Build with EAS**: `eas build --platform ios`
4. **Submit to App Store**: `eas submit --platform ios`

But for now, you can test everything with Expo Go or iOS Simulator!

---

## Summary

**The main differences for iOS-only:**
1. Set bundle identifier in `app.json`
2. Create iOS OAuth client (but still need web client)
3. Use Expo Push Notifications (easier than FCM for iOS)
4. Add camera permissions to `app.json`

**Everything else is the same!** The Firebase config, database setup, and most code work identically.

---

## Need Help?

- **General Setup:** See `QUICK_START.md`
- **Firebase Details:** See `SETUP_GUIDE.md`
- **Push Notifications:** See `BACKEND_SETUP.md`

Good luck with your iOS app! 🍎

