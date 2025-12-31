# Build Production App for TestFlight

## Current Status

✅ EAS CLI installed and logged in as `clarklch`  
✅ Project configured with EAS project ID  
✅ `app.json` updated with required fields  
⏳ **Next: Set up credentials and build**

---

## Step 1: Set Up Credentials (First Time Only)

Run this command in your terminal (it needs to be interactive):

```bash
cd /Users/clarkchung/Desktop/Hoot
eas build --platform ios --profile production
```

**What will happen:**
1. EAS will ask: "Set up credentials with EAS?" → Choose **"Yes"** (recommended)
2. EAS will automatically:
   - Generate a distribution certificate
   - Create a provisioning profile
   - Handle all code signing
   - Store credentials securely on Expo's servers

**This is a one-time setup.** After this, you can use `--non-interactive` flag for future builds.

---

## Step 2: Build Process

After credentials are set up:
- Build will start in the cloud
- Takes **15-30 minutes**
- You'll see progress in the terminal
- You'll get a build URL to track progress

**You can:**
- Close the terminal (build continues in cloud)
- Check status: `eas build:list`
- View logs: `eas build:view [BUILD_ID]`

---

## Step 3: After Build Completes

Once build is successful:

```bash
# Submit to TestFlight
eas submit --platform ios
```

This uploads the build to App Store Connect.

---

## Step 4: Create App in App Store Connect (If Not Done)

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **"My Apps"** → **"+"** → **"New App"**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Hoot
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: `com.sendahoot.app`
   - **SKU**: `hoot-ios-001`
4. Click **"Create"**

---

## Step 5: Wait for TestFlight Processing

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select **"Hoot"** app
3. Go to **"TestFlight"** tab
4. Wait for build to process (10-30 minutes)
5. Status changes from "Processing" to "Ready to Test"

---

## Step 6: Add Beta Testers

### Internal Testing (Recommended - Instant Access)

1. In TestFlight, go to **"Internal Testing"**
2. Click **"+"** to create a group (e.g., "Beta Testers")
3. Add tester emails (they must accept invitation)
4. Select your build and enable it for the group

**Testers will:**
1. Receive email invitation
2. Install **TestFlight** app from App Store
3. Accept invitation
4. Install "Hoot" from TestFlight

---

## Quick Commands Reference

```bash
# Build production app (first time - interactive)
eas build --platform ios --profile production

# Build production app (after credentials set up - non-interactive)
eas build --platform ios --profile production --non-interactive

# Submit to TestFlight
eas submit --platform ios

# Check build status
eas build:list

# View build logs
eas build:view [BUILD_ID]
```

---

## Troubleshooting

### "Credentials are not set up"
- Run the build command interactively (without `--non-interactive`)
- Choose "Set up credentials with EAS" when prompted

### "Distribution Certificate is not validated"
- This is normal for first-time setup
- Run interactively to validate

### Build Fails
- Check logs: `eas build:list` then `eas build:view [BUILD_ID]`
- Common issues: missing dependencies, bundle ID mismatch

---

## What You've Accomplished

✅ EAS CLI installed (globally, best practice)  
✅ Logged in to EAS  
✅ Project configured  
✅ `app.json` updated with encryption compliance  
⏳ **Ready to build!**

**Next:** Run `eas build --platform ios --profile production` in your terminal.

