import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { seedDatabase, runDatabaseMigrations } from '@/core/data/database/bootstrap';
import { refreshInsightsForUser } from '@/core/domain/usecases/refresh-insights-for-user';
import { AndroidSmsGateway } from '@/core/platform/sms/android-sms-gateway';
import { MpesaIngestionService } from '@/core/platform/sms/mpesa-ingestion-service';
import { SmsHistoricalScanner } from '@/core/platform/sms/sms-historical-scanner';
import { ReminderScheduler } from '@/core/notifications/reminder-scheduler';
import { realtimeSyncListener } from '@/core/sync/realtime-sync-listener';
import { SettingsStore, type AppSettings } from '@/core/preferences/settings-store';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';
import { registerBackgroundWorkers, unregisterBackgroundWorkers } from '@/core/work/background-workers';

type BootstrapState = {
  isReady: boolean;
  settings: AppSettings;
  refreshSettings: () => Promise<void>;
  updateSettings: (next: Partial<AppSettings>) => Promise<void>;
};

const BootstrapContext = createContext<BootstrapState | null>(null);

export function AppBootstrapProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    notificationsEnabled: true,
    biometricEnabled: true,
    themeMode: 'system',
  });

  useEffect(() => {
    let mounted = true;
    let unsubscribeSms: (() => void) | null = null;

    async function ingestSms(user: string, body: string, timestamp?: number) {
      try {
        await MpesaIngestionService.ingestSms(user, body, timestamp);
        await SyncCoordinator.enqueueDefault(user, 'PERIODIC_WORK', ['PUSH_ALL']);
        await SyncCoordinator.runPending(user);
      } catch {
        // Keep app shell resilient even if ingestion fails for one message.
      }
    }

    async function initialize() {
      try {
        await runDatabaseMigrations();
        if (userId) {
          await seedDatabase(userId);
          await SyncCoordinator.enqueueDefault(userId, 'APP_START');
          await SyncCoordinator.runPending(userId);
          await registerBackgroundWorkers();
          realtimeSyncListener.start(userId);

          // ── Historical SMS backfill (first launch / 90 days) ───────────────
          if (AndroidSmsGateway.isAvailable()) {
            const lastScan = await SmsHistoricalScanner.getLastScanTimestamp();
            if (lastScan == null) {
              // First launch: backfill last 90 days in background (non-blocking)
              SmsHistoricalScanner.scan(userId, { backfillDays: 90 }).catch(() => {
                // Non-critical: historical scan is best-effort
              });
            }
          }

          await AndroidSmsGateway.startRealtimeReceiver();

          const queuedMessages = await AndroidSmsGateway.drainQueuedMpesaMessages(100);
          for (const message of queuedMessages) {
            if (!message.body) continue;
            await ingestSms(userId, message.body, message.timestamp);
          }

          unsubscribeSms = AndroidSmsGateway.subscribeRealtime(async (message) => {
            if (!mounted || !userId || !message.body) return;
            await ingestSms(userId, message.body, message.timestamp);
          });

          try {
            await refreshInsightsForUser(userId);
          } catch {
            // Non-critical: insights can be stale on first launch
          }

          const settings = await SettingsStore.read();
          if (settings.notificationsEnabled) {
            try {
              await ReminderScheduler.rescheduleAllReminders(userId);
            } catch {
              // Non-critical: reminders are best-effort on startup
            }
          }
        } else {
          await unregisterBackgroundWorkers();
          await AndroidSmsGateway.stopRealtimeReceiver();
          realtimeSyncListener.stop();
        }
      } finally {
        const initialSettings = await SettingsStore.read();
        if (mounted) {
          setSettings(initialSettings);
          setIsReady(true);
        }
      }
    }
    initialize();
    return () => {
      mounted = false;
      unsubscribeSms?.();
      void AndroidSmsGateway.stopRealtimeReceiver();
      realtimeSyncListener.stop();
    };
  }, [userId]);

  const value = useMemo<BootstrapState>(() => ({
    isReady,
    settings,
    refreshSettings: async () => {
      setSettings(await SettingsStore.read());
    },
    updateSettings: async (next) => {
      const merged = await SettingsStore.write(next);
      setSettings(merged);
    },
  }), [isReady, settings]);

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useAppBootstrap() {
  const context = useContext(BootstrapContext);
  if (!context) throw new Error('useAppBootstrap must be used inside AppBootstrapProvider');
  return context;
}
