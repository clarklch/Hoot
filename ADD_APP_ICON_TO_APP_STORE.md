# Add App Icon to App Store Connect

## Current Status

Your app icon is configured in `app.json` as `./assets/images/icon.png`, but you need to upload it to App Store Connect for it to appear in TestFlight and the App Store.

---

## Step 1: Verify Your Icon File

Your icon should be:
- **Size:** 1024x1024 pixels
- **Format:** PNG
- **No transparency** (solid background)
- **Square** (not rounded - Apple will round it automatically)

**Current icon location:** `assets/images/icon.png`

---

## Step 2: Check Icon Requirements

Let's verify your icon meets Apple's requirements:

```bash
# Check icon dimensions (if you have ImageMagick or similar)
# Or just open it in Preview and check the size
```

**Apple Requirements:**
- ✅ 1024x1024 pixels (exactly)
- ✅ PNG format
- ✅ No alpha channel (no transparency)
- ✅ RGB color space
- ✅ Square (1:1 aspect ratio)

---

## Step 3: Upload Icon to App Store Connect

### Method 1: Via App Information (Recommended)

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select your **"Send a Hoot"** app
3. Click **"App Information"** in the left sidebar (or click the app name at the top)
4. Scroll down to **"App Icon"** section
5. Click **"Choose File"** or drag and drop your icon
6. Select `assets/images/icon.png` from your project
7. Click **"Save"** or **"Upload"**

### Method 2: Via Version Information

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select your **"Send a Hoot"** app
3. Go to **"App Store"** tab
4. Select a version (or create one)
5. Scroll to **"App Icon"** section
6. Upload your icon

---

## Step 4: Verify Icon Appears

After uploading:
- Icon should appear in App Store Connect immediately
- May take a few minutes to appear in TestFlight
- Will appear in App Store when you submit for review

---

## Troubleshooting

### "Icon doesn't meet requirements"
- Check that it's exactly 1024x1024 pixels
- Verify it's PNG format
- Make sure there's no transparency
- Try exporting a fresh copy from your design tool

### "Icon not showing in TestFlight"
- Wait a few minutes (can take time to propagate)
- Try refreshing the TestFlight page
- Verify upload was successful in App Store Connect

### "Need to resize icon"
If your icon isn't 1024x1024:

**On Mac (using Preview):**
1. Open `assets/images/icon.png` in Preview
2. Tools → Adjust Size
3. Set to 1024x1024 pixels
4. Save

**On Mac (using sips command):**
```bash
sips -z 1024 1024 assets/images/icon.png --out assets/images/icon-1024.png
```

---

## Quick Checklist

- [ ] Icon is 1024x1024 pixels
- [ ] Icon is PNG format
- [ ] Icon has no transparency
- [ ] Icon uploaded to App Store Connect
- [ ] Icon appears in App Store Connect
- [ ] Icon appears in TestFlight (may take a few minutes)

---

## Summary

1. **Verify icon:** Check it's 1024x1024 PNG, no transparency
2. **Upload:** App Store Connect → App Information → App Icon
3. **Wait:** May take a few minutes to appear in TestFlight
4. **Done:** Icon will show for all testers!

Your icon file is at: `assets/images/icon.png`

