# EAS Capability Sync Issue - FIXED ✅

## What Was The Problem?

EAS Build was **automatically synchronizing capabilities** from your entitlements file to Apple Developer Portal. Every time you ran `eas credentials`, EAS would:
1. Check what capabilities are in your entitlements file
2. Update Apple Developer Portal to match
3. If a capability was enabled in portal but not properly detected in entitlements → **EAS would disable it**

This is why your capabilities kept getting unchecked!

## The Fix

I've added `EXPO_NO_CAPABILITY_SYNC=1` environment variable to your `eas.json` file. This tells EAS to **NOT automatically sync capabilities**, allowing you to manage them manually in Apple Developer Portal.

## What This Means

✅ **Capabilities you enable in Apple Developer Portal will STAY enabled**
✅ **EAS won't modify them automatically**
✅ **You have full control over capabilities**

## Next Steps

1. **Enable capabilities in Apple Developer Portal:**
   - Go to Apple Developer Portal
   - Navigate to: Certificates, Identifiers & Profiles → Identifiers → `com.sendahoot.app`
   - Enable: Push Notifications ✓
   - Enable: Sign In with Apple ✓
   - Click "Save"

2. **Regenerate provisioning profile:**
   ```bash
   eas credentials
   ```
   - Select: iOS → production → Build Credentials → All: Set up all credentials
   - Generate new provisioning profile (should now detect the enabled capabilities)

3. **Build your app:**
   - Build from GitHub via Expo.dev
   - The capabilities should now stay enabled!

## Technical Details

The `EXPO_NO_CAPABILITY_SYNC=1` environment variable disables EAS's automatic capability synchronization feature. This is a documented feature in Expo/EAS that allows you to manage capabilities manually instead of letting EAS auto-sync them.

Reference: https://docs.expo.dev/build-reference/ios-capabilities/

