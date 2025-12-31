# How to Clear Firebase Database

This guide shows you how to delete all data from your Firestore database to start fresh for testing.

## ⚠️ WARNING
**This will permanently delete ALL data in your Firestore database!** Only do this in development/testing environments.

---

## Method 1: Firebase Console (Easiest - Recommended)

### Step 1: Open Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (Hoot)

### Step 2: Navigate to Firestore
1. Click **"Firestore Database"** in the left sidebar
2. You'll see all your collections (users, usernames, friendships, groups, messages, notifications)

### Step 3: Delete Each Collection
For each collection:

1. Click on the collection name (e.g., "users")
2. You'll see all documents in that collection
3. **Option A - Delete individual documents:**
   - Click the checkbox next to each document
   - Click the trash icon at the top
   - Confirm deletion

4. **Option B - Delete entire collection (if you have many documents):**
   - Select all documents (check the header checkbox)
   - Click the trash icon
   - Confirm deletion

### Collections to Delete:
- ✅ `users` - All user accounts
- ✅ `usernames` - All username mappings
- ✅ `friendships` - All friend requests and relationships
- ✅ `groups` - All friend groups
- ✅ `messages` - All ephemeral messages
- ✅ `notifications` - All notification records

### Step 4: Verify
After deleting, refresh the page. All collections should be empty or removed.

---

## Method 2: Firebase CLI (Faster for Large Databases)

### Step 1: Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase
```bash
firebase login
```

### Step 3: Initialize Firebase in Your Project (if not already done)
```bash
firebase init firestore
```

### Step 4: Use Firestore Delete Script
Firebase CLI doesn't have a built-in "delete all" command, but you can use the script I created:

1. **Download Service Account Key:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save it as `serviceAccountKey.json` in your project root
   - ⚠️ **Add it to `.gitignore`** (it contains sensitive credentials!)

2. **Install Firebase Admin SDK:**
   ```bash
   npm install firebase-admin
   ```

3. **Run the clear script:**
   ```bash
   node scripts/clear-firebase.js
   ```

---

## Method 3: Manual Firestore Rules (Nuclear Option)

If you want to delete everything including the database structure:

1. Go to Firebase Console → Firestore Database
2. Click the **"..."** menu (three dots) at the top
3. Select **"Delete database"**
4. ⚠️ **This will delete the entire Firestore database!** You'll need to recreate it.

---

## After Clearing: What Happens?

1. **All user accounts are deleted** - Users will need to create new usernames
2. **All friendships are deleted** - Users will need to send new friend requests
3. **All groups are deleted** - Users will need to create new groups
4. **All messages are deleted** - Expected, since messages are ephemeral anyway

---

## Quick Test After Clearing

1. Open your app
2. Click "Continue" on login screen
3. Create a new username (e.g., "alice")
4. Sign out and create another username (e.g., "bob")
5. Test friend requests between alice and bob

---

## Pro Tip: Keep Test Data Separate

Consider creating a separate Firebase project for testing:
- **Production:** `hoot-production`
- **Testing:** `hoot-testing` or `hoot-dev`

This way you can clear the test database without affecting production data.

---

## Need Help?

If you encounter any issues:
1. Check Firebase Console for error messages
2. Verify you have the correct permissions
3. Make sure you're in the correct Firebase project

