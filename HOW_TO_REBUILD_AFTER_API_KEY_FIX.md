# How to Rebuild After API Key Fix

## Quick Answer
Since you fixed the API key restrictions in Google Cloud (server-side), you just need to rebuild your app. **You don't need to push to Git first** - you can build directly.

## Option 1: Build Directly with EAS (Recommended - Fastest)

### Step 1: Wait 2-3 Minutes
- Let the API key changes propagate in Google Cloud
- You've already done this ✅

### Step 2: Build with EAS CLI
Open your terminal and run:

```bash
cd /Users/clarkchung/Desktop/Hoot
eas build --platform ios --profile production
```

**Or if you want a preview/internal build:**
```bash
eas build --platform ios --profile preview
```

**What this does:**
- Builds your app in the cloud using EAS Build
- Takes 15-30 minutes
- Creates a fresh build with the updated API key configuration
- You can track progress in the terminal or at expo.dev

**You'll get:**
- A build URL to track progress
- When complete, a `.ipa` file or TestFlight upload

---

## Option 2: Build from GitHub (If You Prefer)

If you want to push to Git first (optional - not required for this fix):

### Step 1: Commit and Push Changes
```bash
cd /Users/clarkchung/Desktop/Hoot
git add .
git commit -m "API key restrictions fixed"
git push
```

### Step 2: Build from GitHub
1. Go to [expo.dev](https://expo.dev)
2. Sign in
3. Go to your project: **hoot**
4. Click **"Builds"** tab
5. Click **"Create a build"**
6. Select **iOS** and your build profile
7. Click **"Build"**

**Note:** This builds from your GitHub repository, but for the API key fix, Option 1 is faster since the fix was server-side.

---

## Which Option Should You Use?

**Use Option 1 (Direct EAS Build)** if:
- ✅ You want the fastest rebuild
- ✅ You just need to test the API key fix
- ✅ Your code is already up to date

**Use Option 2 (GitHub Build)** if:
- ✅ You want to build from a specific git commit
- ✅ You have other code changes to include
- ✅ You prefer using the web interface

## Important Notes

1. **The API key fix is server-side** - It's already done in Google Cloud Console
2. **No code changes needed** - Your app code doesn't need to change
3. **Any new build will work** - Once you rebuild, the app will use the updated API key settings
4. **TestFlight builds** - If you use `--profile production`, you can submit to TestFlight after

## After Build Completes

### Step 1: Install the New Build

**Important:** The old version on your phone will NOT automatically fix itself. You need to install the NEW build.

**Option A: Via TestFlight (If you submit the build)**
1. After build completes, submit to TestFlight:
   ```bash
   eas submit --platform ios --profile production
   ```
2. Wait for Apple to process (usually 10-30 minutes)
3. Go to TestFlight app on your iPhone
4. Update to the new version (or install if it's a new build)
5. Delete the old version if needed

**Option B: Direct Install (Faster for testing)**
1. After build completes, download the `.ipa` file
2. Install using EAS CLI or through Expo dashboard
3. Or use the build URL EAS provides

### Step 2: Test Apple Sign-In
1. Open the NEW build on your phone
2. Try signing in with Apple
3. **The error should be gone!** ✅

### Why the Old Version Won't Work
- The old TestFlight build was built BEFORE you fixed the API key restrictions
- Even though the API key fix is server-side, the old app might have cached configurations
- A fresh build ensures everything is properly configured
- **You must install the NEW build to test the fix**

The error `auth/requests-from-this-ios-client-application-<empty>-are-blocked` should no longer appear in the NEW build.

