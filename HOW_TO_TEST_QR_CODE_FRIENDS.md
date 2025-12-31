# How to Test QR Code Friend Requests

## ✅ Fixed: Unique User IDs

**Good news!** The app now generates **unique user IDs** for each username you create. This means:
- Each username gets its own unique user ID (e.g., `temp_1234567890_abc123`)
- You can now test friend requests between different users!
- User IDs are stored and persist across app restarts

## How to Test QR Code Friend Requests

Here's the step-by-step guide:

### Method 1: Use "Sign Out" Feature (Easiest - Single Device)

**Step 1: Create First User**
1. Open Hoot app
2. Click "Continue" to bypass login
3. Create username: `alice`
4. Go to Friends tab → "Generate My QR Code"
5. **Take a screenshot** of the QR code (or keep screen open)
6. Go to Friends tab → Scroll down → Tap "Sign Out (Testing)"

**Step 2: Create Second User**
1. After signing out, you'll be back at login screen
2. Click "Continue" again
3. Create username: `bob` (different username = different user ID!)
4. Go to Friends tab → "Scan QR Code"
5. Display the screenshot of `alice`'s QR code on your computer screen
6. Point phone camera at the QR code on screen
7. ✅ Friend request sent to `alice`!

**Step 3: Switch Back to First User**
1. Sign out from `bob`
2. Click "Continue"
3. Create username: `alice` again (same username)
4. The app will load your existing user data
5. Go to Friends tab → "Requests" tab
6. ✅ You should see friend request from `bob`!
7. Tap "Accept"
8. ✅ `bob` should now appear in your Friends list!

**Step 4: Test Reverse**
1. On `bob` account, generate QR code
2. Sign out and log back in as `alice`
3. Scan `bob`'s QR code
4. ✅ Friend request sent!

---

### Method 2: Use Two Devices (If Available)

**Step 1: Set up Device A (First User)**
1. Open Hoot app on Device A
2. Click "Continue" to bypass login
3. Create username: `user1`
4. Go to Friends tab → "Generate My QR Code"
5. **Keep this QR code screen open**

**Step 2: Set up Device B (Second User)**
1. Open Hoot app on Device B
2. Click "Continue" to bypass login
3. Create username: `user2` (different username = different user ID!)
4. Go to Friends tab → "Scan QR Code"
5. Point camera at Device A's QR code
6. ✅ Friend request should be sent!

**Step 3: Accept Friend Request**
1. On Device A, go to Friends tab → "Requests" tab
2. You should see a friend request from `user2`
3. Tap "Accept"
4. ✅ `user2` should now appear in your Friends list!

---

## Why This Works Now

✅ **Each username gets a unique user ID** (e.g., `temp_1234567890_abc123`)
✅ **User IDs are stored in AsyncStorage** and persist across app restarts
✅ **When you create the same username again**, it loads your existing user data
✅ **Different usernames = different user IDs** = can send friend requests!

## Testing Checklist

- [ ] Create user `alice` and generate QR code
- [ ] Sign out
- [ ] Create user `bob` and scan `alice`'s QR code
- [ ] Verify friend request appears in `alice`'s Requests tab
- [ ] Accept friend request
- [ ] Verify `bob` appears in `alice`'s Friends list
- [ ] Test reverse: `alice` scans `bob`'s QR code
- [ ] Test error: Try scanning your own QR code (should show error)

---

## How It Works

When you create a username:
1. **Unique user ID is generated**: `temp_${timestamp}_${randomString}`
2. **User ID is stored in AsyncStorage** for persistence
3. **User data is saved to Firestore** with the unique ID
4. **When you sign out and create the same username again**, it loads your existing data

This allows you to test friend requests between different users on a single device!

