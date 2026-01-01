# COMPLETE FINAL FIX - This Will Work

## What I've Fixed

1. ✅ Added explicit entitlements to `app.json`
2. ✅ Added `EXPO_NO_CAPABILITY_SYNC=1` to `eas.json` (for builds)

## What You Need to Do (One Time Setup)

### Step 1: Enable Capabilities in Apple Developer Portal
1. Go to: https://developer.apple.com/account/
2. Certificates, Identifiers & Profiles → Identifiers → `com.sendahoot.app`
3. Check: Push Notifications ✓
4. Check: Sign In with Apple ✓
5. Click "Save"
6. **Wait 2 minutes**

### Step 2: Run EAS Credentials WITH Environment Variable
**This is critical - you MUST include the environment variable:**

```bash
cd /Users/clarkchung/Desktop/Hoot
EXPO_NO_CAPABILITY_SYNC=1 eas credentials
```

**DO NOT just run `eas credentials` - you MUST include `EXPO_NO_CAPABILITY_SYNC=1` before it!**

### Step 3: Navigate Menu
1. Select: **iOS**
2. Select: **production**
3. Select: **Build Credentials**
4. Select: **All: Set up all the required credentials**

### Step 4: When Asked About Provisioning Profile
- If it asks about reusing a profile → Answer **"no"** (create new)
- Let EAS create a fresh profile

### Step 5: Verify Capabilities Stay Enabled
After running, immediately check Apple Developer Portal - capabilities should STILL be checked.

## Why This Will Work

1. **Entitlements in app.json** - Tells EAS what capabilities you need
2. **EXPO_NO_CAPABILITY_SYNC=1** - Prevents EAS from modifying capabilities during `eas credentials`
3. **Both together** - EAS knows what you need AND won't modify them

## After This Works

Once you have a valid provisioning profile with capabilities:
- You won't need to run `eas credentials` again unless the profile expires
- Future builds will use the existing profile
- Capabilities will stay enabled

## If It STILL Gets Unchecked

If after following these exact steps it still gets unchecked, the issue might be:
1. EAS CLI bug - try updating: `npm install -g eas-cli@latest`
2. Or you might need to manually create the provisioning profile in Apple Developer Portal instead of using EAS

But this solution should work - it's the official Expo way.

