# Push Notifications Setup Guide

This guide will help you set up Firebase Cloud Functions to send push notifications when Hoots are sent.

## Step 1: Install Firebase CLI

Open your terminal and run:

```bash
npm install -g firebase-tools
```

Verify installation:
```bash
firebase --version
```

## Step 2: Login to Firebase

```bash
firebase login
```

This will open a browser window. Log in with the same Google account you used for Firebase.

## Step 3: Initialize Firebase Functions

In your project directory (`/Users/clarkchung/Desktop/Hoot`), run:

```bash
firebase init functions
```

When prompted:
- **Select your Firebase project**: Choose `hoot-7fe85`
- **Language**: Choose **TypeScript** (recommended)
- **Use ESLint**: **Yes**
- **Install dependencies**: **Yes**

## Step 4: Install Required Packages

```bash
cd functions
npm install expo-server-sdk
npm install firebase-admin
cd ..
```

## Step 5: Update Functions Code

The functions code is already prepared in `BACKEND_SETUP.md`. I'll create the file for you.

## Step 6: Deploy Functions

```bash
firebase deploy --only functions
```

## Step 7: Test Push Notifications

1. Run your app
2. Send a Hoot to a friend
3. Check if they receive a push notification

---

## Troubleshooting

### Functions won't deploy
- Make sure you're logged in: `firebase login`
- Check your project ID matches: `firebase projects:list`

### Notifications not sending
- Check Firebase Functions logs: `firebase functions:log`
- Verify push tokens are stored in Firestore
- Check that `notifications` collection documents are being created

### Need Help?
- Check `BACKEND_SETUP.md` for detailed code examples
- Firebase Console > Functions > Logs for error messages

