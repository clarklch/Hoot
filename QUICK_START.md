# Quick Start Guide - What to Do Now

## 🚀 Step-by-Step Action Plan

Follow these steps in order to get your Hoot app running!

---

## Step 1: Install Dependencies (5 minutes)

Open your terminal (or command prompt) and navigate to your Hoot folder, then run:

```bash
cd /Users/clarkchung/Desktop/Hoot
npm install
```

**What this does:** Downloads all the code libraries your app needs to run.

**Wait for it to finish** - This might take 2-5 minutes. You'll see a lot of text scrolling by - that's normal!

---

## Step 2: Set Up Firebase (15-20 minutes) ⚠️ REQUIRED

**This is the most important step!** Your app won't work without Firebase.

### 2.1 Create Firebase Project

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Project name: **"Hoot"** (or any name you like)
4. Click **"Continue"**
5. **Disable Google Analytics** (optional - you can skip this)
6. Click **"Create project"**
7. Wait for it to finish, then click **"Continue"**

### 2.2 Enable Authentication

1. In Firebase Console, click **"Authentication"** in the left menu
2. Click **"Get started"**
3. Click the **"Sign-in method"** tab
4. Click **"Google"**
5. Toggle **"Enable"** to ON
6. Set **Project support email** (use your email)
7. Click **"Save"**

### 2.3 Enable Firestore Database

1. Click **"Firestore Database"** in the left menu
2. Click **"Create database"**
3. Select **"Start in test mode"** (for development)
4. Click **"Next"**
5. Choose a location (pick the closest to you)
6. Click **"Enable"**

### 2.4 Get Your Firebase Config

1. Click the **gear icon ⚙️** next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **web icon `</>`** (Add app)
5. App nickname: **"Hoot Web"**
6. **Don't** check "Also set up Firebase Hosting"
7. Click **"Register app"**
8. **Copy the `firebaseConfig` object** - it looks like this:

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

### 2.5 Update Your App's Firebase Config

1. Open the file: `config/firebase.ts` in your code editor
2. Find the `firebaseConfig` object (around line 12)
3. Replace ALL the placeholder values with your actual Firebase config
4. **Save the file**

---

## Step 3: Set Up Google Sign-In (10 minutes)

### 3.1 Get OAuth Credentials

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Make sure your Firebase project is selected (top dropdown)
3. Go to **"APIs & Services"** > **"Credentials"**
4. Click **"Create Credentials"** > **"OAuth client ID"**
5. If prompted, configure OAuth consent screen:
   - User type: **External**
   - App name: **"Hoot"**
   - User support email: **Use your organization email** (see `OAUTH_EMAIL_SETUP.md` for options)
   - Developer contact: **Your email** (where Google sends notifications)
   - Click **"Save and Continue"** through all steps
   
   **💡 Tip:** Want to use a professional organization email instead of personal? See `OAUTH_EMAIL_SETUP.md` for detailed setup options.
6. Back to creating OAuth client:
   - Application type: **Web application**
   - Name: **"Hoot Web Client"**
   - Click **"Create"**
7. **Copy the Client ID** - this is your `webClientId`

### 3.2 Create iOS OAuth Client

1. Still in Google Cloud Console > Credentials
2. Click **"Create Credentials"** > **"OAuth client ID"**
3. Application type: **iOS**
4. Name: **"Hoot iOS"**
5. Bundle ID: **"com.hoot.app"** (or any unique identifier)
6. Click **"Create"**
7. **Copy the Client ID** - this is your `iosClientId`

### 3.3 Update Your App

1. Open the file: `contexts/AuthContext.tsx`
2. Find these lines (around line 25-26):
   ```typescript
   iosClientId: 'YOUR_IOS_CLIENT_ID',
   webClientId: 'YOUR_WEB_CLIENT_ID',
   ```
3. Replace with your actual client IDs
4. **Save the file**

---

## Step 4: Test Your App! (5 minutes)

### 4.1 Start the App

In your terminal, run:

```bash
npm start
```

This will:
- Start the development server
- Show a QR code
- Open Expo DevTools in your browser

### 4.2 Run on Your Phone

**Option A: Using Expo Go (Easiest)**
1. Download **"Expo Go"** app from App Store (iOS) or Google Play (Android)
2. Open Expo Go on your phone
3. Scan the QR code from your terminal
4. The app will load on your phone!

**Option B: Using iOS Simulator (Mac only)**
```bash
npm run ios
```

**Option C: Using Web Browser**
```bash
npm run web
```

### 4.3 Test the Features

1. **Sign In:**
   - Click "Sign in with Google"
   - Sign in with your Google account

2. **Create Username:**
   - Enter a username (e.g., "testuser123")
   - Click "Continue"

3. **Explore the App:**
   - Check out the Home tab
   - Check out the Friends tab
   - Try generating a QR code

---

## Step 5: Set Up Push Notifications (Optional - For Later)

Push notifications require a backend service. For now, you can test the app without them. When you're ready:

1. Read `BACKEND_SETUP.md` for instructions
2. Choose Firebase Cloud Functions (recommended) or Custom Server
3. Follow the setup guide

**Note:** The app will work without push notifications, but users won't receive Hoot messages until the backend is set up.

---

## ✅ Checklist

Before you consider the app "ready":

- [ ] Dependencies installed (`npm install`)
- [ ] Firebase project created
- [ ] Authentication enabled (Google Sign-In)
- [ ] Firestore Database enabled
- [ ] Firebase config updated in `config/firebase.ts`
- [ ] Google OAuth credentials created
- [ ] OAuth client IDs updated in `contexts/AuthContext.tsx`
- [ ] App runs successfully (`npm start`)
- [ ] Can sign in with Google
- [ ] Can create username
- [ ] Can navigate between tabs

---

## 🆘 Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- **Fix:** Make sure you updated `config/firebase.ts` with your Firebase config
- Double-check all values are correct (no extra spaces)

### "Google Sign-In not working"
- **Fix:** Verify OAuth client IDs in `contexts/AuthContext.tsx`
- Make sure Google Sign-In is enabled in Firebase Console

### "Cannot connect to Firebase"
- **Fix:** Check your internet connection
- Verify Firestore is enabled in test mode

### App crashes on startup
- **Fix:** Make sure you ran `npm install`
- Check terminal for error messages

### "Module not found" errors
- **Fix:** Run `npm install` again
- Delete `node_modules` folder and run `npm install` again

---

## 📚 Need More Help?

- **Detailed Setup:** Read `SETUP_GUIDE.md`
- **Backend Setup:** Read `BACKEND_SETUP.md`
- **Ephemeral Messages:** Read `EPHEMERAL_MESSAGES.md`
- **Project Overview:** Read `PROJECT_SUMMARY.md`

---

## 🎯 What's Next?

Once your app is running:

1. **Test with friends** - Create multiple accounts and test friend requests
2. **Set up backend** - Follow `BACKEND_SETUP.md` for push notifications
3. **Replace logo** - Follow `PLACEHOLDER_LOGO.md` to add your logo
4. **Customize** - Change colors in `constants/theme.ts`
5. **Test ephemeral messages** - Send Hoots and verify they disappear after viewing

---

## 🎉 You're Ready!

Start with **Step 1** and work through each step. Take your time - there's no rush!

If you get stuck at any step, check the troubleshooting section or read the detailed guides.

Good luck! 🦉

