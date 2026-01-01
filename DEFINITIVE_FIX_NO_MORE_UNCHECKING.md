# DEFINITIVE FIX - Capabilities Will NOT Get Unchecked Anymore

## The Complete Solution

I've implemented TWO fixes to ensure capabilities stay enabled:

### Fix 1: Explicit Entitlements in app.json ✅
Added entitlements so EAS knows what capabilities your app needs:
```json
"entitlements": {
  "com.apple.developer.applesignin": ["Default"],
  "aps-environment": "production"
}
```

### Fix 2: Environment Variable for eas.json ✅
Added `EXPO_NO_CAPABILITY_SYNC=1` to all build profiles in eas.json.

## BUT - For `eas credentials` Command

The environment variable in `eas.json` only works for `eas build`, NOT for `eas credentials`.

**You MUST run `eas credentials` with the environment variable set in the terminal:**

```bash
EXPO_NO_CAPABILITY_SYNC=1 eas credentials
```

## Step-by-Step (Do This Exactly)

### Step 1: Enable Capabilities in Apple Developer Portal
1. Go to Apple Developer Portal
2. Certificates, Identifiers & Profiles → Identifiers → `com.sendahoot.app`
3. Enable: Push Notifications ✓
4. Enable: Sign In with Apple ✓
5. Click "Save"
6. **Refresh the page and verify they're still checked**

### Step 2: Run EAS Credentials WITH Environment Variable
```bash
cd /Users/clarkchung/Desktop/Hoot
EXPO_NO_CAPABILITY_SYNC=1 eas credentials
```

**CRITICAL:** The `EXPO_NO_CAPABILITY_SYNC=1` must be in the command, not just in eas.json.

### Step 3: Navigate Menu
1. Select: **iOS**
2. Select: **production**
3. Select: **Build Credentials: Manage everything needed to build your project**
4. Select: **All: Set up all the required credentials to build your project**

### Step 4: When Asked About Provisioning Profile
- If it asks "Would you like to reuse the original profile?" → Answer **"no"** (create new one)
- This will create a fresh profile

### Step 5: Verify
After running, check Apple Developer Portal again - capabilities should STILL be checked.

## Why This Will Work

1. **Entitlements in app.json** - EAS knows what capabilities you need
2. **EXPO_NO_CAPABILITY_SYNC=1** - Prevents EAS from modifying capabilities
3. **Running with env var** - Ensures it applies to `eas credentials` command

## If It Still Gets Unchecked

If after following these exact steps the capabilities still get unchecked, then:
1. There might be a bug in EAS CLI
2. Or you might need to update EAS CLI: `npm install -g eas-cli@latest`
3. Or contact Expo support

But this solution should work - it's the official way to prevent capability sync.

