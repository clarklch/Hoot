# Finding App Icon in App Store Connect

## Why You Might Not See It

The App Icon section appears in different places depending on your app's status:
- **If you haven't created a version yet:** It won't show
- **If you only have TestFlight builds:** It might be in Version Information
- **If you're preparing for App Store:** It's in the App Store tab

---

## Method 1: Create a Version First (Most Common)

### Step 1: Go to App Store Tab

1. In App Store Connect, select your **"Send a Hoot"** app
2. Click **"App Store"** tab (next to "TestFlight")
3. If you see "Prepare for Submission" or a version number, click it
4. If you don't see a version, click **"+"** to create a new version

### Step 2: Fill in Version Information

1. **Version:** Enter `1.0.0` (or your version number)
2. **What's New in This Version:** Add release notes
3. Scroll down to find **"App Icon"** section
4. Upload your icon there

---

## Method 2: Via App Information

1. Click **"App Information"** in the left sidebar
2. Look for **"App Icon"** section
3. If it's not there, you need to create a version first (see Method 1)

---

## Method 3: Check TestFlight Build Details

1. Go to **"TestFlight"** tab
2. Click on your build (version 1.0.0 (1))
3. Look for icon settings in the build details
4. Some icons are set at the build level

---

## Quick Steps to Create Version

1. **App Store Connect** → Your app
2. **"App Store"** tab
3. Click **"+"** or **"Prepare for Submission"**
4. Enter version: `1.0.0`
5. Scroll to **"App Icon"** section
6. Upload `assets/images/icon.png`

---

## Alternative: Icon in TestFlight

For TestFlight, the icon might automatically come from your build. If it's not showing:
- It may appear after the build finishes processing
- Or you need to set it in the version information

---

## What to Do Now

1. Go to **"App Store"** tab
2. Create a version (if you haven't)
3. Look for **"App Icon"** in the version form
4. Upload your icon

If you still can't find it, let me know what you see in the "App Store" tab!

