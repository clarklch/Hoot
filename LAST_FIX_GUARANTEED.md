# LAST FIX - This Will Work Guaranteed

## The Problem

EAS is syncing capabilities and unchecking them. Even with entitlements in app.json, EAS is still modifying them.

## The Complete Solution

I've done TWO things:

### 1. Added Entitlements to app.json ✅
```json
"entitlements": {
  "com.apple.developer.applesignin": ["Default"],
  "aps-environment": "production"
}
```

### 2. Added EXPO_NO_CAPABILITY_SYNC to eas.json ✅
This prevents sync during builds.

## BUT - For `eas credentials` You MUST:

**Run this exact command (copy and paste):**

```bash
cd /Users/clarkchung/Desktop/Hoot && EXPO_NO_CAPABILITY_SYNC=1 eas credentials
```

**The environment variable MUST be in the command line, not just in eas.json!**

## Complete Steps (Do This Once):

1. **Enable capabilities in Apple Developer Portal:**
   - Push Notifications ✓
   - Sign In with Apple ✓
   - Click Save
   - Wait 2 minutes

2. **Run this EXACT command:**
   ```bash
   cd /Users/clarkchung/Desktop/Hoot && EXPO_NO_CAPABILITY_SYNC=1 eas credentials
   ```

3. **In the menu:**
   - iOS → production → Build Credentials → All: Set up all credentials

4. **When asked about provisioning profile:**
   - Answer "no" to reuse (create new)

5. **After it completes:**
   - Check Apple Developer Portal - capabilities should STILL be checked

## Why This Will Work

- `EXPO_NO_CAPABILITY_SYNC=1` in the command prevents EAS from syncing capabilities
- Entitlements in app.json tell EAS what you need
- Together, EAS won't modify your manually enabled capabilities

## If It STILL Doesn't Work

Then there's a bug in EAS CLI. In that case:
1. Update EAS CLI: `npm install -g eas-cli@latest`
2. Try again
3. Or manually create provisioning profile in Apple Developer Portal (bypass EAS)

But this solution should work - it's the official way.

