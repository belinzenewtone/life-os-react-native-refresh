#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing file: ${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function expect(condition, passMessage, failMessage, results) {
  if (condition) {
    results.passed.push(passMessage);
  } else {
    results.failed.push(failMessage);
  }
}

function hasSqlCipherPlugin(plugins) {
  return plugins.some((entry) => {
    if (!Array.isArray(entry)) return false;
    if (entry[0] !== 'expo-sqlite') return false;
    return Boolean(entry[1]?.useSQLCipher);
  });
}

function hasChannel(profile, channelName) {
  return profile && profile.channel === channelName;
}

function isPlaceholderUrl(url) {
  return typeof url !== 'string' || url.includes('<owner>') || url.includes('<repo>');
}

function run() {
  const results = { passed: [], failed: [] };

  const appJson = readJson('app.json');
  const easJson = readJson('eas.json');
  const expo = appJson.expo ?? {};

  expect(
    expo.runtimeVersion?.policy === 'appVersion',
    'runtimeVersion policy is set to appVersion.',
    'runtimeVersion.policy must be "appVersion" for OTA/binary compatibility.',
    results,
  );

  expect(
    expo.updates?.enabled === true,
    'Expo Updates are enabled.',
    'Expo Updates must be enabled.',
    results,
  );

  expect(
    hasChannel(easJson.build?.development, 'development'),
    'EAS development profile uses development channel.',
    'eas.json build.development.channel must be "development".',
    results,
  );

  expect(
    hasChannel(easJson.build?.preview, 'staging'),
    'EAS preview profile uses staging channel.',
    'eas.json build.preview.channel must be "staging".',
    results,
  );

  expect(
    hasChannel(easJson.build?.production, 'production'),
    'EAS production profile uses production channel.',
    'eas.json build.production.channel must be "production".',
    results,
  );

  const androidPermissions = new Set(expo.android?.permissions ?? []);
  const requiredPermissions = ['READ_SMS', 'RECEIVE_SMS', 'POST_NOTIFICATIONS'];
  const missingPermissions = requiredPermissions.filter((permission) => !androidPermissions.has(permission));

  expect(
    missingPermissions.length === 0,
    `Android permissions include ${requiredPermissions.join(', ')}.`,
    `Missing Android permissions: ${missingPermissions.join(', ')}.`,
    results,
  );

  expect(
    hasSqlCipherPlugin(expo.plugins ?? []),
    'expo-sqlite plugin is configured with useSQLCipher=true.',
    'expo-sqlite plugin must include useSQLCipher=true for encrypted local DB parity.',
    results,
  );

  const otaManifestUrl = expo.extra?.otaManifestUrl;
  const binaryVersionEndpointUrl = expo.extra?.binaryVersionEndpointUrl;

  expect(
    !isPlaceholderUrl(otaManifestUrl),
    `otaManifestUrl looks configured: ${otaManifestUrl}`,
    'expo.extra.otaManifestUrl still contains placeholder values.',
    results,
  );

  expect(
    !isPlaceholderUrl(binaryVersionEndpointUrl),
    `binaryVersionEndpointUrl looks configured: ${binaryVersionEndpointUrl}`,
    'expo.extra.binaryVersionEndpointUrl still contains placeholder values.',
    results,
  );

  expect(
    fs.existsSync(path.join(root, 'ota', 'manifest.json')),
    'ota/manifest.json exists.',
    'Missing ota/manifest.json.',
    results,
  );

  expect(
    fs.existsSync(path.join(root, 'ota', 'binary-version.json')),
    'ota/binary-version.json exists.',
    'Missing ota/binary-version.json.',
    results,
  );

  console.log('Release readiness report');
  console.log('');
  for (const item of results.passed) console.log(`PASS  ${item}`);
  for (const item of results.failed) console.log(`FAIL  ${item}`);
  console.log('');

  if (results.failed.length > 0) {
    console.error(`Release readiness failed with ${results.failed.length} issue(s).`);
    process.exit(1);
  }

  console.log('Release readiness checks passed.');
}

run();
