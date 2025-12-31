# Apple Sign-In Debugging Guide

## Quick Checklist

Since Apple Sign-In is enabled in Firebase, let's verify everything else:

- [ ] Apple Sign-In enabled in Firebase Console ✅ (You confirmed this)
- [ ] Apple Sign-In enabled in Apple Developer Portal
- [ ] Using a development build (not Expo Go)
- [ ] Running on iOS 13+ device or simulator
- [ ] Bundle ID matches in app.json and Apple Developer Portal

## What to Check in Console Logs

When you sign in with Apple, you should see these logs in order:

### 1. Apple Authentication
```
🍎 Starting Sign in with Apple...
✅ Apple authentication successful
   User ID: [some ID]
   Email: [email or "Not provided"]
   Full Name: [name or undefined]
   Has identity token: true
```

**If you don't see "Has identity token: true"** → Apple authentication failed

### 2. Firebase Credential Creation
```
🔑 Creating Firebase credential with Apple identity token...
   Identity token length: [number]
✅ Firebase credential created successfully
```

**If you see an error here** → Credential creation failed (check error message)

### 3. Firebase Sign-In
```
🔥 Signing in with Firebase credential...
   Auth instance: true
✅ Firebase sign-in successful!
👤 User signed in: [email] [uid]
```

**If you see an error here** → Firebase sign-in failed (check error code):
- `auth/operation-not-allowed` → Apple not enabled in Firebase (but you said it is)
- `auth/invalid-credential` → Token issue, try again
- `auth/credential-already-in-use` → Account already linked

### 4. Firestore Update
```
📄 Firestore user document: exists / does not exist
📝 Creating new user document in Firestore... (if new user)
✅ User document updated in Firestore
```

**If you see an error here** → Firestore write failed (check permissions/rules)

### 5. User State Update
```
👤 Setting user state from signIn():
   uid: [uid]
   hasEmail: true/false
   hasDisplayName: true/false
   hasUsername: false (for new users)
   usernameValue: undefined
✅ Sign-in process complete - user state updated
```

**If usernameValue is not undefined for new users** → Issue with user data

### 6. Navigation
```
🔐 Login screen: User detected, checking username...
   uid: [uid]
   hasUsername: false
➡️ Navigating to username creation screen
```

**If you don't see navigation logs** → Navigation not triggering

### 7. Auth State Listener
```
🔐 Auth state changed: User: [uid]
✅ Firebase Auth session detected for user: [uid]
👤 Setting user state from onAuthStateChanged:
   hasUsername: false
```

**This should fire after sign-in completes**

## Common Issues and Fixes

### Issue: "No identity token received"
**Fix:** 
- Make sure you're using a development build (not Expo Go)
- Check Apple Developer Portal has Sign In with Apple enabled
- Try signing in again (sometimes first attempt fails)

### Issue: "Firebase sign-in failed: auth/operation-not-allowed"
**Fix:**
- Double-check Firebase Console → Authentication → Sign-in method → Apple is enabled
- Make sure you clicked "Save" after enabling
- Wait a few minutes for changes to propagate

### Issue: "Firebase sign-in failed: auth/invalid-credential"
**Fix:**
- Try signing in again
- Check that identity token is being received
- Make sure Firebase project is correct

### Issue: User state not updating
**Check:**
- Look for "Setting user state" logs
- Verify user state JSON in logs
- Check if `onAuthStateChanged` is firing

### Issue: Navigation not happening
**Check:**
- Look for "Login screen: User detected" logs
- Verify `hasUsername: false` for new users
- Check if router.replace is being called
- Look for navigation errors in console

### Issue: User appears in Firebase Auth but not in Firestore
**Fix:**
- Check Firestore security rules allow writes
- Check Firestore is enabled
- Look for Firestore write errors in logs

## Step-by-Step Debugging

1. **Sign in with Apple**
2. **Watch the console logs** - copy all logs from start to finish
3. **Check which step fails:**
   - Apple authentication?
   - Firebase credential creation?
   - Firebase sign-in?
   - Firestore write?
   - User state update?
   - Navigation?

4. **Check Firebase Console:**
   - Authentication → Users → Should see your user
   - Firestore Database → users collection → Should see document with your UID

5. **Check app state:**
   - Is user state set? (check logs)
   - Is navigation happening? (check logs)
   - Are you stuck on login screen?

## What to Share for Help

If you need help, share:
1. **All console logs** from sign-in attempt
2. **Screenshot of Firebase Console** → Authentication → Users (showing if user appears)
3. **Screenshot of Firebase Console** → Firestore → users collection
4. **What happens** - Do you stay on login screen? Any error messages?
5. **Device info** - iOS version, simulator or physical device?

## Expected Flow

1. User taps "Sign in with Apple"
2. Apple authentication dialog appears
3. User authenticates
4. App receives identity token
5. App creates Firebase credential
6. App signs in to Firebase
7. App creates/updates Firestore user document
8. App sets user state (username: undefined for new users)
9. Login screen detects user without username
10. App navigates to username creation screen

**If any step fails, the logs will show where!**

