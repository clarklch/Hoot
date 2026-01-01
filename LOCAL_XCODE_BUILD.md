# Building Locally via Xcode to Test on Device

## Quick Steps

1. **Xcode should now be open** with your project

2. **Connect your iPhone** to your Mac via USB cable

3. **In Xcode:**
   - At the top, click the device selector (next to "Hoot" scheme)
   - Select your iPhone from the list
   - Make sure it shows your device name (not "Any iOS Device")

4. **Select the Scheme:**
   - Make sure "Hoot" is selected (top left, next to device selector)

5. **Check Signing:**
   - Click on "Hoot" project in the left sidebar
   - Select "Hoot" target
   - Go to "Signing & Capabilities" tab
   - Make sure "Automatically manage signing" is checked
   - Select your Team (Apple Developer account)

6. **Build and Run:**
   - Press `Cmd + R` (or click the Play button)
   - Or: Product → Run

7. **On your iPhone:**
   - If prompted, tap "Trust This Computer"
   - You might need to go to Settings → General → VPN & Device Management
   - Trust your developer certificate

## Troubleshooting

### "No devices found"
- Make sure iPhone is unlocked
- Make sure you tapped "Trust" on iPhone
- Try unplugging and replugging USB cable

### Signing errors
- Make sure your Apple Developer account is selected in Xcode
- Go to Xcode → Settings → Accounts → Add your Apple ID
- Make sure "Automatically manage signing" is enabled

### Build errors
- Make sure CocoaPods are installed: `cd ios && pod install`
- Clean build: Product → Clean Build Folder (Cmd+Shift+K)
- Try building again

## After Build Succeeds

Once the app installs on your phone:
1. Open the app
2. Try signing in with Apple
3. Watch the Xcode console for logs (View → Debug Area → Activate Console, or Cmd+Shift+Y)
4. Check if navigation to username screen works
5. Verify user appears in Firebase Console

## Viewing Logs in Xcode

1. **Open Console:**
   - View → Debug Area → Activate Console
   - Or press `Cmd + Shift + Y`

2. **Filter logs:**
   - Use the search box to filter by emoji (🍎, 🔥, ✅, ❌)
   - Or search for "Sign in" or "Firebase"

3. **Look for these logs:**
   - `🍎 Starting Sign in with Apple...`
   - `✅ Firebase sign-in successful!`
   - `👤 Setting user state from signIn()`
   - `➡️ Navigating to username creation screen`

## Alternative: Use Terminal Command (If Xcode Fails)

```bash
cd /Users/clarkchung/Desktop/Hoot
npx expo run:ios --device
```

Then select your device from the list when prompted.

