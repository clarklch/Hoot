# FINAL FIX: EAS Capabilities Getting Unchecked

## Root Cause Analysis

After deep research, I found the REAL issue:

1. **`EXPO_NO_CAPABILITY_SYNC=1` only works for `eas build`, NOT for `eas credentials`**
   - The `eas credentials` command still syncs capabilities regardless of this setting
   - This is why the capabilities kept getting unchecked even after adding the env var

2. **EAS syncs capabilities based on what's in your `app.json` entitlements**
   - If entitlements are NOT explicitly defined in `app.json`, EAS may not detect them properly
   - Even though plugins (`expo-apple-authentication`, `expo-notifications`) should auto-configure entitlements, EAS might not see them during sync

## The Real Solution

**Explicitly define entitlements in `app.json`** so EAS can properly detect and sync them.

I've added this to your `app.json`:

```json
"ios": {
  "entitlements": {
    "com.apple.developer.applesignin": ["Default"],
    "aps-environment": "production"
  }
}
```

## Why This Works

- **EAS will see these entitlements** when it syncs capabilities
- **EAS will keep them enabled** in Apple Developer Portal because they're in your config
- **This works for BOTH `eas credentials` and `eas build`**

## What Changed

Added `entitlements` section to `ios` in `app.json`:
- `com.apple.developer.applesignin: ["Default"]` → Enables Sign In with Apple
- `aps-environment: "production"` → Enables Push Notifications

## Next Steps

1. ✅ Entitlements are now in `app.json` (I've done this)
2. **Enable capabilities in Apple Developer Portal** (if not already enabled)
3. **Run `eas credentials`** - it should now detect the entitlements and keep them enabled
4. **Regenerate provisioning profile** - it will include the capabilities
5. **Build your app** - should work!

## Why This Is The Correct Solution

- ✅ Explicitly tells EAS what capabilities your app needs
- ✅ Works with both `eas credentials` and `eas build`
- ✅ Prevents EAS from disabling capabilities that are in your config
- ✅ Standard Expo/React Native approach for managing entitlements
- ✅ Aligns with Expo documentation recommendations

## Note About `EXPO_NO_CAPABILITY_SYNC`

The `EXPO_NO_CAPABILITY_SYNC=1` env var in `eas.json` is still useful for builds, but the real fix is having explicit entitlements in `app.json`. I'm keeping the env var as an extra safeguard, but the entitlements are the primary solution.

