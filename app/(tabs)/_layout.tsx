import { Tabs, useRouter, useSegments } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const segments = useSegments();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const getCurrentTab = () => {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment === 'friends') return 'friends';
    if (lastSegment === 'settings') return 'settings';
    return 'hoot';
  };

  const currentTab = getCurrentTab();
  const [activeTab, setActiveTab] = useState(currentTab);
  
  const getIndicatorPosition = (tab: string) => {
    if (tab === 'hoot') return 0;
    if (tab === 'friends') return SCREEN_WIDTH / 3;
    return (SCREEN_WIDTH / 3) * 2;
  };

  const slideAnim = useRef(new Animated.Value(getIndicatorPosition(currentTab))).current;

  useEffect(() => {
    const tab = getCurrentTab();
    setActiveTab(tab);
    Animated.spring(slideAnim, {
      toValue: getIndicatorPosition(tab),
      useNativeDriver: true,
      tension: 80,
      friction: 8,
    }).start();
  }, [segments, slideAnim]);

  const handleTabPress = (tab: 'hoot' | 'friends' | 'settings') => {
    if (tab === 'friends') {
      router.push('/(tabs)/friends');
    } else if (tab === 'settings') {
      router.push('/(tabs)/settings');
    } else {
      router.push('/(tabs)');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={[styles.tabBar, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => handleTabPress('hoot')}
            activeOpacity={0.7}>
            <ThemedText
              style={[
                styles.tabText,
                {
                  color: activeTab === 'hoot' ? colors.tint : colors.tabIconDefault,
                  fontWeight: activeTab === 'hoot' ? '700' : '500',
                },
              ]}>
              Hoot
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => handleTabPress('friends')}
            activeOpacity={0.7}>
            <ThemedText
              style={[
                styles.tabText,
                {
                  color: activeTab === 'friends' ? colors.tint : colors.tabIconDefault,
                  fontWeight: activeTab === 'friends' ? '700' : '500',
                },
              ]}>
              Friends
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => handleTabPress('settings')}
            activeOpacity={0.7}>
            <ThemedText
              style={[
                styles.tabText,
                {
                  color: activeTab === 'settings' ? colors.tint : colors.tabIconDefault,
                  fontWeight: activeTab === 'settings' ? '700' : '500',
                },
              ]}>
              Settings
            </ThemedText>
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.indicator,
              {
                backgroundColor: colors.tint,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />
        </View>
      </View>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="friends" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  tabBar: {
    flexDirection: 'row',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabText: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH / 3,
    height: 3,
    borderRadius: 2,
  },
});
