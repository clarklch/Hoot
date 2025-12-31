# Logo Placeholder Note

## Current Status
The app is currently using placeholder images for the app icon and logo. You'll need to replace these with your actual logo when ready.

## Files to Replace

### App Icons
- `assets/images/icon.png` - Main app icon (1024x1024px recommended)
- `assets/images/android-icon-foreground.png` - Android foreground icon
- `assets/images/android-icon-background.png` - Android background icon
- `assets/images/android-icon-monochrome.png` - Android monochrome icon
- `assets/images/favicon.png` - Web favicon (32x32px or 16x16px)

### Splash Screen
- `assets/images/splash-icon.png` - Splash screen icon (200x200px as configured)

## Logo Requirements

### App Icon
- **Size**: 1024x1024 pixels
- **Format**: PNG with transparency
- **Design**: Should work well at small sizes (appears as 60x60 on iOS home screen)

### Android Adaptive Icon
- **Foreground**: 432x432px (safe zone: 288x288px)
- **Background**: 432x432px (full size)
- **Monochrome**: 432x432px (for themed icons)

### Splash Screen
- **Size**: 200x200px (as configured in app.json)
- **Format**: PNG with transparency
- **Background**: White (light mode) / Black (dark mode) as configured

## How to Replace

1. Create your logo files with the specifications above
2. Replace the files in `assets/images/` folder
3. Update `app.json` if you change file names or sizes
4. Rebuild the app for changes to take effect

## Design Tips

- Keep logos simple and recognizable at small sizes
- Use high contrast colors
- Test how it looks on both light and dark backgrounds
- Ensure the logo is centered and has appropriate padding

## Testing

After replacing logos:
1. Run `npm start` to restart the development server
2. Clear app cache if needed
3. Check how icons appear on home screen
4. Test splash screen appearance

