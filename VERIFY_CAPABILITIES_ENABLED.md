# Verify Capabilities Are Actually Enabled

## The Problem

Even though you enabled the capabilities, EAS is still detecting them as "Disabled". We need to double-check they're actually enabled and saved.

## Step-by-Step Verification

### Step 1: Go to Apple Developer Portal
1. Go to: https://developer.apple.com/account/
2. Sign in

### Step 2: Navigate to Your App ID
1. Click **"Certificates, Identifiers & Profiles"**
2. Click **"Identifiers"** in the left sidebar
3. Find and click: **com.sendahoot.app**

### Step 3: Check Push Notifications
1. Scroll down to **"Capabilities"** section
2. Find **"Push Notifications"**
3. **Look carefully:** Is it checked/enabled?
   - Should show a checkmark ✓
   - Should NOT show "Configurable" or "Configure" button
   - Should be green/active
4. If it's NOT checked, check it and click **"Save"** at the top right

### Step 4: Check Sign in with Apple
1. Still in the Capabilities section
2. Find **"Sign In with Apple"**
3. **Look carefully:** Is it checked/enabled?
   - Should show a checkmark ✓
   - Should be enabled/active
4. If it's NOT checked, check it and click **"Save"** at the top right

### Step 5: Save Changes
1. After checking both, click **"Save"** button at the top right
2. Wait for confirmation that it saved
3. Refresh the page and verify they're still checked

### Step 6: Wait for Sync
1. Wait 2-3 minutes for changes to propagate
2. Then try regenerating the provisioning profile again

## Common Issues

1. **Capabilities weren't actually saved** - You checked them but didn't click "Save"
2. **Page wasn't refreshed** - You enabled them but the page needs a refresh
3. **Wrong App ID** - Make sure you're editing `com.sendahoot.app`, not a different one
4. **Sync delay** - Changes can take a few minutes to propagate

## After Verifying

1. Go back to terminal
2. Run: `eas credentials`
3. Delete the provisioning profile again
4. Regenerate it
5. This time it should show: "Synced capabilities: Enabled: Push Notifications, Sign In with Apple"

