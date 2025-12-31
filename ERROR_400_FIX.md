# Fix: Error 400 - OAuth Configuration Issue

Error 400 typically means "Bad Request" and in OAuth context, this usually indicates:

1. **Redirect URI mismatch** (most common)
2. **Invalid client configuration**
3. **Missing redirect URIs in Google Cloud Console**

---

## Fix 1: Add Redirect URIs to Web Client (MOST IMPORTANT)

This is the #1 cause of Error 400!

### Step 1: Go to Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **"APIs & Services"** > **"Credentials"**

### Step 2: Edit Your Web Client

1. Find your **Web client** (the one with ID ending in `nv5lj7amof31ouivnbehadgk2q07kbms`)
2. Click on it to edit

### Step 3: Add Redirect URIs

Under **"Authorized redirect URIs"**, add these specific URIs (one per line, no wildcards):

```
https://auth.expo.io/@anonymous/Hoot
```

**Important:** 
- Google doesn't accept `exp://` URIs for web OAuth clients
- Only add the HTTPS URI above
- Don't add `hoot://` - custom URL schemes aren't valid OAuth redirect URIs

**Important:** Add each URI on a separate line. Google doesn't allow wildcards (*).

**If you have an Expo account**, also add:
```
https://auth.expo.io/@your-expo-username/Hoot
```
(Replace `your-expo-username` with your actual Expo username if you have one)

### Step 4: Save

1. Click **"SAVE"** at the bottom
2. Wait 1-2 minutes for changes to propagate

---

## Fix 2: Check iOS Client Bundle ID

1. Still in **"Credentials"**
2. Click on your **iOS client** (ending in `biqtj70lm12kjsb8tc4p0e8075aaaej3`)
3. Verify **Bundle ID** is: `com.hoot.app`
4. If it's different, either:
   - Update it to `com.hoot.app` in Google Cloud Console
   - OR update `app.json` to match what's in Google Cloud Console

---

## Fix 3: Verify Client IDs in Code

Make sure your client IDs match exactly:

1. Open `contexts/AuthContext.tsx`
2. Verify:
   - `webClientId`: `155703291482-nv5lj7amof31ouivnbehadgk2q07kbms.apps.googleusercontent.com`
   - `iosClientId`: `155703291482-biqtj70lm12kjsb8tc4p0e8075aaaej3.apps.googleusercontent.com`
3. Make sure there are no extra spaces or characters

---

## Fix 4: Check OAuth Consent Screen

1. Go to **"APIs & Services"** > **"OAuth consent screen"**
2. Make sure:
   - App is published OR you're a test user
   - Privacy Policy URL is saved
   - All required fields are filled

---

## Fix 5: Clear Cache and Retry

1. Stop your Expo server
2. Clear cache:
   ```bash
   expo start -c
   ```
3. Or delete and reinstall Expo Go

---

## Most Common Cause

**90% of Error 400 issues are caused by missing redirect URIs.**

The web client needs to know which redirect URIs are allowed. Expo uses specific redirect URIs that must be added to your OAuth client.

---

## Quick Fix Steps

1. **Go to Credentials** in Google Cloud Console
2. **Click your Web client**
3. **Add redirect URI:** `https://auth.expo.io/@*/Hoot-*`
4. **Save**
5. **Wait 2 minutes**
6. **Try signing in again**

---

## Still Getting Error 400?

If you've added the redirect URIs and it still doesn't work:

1. **Check the exact error message** - there might be more details
2. **Verify client IDs** match exactly in code and console
3. **Check bundle ID** matches in both places
4. **Try a different Google account** (add it as test user first)

---

## Summary

**Most likely fix:** Add `https://auth.expo.io/@*/Hoot-*` to your Web client's authorized redirect URIs.

This should fix Error 400! 🎯

