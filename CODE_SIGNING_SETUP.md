# Code Signing Setup in Xcode

Xcode should have just opened. Follow these steps:

## Step 1: Select Your Development Team

1. In Xcode, click on **"Hoot"** in the left sidebar (the blue project icon at the top)
2. Select the **"Hoot"** target (under "TARGETS")
3. Click the **"Signing & Capabilities"** tab
4. Under **"Signing"**, check **"Automatically manage signing"**
5. In the **"Team"** dropdown, select your Apple Developer account
   - If you don't see your team, click **"Add Account..."** and sign in with your Apple ID
6. Xcode will automatically generate a provisioning profile

## Step 2: Verify Bundle Identifier

Make sure the **Bundle Identifier** is: `com.sendahoot.app`

## Step 3: Build and Run

Once the team is selected:

1. Make sure your iPhone is still connected
2. At the top of Xcode, next to the play button, select **"Clark's iPhone"** from the device dropdown
3. Click the **Play button** (▶️) or press `Cmd + R` to build and run

The app will build and install on your iPhone!

## Troubleshooting

### "No accounts available"
- Click **"Add Account..."** and sign in with your Apple ID
- Make sure you're signed in to the same Apple ID in Xcode → Settings → Accounts

### "Bundle identifier is already in use"
- This means someone else has that identifier
- We can change it to something unique like `com.sendahoot.hoot` or `com.yourname.hoot`

### "Provisioning profile error"
- Make sure "Automatically manage signing" is checked
- Xcode will create the profile automatically

