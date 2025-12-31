# Clearing Test Data from Firestore

## ⚠️ IMPORTANT: Before You Clear

**Test data includes:**
- Test user accounts
- Test friendships
- Test messages/hoots
- Test groups
- Test notifications
- Push tokens from test devices

**What will be preserved:**
- Cloud Functions code (not in Firestore)
- Firebase project configuration
- Authentication settings

## Is It Safe to Clear?

**YES, but only if:**
1. ✅ You've finished all testing
2. ✅ You've verified the app works correctly
3. ✅ You don't need any test data for reference
4. ✅ You're ready for real users

**NO, if:**
- ❌ You're still testing features
- ❌ You need test data for debugging
- ❌ You want to keep test user accounts

## Recommended Approach: Selective Cleanup

Instead of clearing everything, consider:

### Option 1: Clear Only Test Users (Recommended)

Keep your Firebase structure, just remove test accounts:

```javascript
// Run this in Firebase Console > Firestore > Data
// Or use a script to delete test users

// Delete test users (identify by email or username pattern)
// Example: Delete users with emails like "test@", "demo@", etc.
```

### Option 2: Clear Everything (Fresh Start)

If you want a completely clean database:

**Collections to clear:**
- `users` - All user accounts
- `friendships` - All friend relationships
- `messages` - All hoots/messages
- `groups` - All groups
- `notifications` - All notification documents
- `groupMutes` - All group mute settings

**Collections to keep:**
- None (if you want a fresh start)

## How to Clear Test Data

### Method 1: Firebase Console (Manual)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `hoot-7fe85`
3. Go to **Firestore Database**
4. For each collection:
   - Click on the collection
   - Select all documents (or specific test ones)
   - Click **"Delete"**

**⚠️ Warning:** This is manual and time-consuming for large datasets.

### Method 2: Firebase CLI (Recommended)

Create a cleanup script:

```bash
# Install Firebase CLI if you haven't
npm install -g firebase-tools

# Login
firebase login

# Initialize (if not already done)
firebase init firestore
```

Then create a cleanup script (I can help you create this).

### Method 3: Cloud Function (One-Time)

Create a one-time Cloud Function to clear test data:

```javascript
// This would be a temporary function you run once
// Then delete it after use
```

## What I Recommend

**Before TestFlight:**
- ✅ Keep test data for now
- ✅ Test with real accounts if possible
- ✅ Document any test accounts you create

**After TestFlight Beta:**
- ✅ Clear test data before going to App Store
- ✅ Keep a backup/export if needed
- ✅ Start fresh for production users

## Safe Cleanup Checklist

Before clearing:
- [ ] Export important data (if any)
- [ ] Document test accounts to remove
- [ ] Verify app works without test data
- [ ] Make sure Cloud Functions still work
- [ ] Test Sign in with Apple with fresh account

After clearing:
- [ ] Test app with new account
- [ ] Verify push notifications work
- [ ] Test friend requests
- [ ] Test sending hoots
- [ ] Verify groups work

## Need Help?

If you want me to create a cleanup script, let me know what you want to clear:
- All data (fresh start)
- Only test users
- Only test messages
- Specific collections

