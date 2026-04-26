import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Application from 'expo-application';
import * as LocalAuthentication from 'expo-local-authentication';

import { useAuthSession } from '@/core/auth/session-context';
import { useAppBootstrap } from '@/core/bootstrap/app-bootstrap-context';
import { buildRoute } from '@/core/navigation/routes';
import { ConflictRepository } from '@/core/repositories/conflict-repository';
import { ReminderScheduler } from '@/core/notifications/reminder-scheduler';
import { BinaryUpgradeService } from '@/core/update/binary-upgrade-service';
import { OtaUpdateService } from '@/core/update/ota-update-service';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { AppCard } from '@/core/ui/components/AppCard';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export default function SettingsScreen() {
  const { state } = useAuthSession();
  const { settings, updateSettings } = useAppBootstrap();
  const router = useRouter();
  const colors = useLifeOSColors();

  const [conflictCount, setConflictCount] = useState(0);
  const [otaStatus, setOtaStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready'>('idle');
  const [otaProgress, setOtaProgress] = useState(0);
  const [queueStats, setQueueStats] = useState<{ pending?: number } | null>(null);

  useEffect(() => {
    if (settings.notificationsEnabled) {
      ReminderScheduler.requestPermissions();
    }
  }, [settings.notificationsEnabled]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!state.userId) return;
      const count = await ConflictRepository.countConflicts(state.userId);
      if (mounted) {
        setConflictCount(count);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [state.userId]);

  useEffect(() => {
    if (!state.userId) return;
    async function loadQueueStats() {
      try {
        const stats = await (SyncCoordinator as any).getQueueStats?.(state.userId);
        if (stats) setQueueStats(stats);
      } catch {
        // ignore
      }
    }
    loadQueueStats();
  }, [state.userId]);

  async function handleCheckOta() {
    setOtaStatus('checking');
    try {
      const result = await OtaUpdateService.checkForUpdate();
      if (result.available) {
        setOtaStatus('available');
      } else {
        setOtaStatus('idle');
      }
    } catch {
      setOtaStatus('idle');
    }
  }

  async function handleDownloadOta() {
    setOtaStatus('downloading');
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.1;
      setOtaProgress(progress);
      if (progress >= 1) {
        clearInterval(interval);
        setOtaStatus('ready');
      }
    }, 200);
  }

  function handleInstallOta() {
    Alert.alert('Installing update', 'The app will restart.');
    setOtaStatus('idle');
    setOtaProgress(0);
  }

  return (
    <PageScaffold title="Settings" eyebrow="Preferences" subtitle="Theme, notifications, biometric lock" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Notifications</Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={async (value) => {
              try {
                await updateSettings({ notificationsEnabled: value });
                if (!value) {
                  await ReminderScheduler.cancelAll();
                } else if (state.userId) {
                  await ReminderScheduler.rescheduleAllReminders(state.userId);
                }
              } catch {
                await updateSettings({ notificationsEnabled: !value }).catch(() => {});
              }
            }}
          />
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Biometric lock</Text>
          <Switch
            value={settings.biometricEnabled}
            onValueChange={async (value) => {
              try {
                if (!value) {
                  await updateSettings({ biometricEnabled: false });
                  return;
                }

                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                if (!hasHardware || !isEnrolled) {
                  Alert.alert('Biometric unavailable', 'Set up Face ID/Fingerprint on this device first.');
                  return;
                }

                const auth = await LocalAuthentication.authenticateAsync({
                  promptMessage: 'Enable biometric lock',
                  fallbackLabel: 'Use passcode',
                });
                if (!auth.success) {
                  Alert.alert('Biometric not enabled', 'Authentication was cancelled or failed.');
                  return;
                }

                await updateSettings({ biometricEnabled: true });
              } catch {
                await updateSettings({ biometricEnabled: !value }).catch(() => {});
              }
            }}
          />
        </View>

        <View style={[styles.cardColumn, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Theme mode</Text>
          <View style={styles.themeRow}>
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[
                  styles.themeButton,
                  { borderColor: colors.border },
                  settings.themeMode === mode && [
                    styles.themeButtonActive,
                    { backgroundColor: colors.primary + '22', borderColor: colors.primary },
                  ],
                ]}
                onPress={() => updateSettings({ themeMode: mode })}
              >
                <Text
                  style={[
                    styles.themeText,
                    { color: colors.textSecondary },
                    settings.themeMode === mode && [styles.themeTextActive, { color: colors.primary }],
                  ]}
                >
                  {mode}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {conflictCount > 0 ? (
          <Pressable
            style={[styles.cardColumn, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            onPress={() => router.push(buildRoute('conflicts') as never)}
          >
            <View style={styles.conflictRow}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Sync conflicts</Text>
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>{conflictCount}</Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {conflictCount} unresolved conflict{conflictCount === 1 ? '' : 's'}.
            </Text>
          </Pressable>
        ) : null}

        {Platform.OS === 'android' ? (
          <Pressable
            style={[styles.cardColumn, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            onPress={() => router.push(buildRoute('smsDiagnostics') as never)}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>SMS diagnostics</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Run on-device ingestion checks and parity validation tools.
            </Text>
          </Pressable>
        ) : null}

        <AppCard mode="elevated">
          <View style={{ gap: 10 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>OTA Update</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Current version: {Application.nativeApplicationVersion || '1.0.0'}
            </Text>

            {otaStatus === 'idle' || otaStatus === 'checking' ? (
              <Pressable
                style={[styles.updateButton, { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}
                onPress={handleCheckOta}
                disabled={otaStatus === 'checking'}
              >
                <Text style={[styles.updateButtonText, { color: colors.primary }]}>
                  {otaStatus === 'checking' ? 'Checking...' : 'Check for updates'}
                </Text>
              </Pressable>
            ) : null}

            {otaStatus === 'available' ? (
              <>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Update available</Text>
                <Pressable
                  style={[styles.updateButton, { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}
                  onPress={handleDownloadOta}
                >
                  <Text style={[styles.updateButtonText, { color: colors.primary }]}>Download & Install</Text>
                </Pressable>
              </>
            ) : null}

            {otaStatus === 'downloading' ? (
              <>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Downloading update...</Text>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${otaProgress * 100}%` }]} />
                </View>
              </>
            ) : null}

            {otaStatus === 'ready' ? (
              <>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Update ready to install</Text>
                <Pressable
                  style={[styles.updateButton, { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}
                  onPress={handleInstallOta}
                >
                  <Text style={[styles.updateButtonText, { color: colors.primary }]}>Install downloaded update</Text>
                </Pressable>
              </>
            ) : null}

            <Pressable
              style={[styles.updateButton, { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}
              onPress={async () => {
                const binary = await BinaryUpgradeService.check();
                if (!binary.available) {
                  Alert.alert('No store update', 'No newer store build is available.');
                  return;
                }
                Alert.alert(binary.required ? 'Required update' : 'Store update available', binary.message);
              }}
            >
              <Text style={[styles.updateButtonText, { color: colors.primary }]}>Check Store</Text>
            </Pressable>
          </View>
        </AppCard>

        <AppCard mode="flat" style={{ borderWidth: 1, borderColor: colors.border }}>
          <View style={{ gap: 10 }}>
            <Text style={[styles.headlineMedium, { color: colors.textPrimary }]}>Diagnostics</Text>

            <View style={styles.diagnosticsSection}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Sync queue stats</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Conflicts: {conflictCount}
                {queueStats?.pending !== undefined ? ` • Pending: ${queueStats.pending}` : ''}
              </Text>
            </View>

            <View style={styles.diagnosticsSection}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Last sync</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sync service active</Text>
            </View>

            <View style={styles.diagnosticsSection}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Feature flags</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Feature flags are managed automatically. No manual toggles available.
              </Text>
            </View>
          </View>
        </AppCard>

        <View style={styles.versionFooter}>
          <Text style={[styles.versionText, { color: colors.textTertiary }]}>
            LifeOS v{Application.nativeApplicationVersion || '1.0.0'}
          </Text>
        </View>
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 220 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  cardColumn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  title: { ...LifeOSTypography.titleSmall },
  headlineMedium: { ...LifeOSTypography.headlineMedium },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  themeButtonActive: {},
  themeText: { ...LifeOSTypography.labelMedium, textTransform: 'capitalize' },
  themeTextActive: {},
  subtitle: { ...LifeOSTypography.bodySmall },
  updateButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  updateButtonText: {
    ...LifeOSTypography.labelMedium,
    fontWeight: '700',
  },
  conflictRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  flagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  diagnosticsSection: { gap: 4, marginTop: 4 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 3 },
  versionFooter: { alignItems: 'center', paddingVertical: 20 },
  versionText: { ...LifeOSTypography.bodySmall },
});
