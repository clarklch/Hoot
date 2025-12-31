# Clear Firestore Database - Production Ready

## ⚠️ WARNING: This Will Delete ALL Data

This operation will **permanently delete** all data from your Firestore database:
- All user accounts
- All messages/Hoots
- All friendships
- All groups
- All notifications
- All activity logs

**This cannot be undone!** Make sure you have backups if needed.

---

## Prerequisites

1. **Firebase CLI installed:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Logged into Firebase:**
   ```bash
   firebase login
   ```

3. **Firebase project selected:**
   ```bash
   firebase use hoot-7fe85
   ```
   (Replace with your actual project ID if different)

---

## Method 1: Firebase Console (Recommended - Visual)

### Step 1: Open Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **hoot-7fe85** (or your project name)
3. Click **"Firestore Database"** in the left sidebar
4. Click **"Data"** tab

### Step 2: Delete Collections

For each collection, delete all documents:

1. **users** collection:
   - Click on "users" collection
   - Select all documents (check the box at the top)
   - Click "Delete" button
   - Confirm deletion

2. **messages** collection:
   - Click on "messages" collection
   - Select all documents
   - Click "Delete"
   - Confirm

3. **friendships** collection:
   - Click on "friendships" collection
   - Select all documents
   - Click "Delete"
   - Confirm

4. **groups** collection:
   - Click on "groups" collection
   - Select all documents
   - Click "Delete"
   - Confirm

5. **notifications** collection:
   - Click on "notifications" collection
   - Select all documents
   - Click "Delete"
   - Confirm

6. **groupActivities** collection:
   - Click on "groupActivities" collection
   - Select all documents
   - Click "Delete"
   - Confirm

7. **usernames** collection:
   - Click on "usernames" collection
   - Select all documents
   - Click "Delete"
   - Confirm

### Step 3: Verify Database is Empty

- Check that all collections show "No documents"
- Database should be completely empty

---

## Method 2: Firebase CLI (Faster for Large Databases)

### Step 1: Install Firebase Tools (if not installed)

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

### Step 3: Select Your Project

```bash
firebase use hoot-7fe85
```

(Replace with your actual project ID)

### Step 4: Delete All Collections

**⚠️ Warning:** This will delete everything. Run each command carefully.

```bash
# Delete users collection
firebase firestore:delete --recursive users --project hoot-7fe85

# Delete messages collection
firebase firestore:delete --recursive messages --project hoot-7fe85

# Delete friendships collection
firebase firestore:delete --recursive friendships --project hoot-7fe85

# Delete groups collection
firebase firestore:delete --recursive groups --project hoot-7fe85

# Delete notifications collection
firebase firestore:delete --recursive notifications --project hoot-7fe85

# Delete groupActivities collection
firebase firestore:delete --recursive groupActivities --project hoot-7fe85

# Delete usernames collection
firebase firestore:delete --recursive usernames --project hoot-7fe85
```

**Note:** Replace `hoot-7fe85` with your actual Firebase project ID.

---

## Method 3: Firebase Admin SDK Script (Most Control)

Create a script to delete everything programmatically:

### Step 1: Create Script

Create a file `clear-firestore.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./path-to-your-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionPath) {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.get();
  
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`✅ Deleted ${snapshot.size} documents from ${collectionPath}`);
}

async function clearDatabase() {
  const collections = [
    'users',
    'messages',
    'friendships',
    'groups',
    'notifications',
    'groupActivities',
    'usernames'
  ];

  console.log('🗑️ Starting database cleanup...');
  
  for (const collection of collections) {
    await deleteCollection(collection);
  }
  
  console.log('✅ Database cleared successfully!');
  process.exit(0);
}

clearDatabase().catch(console.error);
```

### Step 2: Run Script

```bash
node clear-firestore.js
```

---

## Verification

After clearing, verify the database is empty:

1. Go to Firebase Console → Firestore Database
2. Check each collection shows "No documents"
3. Database should be completely clean

---

## What Gets Deleted

- ✅ All user accounts and profiles
- ✅ All messages/Hoots
- ✅ All friend relationships
- ✅ All groups and group memberships
- ✅ All notifications
- ✅ All activity logs
- ✅ All username mappings

## What Stays

- ✅ Firebase project configuration
- ✅ Authentication users (if you want to keep them, see below)
- ✅ Cloud Functions code
- ✅ Firebase rules
- ✅ App configuration

---

## Optional: Clear Firebase Authentication Users

If you also want to delete all authenticated users:

### Using Firebase Console:

1. Go to Firebase Console
2. Click **"Authentication"**
3. Click **"Users"** tab
4. Select all users
5. Click **"Delete"**
6. Confirm

### Using Firebase CLI:

```bash
# List all users first (to see what you're deleting)
firebase auth:export users.json --project hoot-7fe85

# Delete users (requires Admin SDK script - see Firebase docs)
```

**Note:** Deleting Auth users is separate from Firestore. You may want to keep Auth users if you want to preserve sign-in history.

---

## After Clearing

1. ✅ Database is clean and ready for production users
2. ✅ Test users can sign up fresh
3. ✅ All data will be new and clean
4. ✅ No old test data will interfere

---

## Safety Checklist

Before clearing:
- [ ] Backed up any data you want to keep
- [ ] Verified you're on the correct Firebase project
- [ ] Confirmed this is what you want to do
- [ ] TestFlight testers are aware (if needed)

After clearing:
- [ ] Verified all collections are empty
- [ ] Tested that new users can sign up
- [ ] Confirmed app works with empty database

---

## Quick Command Reference

```bash
# Login to Firebase
firebase login

# Select project
firebase use hoot-7fe85

# Delete a collection
firebase firestore:delete --recursive COLLECTION_NAME --project hoot-7fe85

# List all collections (to see what exists)
# (Do this in Firebase Console)
```

---

## Summary

**Recommended Method:** Use Firebase Console (Method 1) for visual confirmation and safety.

**Fastest Method:** Use Firebase CLI (Method 2) if you have many documents.

**Most Control:** Use Admin SDK script (Method 3) for programmatic control.

**Remember:** This is permanent! Make sure you want to delete everything before proceeding.

