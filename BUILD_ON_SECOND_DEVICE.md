# Building Hoot on a Second Device (Xcode)

## Prerequisites

✅ **Before you start:**
- Second iPhone connected to your Mac via USB cable
- Developer Mode enabled on the second iPhone (Settings → Privacy & Security → Developer Mode)
- Trust the computer when prompted on the iPhone
- Xcode installed on your Mac

---

## Step 1: Open Xcode Workspace

1. **Open Finder** and navigate to: `/Users/clarkchung/Desktop/Hoot/ios`
2. **Double-click** `Hoot.xcworkspace` (NOT `.xcodeproj`)
3. Wait for Xcode to open and index the project

---

## Step 2: Connect Your Second Device

1. **Connect your second iPhone** to your Mac via USB cable
2. **Unlock your iPhone** and trust the computer if prompted
3. In Xcode, you should see your device appear in the device dropdown at the top

---

## Step 3: Select Your Second Device

1. At the top of Xcode, next to the play button (▶️), click the **device dropdown**
2. You should see both devices listed:
   - Your first iPhone (already has the app)
   - Your second iPhone (new device)
3. **Select your second iPhone** from the dropdown

---

## Step 4: Configure Code Signing

1. In Xcode's left sidebar, click on **"Hoot"** (the blue project icon at the top)
2. Select the **"Hoot"** target (under "TARGETS")
3. Click the **"Signing & Capabilities"** tab
4. Under **"Signing"**:
   - ✅ Check **"Automatically manage signing"**
   - In the **"Team"** dropdown, select your Apple Developer account
   - Xcode will automatically create a provisioning profile for this device

**Note:** If you see a warning about the device not being registered, Xcode will automatically register it when you build.

---

## Step 5: Build and Install

1. **Click the Play button** (▶️) at the top of Xcode, or press `Cmd + R`
2. Xcode will:
   - Build the app (this takes 2-5 minutes the first time)
   - Install it on your second iPhone
   - Launch the app automatically

---

## Step 6: Trust the Developer Certificate (First Time Only)

On your second iPhone:
1. Go to **Settings** → **General** → **VPN & Device Management** (or **Device Management**)
2. You should see your Apple Developer account listed
3. Tap it and tap **"Trust [Your Name]"**
4. Confirm by tapping **"Trust"**
5. The app should now launch properly

---

## Step 7: Connect to Development Server

Both devices need to connect to the same development server:

1. **On your Mac**, make sure the development server is running:
   ```bash
   cd /Users/clarkchung/Desktop/Hoot
   npm start
   ```

2. **On both iPhones**, open the Hoot app
3. If the app doesn't auto-connect:
   - Shake your iPhone
   - Tap **"Configure Bundler"** or **"Enter URL manually"**
   - Enter your Mac's IP address and port: `http://[YOUR_MAC_IP]:8081`
   - To find your Mac's IP: System Settings → Network → Wi-Fi → IP Address

---

## Troubleshooting

### "Device not registered"
- Xcode will automatically register the device when you build
- Make sure the device is unlocked and trusted

### "No development team selected"
- Go to Signing & Capabilities tab
- Select your Apple Developer team from the dropdown
- Make sure "Automatically manage signing" is checked

### "Code signing error"
- Make sure both devices are registered to your Apple Developer account
- Xcode should handle this automatically with "Automatically manage signing"

### "App won't launch after installation"
- Go to Settings → General → VPN & Device Management
- Trust your developer certificate
- Try launching the app again

### "Can't connect to development server"
- Make sure both devices are on the same Wi-Fi network as your Mac
- Make sure `npm start` is running on your Mac
- Check that port 8081 is not blocked by firewall

### "Build fails with code signing error"
- Make sure your Apple Developer account has the right permissions
- Try cleaning the build: Product → Clean Build Folder (Shift + Cmd + K)
- Then rebuild: Product → Build (Cmd + B)

---

## Testing on Both Devices

Once both devices have the app installed:

1. **Device 1**: Sign in with Apple account A
2. **Device 2**: Sign in with Apple account B (or a different account)
3. **Device 1**: Generate QR code in Friends tab
4. **Device 2**: Scan QR code to send friend request
5. **Device 1**: Accept friend request
6. **Device 1**: Send a Hoot to Device 2
7. **Device 2**: Should receive push notification and see the message!

---

## Quick Reference

**Open workspace:**
```bash
open /Users/clarkchung/Desktop/Hoot/ios/Hoot.xcworkspace
```

**Start dev server:**
```bash
cd /Users/clarkchung/Desktop/Hoot
npm start
```

**Build in Xcode:**
- Select device → Click Play button (▶️) or press `Cmd + R`

**Clean build:**
- Product → Clean Build Folder (Shift + Cmd + K)

---

## Notes

- Both devices can run the app simultaneously
- Both devices connect to the same development server
- Code changes will hot-reload on both devices
- Each device needs to trust the developer certificate once
- Both devices must be on the same Wi-Fi network as your Mac

