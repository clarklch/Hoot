# How to Test Hoot Feature on 2 Different Devices

## Prerequisites
- 2 iOS devices with Expo Go installed (or 2 simulators)
- Both devices connected to the same network
- Firebase is set up and working

---

## Step-by-Step Testing Guide

### Step 1: Set Up Device A (First User - "Alice")

1. **Open Hoot app on Device A**
2. **Click "Continue"** to bypass login
3. **Create username:** `alice`
   - Enter username: `alice`
   - Enter display name: `Alice`
   - Tap "Create Profile"
4. **Go to Friends tab**
5. **Generate QR Code:**
   - Tap "Generate My QR Code"
   - **Keep this QR code screen open** (or take a screenshot)

### Step 2: Set Up Device B (Second User - "Bob")

1. **Open Hoot app on Device B**
2. **Click "Continue"** to bypass login
3. **Create username:** `bob` (must be different from Device A!)
   - Enter username: `bob`
   - Enter display name: `Bob`
   - Tap "Create Profile"
4. **Go to Friends tab**
5. **Scan QR Code:**
   - Tap "Scan QR Code"
   - Point Device B's camera at Device A's QR code
   - ✅ Friend request sent to `alice`!

### Step 3: Accept Friend Request on Device A

1. **On Device A**, go to **Friends tab** → **"Requests" tab**
2. You should see a friend request from `bob`
3. **Tap "Accept"**
4. ✅ `bob` should now appear in your Friends list!

### Step 4: Send Hoot from Device A to Device B

1. **On Device A**, go to **Home tab (Hoot)**
2. **Type a message** in the Hoot input (e.g., "Hello Bob!")
3. **Select send mode:**
   - Choose **"All Friends"** (sends to all friends including Bob)
   - OR choose **"Select Users"** and select `bob`
4. **Tap the circular "Send Hoot" button**
5. ✅ You should see "Hoot sent successfully!" message

### Step 5: Verify Message in Firestore

**Option A: Check Firebase Console**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Firestore Database**
4. Click on **"messages"** collection
5. You should see a message document with:
   - `fromUserId`: Alice's user ID
   - `toUserId`: Bob's user ID
   - `message`: "Hello Bob!"
   - `createdAt`: timestamp
   - `expiresAt`: timestamp (24 hours later)

**Option B: Check in App (if message view is implemented)**
- Note: Without push notifications backend, Bob won't get a notification
- But the message is still created in Firestore

### Step 6: Test Reverse (Bob Sends to Alice)

1. **On Device B**, go to **Home tab**
2. **Type a message** (e.g., "Hi Alice!")
3. **Select send mode:**
   - Choose **"All Friends"** or **"Select Users"** → select `alice`
4. **Tap "Send Hoot"**
5. ✅ Message created in Firestore

---

## Testing Different Send Modes

### Test 1: Send to All Friends
- On Device A: Select **"All Friends"** mode
- Send Hoot
- ✅ Should send to all friends (including Bob)

### Test 2: Send to Select Users
- On Device A: Select **"Select Users"** mode
- Search for `bob` in the search field
- Select `bob` from the list
- Send Hoot
- ✅ Should send only to Bob

### Test 3: Send to Groups
1. **Create a group:**
   - On Device A: Go to Friends tab → Groups tab
   - Tap "+ Create Group"
   - Name: "Test Group"
   - Add `bob` to the group
2. **Send Hoot to group:**
   - On Device A: Go to Home tab
   - Select **"Groups"** mode
   - Select "Test Group"
   - Send Hoot
   - ✅ Should send to all members of the group (including Bob)

---

## What Works Without Backend

✅ **Message Creation:**
- Messages are created in Firestore
- Messages have expiration timestamps (24 hours)
- Messages are linked to sender and recipient

✅ **Friend Requests:**
- Can send friend requests via QR code
- Can accept/decline requests
- Friends list updates correctly

✅ **Groups:**
- Can create groups
- Can add friends to groups
- Can send Hoots to groups

❌ **Push Notifications:**
- Won't receive push notifications (requires backend setup)
- Messages are still created and stored

---

## Troubleshooting

### "No Recipients" Error
- **Problem:** No friends selected
- **Solution:** Make sure you've accepted the friend request first

### Friend Request Not Appearing
- **Problem:** Request not showing up
- **Solution:** 
  1. Check that you scanned the correct QR code
  2. Refresh the Requests tab
  3. Check Firestore "friendships" collection

### Message Not Appearing in Firestore
- **Problem:** Message not created
- **Solution:**
  1. Check console for errors
  2. Verify Firebase connection
  3. Check that recipient user exists in Firestore

### QR Code Not Scanning
- **Problem:** Camera not working
- **Solution:**
  1. Grant camera permissions
  2. Make sure QR code is fully visible
  3. Try taking a screenshot and scanning from photo

---

## Quick Test Checklist

- [ ] Device A: Create user `alice`
- [ ] Device A: Generate QR code
- [ ] Device B: Create user `bob`
- [ ] Device B: Scan Alice's QR code
- [ ] Device A: Accept friend request
- [ ] Device A: Send Hoot to "All Friends"
- [ ] Verify message in Firestore
- [ ] Device B: Send Hoot to Alice
- [ ] Create group and test group Hoot

---

## Next Steps

Once basic testing works:
1. **Set up push notifications backend** (see `BACKEND_SETUP.md`)
2. **Test with real push notifications**
3. **Test message viewing** (when notification is tapped)
4. **Test message deletion** (swipe up to dismiss)

---

## Notes

- **Each device needs a different username** to create different user IDs
- **Messages are stored in Firestore** even without push notifications
- **You can verify messages** in Firebase Console
- **Push notifications require backend setup** to actually notify users

