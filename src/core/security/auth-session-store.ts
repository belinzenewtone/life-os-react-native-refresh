import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'lifeos.access_token';
const USER_ID_KEY = 'lifeos.user_id';

function sanitizeKeyPart(value: string) {
  const normalized = value.trim();
  if (!normalized) return 'anonymous';
  return normalized.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function onboardingKey(userId: string) {
  return `lifeos.onboarding_completed.${sanitizeKeyPart(userId)}`;
}

export type AuthSnapshot = {
  accessToken: string | null;
  userId: string | null;
  onboardingCompleted: boolean;
};

export class AuthSessionStore {
  static async readOnboardingCompleted(userId: string): Promise<boolean> {
    return (await SecureStore.getItemAsync(onboardingKey(userId))) === '1';
  }

  static async read(): Promise<AuthSnapshot> {
    const [accessToken, userId] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(USER_ID_KEY),
    ]);
    const onboardingRaw = userId ? await SecureStore.getItemAsync(onboardingKey(userId)) : null;
    return { accessToken, userId, onboardingCompleted: onboardingRaw === '1' };
  }

  static async write(session: { accessToken: string; userId: string }): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken),
      SecureStore.setItemAsync(USER_ID_KEY, session.userId),
    ]);
  }

  static async setOnboardingCompleted(userId: string, completed: boolean): Promise<void> {
    await SecureStore.setItemAsync(onboardingKey(userId), completed ? '1' : '0');
  }

  static async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_ID_KEY),
    ]);
  }
}
