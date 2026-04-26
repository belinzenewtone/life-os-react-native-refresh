import * as Updates from 'expo-updates';

export class OtaUpdateService {
  static async checkForUpdate() {
    if (__DEV__) return { available: false };
    try {
      const result = await Updates.checkForUpdateAsync();
      return { available: result.isAvailable };
    } catch {
      return { available: false };
    }
  }

  static async applyUpdate() {
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  }
}
