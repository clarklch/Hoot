# Testing Friend Management - Step by Step Guide

## 🎯 Goal
Test all friend management features to ensure they work correctly, especially after fixing the duplicate request bug.

---

## ✅ Test 1: Username Search Friend Request

### Step 1: Create First User (Alice)
1. Open Hoot app
2. Click **"Continue"** button
3. Create username: **`alice`**
4. You should land on the Home screen
5. Navigate to **Friends** tab

### Step 2: Sign Out
1. Scroll down in Friends tab
2. Tap **"Sign Out (Testing)"** button
3. Confirm sign out
4. You should be back at the login screen

### Step 3: Create Second User (Bob)
1. Click **"Continue"** button again
2. Create username: **`bob`** (different username = different user ID)
3. Navigate to **Friends** tab

### Step 4: Send Friend Request via Username Search
1. In the **Friends** tab, you should see a search box
2. Type: **`alice`** in the search box
3. Tap **"Add ❄️"** button
4. ✅ You should see: **"Success! ✅ Friend request sent to @alice!"**
5. ✅ Check: Only **ONE** request should be created (no duplicates!)

### Step 5: Switch Back to Alice
1. Scroll down and tap **"Sign Out (Testing)"**
2. Click **"Continue"**
3. Create username: **`alice`** again (same username)
4. The app should load your existing user data
5. Navigate to **Friends** tab → **"Requests"** tab

### Step 6: Verify Request Appears
1. ✅ You should see: **"bob wants to be your friend"**
2. ✅ Check: Only **ONE** request from bob (not multiple!)
3. ✅ Check: Request text is **black** and legible

### Step 7: Accept Friend Request
1. Tap **"Accept"** button
2. ✅ You should see: **"Success Friend request accepted! 🎉"**
3. Navigate to **"Friends"** tab (not Requests)
4. ✅ You should see: **`bob`** in your friends list
5. ✅ Check: Only **ONE** entry for bob (not duplicates!)

### Step 8: Verify Bob's Side
1. Sign out from alice
2. Log back in as **`bob`**
3. Go to **Friends** tab
4. ✅ You should see: **`alice`** in your friends list
5. ✅ Check: Only **ONE** entry for alice (not duplicates!)
6. ✅ Check: No pending requests in "Requests" tab

---

## ✅ Test 2: QR Code Friend Request

### Step 1: Generate QR Code (Alice)
1. Log in as **`alice`** (or create if needed)
2. Go to **Friends** tab
3. Tap **"Generate My QR Code ❄️"**
4. ✅ You should see: A **black QR code** (not light grey)
5. ✅ You should see: **@alice** displayed below the QR code
6. **Take a screenshot** of this QR code (or keep screen open)

### Step 2: Scan QR Code (Bob)
1. Sign out and log in as **`bob`**
2. Go to **Friends** tab
3. Tap **"Scan QR Code ❄️"**
4. Point camera at the QR code (from screenshot or another device)
5. ✅ You should see: **"Success Friend request sent!"**
6. ✅ Check: Only **ONE** request created (no duplicates!)

### Step 3: Verify Request
1. Sign out and log back in as **`alice`**
2. Go to **Friends** tab → **"Requests"** tab
3. ✅ You should see: **"bob wants to be your friend"**
4. Accept the request
5. ✅ Both users should see each other in friends list

---

## ✅ Test 3: Error Cases

### Test 3a: Send Request to Yourself
1. Log in as **`alice`**
2. Go to **Friends** tab
3. Search for: **`alice`** (your own username)
4. Tap **"Add ❄️"**
5. ✅ You should see: **"You cannot send a friend request to yourself 🤦‍♀️"**
6. ✅ Check: Only **ONE** alert appears (not spammed!)

### Test 3b: Duplicate Request Prevention
1. Log in as **`bob`**
2. Search for **`alice`** and send a request
3. ✅ Should see success message
4. **Immediately try again** (rapid clicks)
5. ✅ Should see: **"Request Already Sent"** or **"Please wait"**
6. ✅ Check: Only **ONE** request in Firestore (not multiple!)

### Test 3c: Already Friends
1. If alice and bob are already friends
2. Try to send another request from bob to alice
3. ✅ Should see: **"Already Friends You already have a friendship with this user 🤝"**

---

## ✅ Test 4: Remove Friend

### Step 1: Remove Friend
1. Log in as **`alice`**
2. Go to **Friends** tab
3. Find **`bob`** in your friends list
4. Tap **"Remove"** button
5. ✅ You should see: **Confirmation popup**: "Are you sure you want to remove bob? 🥺"
6. Tap **"Remove"** to confirm
7. ✅ You should see: **"Success Friend removed! 👋"**
8. ✅ **`bob`** should disappear from your friends list

### Step 2: Verify Both Sides
1. Sign out and log in as **`bob`**
2. Go to **Friends** tab
3. ✅ **`alice`** should also be removed from bob's friends list
4. (Friendship is bidirectional, so removing from one side removes from both)

---

## ✅ Test 5: Decline Friend Request

### Step 1: Send Request
1. Log in as **`bob`**
2. Send a friend request to **`alice`** (via search or QR)

### Step 2: Decline Request
1. Log in as **`alice`**
2. Go to **Friends** tab → **"Requests"** tab
3. Find the request from **`bob`**
4. Tap **"Decline"** button
5. ✅ You should see: **"Success Friend request declined 🗑️"**
6. ✅ Request should disappear from Requests tab

### Step 3: Verify
1. Sign out and log in as **`bob`**
2. Go to **Friends** tab → **"Requests"** tab
3. ✅ The pending request should also be gone
4. ✅ **`alice`** should NOT be in friends list

---

## ✅ Test 6: Multiple Users (Stress Test)

### Test with 3+ Users
1. Create users: **`alice`**, **`bob`**, **`charlie`**
2. Send requests: alice → bob, bob → charlie, charlie → alice
3. Accept all requests
4. ✅ Each user should have exactly **2 friends** (not more, not less)
5. ✅ No duplicate entries in any friends list
6. ✅ No duplicate requests in Requests tab

---

## 🐛 What to Watch For (Bug Checks)

### ❌ Red Flags (These Should NOT Happen):
- Multiple friend requests from the same user
- Duplicate entries in friends list
- Pending requests that won't go away after accepting
- Multiple alerts for the same error
- Friend requests that don't appear
- Friends that don't show up after accepting

### ✅ Green Flags (These SHOULD Happen):
- Only ONE request per user pair
- Only ONE friend entry per user
- Requests disappear after accepting/declining
- Both users see each other after accepting
- Errors show only once (not spammed)
- User IDs are consistent (check Firestore if needed)

---

## 📊 Verify in Firestore (Optional)

If you want to verify in Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **hoot-7fe85**
3. Go to **Firestore Database**
4. Check **`friendships`** collection:
   - Each friendship should have unique `userId` and `friendId` pair
   - Status should be `pending` or `accepted`
   - No duplicate documents with same `userId` + `friendId` combination

---

## ✅ Success Criteria

Friend management is working correctly if:
- ✅ You can send friend requests via username search
- ✅ You can send friend requests via QR code
- ✅ Requests appear in the Requests tab
- ✅ You can accept/decline requests
- ✅ Friends appear in Friends tab after accepting
- ✅ You can remove friends
- ✅ **NO duplicate requests or friends**
- ✅ **NO duplicate error alerts**
- ✅ Both users see each other after accepting

---

## 🎉 Next Steps After Testing

Once friend management is verified:
1. Test **Groups** functionality
2. Test **Sending Hoots** to friends
3. Test **Receiving Hoots** (requires push notification setup)

