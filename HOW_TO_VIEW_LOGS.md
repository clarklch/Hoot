# How to View App Logs

The location of your app logs depends on how you're running the app. Here's where to find them:

## 📱 Option 1: Terminal/Console (Most Common)

When you run your app, the logs appear in the **same terminal window** where you started the app.

### Starting the App

1. **Open Terminal** (on Mac) or Command Prompt (on Windows)
2. **Navigate to your project:**
   ```bash
   cd /Users/clarkchung/Desktop/Hoot
   ```

3. **Start the app:**
   ```bash
   npm start
   ```
   or
   ```bash
   npx expo start
   ```

### Viewing Logs

- **All console.log() statements** will appear in this terminal window
- **Errors** will also appear here
- **Firebase logs** (the ones we added with emojis like 🍎, 🔥, ✅) will appear here

### What You'll See

When you sign in with Apple, you should see logs like:
```
🍎 Starting Sign in with Apple...
✅ Apple authentication successful
🔑 Creating Firebase credential with Apple identity token...
🔥 Signing in with Firebase credential...
✅ Firebase sign-in successful!
👤 Setting user state from signIn(): ...
```

---

## 📱 Option 2: iOS Simulator Console (If using Simulator)

If you're running on iOS Simulator:

1. **Open Xcode** (if not already open)
2. **Go to:** `Window` → `Devices and Simulators`
3. **Select your simulator**
4. **Click "Open Console"** button
5. **Filter by your app name** (search for "Hoot")

Or use the **Console app** on Mac:
1. Open **Console.app** (search Spotlight for "Console")
2. Select your **iOS Simulator** from the left sidebar
3. Filter by "Hoot" or "Expo"

---

## 📱 Option 3: Physical Device (iOS)

If you're running on a physical iPhone:

### Method A: Xcode Console
1. **Connect your iPhone** to your Mac via USB
2. **Open Xcode**
3. **Go to:** `Window` → `Devices and Simulators`
4. **Select your iPhone**
5. **Click "Open Console"**
6. **Filter by "Hoot"** or "Expo"

### Method B: Safari Web Inspector (For Development Builds)
1. **On your Mac:** Open Safari
2. **Enable Developer Menu:** Safari → Preferences → Advanced → Check "Show Develop menu"
3. **On your iPhone:** Settings → Safari → Advanced → Enable "Web Inspector"
4. **In Safari on Mac:** Develop → [Your iPhone Name] → [Your App]
5. **Click "Console" tab** to see logs

---

## 📱 Option 4: Expo DevTools (Browser)

When you run `npm start`, Expo opens a browser window with **Expo DevTools**.

1. **Look for the browser window** that opened automatically
2. **Or go to:** `http://localhost:19002` in your browser
3. **Click "Logs" tab** to see console logs
4. **Click "Device" tab** to see device-specific logs

---

## 📱 Option 5: React Native Debugger (Advanced)

For more advanced debugging:

1. **Install React Native Debugger:**
   ```bash
   brew install --cask react-native-debugger
   ```

2. **Open React Native Debugger app**

3. **In your app:** Shake device or press `Cmd+D` (iOS) → Select "Debug"

4. **In React Native Debugger:** See all console logs, network requests, etc.

---

## 🔍 Quick Tips for Finding Logs

### Filter Logs
In terminal, you can filter logs:
```bash
npm start | grep "🍎\|🔥\|✅\|❌"
```
This shows only logs with emojis (our sign-in logs).

### Save Logs to File
```bash
npm start > app-logs.txt 2>&1
```
This saves all logs to `app-logs.txt` file.

### Clear Terminal
Press `Cmd+K` (Mac) or `Ctrl+L` (Windows/Linux) to clear terminal.

---

## 🎯 What to Look For

When testing Apple Sign-In, look for these specific logs:

### ✅ Success Flow:
1. `🍎 Starting Sign in with Apple...`
2. `✅ Apple authentication successful`
3. `🔑 Creating Firebase credential...`
4. `✅ Firebase credential created successfully`
5. `🔥 Signing in with Firebase credential...`
6. `✅ Firebase sign-in successful!`
7. `👤 Setting user state from signIn():`
8. `⏭️ Skipping onAuthStateChanged update` (this confirms race condition fix)
9. `➡️ Navigating to username creation screen`

### ❌ Error Indicators:
- `❌ Sign in error:` - Something failed
- `❌ Firebase sign-in failed:` - Firebase authentication failed
- `❌ Error updating user document:` - Firestore write failed
- `❌ Error restoring user data:` - Firestore read failed

---

## 📝 Example: Complete Log Output

Here's what a successful sign-in should look like:

```
🔐 Setting up Firebase Auth state listener...
🍎 Starting Sign in with Apple...
✅ Apple authentication successful
   User ID: 001234.567890abcdef
   Email: user@example.com
   Full Name: John Doe
   Has identity token: true
🔑 Creating Firebase credential with Apple identity token...
   Identity token length: 1234
✅ Firebase credential created successfully
🔥 Signing in with Firebase credential...
   Auth instance: true
✅ Firebase sign-in successful!
👤 User signed in: user@example.com abc123def456
📄 Firestore user document: does not exist
📝 Creating new user document in Firestore...
✅ User document updated in Firestore { hasUsername: false, isNewUser: true }
👤 Setting user state from signIn(): { uid: 'abc123', hasEmail: true, hasDisplayName: true, hasUsername: false, usernameValue: undefined }
🆕 New user detected - will be prompted to create username
   Navigation should trigger automatically when user state is set
✅ Sign-in process complete - user state updated
🔐 Auth state changed: User: abc123def456
⏭️ Skipping onAuthStateChanged update - user state already set by signIn()
🔐 Login screen: User detected, checking username... { uid: 'abc123', hasUsername: false }
➡️ Navigating to username creation screen
```

---

## 🆘 If You Don't See Logs

1. **Check terminal is still running** - Make sure `npm start` is still active
2. **Check you're looking at the right terminal** - You might have multiple terminals open
3. **Try restarting the app:**
   - Stop the current process (`Ctrl+C`)
   - Run `npm start` again
4. **Check Expo DevTools** - Logs might be in the browser instead
5. **Check device console** - If using physical device, check Xcode Console

---

## 💡 Pro Tip

**Keep the terminal window visible** while testing - that's where all the important logs appear! The emoji prefixes (🍎, 🔥, ✅, ❌) make it easy to spot sign-in related logs.

