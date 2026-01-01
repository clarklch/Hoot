# How to View App Logs for Debugging

## 🔍 Quick Method: Terminal (If Running Development Build)

If you're running the app via `npm start` or Expo:

```bash
# In your terminal where you ran npm start, look for logs
# All console.log statements will appear there with emojis like:
# 🍎 🔥 ✅ ❌ 👤 📄
```

---

## 📱 Method 1: Xcode Console (Physical Device - TestFlight or Development Build)

**Best for TestFlight builds:**

1. **Connect your iPhone to your Mac via USB**
2. **Open Xcode**
3. **Go to:** `Window` → `Devices and Simulators` (or press `Shift+Cmd+2`)
4. **Select your iPhone** from the left sidebar
5. **Click "Open Console"** button at the bottom
6. **Filter by your app:** In the search box, type "Hoot" or "Expo"

You'll see all console.log statements from your app!

---

## 📱 Method 2: Console.app (Mac System Console)

**Alternative method for physical devices:**

1. **Connect your iPhone to your Mac via USB**
2. **Open Console.app** on Mac (search Spotlight for "Console")
3. **Select your iPhone** from the left sidebar (under "Devices")
4. **In the search box**, type: `process:Hoot` or `subsystem:com.sendahoot.app`
5. **Run your app** and trigger the sign-in
6. **Watch the logs appear** in real-time

---

## 📱 Method 3: Safari Web Inspector (Development Builds Only)

**Only works for development builds, NOT TestFlight:**

1. **On your Mac:** Open Safari
2. **Enable Developer Menu:**
   - Safari → Preferences → Advanced
   - Check "Show Develop menu in menu bar"
3. **On your iPhone:**
   - Settings → Safari → Advanced
   - Enable "Web Inspector"
4. **In Safari on Mac:**
   - Develop → [Your iPhone Name] → [Your App Name]
   - Click "Console" tab
5. **All logs will appear here!**

---

## 📱 Method 4: iOS Simulator Console

**If you're using iOS Simulator:**

1. **Open Xcode**
2. **Window** → **Devices and Simulators**
3. **Select your simulator**
4. **Click "Open Console"**
5. **Filter by "Hoot"**

---

## 🔍 What Logs to Look For

When testing Apple Sign-In, look for these specific log messages:

### ✅ Expected Success Flow:
```
🔐 Setting up Firebase Auth state listener...
🍎 Starting Sign in with Apple...
✅ Apple authentication successful
🔑 Creating Firebase credential with Apple identity token...
✅ Firebase credential created successfully
🔥 Signing in with Firebase credential...
✅ Firebase sign-in successful!
👤 User signed in: ...
📄 Firestore user document: does not exist (or exists)
✅ User document updated in Firestore with Apple account info
✅ Sign-in process complete - onAuthStateChanged will handle user state update
🔐 Auth state changed: User: ...
👤 Setting user state from onAuthStateChanged: ...
➡️ Navigating to username creation screen
```

### ❌ Error Indicators:
- `❌ Sign in error:` - Something failed in signIn()
- `❌ Apple authentication failed:` - Apple Sign-In failed
- `❌ Firebase sign-in failed:` - Firebase authentication failed
- `❌ Error updating user document:` - Firestore write failed
- `❌ Error restoring user data:` - Firestore read failed

---

## 🚀 Quick Terminal Command (If Using npm start)

If you're running the app in development mode:

```bash
# Filter for sign-in related logs only
npm start | grep -E "🍎|🔥|✅|❌|👤|📄|🔐|➡️"
```

Or save all logs to a file:
```bash
npm start 2>&1 | tee app-logs.txt
```

Then open `app-logs.txt` to review.

---

## ⚠️ Important Notes

1. **TestFlight builds:** Use Xcode Console (Method 1) or Console.app (Method 2)
2. **Development builds:** Use terminal, Xcode Console, or Safari Web Inspector
3. **Logs include emoji prefixes** (🍎 🔥 ✅ ❌) to make them easy to spot
4. **All console.log statements** from the code will appear in these logs

---

## 🎯 Most Likely Method for Your Situation

Since you're testing on a device (likely TestFlight), use **Method 1 (Xcode Console)**:

1. Connect iPhone to Mac
2. Open Xcode
3. Window → Devices and Simulators
4. Select your iPhone
5. Click "Open Console"
6. Filter by "Hoot"
7. Try signing in and watch the logs!

The logs will show you exactly where the flow is breaking. Look for the emoji-prefixed messages to track the authentication flow.

