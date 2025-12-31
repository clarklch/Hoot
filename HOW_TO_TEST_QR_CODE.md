# How to Test QR Code Scanning with One Device

Since you only have Expo Go on one phone, here are several ways to test the QR code scanning feature:

## Option 1: Use a Computer Screen (Easiest) ✅

1. **Generate QR code on your phone:**
   - Open Hoot app
   - Go to Friends tab
   - Tap "Generate My QR Code"
   - The QR code will appear on your phone screen

2. **Display QR code on computer:**
   - Take a screenshot of the QR code on your phone
   - AirDrop it to your Mac, or email it to yourself
   - Open the image on your computer screen
   - Make the image large enough to scan

3. **Scan from phone:**
   - In the Hoot app, go to Friends tab
   - Tap "Scan QR Code"
   - Point your phone's camera at the QR code on your computer screen
   - It should scan successfully!

## Option 2: Use a Second Device (If Available)

1. **Device A (your phone):**
   - Generate QR code in Hoot app
   - Keep the QR code screen open

2. **Device B (another phone/tablet):**
   - Install Expo Go on Device B
   - Open Hoot app on Device B
   - Go to Friends tab > "Scan QR Code"
   - Point Device B's camera at Device A's QR code

## Option 3: Print or Display on Another Screen

1. Generate QR code on your phone
2. Take a screenshot
3. Display it on:
   - Another phone/tablet
   - A TV/monitor
   - Print it out (if you have a printer)
4. Scan with your phone

## Option 4: Test with Same Account (Limited Testing)

⚠️ **Note:** The app prevents you from sending a friend request to yourself, so this won't fully test the friend request flow, but you can test:
- QR code generation ✅
- QR code scanning ✅
- Error handling (should show "cannot send to yourself" message) ✅

## Quick Test Steps:

1. **Generate QR Code:**
   ```
   Friends Tab → "Generate My QR Code"
   ```

2. **Display QR Code:**
   - Screenshot it
   - Open on computer/another device

3. **Scan QR Code:**
   ```
   Friends Tab → "Scan QR Code"
   Point camera at the displayed QR code
   ```

4. **Expected Result:**
   - If scanning your own QR code: "You cannot send a friend request to yourself"
   - If scanning another user's QR code: "Friend request sent!"

## Troubleshooting:

**QR code won't scan?**
- Make sure the QR code is large enough on the screen
- Ensure good lighting
- Hold phone steady
- Try moving closer/farther from the QR code

**Camera permission denied?**
- Go to iPhone Settings > Hoot > Camera
- Enable camera access

**QR code appears too small?**
- The QR code is 250x250 pixels
- Try zooming in on the screenshot when displaying it

---

**Recommendation:** Use Option 1 (computer screen) - it's the easiest way to test with one device! 🎯

