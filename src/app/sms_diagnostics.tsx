import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuthSession } from '@/core/auth/session-context';
import { useImportAudit } from '@/core/hooks/use-import-audit';
import { AndroidSmsGateway } from '@/core/platform/sms/android-sms-gateway';
import { MpesaIngestionService } from '@/core/platform/sms/mpesa-ingestion-service';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

type SmsPermissionStatus = {
  readSms: boolean;
  receiveSms: boolean;
};

const edgeCaseSamples = [
  'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/26 at 8:42 AM.',
  'QWE123RTY9 Confirmed. Ksh1,250.00 paid to KPLC PREPAID for account 998877 via M-PESA PayBill on 22/04/26.',
  'QZX123VBN8 Confirmed. You have received Ksh2,000.00 from JOHN DOE 0712345678 on 22/04/26 at 9:01 AM.',
  'QMN777UIO2 Confirmed. Fuliza charge Ksh31.00 debited from your M-PESA account on 22/04/26.',
];

async function readSmsPermissionState(): Promise<SmsPermissionStatus> {
  if (Platform.OS !== 'android') return { readSms: false, receiveSms: false };
  const [readSms, receiveSms] = await Promise.all([
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS),
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
  ]);
  return { readSms, receiveSms };
}

export default function SmsDiagnosticsScreen() {
  const router = useRouter();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const { items: auditItems, reload: reloadAudit } = useImportAudit(state.userId);
  const [permissions, setPermissions] = useState<SmsPermissionStatus>({ readSms: false, receiveSms: false });
  const [lastRunMessage, setLastRunMessage] = useState<string>('No diagnostics run yet.');
  const [isBusy, setIsBusy] = useState(false);

  const recentAudit = useMemo(() => auditItems.slice(0, 8), [auditItems]);

  async function refreshPermissions() {
    setPermissions(await readSmsPermissionState());
  }

  async function requestPermissions() {
    if (Platform.OS !== 'android') return;
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    await refreshPermissions();
  }

  useEffect(() => {
    void readSmsPermissionState().then(setPermissions);
  }, []);

  async function ingestMessages(label: string, messages: { body: string; timestamp?: number }[]) {
    if (!state.userId) return;
    setIsBusy(true);
    let inserted = 0;
    let duplicates = 0;
    let lowConfidence = 0;

    try {
      for (const message of messages) {
        const result = await MpesaIngestionService.ingestSms(state.userId, message.body, message.timestamp);
        if (result.inserted) inserted += 1;
        if (result.duplicate) duplicates += 1;
        if (result.parsed?.confidence === 'LOW') lowConfidence += 1;
      }

      await SyncCoordinator.enqueueDefault(state.userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(state.userId);
      await reloadAudit();
      setLastRunMessage(
        `${label}: ${messages.length} processed · ${inserted} inserted · ${duplicates} duplicates · ${lowConfidence} low confidence`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setLastRunMessage(`${label}: Failed — ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <PageScaffold title="SMS Diagnostics" subtitle="Android parity validation tools" eyebrow="Diagnostics" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Permission state</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>READ_SMS: {permissions.readSms ? 'granted' : 'missing'}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>RECEIVE_SMS: {permissions.receiveSms ? 'granted' : 'missing'}</Text>
          <View style={styles.row}>
            <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={refreshPermissions}>
              <Text style={styles.buttonText}>Refresh</Text>
            </Pressable>
            <Pressable style={[styles.buttonSecondary, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={requestPermissions}>
              <Text style={[styles.buttonSecondaryText, { color: colors.textPrimary }]}>Request</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Ingestion runners</Text>
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            disabled={isBusy || !state.userId}
            onPress={async () => {
              const inbox = await AndroidSmsGateway.readMpesaInbox(30);
              await ingestMessages('Inbox import', inbox);
            }}
          >
            <Text style={styles.buttonText}>{isBusy ? 'Running...' : 'Run Inbox Import (30)'}</Text>
          </Pressable>
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            disabled={isBusy || !state.userId}
            onPress={async () => {
              const queued = await AndroidSmsGateway.drainQueuedMpesaMessages(100);
              await ingestMessages('Queued drain', queued);
            }}
          >
            <Text style={styles.buttonText}>{isBusy ? 'Running...' : 'Run Queue Drain (100)'}</Text>
          </Pressable>
          <Pressable
            style={[styles.buttonSecondary, { borderColor: colors.border, backgroundColor: colors.surface }]}
            disabled={isBusy || !state.userId}
            onPress={async () => {
              await ingestMessages(
                'Synthetic edge cases',
                edgeCaseSamples.map((body) => ({ body })),
              );
            }}
          >
            <Text style={[styles.buttonSecondaryText, { color: colors.textPrimary }]}>{isBusy ? 'Running...' : 'Run Synthetic Edge Cases'}</Text>
          </Pressable>
          <Text style={[styles.lastRun, { color: colors.textTertiary }]}>{lastRunMessage}</Text>
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Recent import audit</Text>
          {recentAudit.map((item) => (
            <View key={item.id} style={[styles.auditRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.auditStatus, { color: colors.primary }]}>{item.status}</Text>
              <Text style={[styles.auditMessage, { color: colors.textPrimary }]} numberOfLines={2}>{item.message}</Text>
              <Text style={[styles.auditTime, { color: colors.textTertiary }]}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          ))}
          {!recentAudit.length ? <Text style={[styles.meta, { color: colors.textSecondary }]}>No audit rows yet.</Text> : null}
        </View>
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 220 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  title: { ...LifeOSTypography.titleSmall },
  meta: { ...LifeOSTypography.bodySmall },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  buttonText: { ...LifeOSTypography.labelMedium, color: '#fff' },
  buttonSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  buttonSecondaryText: { ...LifeOSTypography.labelMedium },
  lastRun: { ...LifeOSTypography.bodySmall, marginTop: 4 },
  auditRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 2,
  },
  auditStatus: { ...LifeOSTypography.labelSmall },
  auditMessage: { ...LifeOSTypography.bodySmall },
  auditTime: { ...LifeOSTypography.bodySmall },
});
