# Fix: EAS Unchecking Capabilities Issue

## The Problem

Every time you run `eas credentials`, the capabilities (Push Notifications, Sign In with Apple) get unchecked in Apple Developer Portal.

## Root Cause

**EAS Build synchronizes capabilities based on your entitlements file.** According to Expo documentation:
- If a capability is in your entitlements file → EAS enables it in Apple Developer Portal
- If a capability is NOT in your entitlements file but enabled in portal → **EAS DISABLES it** to match your entitlements

This is why they keep getting unchecked!

## Solution Options

### Option 1: Disable Automatic Capability Sync (Recommended)

Add an environment variable to disable EAS's automatic capability synchronization. This allows you to manage capabilities manually in Apple Developer Portal.

**Update `eas.json`:**

```json
{
  "build": {
    "production": {
      "distribution": "store",
      "ios": {
        "simulator": false,
        "env": {
          "EXPO_NO_CAPABILITY_SYNC": "1"
        }
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false,
        "env": {
          "EXPO_NO_CAPABILITY_SYNC": "1"
        }
      }
    },
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true,
        "env": {
          "EXPO_NO_CAPABILITY_SYNC": "1"
        }
      }
    }
  }
}
```

This tells EAS to NOT sync capabilities automatically, so your manual settings in Apple Developer Portal will be preserved.

### Option 2: Ensure Entitlements Are Properly Configured

With Expo's managed workflow, the plugins (`expo-apple-authentication` and `expo-notifications`) should automatically configure entitlements. However, if EAS isn't detecting them, you might need to ensure they're properly configured.

Your `app.json` already has:
- `"usesAppleSignIn": true` ✅
- `"expo-apple-authentication"` plugin ✅
- `"expo-notifications"` plugin ✅
- `UIBackgroundModes: ["remote-notification"]` ✅

These should be enough, but EAS sync might still be causing issues.

## Recommended Action

Use **Option 1** - disable capability sync. This is the safest approach and will prevent EAS from modifying your manually configured capabilities.

After making this change:
1. Enable capabilities in Apple Developer Portal (they'll stay enabled)
2. Regenerate provisioning profile
3. Build should work!

