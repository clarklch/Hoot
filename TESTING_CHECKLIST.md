# Hoot App Testing Checklist

## Pre-Testing Setup
- [x] App is running on your device/simulator
- [x] Firebase is connected and working ✅ (Verified - users/usernames visible in Firestore)
- [x] You can see the login screen

## 1. Authentication & Username ✅
- [x] Click "Continue" button (bypasses OAuth for now)
- [x] Username screen appears
- [x] Enter a username (3-20 characters)
- [x] Username validation works (shows error for invalid usernames)
- [x] Username availability check works
- [x] Successfully create username and navigate to home screen

## 2. Friends Management
- [ ] Navigate to Friends tab
- [ ] Search for a username and send friend request
- [ ] Generate QR code (should show your username)
- [ ] Scan QR code from another device/account
- [ ] Friend request appears in "Requests" tab
- [ ] Accept friend request
- [ ] Friend appears in "Friends" tab
- [ ] Remove friend (with confirmation popup)

## 3. Groups
- [ ] Create a new group
- [ ] Add friends to group
- [ ] Group appears in groups list
- [ ] View group members

## 4. Sending Hoots
- [ ] Navigate to Home tab
- [ ] Type a message in the Hoot input
- [ ] Character counter works (240 max)
- [ ] Toggle "Send to all friends" works
- [ ] Select specific groups
- [ ] Click circular "Send Hoot" button
- [ ] Success message appears
- [ ] Message is sent (check Firestore)

## 5. Receiving Hoots (Requires 2 Devices/Accounts)
- [ ] Send Hoot from Device A to Device B
- [ ] Push notification appears on Device B
- [ ] Tap notification
- [ ] Message view screen opens
- [ ] Message displays correctly
- [ ] Swipe up to dismiss
- [ ] Message is deleted

## 6. UI/UX Testing
- [ ] All text is visible (no cutoff)
- [ ] Dynamic Island spacing works on iPhone
- [ ] Buttons are labeled and visible
- [ ] Colors match snowy owl theme
- [ ] Emojis display correctly
- [ ] Background colors fill entire screen
- [ ] Circular "Send Hoot" button displays correctly

## 7. Error Handling
- [ ] Try to send Hoot with no friends
- [ ] Try to create duplicate username
- [ ] Try to send friend request to yourself
- [ ] Network error handling (turn off WiFi)

## Known Issues to Test
- [ ] OAuth is currently bypassed (expected)
- [ ] Push notifications require backend setup (see BACKEND_SETUP.md)

## Next Steps After Testing
1. Set up push notifications backend
2. Fix OAuth if needed
3. Add Firestore security rules
4. Test on real iOS device
5. Prepare for App Store submission

