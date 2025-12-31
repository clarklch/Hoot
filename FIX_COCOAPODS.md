# Fix CocoaPods Installation for Ruby 2.6

Your Ruby version (2.6.10) is too old for the latest ffi. We need to install an older compatible version.

## Solution: Install Older ffi Version

Run these commands in your terminal:

```bash
# Step 1: Install an older ffi version that works with Ruby 2.6
sudo gem install ffi -v 1.14.2

# Step 2: Install CocoaPods (it will use the older ffi)
sudo gem install cocoapods

# Step 3: Verify installation
pod --version
```

## If That Doesn't Work, Try Even Older Version

If you still get errors, try an even older ffi:

```bash
sudo gem install ffi -v 1.13.1
sudo gem install cocoapods
```

## Alternative: Install Specific CocoaPods Version

If the above doesn't work, try installing an older CocoaPods version that doesn't require the latest ffi:

```bash
sudo gem install cocoapods -v 1.11.3
```

## Then Build Your App

Once CocoaPods is installed:

```bash
cd /Users/clarkchung/Desktop/Hoot
npx expo run:ios
```

