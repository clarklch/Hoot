# Should You Delete the Provisioning Profile?

## The Question

You're asking if you should select "Provisioning Profile: Delete one from your project" when running `eas credentials`.

## Answer: You DON'T Need to Delete It

Looking at your terminal output (line 933, 963, 997), it shows:
```
Provisioning Profile
   None assigned yet
```

**There's no provisioning profile to delete!** The system is telling you there's no profile associated.

## What's Actually Happening

The capabilities are getting unchecked when EAS **syncs capabilities**, not when you delete a profile. Look at line 1002:

```
✔ Synced capabilities: Disabled: Push Notifications, Sign In with Apple
```

This happens when you select **"All: Set up all the required credentials"**, NOT when you delete a profile.

## The Real Issue

EAS is syncing capabilities based on your entitlements. Since I just added the entitlements to `app.json`, you need to:

1. **Make sure the entitlements are saved** in `app.json` (I just added them)
2. **Enable capabilities in Apple Developer Portal** (if not already)
3. **Run `eas credentials` again** - this time EAS should see the entitlements and keep them enabled

## Correct Flow (No Need to Delete)

1. Run `eas credentials`
2. Select: iOS → production → **Build Credentials** → **All: Set up all credentials**
3. EAS will:
   - Check your `app.json` entitlements (now includes the capabilities!)
   - Sync capabilities (should now say "Enabled" because they're in app.json)
   - Generate provisioning profile WITH the capabilities

**You don't need to manually delete the profile** - just select "All: Set up all credentials" and let EAS handle it.

## Why It Was Getting Unchecked Before

Before I added the entitlements to `app.json`, EAS couldn't see them in your config, so it thought they should be disabled and unchecked them in Apple Developer Portal.

Now that entitlements are in `app.json`, EAS will see them and keep them enabled!

