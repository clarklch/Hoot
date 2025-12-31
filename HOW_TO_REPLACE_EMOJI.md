# How to Replace the Owl Emoji 🦉 with Your Own

## Quick Method: Find and Replace

1. **Open VS Code** (or your code editor)
2. **Press `Cmd+Shift+F`** (Mac) or `Ctrl+Shift+F` (Windows) to open Find and Replace
3. **In the search box**, type: `🦉`
4. **In the replace box**, type your emoji (e.g., `🦅` for eagle, `🐦` for bird, etc.)
5. **Click "Replace All"**

## Files That Contain the Owl Emoji

The owl emoji appears in these files:

1. **`app/(auth)/login.tsx`** - Line 59 (welcome screen)
2. **`app/(auth)/username.tsx`** - Line 100 (username screen)
3. **`app/(tabs)/index.tsx`** - Line 199 (home/send hoot screen)
4. **`app/(tabs)/friends.tsx`** - Multiple places (empty states)
5. **`app/admin.tsx`** - Line 76 (admin screen)

## Manual Replacement (If Needed)

If you prefer to replace manually, here are the exact locations:

### 1. Login Screen (`app/(auth)/login.tsx`)
- Line 59: `<ThemedText style={styles.emoji}>🦉</ThemedText>`

### 2. Username Screen (`app/(auth)/username.tsx`)
- Line 100: `<ThemedText style={styles.emoji}>🦉</ThemedText>`

### 3. Home Screen (`app/(tabs)/index.tsx`)
- Line 199: `<ThemedText style={styles.emoji}>🦉</ThemedText>`

### 4. Friends Screen (`app/(tabs)/friends.tsx`)
- Line 454: `"No friends yet 🦉❄️"`
- Line 477: `"No pending requests 🦉❄️"`
- Line 552: `"No groups yet 🦉❄️"`

### 5. Admin Screen (`app/admin.tsx`)
- Line 76: `"Database Statistics 🦉"`

## Example: Replace with Eagle Emoji 🦅

If you want to use an eagle emoji instead:
1. Find: `🦉`
2. Replace: `🦅`

## Example: Replace with Bird Emoji 🐦

If you want to use a bird emoji:
1. Find: `🦉`
2. Replace: `🐦`

## Tips

- **Keep it consistent** - Use the same emoji everywhere
- **Test after replacing** - Make sure the emoji displays correctly
- **Consider size** - Some emojis might look better at different sizes
- **Check all screens** - Make sure you didn't miss any

---

**Ready to replace?** Just use Find and Replace in your editor with `🦉` → `[your emoji]`

