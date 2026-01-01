# EAS Build - Provisioning Profile Issue

## What's Happening

EAS is asking about a provisioning profile that is "no longer valid":
- Profile ID: NLPM7HNYT6
- Expiry: Thu Dec 31 2026 (but marked as no longer valid)

## What to Do

**Answer: N (No)** - Don't reuse the old profile.

Let EAS generate a new valid provisioning profile automatically.

## Why

- The old profile is invalid/expired
- Reusing it will cause the build to fail
- EAS can automatically create a new valid profile
- This is the safest option

## Expected Next Steps

After you answer "N", EAS will:
1. Generate a new provisioning profile
2. Continue with the build process
3. The build should proceed normally

## Complete Answer Sequence

When asked: "Would you like to reuse the original profile?"

Type: **N** (or **No**)

Then press Enter.

EAS will handle the rest automatically.

