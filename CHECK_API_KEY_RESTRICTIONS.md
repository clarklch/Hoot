# How to Check and Fix API Key Restrictions

## Quick Steps to Fix Your Firebase Auth Error

The error `auth/requests-from-this-ios-client-application-<empty>-are-blocked` is most likely caused by API key restrictions blocking iOS app requests.

## Step-by-Step Instructions

### Step 1: Go to Google Cloud Console
1. Open your web browser
2. Go to: https://console.cloud.google.com/
3. Make sure you're signed in with the same account that has access to your Firebase project

### Step 2: Select Your Firebase Project
1. At the top of the page, you'll see a project dropdown (next to "Google Cloud")
2. Click the dropdown and select: **hoot-7fe85**
   - If you don't see it, type "hoot" in the search box

### Step 3: Navigate to Credentials
1. In the left sidebar, click on **"APIs & Services"** (you might need to expand it first)
2. Then click **"Credentials"**
3. You'll see a list of API keys and OAuth clients

### Step 4: Find Your Firebase API Key
1. Look for the API key that matches your Firebase config
2. Your API key (from `config/firebase.ts`) is: `AIzaSyB5xkJHtYDZYcRNoPkNvNaUi6AFMa8Rz6c`
3. **Click on the API key name** (or the edit/pencil icon) to open it

### Step 5: Find "Application restrictions" Section
1. **IMPORTANT:** There are TWO different sections:
   - **"API restrictions"** - Controls which APIs the key can access (this is OK, you can leave it as-is)
   - **"Application restrictions"** - Controls which apps can use the key (THIS IS WHAT WE NEED TO CHECK!)
2. Scroll down PAST the "API restrictions" section
3. Look for the **"Application restrictions"** section (it comes AFTER "API restrictions")
4. Look at what's currently selected in "Application restrictions":
   - **If it says "None"** → API key restrictions are NOT the issue (try other solutions)
   - **If it says "HTTP referrers (web sites)"** → This is blocking iOS apps! ⚠️
   - **If it says "IP addresses"** → This is also blocking iOS apps! ⚠️
   - **If it says "iOS apps"** → Check if your bundle ID is listed

### Step 6: Fix the Restrictions

**If it says "HTTP referrers" or "IP addresses":**

**Option A: Remove Restrictions (Easiest - Recommended for Development)**
1. Click the radio button next to **"None"**
2. Scroll down and click **"SAVE"** button (blue button at the bottom)
3. Wait 1-2 minutes for changes to take effect

**Option B: Restrict to iOS Apps (More Secure)**
1. Click the radio button next to **"iOS apps"**
2. Click **"Add an item"** button
3. Enter your bundle ID: `com.sendahoot.app`
4. Click **"SAVE"** button
5. Wait 1-2 minutes for changes to take effect

### Step 7: Verify the Fix
1. After saving, go back to the API key (refresh the page)
2. Confirm "Application restrictions" now shows:
   - ✅ **"None"** (if you chose Option A), OR
   - ✅ **"iOS apps"** with `com.sendahoot.app` listed (if you chose Option B)

### Step 8: Rebuild and Test
1. **Rebuild your app** completely (delete build folders if needed)
2. **Try signing in with Apple again**
3. The error should be resolved! ✅

## Visual Guide

When you open the API key, you should see something like:

```
API key details
┌─────────────────────────────────────┐
│ Name: [Your API key name]           │
│ API key: AIzaSyB5x...               │
│                                     │
│ Application restrictions:           │
│ ○ None                              │
│ ● HTTP referrers (web sites)  ⚠️    │
│ ○ IP addresses                      │
│ ○ iOS apps                          │
│ ○ Android apps                      │
│                                     │
│ [API restrictions section below]    │
└─────────────────────────────────────┘
```

If "HTTP referrers" is selected (●), that's your problem! Change it to "None" (○).

## Why This Fixes the Error

- When API key is restricted to "HTTP referrers", only web browsers can use it
- iOS apps are blocked before Firebase can read the bundle ID
- Firebase sees `<empty>` bundle ID because the request is rejected immediately
- Changing to "None" or "iOS apps" allows your iOS app to use the API key

## Important Notes

- ⏱️ **Wait 1-2 minutes** after saving - changes take time to propagate
- 🔄 **Rebuild your app** after fixing - don't just restart, do a full rebuild
- 📱 **Test on a real device or TestFlight** - not Expo Go (Apple Sign-In requires native build)

## If This Doesn't Fix It

If changing API key restrictions doesn't work:
1. Double-check you edited the correct API key (the one in your `config/firebase.ts`)
2. Make sure you saved the changes (clicked "SAVE" button)
3. Wait a few more minutes and try again
4. Check if you have multiple API keys - make sure you're editing the right one
5. Check Firebase Console → Authentication → Users to see if users are being created despite the error

