# TestFlight Deployment Guide

## Prerequisites

✅ **You already have:**
- EAS project configured (`projectId: 2901f7b5-e5f2-4774-bfca-970cf49a4d6f`)
- Bundle ID set: `com.sendahoot.app`
- Apple Developer account (you set up Sign in with Apple)
- App configured in Apple Developer Portal

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 2: Login to EAS

```bash
eas login
```

Use your Expo account (create one at https://expo.dev if needed).

## Step 3: Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **"My Apps"** → **"+"** → **"New App"**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Hoot
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: Select `com.sendahoot.app` (should already exist from Apple Developer setup)
   - **SKU**: `hoot-ios-001` (any unique identifier)
   - **User Access**: Full Access
4. Click **"Create"**

## Step 4: Update App Version (Optional)

If you want to bump the version before building:

```json
// In app.json, update:
"version": "1.0.1"  // or whatever version you want
```

## Step 5: Build for TestFlight

```bash
eas build --platform ios --profile production
```

This will:
- Build your app in the cloud
- Take 15-30 minutes
- Generate an `.ipa` file

**Note:** First build will ask you to configure credentials. Choose:
- **"Set up credentials with EAS"** (recommended - EAS manages everything)

## Step 6: Submit to TestFlight

After the build completes:

```bash
eas submit --platform ios
```

This will:
- Upload the build to App Store Connect
- Process it for TestFlight (takes 10-30 minutes)

## Step 7: Configure TestFlight

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select your **Hoot** app
3. Go to **"TestFlight"** tab
4. Wait for build to finish processing (status will change from "Processing" to "Ready to Test")

## Step 8: Add Beta Testers

### Option A: Internal Testing (Up to 100 testers, instant access)

1. In TestFlight, go to **"Internal Testing"**
2. Click **"+"** to create a group (e.g., "Beta Testers")
3. Add testers by email (they must accept the invitation)
4. Select your build and enable it for the group

### Option B: External Testing (Up to 10,000 testers, requires review)

1. Go to **"External Testing"**
2. Create a group
3. Add testers
4. Submit for Beta App Review (takes 24-48 hours)

**For friends testing, use Internal Testing - it's instant!**

## Step 9: Testers Install TestFlight

Your testers need to:
1. Install **TestFlight** app from App Store
2. Accept your email invitation
3. Open TestFlight and install "Hoot"

## Important Notes

### Code Signing
- EAS will handle code signing automatically
- Make sure your Apple Developer account has the right permissions

### Push Notifications
- Push notifications work in TestFlight builds
- Make sure your Firebase iOS app is configured (you did this earlier)

### Sign in with Apple
- Should work in TestFlight (you've already configured it)

### Updates
- To push updates: Just run `eas build` and `eas submit` again
- Testers will get notified of new builds in TestFlight

## Troubleshooting

### Build Fails
- Check EAS build logs: `eas build:list`
- Make sure all dependencies are compatible
- Check that bundle ID matches Apple Developer Portal

### TestFlight Processing Fails
- Usually means there's an issue with the build
- Check App Store Connect for error messages
- Common issues: missing entitlements, code signing problems

### Testers Can't Install
- Make sure they accepted the TestFlight invitation
- Check that the build is enabled for their group
- Verify they have TestFlight app installed

## Quick Commands Reference

```bash
# Build for TestFlight
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios

# Check build status
eas build:list

# View build logs
eas build:view [BUILD_ID]
```

## Next Steps After Beta Testing

1. Collect feedback from testers
2. Fix bugs
3. Build new version: `eas build --platform ios --profile production`
4. Submit again: `eas submit --platform ios`
5. When ready for App Store: Submit for App Review in App Store Connect

