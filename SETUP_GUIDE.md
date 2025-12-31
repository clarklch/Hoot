# Hoot App Setup Guide

Welcome! This guide will walk you through setting up your Hoot app step by step. Don't worry if you're new to coding - I'll explain everything in simple terms.

## 📋 Prerequisites

Before you start, make sure you have:
- A computer (Mac, Windows, or Linux)
- Node.js installed (download from [nodejs.org](https://nodejs.org/))
- A Google account (for Google Sign-In)
- A Firebase account (free tier is fine)

---

## Step 1: Install Dependencies

First, you need to install all the code libraries your app uses. Open your terminal (or command prompt) in the Hoot folder and run:

```bash
npm install
```

This will download all the necessary packages. It might take a few minutes.

---

## Step 2: Set Up Firebase (Your Backend)

Firebase is Google's free backend service that will handle:
- User authentication (Google Sign-In)
- Database (storing users, friends, groups)
- Push notifications

### 2.1 Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name: "Hoot" (or any name you like)
4. Disable Google Analytics (optional, to keep it simple)
5. Click "Create project"

### 2.2 Enable Authentication

1. In Firebase Console, click "Authentication" in the left menu
2. Click "Get started"
3. Click "Sign-in method" tab
4. Click "Google" and enable it
5. Set a project support email (use your email)
6. Click "Save"

### 2.3 Create a Web App

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon `</>` to add a web app
5. Register app name: "Hoot Web"
6. **Don't** check "Also set up Firebase Hosting"
7. Click "Register app"
8. **Copy the `firebaseConfig` object** - you'll need this!

It will look like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 2.4 Update Firebase Config in Your App

1. Open the file: `config/firebase.ts`
2. Find the `firebaseConfig` object (around line 12)
3. Replace all the placeholder values with your actual Firebase config values
4. Save the file

### 2.5 Set Up Firestore Database

1. In Firebase Console, click "Firestore Database" in the left menu
2. Click "Create database"
3. Choose "Start in test mode" (for now)
4. Choose a location (pick the closest to you)
5. Click "Enable"

**Important Security Rules:** Later, you'll need to set up security rules, but for development, test mode is okay.

### 2.6 Set Up Cloud Messaging (Push Notifications)

1. In Firebase Console, click "Cloud Messaging" in the left menu
2. Click "Get started" if prompted
3. For iOS, you'll need to upload APNs certificates later (we'll skip this for now)
4. For Android, Firebase handles it automatically

---

## Step 3: Set Up Google Sign-In

To use Google Sign-In, you need to configure OAuth credentials.

### 3.1 Get OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project (or create one)
3. Go to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. If prompted, configure the OAuth consent screen first:
   - User type: External
   - App name: "Hoot"
   - User support email: your email
   - Developer contact: your email
   - Click "Save and Continue" through the steps
6. Back to creating OAuth client ID:
   - Application type: **Web application**
   - Name: "Hoot Web Client"
   - Authorized redirect URIs: Add `https://auth.expo.io/@your-username/hoot` (we'll update this)
   - Click "Create"
7. **Copy the Client ID** - this is your `webClientId`

### 3.2 Create iOS OAuth Client (for iOS app)

1. Still in Google Cloud Console > Credentials
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: **iOS**
4. Name: "Hoot iOS"
5. Bundle ID: You'll get this from Expo later (for now, use a placeholder like `com.yourname.hoot`)
6. Click "Create"
7. **Copy the Client ID** - this is your `iosClientId`

### 3.3 Update Auth Context

1. Open the file: `contexts/AuthContext.tsx`
2. Find these lines (around line 25-26):
   ```typescript
   iosClientId: 'YOUR_IOS_CLIENT_ID',
   webClientId: 'YOUR_WEB_CLIENT_ID',
   ```
3. Replace with your actual client IDs
4. Save the file

---

## Step 4: Install Expo CLI (if not already installed)

```bash
npm install -g expo-cli
```

Or use npx (no installation needed):
```bash
npx expo start
```

---

## Step 5: Set Up Expo Push Notifications

For push notifications to work, you need to configure Expo's push notification service.

### 5.1 Create Expo Account

1. Go to [expo.dev](https://expo.dev/)
2. Sign up for a free account
3. Install Expo Go app on your phone (iOS App Store or Google Play)

### 5.2 Configure App

1. Open `app.json`
2. Make sure it has your app name and configuration
3. The push notification setup will be handled automatically by Expo

---

## Step 6: Run Your App

### 6.1 Start the Development Server

```bash
npm start
```

This will:
- Start the Expo development server
- Show a QR code in your terminal
- Open Expo DevTools in your browser

### 6.2 Run on Your Phone

**Option A: Using Expo Go (Easiest for Testing)**
1. Open Expo Go app on your phone
2. Scan the QR code from your terminal
3. The app will load on your phone

**Option B: Using iOS Simulator (Mac only)**
```bash
npm run ios
```

**Option C: Using Android Emulator**
```bash
npm run android
```

**Option D: Using Web Browser**
```bash
npm run web
```

---

## Step 7: Test Your App

1. **Test Login:**
   - Open the app
   - Click "Sign in with Google"
   - Sign in with your Google account

2. **Test Username Creation:**
   - After login, you'll be asked to create a username
   - Try creating a username (e.g., "testuser123")
   - The app will check if it's available

3. **Test Friend Requests:**
   - Go to the Friends tab
   - Try searching for a username (you'll need another account to test fully)
   - Or generate a QR code and scan it with another device

4. **Test Sending a Hoot:**
   - Go to the Home tab
   - Type a message (default is "Hoot!")
   - Click "Send Hoot"
   - This will send notifications to your friends

---

## 🔧 Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Make sure you've updated `config/firebase.ts` with your Firebase config
- Double-check that all values are correct (no extra spaces or quotes)

### "Google Sign-In not working"
- Verify your OAuth client IDs in `contexts/AuthContext.tsx`
- Make sure Google Sign-In is enabled in Firebase Console
- Check that your redirect URI is correct

### "Cannot connect to Firebase"
- Check your internet connection
- Verify your Firebase project is active
- Make sure Firestore is enabled in test mode

### "Push notifications not working"
- Push notifications require additional setup for production
- For testing, local notifications will work
- For production iOS, you'll need Apple Developer account and APNs certificates
- For production Android, Firebase handles it automatically

### App crashes on startup
- Make sure you ran `npm install`
- Check that all dependencies are installed
- Look at the error message in the terminal for clues

---

## 📱 Next Steps (Production)

When you're ready to publish your app:

1. **Set up proper Firestore security rules** (important for security!)
2. **Get Apple Developer account** (for iOS App Store - $99/year)
3. **Set up Google Play Console** (for Android - one-time $25 fee)
4. **Configure production push notifications**
5. **Test thoroughly** with multiple users
6. **Build production versions** using `expo build`

---

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)

---

## 🆘 Need Help?

If you get stuck:
1. Check the error message carefully
2. Search for the error online
3. Check Firebase Console for any issues
4. Make sure all configuration values are correct

Good luck building Hoot! 🦉

