# Deploy Privacy Policy to Netlify

## Quick Setup

Netlify requires an `index.html` file. Here's how to deploy:

### Step 1: Create a Deployment Folder

1. Create a new folder on your computer (e.g., `hoot-privacy`)
2. Copy these two files into it:
   - `index.html` (redirects to privacy policy)
   - `privacy-policy.html` (the actual privacy policy)

### Step 2: Deploy to Netlify

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop the folder containing:
   - `index.html`
   - `privacy-policy.html`
3. Wait for upload to complete
4. Copy your Netlify URL

### Step 3: Get Your Privacy Policy URL

Your Privacy Policy will be accessible at:
```
https://your-site.netlify.app/privacy-policy.html
```

**OR** (if index.html redirects properly):
```
https://your-site.netlify.app/
```

Both URLs should work!

---

## Files You Need

Make sure your deployment folder has:
- ✅ `index.html` (required by Netlify)
- ✅ `privacy-policy.html` (your privacy policy)

**That's it!** Just these two files.

---

## Alternative: Use Root URL

If you want the root URL (`https://your-site.netlify.app/`) to show the privacy policy directly, you can:

1. Rename `privacy-policy.html` to `index.html`
2. Deploy just that one file

But having both files is better for flexibility!

---

## After Deployment

1. Test your URL: `https://your-site.netlify.app/privacy-policy.html`
2. Add it to Google Cloud Console > OAuth consent screen
3. Save and try signing in again!

Done! 🎉

