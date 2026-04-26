import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { PermissionsAndroid, Platform, Text } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

let cachedNotifications: NotificationsModule | null = null;

function isExpoGo() {
  return Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
}

async function getNotificationsModule() {
  if (Platform.OS === 'web' || isExpoGo()) return null;
  if (!cachedNotifications) {
    cachedNotifications = await import('expo-notifications');
  }
  return cachedNotifications;
}

async function ensureNotificationPermission() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return;
  await Notifications.requestPermissionsAsync();
}

async function ensureSmsPermissions() {
  if (Platform.OS !== 'android') return;
  await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  ]);
}

export function AppPermissionsOrchestrator({ currentRoute, enabled = true }: { currentRoute?: string; enabled?: boolean }) {
  const didAskNotifications = useRef(false);
  const didAskSms = useRef(false);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web' || didAskNotifications.current) return;
    didAskNotifications.current = true;
    void ensureNotificationPermission();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android' || currentRoute !== '/finance' || didAskSms.current) return;
    didAskSms.current = true;
    void ensureSmsPermissions();
  }, [currentRoute, enabled]);

  if (Platform.OS === 'web') return null;
  return <Text style={{ position: 'absolute', left: -9999 }}>permissions-orchestrator</Text>;
}
