import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { compareVersions } from '@/core/update/version-utils';

type BinaryManifest = {
  minimumVersion?: string;
  latestVersion?: string;
  androidStoreUrl?: string;
  iosStoreUrl?: string;
  forceUpgradeMessage?: string;
  optionalUpgradeMessage?: string;
};

export type BinaryUpgradeDecision = {
  available: boolean;
  required: boolean;
  currentVersion: string;
  targetVersion: string | null;
  storeUrl: string | null;
  message: string;
};

function pickStoreUrl(manifest: BinaryManifest) {
  if (Platform.OS === 'android') return manifest.androidStoreUrl ?? null;
  if (Platform.OS === 'ios') return manifest.iosStoreUrl ?? null;
  return null;
}

function resolveCurrentVersion() {
  return Application.nativeApplicationVersion ?? '0.0.0';
}

export class BinaryUpgradeService {
  static async check(): Promise<BinaryUpgradeDecision> {
    const endpoint = process.env.EXPO_PUBLIC_BINARY_VERSION_ENDPOINT;
    const currentVersion = resolveCurrentVersion();

    if (!endpoint) {
      return {
        available: false,
        required: false,
        currentVersion,
        targetVersion: null,
        storeUrl: null,
        message: '',
      };
    }

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        return {
          available: false,
          required: false,
          currentVersion,
          targetVersion: null,
          storeUrl: null,
          message: '',
        };
      }

      const manifest = (await response.json()) as BinaryManifest;
      const minimumVersion = manifest.minimumVersion;
      const latestVersion = manifest.latestVersion;
      const storeUrl = pickStoreUrl(manifest);

      const isRequired = Boolean(
        minimumVersion && compareVersions(currentVersion, minimumVersion) < 0,
      );

      if (isRequired) {
        return {
          available: true,
          required: true,
          currentVersion,
          targetVersion: minimumVersion ?? latestVersion ?? null,
          storeUrl,
          message:
            manifest.forceUpgradeMessage ??
            'A new app version is required to continue syncing and receiving updates.',
        };
      }

      const hasOptional = Boolean(latestVersion && compareVersions(currentVersion, latestVersion) < 0);
      return {
        available: hasOptional,
        required: false,
        currentVersion,
        targetVersion: latestVersion ?? null,
        storeUrl,
        message:
          manifest.optionalUpgradeMessage ??
          'A newer app build is available with native improvements and stability updates.',
      };
    } catch {
      return {
        available: false,
        required: false,
        currentVersion,
        targetVersion: null,
        storeUrl: null,
        message: '',
      };
    }
  }
}
