# Production Server Setup Guide

## Understanding Production vs Development

### Current Setup (Development)
- App connects to local development server (`npm start` on your Mac)
- Code changes hot-reload automatically
- Requires computer and Wi-Fi connection

### Production Setup (What We're Building)
- App runs **completely standalone** - no server needed
- All code is bundled into the app
- Works offline (except for Firebase/network features)
- Perfect for TestFlight and App Store

---

## Option 1: Standalone Production Build (Recommended)

This creates a **fully standalone app** that doesn't need any server. This is what you want for TestFlight.

### How It Works
- All JavaScript code is bundled into the app
- App runs independently on the device
- No development server needed
- Firebase still works (it's cloud-based)

### Steps

**1. Build Production Standalone App**

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to EAS
eas login

# Build standalone production app
eas build --platform ios --profile production
```

This will:
- Bundle all your code into the app
- Create a standalone `.ipa` file
- Take 15-30 minutes
- Result: App that works completely independently

**2. Submit to TestFlight**

```bash
eas submit --platform ios
```

**3. Install on Devices**
- TestFlight handles distribution
- No server needed - app runs standalone

---

## Option 2: EAS Update (For Over-the-Air Updates)

If you want to push code updates without rebuilding, you can use EAS Update. This is **optional** but useful.

### How It Works
- Production build is installed on devices
- You can push JavaScript updates over-the-air
- Users get updates without reinstalling from TestFlight
- Still no local server needed

### Setup Steps

**1. Configure EAS Update**

```bash
# Make sure you're logged in
eas login

# Configure the project (if not already done)
eas update:configure
```

**2. Build Production App (with Update Support)**

The production build already supports updates. Just build normally:

```bash
eas build --platform ios --profile production
```

**3. Publish Updates (After Making Code Changes)**

When you make code changes and want to push them:

```bash
# Commit your changes
git add .
git commit -m "Update app code"

# Publish update
eas update --branch production --message "Bug fixes and improvements"
```

**4. Users Get Updates Automatically**
- App checks for updates on launch
- Updates download in background
- Users see new version on next app open

---

## Recommended Approach for TestFlight

For your TestFlight deployment, use **Option 1 (Standalone Build)**:

1. ✅ Build standalone production app
2. ✅ Submit to TestFlight
3. ✅ App works independently on all devices
4. ✅ No server needed

**Later, if you want OTA updates:**
- Add EAS Update (Option 2) for pushing updates without rebuilding

---

## Step-by-Step: Build Standalone Production App

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 2: Login to EAS

```bash
eas login
```

Create an Expo account at https://expo.dev if you don't have one.

### Step 3: Verify Project Configuration

Your `eas.json` is already configured with a production profile. Check that your `app.json` has:

```json
{
  "expo": {
    "name": "Hoot",
    "slug": "hoot",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.sendahoot.app"
    }
  }
}
```

### Step 4: Build Production App

```bash
cd /Users/clarkchung/Desktop/Hoot
eas build --platform ios --profile production
```

**First time setup:**
- EAS will ask about credentials
- Choose: **"Set up credentials with EAS"** (recommended)
- EAS will handle code signing automatically

**Build process:**
- Takes 15-30 minutes
- Builds in the cloud
- You'll get a download link when done

### Step 5: Create App in App Store Connect (If Not Done)

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **"My Apps"** → **"+"** → **"New App"**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Hoot
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: `com.sendahoot.app`
   - **SKU**: `hoot-ios-001`
4. Click **"Create"**

### Step 6: Submit to TestFlight

After build completes:

```bash
eas submit --platform ios
```

This uploads the build to App Store Connect.

### Step 7: Wait for Processing

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select **"Hoot"** app
3. Go to **"TestFlight"** tab
4. Wait for build to process (10-30 minutes)
5. Status changes from "Processing" to "Ready to Test"

### Step 8: Add Testers

1. In TestFlight, go to **"Internal Testing"**
2. Click **"+"** to create a group (e.g., "Beta Testers")
3. Add tester emails
4. Select your build and enable it

### Step 9: Testers Install

Testers need to:
1. Install **TestFlight** app from App Store
2. Accept email invitation
3. Open TestFlight and install "Hoot"

---

## Key Differences: Development vs Production

| Feature | Development Build | Production Build |
|---------|------------------|------------------|
| **Server Needed** | Yes (local `npm start`) | No (standalone) |
| **Wi-Fi to Computer** | Yes | No |
| **Hot Reload** | Yes | No |
| **Works Offline** | No | Yes (except Firebase) |
| **Code Updates** | Instant | Requires rebuild or EAS Update |
| **TestFlight** | No | Yes |
| **App Store** | No | Yes |

---

## What Happens in Production Build

1. **JavaScript Bundle**: All your React Native code is bundled into a single file
2. **Assets**: All images, fonts, etc. are included in the app
3. **Native Code**: All native modules are compiled and included
4. **Firebase**: Still connects to Firebase cloud (not local)
5. **Standalone**: App runs completely independently

---

## Testing the Standalone Build

Once installed via TestFlight:
- ✅ App opens without needing a server
- ✅ All features work independently
- ✅ Firebase connects to cloud (not local)
- ✅ Push notifications work
- ✅ Sign in with Apple works
- ✅ Everything works like a real App Store app

---

## Troubleshooting

### Build Fails
- Check logs: `eas build:list` then `eas build:view [BUILD_ID]`
- Make sure bundle ID matches Apple Developer Portal
- Verify all dependencies are compatible

### "Credentials Error"
- EAS will handle credentials automatically
- Make sure you're logged in: `eas login`
- Check Apple Developer account permissions

### "App Won't Install on TestFlight"
- Wait for processing to complete (10-30 minutes)
- Check App Store Connect for error messages
- Verify code signing was successful

---

## Next Steps After Setup

1. ✅ Build standalone production app
2. ✅ Submit to TestFlight
3. ✅ Add testers
4. ✅ Test on multiple devices
5. ✅ Collect feedback
6. ✅ Make improvements
7. ✅ Push updates (rebuild or use EAS Update)

---

## Quick Command Reference

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build standalone production app
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios

# Check build status
eas build:list

# View build logs
eas build:view [BUILD_ID]
```

---

## Summary

**For TestFlight, you want a standalone production build:**
- ✅ No local server needed
- ✅ App runs independently
- ✅ Works on any device
- ✅ Perfect for testing with friends

The production build bundles everything into the app, so it works completely standalone. Firebase still connects to the cloud (that's separate from the development server).

Ready to proceed? Let's start with Step 1!

