# Why "Synced capabilities: Disabled"?

## What This Message Means

When EAS says **"Synced capabilities: Disabled: Push Notifications, Sign In with Apple"**, it means:

- EAS just checked Apple Developer Portal
- EAS found that these capabilities are **currently disabled** on your App ID (`com.sendahoot.app`)
- EAS is reporting what it found - it's not modifying anything

## EAS Cannot Modify App ID Capabilities

Important: **EAS cannot disable or enable capabilities on your App ID**. It can only:
- Read the current state from Apple Developer Portal
- Create provisioning profiles based on what's enabled

If EAS says "Disabled", the App ID actually has them disabled in Apple Developer Portal.

## Why They Keep Getting Unchecked

This is unusual. Here are possible causes:

1. **Not saving properly** - You checked the boxes but didn't click "Save"
2. **Browser cache** - The page is showing stale data
3. **Looking at wrong App ID** - You're checking a different App ID
4. **Sync delay** - Changes haven't propagated yet
5. **Something else is modifying it** - Very unlikely, but possible

## What To Do Right Now

**Don't generate the provisioning profile yet** - answer "n" to the prompt, because it will create a profile WITHOUT the capabilities.

Instead:

1. **Go to Apple Developer Portal** (in a web browser, not in terminal)
2. **Navigate to**: Certificates, Identifiers & Profiles → Identifiers → `com.sendahoot.app`
3. **Check the capabilities**:
   - Push Notifications - should be CHECKED ✓
   - Sign In with Apple - should be CHECKED ✓
4. **Click "Save"** at the top right
5. **Wait for confirmation** that it saved
6. **Refresh the page** (F5 or Cmd+R)
7. **Verify they're still checked** after refresh
8. **Wait 3-5 minutes** for changes to fully propagate
9. **Then regenerate the profile** using `eas credentials`

## Quick Test

If the capabilities are truly enabled and saved in Apple Developer Portal, but EAS still says "Disabled" after 5+ minutes, then there might be a sync issue. But 99% of the time, it means they're actually disabled in the portal.

