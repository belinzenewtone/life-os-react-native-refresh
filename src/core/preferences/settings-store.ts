import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'lifeos.setting.';

export type AppSettings = {
  notificationsEnabled: boolean;
  biometricEnabled: boolean;
  themeMode: 'system' | 'light' | 'dark';
};

const defaults: AppSettings = {
  notificationsEnabled: true,
  biometricEnabled: true,
  themeMode: 'system',
};

export class SettingsStore {
  static async read(): Promise<AppSettings> {
    const raw = await SecureStore.getItemAsync(`${KEY_PREFIX}all`);
    if (!raw) return defaults;
    try {
      return { ...defaults, ...(JSON.parse(raw) as Partial<AppSettings>) };
    } catch {
      return defaults;
    }
  }

  static async write(next: Partial<AppSettings>) {
    const current = await this.read();
    const merged = { ...current, ...next };
    await SecureStore.setItemAsync(`${KEY_PREFIX}all`, JSON.stringify(merged));
    return merged;
  }
}