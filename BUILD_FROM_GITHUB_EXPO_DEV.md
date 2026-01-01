# How to Build from GitHub via Expo.dev

## Current Build Status

You've started a build with EAS CLI. You have two options:

### Option 1: Let Current Build Finish (Recommended)
- The build is already in progress
- You can cancel it, but it's easier to let it finish
- It won't hurt anything - you can just ignore it or use it later

### Option 2: Cancel Current Build
- Press `Ctrl+C` in the terminal to cancel
- Then proceed with GitHub build method below

---

## Build from GitHub via Expo.dev (Your Preferred Method)

### Step 1: Make Sure Your Code is Pushed to GitHub

**Check if you have any uncommitted changes:**
```bash
cd /Users/clarkchung/Desktop/Hoot
git status
```

**If you have changes to commit:**
```bash
git add .
git commit -m "Ready for build - API key fix"
git push
```

**Note:** For the API key fix, no code changes are needed (it was a server-side fix in Google Cloud). But if you want to build from GitHub, make sure your latest code is pushed.

### Step 2: Go to Expo.dev

1. Open your web browser
2. Go to: https://expo.dev
3. Sign in with your Expo account

### Step 3: Navigate to Your Project

1. Click on **"Projects"** in the top menu
2. Find and click on your project: **hoot**
   - Or search for it if you have many projects

### Step 4: Start a New Build

1. Click on the **"Builds"** tab (in the project page)
2. Click the **"Create a build"** button (usually blue, at the top right)
3. You'll see build options

### Step 5: Configure the Build

1. **Platform:** Select **iOS**
2. **Build profile:** Select **production** (for TestFlight)
   - Or **preview** if you want an internal build
3. **Git branch:** Usually **main** or **master** (select the branch you pushed to)
4. **Git commit:** Usually **"Latest commit"** or select a specific commit

### Step 6: Start the Build

1. Review your settings
2. Click **"Build"** or **"Create build"** button
3. The build will start in the cloud
4. You'll see a build page with progress

### Step 7: Monitor the Build

- You'll see build progress in real-time
- Builds typically take **15-30 minutes**
- You can close the browser - you'll get email notifications when it's done
- Check back at: https://expo.dev/accounts/[your-username]/projects/hoot/builds

---

## After Build Completes

### Step 1: Download or Submit

Once the build finishes successfully, you'll see options to:
- **Download** the `.ipa` file
- **Submit to App Store** / TestFlight

### Step 2: Submit to TestFlight (If production build)

1. Click **"Submit to App Store"** or **"Submit"** button
2. Follow the prompts
3. EAS will submit it to TestFlight automatically
4. Wait 10-30 minutes for Apple to process

### Step 3: Install on Your Phone

1. Go to **TestFlight app** on your iPhone
2. You'll see the new build available
3. Tap **"Update"** or **"Install"** to get the new version
4. Test Apple Sign-In - it should work now! ✅

---

## Advantages of GitHub Build Method

✅ **Visual interface** - See everything in the browser  
✅ **Build history** - All builds are saved  
✅ **Easy to track** - See progress and logs  
✅ **No terminal needed** - Everything is in the web UI  
✅ **Team collaboration** - Team members can see builds  

---

## Important Notes

1. **API Key Fix:** The fix you made (setting Application restrictions to "None") is server-side, so ANY new build will work - whether from CLI or GitHub
2. **No Code Changes Needed:** The API key fix was in Google Cloud Console, not in your code
3. **Git Push:** Even though no code changes are needed, make sure your code is pushed to GitHub if you want to build from a specific state
4. **Build Time:** Both methods take the same amount of time (15-30 minutes)

---

## Quick Reference

**Build URL Pattern:**
```
https://expo.dev/accounts/[username]/projects/hoot/builds
```

**To check build status:**
- Go to Expo.dev → Your Project → Builds tab
- Click on any build to see details and logs

