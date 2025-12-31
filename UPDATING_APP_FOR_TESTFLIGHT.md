# Updating Your App for TestFlight

## Quick Answer

**It depends on what you changed:**

- **JavaScript/React Native code changes:** Use **EAS Update** (over-the-air, no rebuild needed) ✅
- **Native code changes:** Need to **rebuild and resubmit** (takes 15-30 minutes) ⏳
- **App configuration changes:** Usually need to **rebuild** ⏳

---

## Option 1: EAS Update (Fast - For Code Changes Only)

### When to Use
- ✅ Bug fixes in JavaScript/TypeScript
- ✅ UI changes
- ✅ Feature updates
- ✅ Logic changes
- ✅ No native code changes

### How It Works
- Updates are pushed **over-the-air**
- Testers get updates **automatically** (no reinstall needed)
- Takes **minutes** instead of hours
- No new TestFlight build required

### Steps

1. **Make your code changes**
   ```bash
   # Edit your code files
   ```

2. **Commit changes**
   ```bash
   git add .
   git commit -m "Fix: Bug description"
   ```

3. **Publish update**
   ```bash
   eas update --branch production --message "Bug fix: description"
   ```

4. **Testers get update automatically**
   - Next time they open the app, they'll get the update
   - No need to reinstall from TestFlight

### Limitations
- ❌ Can't change native code (iOS/Android native modules)
- ❌ Can't change app configuration (app.json changes)
- ❌ Can't change dependencies that require native changes
- ❌ Can't change bundle ID, version, etc.

---

## Option 2: Rebuild and Resubmit (For Native Changes)

### When to Use
- ✅ Native code changes (iOS/Android)
- ✅ New native dependencies
- ✅ App configuration changes (app.json)
- ✅ Version number changes
- ✅ Bundle ID changes
- ✅ Major structural changes

### How It Works
- Builds a new app binary
- Takes 15-30 minutes
- Need to resubmit to TestFlight
- Testers need to update from TestFlight

### Steps

1. **Make your changes**
   ```bash
   # Edit code or configuration
   ```

2. **Update version (optional)**
   ```json
   // In app.json
   "version": "1.0.1"  // Bump version
   ```

3. **Build new version**
   ```bash
   eas build --platform ios --profile production --non-interactive
   ```

4. **Submit to TestFlight**
   ```bash
   eas submit --platform ios --latest
   ```

5. **Wait for processing** (10-30 minutes)

6. **Testers update from TestFlight**
   - They'll see a new version available
   - Tap "Update" in TestFlight

---

## Decision Tree

```
Did you change:
├─ JavaScript/TypeScript code only?
│  └─ ✅ Use EAS Update (fast, over-the-air)
│
├─ Native code or dependencies?
│  └─ ⏳ Rebuild and resubmit
│
├─ app.json configuration?
│  └─ ⏳ Rebuild and resubmit
│
└─ Version number?
   └─ ⏳ Rebuild and resubmit
```

---

## Best Practice Workflow

### For Quick Bug Fixes (Most Common)

1. **Fix the bug** (JavaScript/TypeScript)
2. **Test locally** (`npm start`)
3. **Publish update:**
   ```bash
   eas update --branch production --message "Fix: Bug description"
   ```
4. **Testers get it automatically** (within minutes)

### For Major Changes

1. **Make changes** (including native/config if needed)
2. **Bump version** in `app.json`
3. **Build:**
   ```bash
   eas build --platform ios --profile production --non-interactive
   ```
4. **Submit:**
   ```bash
   eas submit --platform ios --latest
   ```
5. **Wait for processing**
6. **Testers update from TestFlight**

---

## Examples

### Example 1: Fix a UI Bug
```bash
# Change: Fixed button color in friends screen
# Type: JavaScript only
# Solution: EAS Update

eas update --branch production --message "Fix: Button color in friends screen"
# ✅ Done in 2 minutes, testers get it automatically
```

### Example 2: Add New Native Dependency
```bash
# Change: Added new camera library
# Type: Native dependency
# Solution: Rebuild

# Update app.json version
eas build --platform ios --profile production --non-interactive
eas submit --platform ios --latest
# ⏳ Takes 30-45 minutes total
```

### Example 3: Fix Critical Bug
```bash
# Change: Fixed crash in message view
# Type: JavaScript only
# Solution: EAS Update (fastest)

eas update --branch production --message "Critical: Fix crash in message view"
# ✅ Testers get fix within minutes
```

---

## EAS Update Setup (One-Time)

If you haven't set up EAS Update yet:

```bash
# Configure EAS Update
eas update:configure

# This sets up the update system
# Your production build already supports updates
```

---

## Summary

**For most bug fixes:** Use **EAS Update** - it's fast and testers get updates automatically.

**For native/config changes:** **Rebuild and resubmit** - required for those changes.

**Pro tip:** Use EAS Update for 90% of your fixes, only rebuild when absolutely necessary!

---

## Quick Commands

```bash
# Fast update (JavaScript changes only)
eas update --branch production --message "Fix: Description"

# Full rebuild (native/config changes)
eas build --platform ios --profile production --non-interactive
eas submit --platform ios --latest
```

