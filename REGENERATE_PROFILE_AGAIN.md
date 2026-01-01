# How to Regenerate Provisioning Profile Again

## Steps to Regenerate

### Step 1: Open Terminal
Make sure you're in your project directory.

### Step 2: Run EAS Credentials
```bash
cd /Users/clarkchung/Desktop/Hoot
eas credentials
```

### Step 3: Navigate the Menu
1. Select: **iOS**
2. Select: **production** (or the profile you're building with)
3. Select: **Build Credentials: Manage everything needed to build your project**
4. Select: **Provisioning Profile: Delete one from your project**
5. Confirm deletion: **yes**

### Step 4: Regenerate
After deleting, you'll see the menu again. Select:
- **All: Set up all the required credentials to build your project**

This will:
- Detect the enabled capabilities in Apple Developer Portal
- Create a NEW provisioning profile WITH the capabilities
- Should show: "Synced capabilities: Enabled: Push Notifications, Sign In with Apple"

### Step 5: Verify
After regenerating, check the output. It should say:
- ✅ "Synced capabilities: Enabled: Push Notifications, Sign In with Apple"
- ✅ "Created provisioning profile"

If it still says "Disabled", wait another 2-3 minutes and try again (Apple's changes might still be propagating).

---

## Quick Command Sequence

```bash
cd /Users/clarkchung/Desktop/Hoot
eas credentials
# Then follow the menu prompts:
# 1. iOS
# 2. production
# 3. Build Credentials
# 4. Delete provisioning profile
# 5. Yes (confirm)
# 6. All: Set up all credentials
```

---

## What to Look For

**Good signs:**
- "Synced capabilities: Enabled: Push Notifications, Sign In with Apple"
- "Created provisioning profile"
- Profile shows as "active"

**Bad signs:**
- "Synced capabilities: Disabled: Push Notifications, Sign In with Apple"
- If you see this, wait 2-3 more minutes and try again

