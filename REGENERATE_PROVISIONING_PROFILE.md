# How to Regenerate Provisioning Profile After Enabling Capabilities

## The Problem
You enabled Push Notifications and Sign in with Apple in Apple Developer Portal, but EAS is still using the old provisioning profile that was created BEFORE those capabilities were enabled.

## Solution: Regenerate Provisioning Profile via EAS CLI

### Option 1: Clear and Regenerate Credentials (Recommended)

1. Open your terminal
2. Run:
   ```bash
   cd /Users/clarkchung/Desktop/Hoot
   eas credentials
   ```
3. Follow the prompts:
   - Select: **iOS**
   - Select: **production** (or the profile you're building with)
   - Choose: **Remove provisioning profile** or **Clear credentials** (if available)
   - OR choose to **Update provisioning profile**

This will force EAS to create a NEW provisioning profile that includes the newly enabled capabilities.

### Option 2: Use EAS Credentials Command Directly

If the interactive menu doesn't have the right options, try:

```bash
cd /Users/clarkchung/Desktop/Hoot
eas credentials --platform ios
```

Then look for options to:
- Remove/recreate provisioning profile
- Sync capabilities
- Update credentials

### Option 3: Just Rebuild (EAS Auto-Sync)

Sometimes EAS automatically detects the changes. You can try:
1. Wait 2-3 minutes for Apple's changes to fully propagate
2. Build again from GitHub via Expo.dev
3. EAS might automatically sync and regenerate the profile

**Note:** This doesn't always work, so Option 1 is more reliable.

---

## What Happens When You Regenerate

1. EAS detects that the App ID now has Push Notifications and Sign in with Apple enabled
2. EAS creates a NEW provisioning profile that includes these capabilities
3. The new profile will have the entitlements: `aps-environment` and `com.apple.developer.applesignin`
4. Your next build will use this new profile and succeed ✅

---

## Timeline

- **Apple Developer Portal changes:** Usually propagate within 1-2 minutes
- **EAS credential regeneration:** Takes 1-2 minutes
- **New build:** Should succeed after profile is regenerated

---

## Quick Steps Summary

1. ✅ Enabled capabilities in Apple Developer Portal (you did this)
2. ⏳ Wait 2-3 minutes for changes to propagate
3. 🔄 Run `eas credentials` to regenerate provisioning profile
4. 🔨 Build again from GitHub
5. ✅ Build should succeed!

