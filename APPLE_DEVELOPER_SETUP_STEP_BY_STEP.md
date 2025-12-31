# Apple Developer Portal - Step by Step Guide

## Prerequisites

Before you start, make sure you have:
- An Apple ID (the one you use for iCloud, App Store, etc.)
- An Apple Developer account (free or paid)
  - If you don't have one, go to https://developer.apple.com/programs/ and enroll (it's free for personal use)

---

## Step 1: Sign In to Apple Developer Portal

1. Go to: **https://developer.apple.com/account/**
2. Click **"Sign In"** in the top right
3. Enter your Apple ID and password
4. Complete 2-factor authentication if prompted

---

## Step 2: Navigate to Identifiers

Once you're signed in:

1. Look at the top navigation bar
2. Click on **"Certificates, Identifiers & Profiles"**
   - This might be under a menu if you're on mobile
3. In the left sidebar, under **"Identifiers"**, click **"Identifiers"**
   - You should see a list of your app identifiers

---

## Step 3: Find Your App Identifier

1. Look for an identifier that matches: **`com.hoot.app`**
   - This is your bundle identifier from `app.json`
2. If you see it, click on it to open it
3. **If you DON'T see it**, you need to create it first (see Step 3b below)

### Step 3b: Create App Identifier (If It Doesn't Exist)

1. Click the **"+"** button in the top right (or "Register a new identifier")
2. Select **"App IDs"** and click **"Continue"**
3. Select **"App"** and click **"Continue"**
4. Fill in:
   - **Description**: `Hoot App` (or whatever you want)
   - **Bundle ID**: Select **"Explicit"**
   - **Bundle ID**: Enter `com.sendahoot.app` (or use your own unique identifier)
5. Scroll down to **"Capabilities"**
6. Check the box for **"Sign In with Apple"**
7. Click **"Continue"**
8. Review and click **"Register"**
9. Click **"Done"**

---

## Step 4: Enable Sign In with Apple Capability

Once you're viewing your app identifier (`com.sendahoot.app` or whatever you chose):

1. Scroll down to the **"Capabilities"** section
2. Look for **"Sign In with Apple"**
3. Check the box next to **"Sign In with Apple"**
   - If it's already checked, you're good!
4. Click **"Save"** in the top right
5. Wait for it to save (you'll see a confirmation)

---

## Step 5: Verify It's Enabled

1. After saving, you should see **"Sign In with Apple"** listed under Capabilities
2. It should show as **"Enabled"** or have a checkmark
3. You're done with the Apple Developer Portal! ✅

---

## Step 6: Enable in Firebase Console

Now let's enable it in Firebase:

1. Go to: **https://console.firebase.google.com/**
2. Select your project: **hoot-7fe85**
3. In the left sidebar, click **"Authentication"**
4. Click the **"Sign-in method"** tab (at the top)
5. Scroll down and look for **"Apple"** in the list
6. Click on **"Apple"**
7. Toggle the **"Enable"** switch to ON
8. Click **"Save"**

That's it for Firebase! ✅

---

## Step 7: Build Your App

Now you need to build a development build (Sign in with Apple doesn't work in Expo Go):

### Option A: Local Build (Recommended for Testing)

```bash
cd /Users/clarkchung/Desktop/Hoot
npx expo run:ios
```

This will:
- Build the app locally
- Install it on your connected iPhone or simulator
- Take 5-10 minutes the first time

### Option B: EAS Build (For Physical Device)

If you want to build for a physical device:

```bash
eas build --profile development --platform ios
```

---

## Troubleshooting

### "I can't find Certificates, Identifiers & Profiles"
- Make sure you're signed in with an Apple Developer account
- Free accounts work fine for development
- The link might be in a dropdown menu on mobile

### "I don't see my app identifier"
- You need to create it first (see Step 3b)
- Make sure the Bundle ID matches exactly: `com.hoot.app`

### "Sign In with Apple option is grayed out"
- Make sure you've saved your app identifier first
- Try refreshing the page
- Make sure you have the right permissions in your Apple Developer account

### "I get an error when building"
- Make sure you've enabled Sign in with Apple in both:
  1. Apple Developer Portal ✅
  2. Firebase Console ✅
- Try cleaning the build: `npx expo run:ios --clean`

---

## What to Expect

After building and running the app:

1. You'll see the welcome screen
2. Instead of "Continue ❄️", you should see the native **"Sign in with Apple"** button
3. When you tap it:
   - A native iOS dialog appears
   - You can use Face ID/Touch ID or your Apple ID password
   - You can choose to "Hide My Email" (Apple will give you a private email)
4. After signing in, you'll be taken to username creation (if you don't have one yet)

---

## Need Help?

If you get stuck at any step:
1. Take a screenshot of where you are
2. Tell me which step you're on
3. Describe what you see vs. what you expected

I'll help you navigate through it!

