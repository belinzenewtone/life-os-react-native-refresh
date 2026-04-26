import React, { memo } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';

const TabIcon = memo(function TabIcon({
  name,
  color,
  focused,
  bubbleColor,
}: {
  name: keyof typeof MaterialIcons.glyphMap;
  color: string;
  focused: boolean;
  bubbleColor: string;
}) {
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: bubbleColor }]}>
      <MaterialIcons name={name} size={focused ? 22 : 20} color={color} />
    </View>
  );
});

export default function TabsLayout() {
  const colors = useLifeOSColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16 + insets.bottom,
          borderRadius: 24,
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: colors.glass,
          borderTopWidth: 1,
          borderColor: colors.glassBorder,
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        },
        tabBarLabelStyle: styles.label,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} bubbleColor={`${colors.primary}2A`} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="payments" color={color} focused={focused} bubbleColor={`${colors.primary}2A`} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="calendar-month" color={color} focused={focused} bubbleColor={`${colors.primary}2A`} />
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'AI',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="smart-toy" color={color} focused={focused} bubbleColor={`${colors.primary}2A`} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} bubbleColor={`${colors.primary}2A`} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    marginTop: 2,
  },
});
