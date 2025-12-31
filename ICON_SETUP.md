# App Icon Setup Guide for Hoot

## Required Icon Files

For publishing your Hoot app, you need the following icon files in `assets/images/`:

### 1. Main App Icon
- **File**: `icon.png`
- **Size**: 1024x1024px
- **Format**: PNG
- **Requirements**: 
  - Square format
  - No transparency (iOS requirement)
  - Should be your owl logo on the blue gradient background

### 2. Android Adaptive Icons
Android requires adaptive icons with separate foreground and background layers:

- **Foreground**: `android-icon-foreground.png`
  - Size: 1024x1024px
  - Should contain your owl logo (centered, with safe zone)
  - Safe zone: Keep important content within the center 66% (about 676x676px)
  
- **Background**: `android-icon-background.png`
  - Size: 1024x1024px
  - Should be your blue gradient background
  - Can be a solid color or gradient
  
- **Monochrome**: `android-icon-monochrome.png`
  - Size: 1024x1024px
  - Single color version (usually white or black)
  - Used for themed icons

### 3. Splash Screen Icon
- **File**: `splash-icon.png`
- **Size**: 200x200px (or larger, will be scaled)
- **Format**: PNG
- **Requirements**: Your owl logo, will be displayed on splash screen

### 4. Web Favicon
- **File**: `favicon.png`
- **Size**: 48x48px or 192x192px
- **Format**: PNG
- **Requirements**: Small version of your logo

## How to Generate Icons

### Option 1: Using Online Tools
1. **AppIcon.co** - https://appicon.co
   - Upload your 1024x1024px logo
   - Generates all required sizes automatically
   - Download and place in `assets/images/`

2. **IconKitchen** - https://icon.kitchen
   - Google's official adaptive icon generator
   - Great for Android adaptive icons

### Option 2: Manual Creation
1. Start with your logo at 1024x1024px
2. Use image editing software (Photoshop, Figma, etc.) to:
   - Create the main `icon.png` (1024x1024px, no transparency)
   - Extract foreground (owl) for `android-icon-foreground.png`
   - Extract background (gradient) for `android-icon-background.png`
   - Create monochrome version for `android-icon-monochrome.png`
   - Resize for splash (200x200px) and favicon (192x192px)

### Option 3: Using Expo Tools
You can use `@expo/image-utils` or similar tools to programmatically generate icons.

## Current Configuration

Your `app.json` is already configured to use these files:
- Main icon: `./assets/images/icon.png`
- Android adaptive icons: Configured in `android.adaptiveIcon`
- Splash screen: Configured in `expo-splash-screen` plugin
- Favicon: Configured in `web.favicon`

## Next Steps

1. **Place your logo file** in `assets/images/` (name it something like `hoot-logo-source.png`)
2. **Generate all required sizes** using one of the methods above
3. **Replace the existing icon files** in `assets/images/`
4. **Test the icons** by running:
   ```bash
   npx expo prebuild
   ```
   This will generate native projects with your icons

## Notes

- iOS icons must not have transparency
- Android adaptive icons should have the logo centered with safe zone padding
- The splash screen icon will be displayed on a white background (light mode) or black background (dark mode) as configured
- Make sure all icons maintain the same visual style and branding

