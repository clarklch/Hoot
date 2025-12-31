# Clear Firestore Database for Production

## ⚠️ WARNING: This Will Delete ALL Data

This will **permanently delete** all data from your Firestore database:
- All user accounts
- All messages/Hoots
- All friendships
- All groups
- All notifications
- All activity logs

**This cannot be undone!** Make sure you're ready for production users.

---

## Recommended Method: Firebase Console (Safest)

### Step 1: Open Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **hoot-7fe85** (or your project name)
3. Click **"Firestore Database"** in the left sidebar
4. Click **"Data"** tab

### Step 2: Delete All Collections

For each collection, delete all documents:

**Collections to delete:**
1. **users** - All user accounts
2. **usernames** - All username mappings
3. **friendships** - All friend relationships
4. **groups** - All groups
5. **messages** - All messages/Hoots
6. **notifications** - All notification documents
7. **groupActivities** - All group activity logs

**How to delete:**
1. Click on the collection name
2. Select all documents (check the box at the top)
3. Click **"Delete"** button
4. Confirm deletion
5. Repeat for each collection

### Step 3: Verify Database is Empty

- Check that all collections show "No documents"
- Database should be completely clean

---

## Alternative: Firebase CLI (Faster)

If you have many documents, use the CLI:

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login

```bash
firebase login
```

### Step 3: Select Project

```bash
firebase use hoot-7fe85
```

(Replace with your actual project ID)

### Step 4: Delete Collections

```bash
# Delete each collection
firebase firestore:delete --recursive users --project hoot-7fe85
firebase firestore:delete --recursive usernames --project hoot-7fe85
firebase firestore:delete --recursive friendships --project hoot-7fe85
firebase firestore:delete --recursive groups --project hoot-7fe85
firebase firestore:delete --recursive messages --project hoot-7fe85
firebase firestore:delete --recursive notifications --project hoot-7fe85
firebase firestore:delete --recursive groupActivities --project hoot-7fe85
```

---

## Optional: Clear Firebase Authentication Users

If you also want to delete all authenticated users:

1. Go to Firebase Console
2. Click **"Authentication"**
3. Click **"Users"** tab
4. Select all users
5. Click **"Delete"**
6. Confirm

**Note:** This is optional. You can keep Auth users if you want to preserve sign-in history.

---

## After Clearing

1. ✅ Database is clean and ready for production users
2. ✅ TestFlight testers can sign up fresh
3. ✅ All data will be new and clean
4. ✅ No old test data will interfere

---

## Verification Checklist

After clearing:
- [ ] All collections show "No documents" in Firebase Console
- [ ] Test that new users can sign up
- [ ] Test that friend requests work
- [ ] Test that messages can be sent
- [ ] Verify push notifications work
- [ ] Confirm app works with empty database

---

## Quick Summary

**Easiest:** Use Firebase Console (Method 1) - visual and safe  
**Fastest:** Use Firebase CLI (Method 2) - good for large databases

**Remember:** This is permanent! Make sure you want to delete everything.

