# Apple Sign-In Fix - What Broke and What We Fixed

## What Likely Broke the Sign-In Flow

Since Apple Sign-In used to work, something changed that broke it. Here are the most likely causes:

### 1. **Race Condition Between `signIn()` and `onAuthStateChanged`** ✅ FIXED

**The Problem:**
- When `signInWithCredential()` completes, it triggers `onAuthStateChanged` immediately
- The `signIn()` function sets user state, then `onAuthStateChanged` fires and might overwrite it
- If `onAuthStateChanged` reads Firestore before the document is written, it gets stale data
- This could cause navigation to not trigger properly

**The Fix:**
- Added `justSignedInRef` to track when we just signed in
- `onAuthStateChanged` now skips updating state if we just signed in (within 500ms)
- This gives navigation a chance to happen with the correct state

### 2. **Inconsistent Username Field Handling** ✅ FIXED

**The Problem:**
- We were writing `username: null` to Firestore for new users
- `onAuthStateChanged` would read it back as `null`
- But `signIn()` was converting it to `undefined`
- This inconsistency could cause navigation checks to fail

**The Fix:**
- Now we omit the `username` field entirely for new users (don't write it to Firestore)
- Both `signIn()` and `onAuthStateChanged` now consistently use `undefined` for new users
- Navigation checks (`!user.username`) work correctly

### 3. **Missing Error Handling** ✅ FIXED

**The Problem:**
- Errors during sign-in might have been silently failing
- No way to debug what was going wrong

**The Fix:**
- Added comprehensive error handling and logging throughout the sign-in flow
- Each step now logs success/failure with detailed information
- Errors are caught and logged with helpful messages

## What Changed in the Code

### Before (Broken):
```typescript
// In signIn():
await setDoc(doc(db, 'users', firebaseUser.uid), {
  username: finalUsername, // Could be null for new users
}, { merge: true });
setUser({ username: finalUsername || undefined }); // Converting null to undefined

// In onAuthStateChanged:
setUser({ username: userData?.username }); // Could be null if written as null
// This fires immediately after signInWithCredential, potentially overwriting state
```

### After (Fixed):
```typescript
// In signIn():
const userDocData: any = { /* ... */ };
if (finalUsername) {
  userDocData.username = finalUsername; // Only write if exists
}
await setDoc(doc(db, 'users', firebaseUser.uid), userDocData, { merge: true });
setUser({ username: finalUsername }); // undefined for new users

// Track that we just signed in
justSignedInRef.current = firebaseUser.uid;

// In onAuthStateChanged:
if (justSignedInRef.current === firebaseUser.uid) {
  return; // Skip to avoid race condition
}
setUser({ username: userData?.username }); // undefined for new users (field doesn't exist)
```

## Testing the Fix

1. **Sign in with Apple**
2. **Check console logs** - you should see:
   - `⏭️ Skipping onAuthStateChanged update - user state already set by signIn()`
   - This confirms the race condition fix is working

3. **Verify navigation** - should navigate to username screen for new users

4. **Check Firestore** - new users should NOT have a `username` field (it should be omitted)

## If It Still Doesn't Work

Check the console logs to see where it's failing:
- Look for error messages
- Check if `onAuthStateChanged` is still overwriting state
- Verify Firestore document structure
- Check navigation logs

## Other Potential Causes (If Fix Doesn't Work)

1. **Firebase SDK Update** - A recent update might have changed behavior
2. **Expo SDK Update** - `expo-apple-authentication` might have changed
3. **Firebase Config Change** - Something in Firebase project settings
4. **App Rebuild Needed** - Native code changes require a rebuild

If the fix doesn't work, try:
```bash
# Rebuild the app
npx expo run:ios
# Or
eas build --profile development --platform ios
```

