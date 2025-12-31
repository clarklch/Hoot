/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Snowy Owl Theme - Elegant whites, light blues, and winter tones
const tintColorLight = '#4A90E2'; // Soft ice blue
const tintColorDark = '#87CEEB'; // Sky blue

export const Colors = {
  light: {
    text: '#2C3E50', // Dark blue-gray
    background: '#F8F9FA', // Soft white with slight gray
    tint: tintColorLight,
    icon: '#5F7F9B', // Darker blue-gray for better contrast
    tabIconDefault: '#B0C4DE', // Light steel blue
    tabIconSelected: tintColorLight,
    accent: '#E8F4F8', // Very light blue
    secondary: '#6B8E9F', // Blue-gray
    success: '#5CB85C', // Soft green
    snow: '#FFFFFF', // Pure white
    ice: '#E0F2F7', // Ice blue
  },
  dark: {
    text: '#E8E8E8', // Light gray
    background: '#1E2A3A', // Dark blue-gray (night sky)
    tint: tintColorDark,
    icon: '#87CEEB', // Sky blue
    tabIconDefault: '#6B8E9F',
    tabIconSelected: tintColorDark,
    accent: '#2C3E50', // Dark blue-gray
    secondary: '#4A90E2',
    success: '#5CB85C',
    snow: '#F0F8FF', // Alice blue
    ice: '#B0E0E6', // Powder blue
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
