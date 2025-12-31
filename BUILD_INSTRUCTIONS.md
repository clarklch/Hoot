# Building Your App - Fix CocoaPods Issue

## The Problem
Your Ruby version (2.6.10) is too old for the latest CocoaPods. We need to install an older compatible version first.

## Solution: Install Older ffi, Then CocoaPods

Run these commands in your terminal (you'll be asked for your password):

```bash
# Step 1: Install the compatible ffi version
sudo gem install ffi -v 1.17.3

# Step 2: Install CocoaPods
sudo gem install cocoapods

# Step 3: Verify installation
pod --version
```

You should see a version number like `1.15.2`.

## Then Build Your App

Once CocoaPods is installed, run:

```bash
cd /Users/clarkchung/Desktop/Hoot
npx expo run:ios
```

## What to Expect

- First build takes 5-10 minutes (downloads dependencies)
- You'll be asked to select a simulator or connected device
- The app will build and launch automatically
- You should see the **Sign in with Apple** button on the welcome screen

## Alternative: Use Simulator

If you want to test on the iOS Simulator (no physical device needed):

```bash
npx expo run:ios --device
```

Then select a simulator from the list.

## Troubleshooting

### "Still getting Ruby version error"
Try installing a specific older version of CocoaPods:
```bash
sudo gem install cocoapods -v 1.14.3
```

### "Permission denied"
Make sure you're using `sudo` and entering your Mac password when prompted.

### "Build fails with Xcode errors"
Make sure you have Xcode installed:
```bash
xcode-select --install
```

