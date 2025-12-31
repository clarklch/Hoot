# How to Check if Firebase is Connected

## Method 1: Check the Console (Easiest)

1. **Open your terminal** where you ran `npm start` or `expo start`
2. **Look for any Firebase errors** - If you see errors like "Firebase: Error" or connection issues, Firebase isn't working
3. **Try creating a username** - If it works, Firebase is connected!

## Method 2: Check Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **hoot-7fe85**
3. Click **"Firestore Database"** in the left menu
4. **Try creating a username in the app**
5. **Check if data appears** in Firestore:
   - Look for a `usernames` collection
   - Look for a `users` collection
   - If you see data appearing, Firebase is working! ✅

## Method 3: Visual Test in App

The easiest way is to just try using the app:
- Click "Continue" on login screen
- Try to create a username
- If it works without errors, Firebase is connected!

## What to Look For

### ✅ Firebase IS Working If:
- You can create a username successfully
- No error messages appear
- Data shows up in Firebase Console
- Friend requests work
- You can send Hoots

### ❌ Firebase is NOT Working If:
- You see error messages in the terminal
- Username creation fails
- Nothing appears in Firebase Console
- App crashes when trying to use Firebase features

## Quick Test

**Try this right now:**
1. In the app, click "Continue"
2. Enter a test username (like "test123")
3. Click "Continue" button
4. If it works and takes you to the home screen → **Firebase is connected!** ✅
5. If you get an error → Firebase needs to be set up

---

**Bottom line:** If you can create a username, Firebase is working! 🎉

