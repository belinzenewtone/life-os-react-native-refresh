#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function run() {
  const app = readJson('app.json');
  const eas = readJson('eas.json');
  const appVersion = app?.expo?.version ?? '1.0.0';
  const runtimePolicy = app?.expo?.runtimeVersion?.policy ?? 'appVersion';
  const generatedAt = new Date().toISOString();

  const manifest = {
    schemaVersion: 1,
    generatedAt,
    appVersion,
    runtimePolicy,
    channels: {
      development: eas?.build?.development?.channel ?? 'development',
      staging: eas?.build?.preview?.channel ?? 'staging',
      production: eas?.build?.production?.channel ?? 'production',
    },
    notes: 'Use EAS Update to publish channel-specific updates. Keep runtime compatibility with appVersion policy.',
  };

  const existingBinaryManifestPath = path.join(root, 'ota', 'binary-version.json');
  const existingBinary = fs.existsSync(existingBinaryManifestPath)
    ? JSON.parse(fs.readFileSync(existingBinaryManifestPath, 'utf8'))
    : {};

  const binaryManifest = {
    minimumVersion: existingBinary.minimumVersion ?? appVersion,
    latestVersion: appVersion,
    androidStoreUrl:
      existingBinary.androidStoreUrl ??
      'https://play.google.com/store/apps/details?id=com.personal.lifeos.rn',
    iosStoreUrl:
      existingBinary.iosStoreUrl ??
      'https://apps.apple.com/app/id0000000000',
    forceUpgradeMessage:
      existingBinary.forceUpgradeMessage ??
      'A new app version is required to continue syncing and receiving updates.',
    optionalUpgradeMessage:
      existingBinary.optionalUpgradeMessage ??
      'A newer app build is available with native improvements and stability updates.',
    generatedAt,
  };

  writeJson('ota/manifest.json', manifest);
  writeJson('ota/binary-version.json', binaryManifest);

  console.log('Synced OTA manifests');
  console.log(`- app version: ${appVersion}`);
  console.log(`- runtime policy: ${runtimePolicy}`);
  console.log(`- channels: development=${manifest.channels.development}, staging=${manifest.channels.staging}, production=${manifest.channels.production}`);
}

run();
