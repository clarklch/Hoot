# Fix: Provisioning Profile Missing Capabilities

## Error
The provisioning profile doesn't support:
- Push Notifications capability
- Sign in with Apple capability

## Root Cause
These capabilities need to be enabled in your Apple Developer Portal App ID, and then the provisioning profile needs to be regenerated.

## Solution: Enable Capabilities in Apple Developer Portal

### Step 1: Go to Apple Developer Portal
1. Go to: https://developer.apple.com/account/
2. Sign in with your Apple Developer account

### Step 2: Navigate to App ID
1. Click **"Certificates, Identifiers & Profiles"**
2. Click **"Identifiers"** in the left sidebar
3. Find and click on your App ID: **com.sendahoot.app**
4. Click on it to edit

### Step 3: Enable Sign in with Apple
1. Scroll down to **"Capabilities"** section
2. Find **"Sign In with Apple"**
3. **Check the box** to enable it
4. Click **"Save"** at the top right

### Step 4: Enable Push Notifications
1. Still in the App ID settings
2. Find **"Push Notifications"** in the Capabilities section
3. **Check the box** to enable it
4. Click **"Save"** at the top right

**Note:** Push Notifications might require additional setup (APNs certificates), but you need to enable the capability first.

### Step 5: Regenerate Provisioning Profile via EAS

After enabling capabilities, EAS needs to regenerate the provisioning profile. You have two options:

#### Option A: Clear Credentials and Rebuild (Recommended)
1. Go to your terminal
2. Run:
   ```bash
   cd /Users/clarkchung/Desktop/Hoot
   eas credentials
   ```
3. Select **iOS**
4. Select **"Remove all credentials and start fresh"** or **"Remove provisioning profile"**
5. This will force EAS to regenerate credentials with the new capabilities

#### Option B: Just Rebuild (EAS Auto-Detects)
Sometimes EAS will automatically detect the changes. Try rebuilding:
1. Go to expo.dev
2. Create a new build from GitHub
3. EAS should detect the enabled capabilities and regenerate the profile

---

## Quick Checklist

- [ ] Enabled "Sign In with Apple" in Apple Developer Portal App ID
- [ ] Enabled "Push Notifications" in Apple Developer Portal App ID
- [ ] Saved changes in Apple Developer Portal
- [ ] Cleared/regenerated provisioning profile in EAS (or just rebuild)
- [ ] Build new version from GitHub

---

## Expected Result

After doing this:
- ✅ Provisioning profile will include both capabilities
- ✅ Build should succeed
- ✅ App will have Push Notifications and Sign in with Apple enabled

## If Push Notifications Still Has Issues

If you get errors about APNs certificates:
- For Expo Push Notifications, you might not need APNs certificates initially
- EAS handles push notifications through Expo's service
- If needed, you can configure APNs later in Firebase Console

