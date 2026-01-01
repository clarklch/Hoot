# How to Run EAS Credentials Without Syncing Capabilities

## The Problem

When you run `eas credentials`, EAS syncs capabilities and unchecks them in Apple Developer Portal.

## The Solution

Set the `EXPO_NO_CAPABILITY_SYNC=1` environment variable **BEFORE** running `eas credentials`. This prevents EAS from syncing/modifying capabilities.

## How to Do It

### Step 1: Set Environment Variable

**In your terminal, run:**

```bash
export EXPO_NO_CAPABILITY_SYNC=1
```

### Step 2: Run EAS Credentials

**Then immediately run:**

```bash
eas credentials
```

**Important:** Run both commands in the same terminal session. The environment variable only lasts for that terminal session.

### Step 3: Navigate the Menu

1. Select: **iOS**
2. Select: **production**
3. Select: **Build Credentials: Manage everything needed to build your project**
4. Select: **All: Set up all the required credentials to build your project**

### Step 4: What to Expect

With `EXPO_NO_CAPABILITY_SYNC=1` set, EAS should:
- **NOT sync capabilities** (or sync without modifying them)
- Generate provisioning profile based on what's currently enabled in Apple Developer Portal
- **NOT uncheck your capabilities**

## Alternative: One-Line Command

You can also combine both commands:

```bash
EXPO_NO_CAPABILITY_SYNC=1 eas credentials
```

This sets the variable just for that one command.

## After This Works

Once you have a provisioning profile with the capabilities:
- You won't need to regenerate it often
- Future builds will use the existing profile
- Capabilities will stay enabled

## Why This Works

- `EXPO_NO_CAPABILITY_SYNC=1` tells EAS to skip capability synchronization
- This prevents EAS from modifying capabilities in Apple Developer Portal
- Your manually enabled capabilities will stay enabled

