import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuthSession } from '@/core/auth/session-context';
import {
  encryptWithPassphrase,
  decryptWithPassphrase,
  tryDecryptLegacyExport,
} from '@/core/security/export-crypto';
import { ExportHistoryRepository, type ExportHistoryRecord } from '@/core/repositories/export-history-repository';
import { ExportRepository, type ExportPayload } from '@/core/repositories/export-repository';
import { AppCard } from '@/core/ui/components/AppCard';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

type ExportFormat = 'JSON' | 'CSV';
type ExportDomain = 'ALL' | 'TASKS' | 'EVENTS' | 'TRANSACTIONS';
type DatePreset = 'ALL_TIME' | 'LAST_30_DAYS' | 'LAST_7_DAYS';

function escapeCsv(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.map(escapeCsv).join(',');
  const lines = rows.map((row) => keys.map((k) => escapeCsv(row[k])).join(','));
  return [header, ...lines].join('\n');
}

function convertToCsv(payload: ExportPayload): string {
  const sections: string[] = [];
  sections.push('# LifeOS Export');
  sections.push(`# Generated: ${payload.generated_at}`);
  sections.push(`# User: ${payload.user_id}`);
  sections.push('');

  if (payload.tasks.length) {
    sections.push('# Tasks');
    sections.push(rowsToCsv(payload.tasks as Record<string, unknown>[]));
    sections.push('');
  }

  if (payload.events.length) {
    sections.push('# Events');
    sections.push(rowsToCsv(payload.events as Record<string, unknown>[]));
    sections.push('');
  }

  if (payload.transactions.length) {
    sections.push('# Transactions');
    sections.push(rowsToCsv(payload.transactions as Record<string, unknown>[]));
    sections.push('');
  }

  return sections.join('\n');
}

async function tryDecryptExport(content: string, passphrase: string): Promise<ExportPayload | null> {
  const aesPlaintext = await decryptWithPassphrase(content, passphrase);
  if (aesPlaintext) {
    try { return JSON.parse(aesPlaintext) as ExportPayload; } catch { return null; }
  }
  const legacyPlaintext = tryDecryptLegacyExport(content, passphrase);
  if (legacyPlaintext) {
    try { return JSON.parse(legacyPlaintext) as ExportPayload; } catch { return null; }
  }
  return null;
}

export default function ExportScreen() {
  const { state } = useAuthSession();
  const router = useRouter();
  const colors = useLifeOSColors();
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('JSON');
  const [domain, setDomain] = useState<ExportDomain>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL_TIME');
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [previewCounts, setPreviewCounts] = useState({ tasks: 0, events: 0, transactions: 0 });
  const [latestResult, setLatestResult] = useState<ExportHistoryRecord | null>(null);
  const [history, setHistory] = useState<ExportHistoryRecord[]>([]);

  const loadHistory = useCallback(async () => {
    if (!state.userId) return;
    const records = await ExportHistoryRepository.list(state.userId);
    setHistory(records.slice(0, 8));
    setLatestResult(records[0] ?? null);
  }, [state.userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadPreview = useCallback(async () => {
    if (!state.userId) return;
    const counts = await ExportRepository.getCounts(state.userId, domain, datePreset);
    setPreviewCounts(counts);
  }, [state.userId, domain, datePreset]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  async function exportData() {
    if (!state.userId || isExporting) return;
    setIsExporting(true);
    try {
      const payload = await ExportRepository.buildPayload(state.userId, domain, datePreset);

      let content: string;
      if (format === 'CSV') {
        content = convertToCsv(payload);
      } else {
        content = JSON.stringify(payload, null, 2);
      }

      if (encryptionEnabled) {
        content = await encryptWithPassphrase(content, passphrase || 'default');
      }

      const extension = format === 'CSV' ? 'csv' : 'lifeos';
      const filename = `${FileSystem.documentDirectory}lifeos-export-${Date.now()}.${extension}`;
      await FileSystem.writeAsStringAsync(filename, content);

      const recordCount = payload.record_counts.tasks + payload.record_counts.events + payload.record_counts.transactions;
      await ExportHistoryRepository.record(state.userId, filename, recordCount);
      await loadHistory();

      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        const csvMime = format === 'CSV' ? 'text/csv' : 'application/json';
        await Sharing.shareAsync(filename, { mimeType: csvMime });
      } else {
        Alert.alert('Export saved', `File saved to:\n${filename}`);
      }
    } catch {
      Alert.alert('Export failed', 'An error occurred while generating the export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  async function shareLatest() {
    if (!latestResult) return;
    const sharingAvailable = await Sharing.isAvailableAsync();
    if (sharingAvailable) {
      const isCsv = latestResult.filename.endsWith('.csv');
      await Sharing.shareAsync(latestResult.filename, { mimeType: isCsv ? 'text/csv' : 'application/json' });
    } else {
      Alert.alert('Share unavailable', 'Sharing is not available on this device.');
    }
  }

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importFileUrl, setImportFileUrl] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');

  async function importData() {
    if (!state.userId) return;
    setImportModalVisible(true);
  }

  async function doImportFromUrl() {
    if (!state.userId || !importFileUrl.trim()) {
      Alert.alert('Missing input', 'Please paste the file path or URL.');
      return;
    }
    const rawInput = importFileUrl.trim();
    try {
      let content: string;
      if (rawInput.startsWith('http') || rawInput.startsWith('file')) {
        content = await FileSystem.readAsStringAsync(rawInput);
      } else {
        Alert.alert('Invalid input', 'Please paste a valid file path or URL starting with http://, https://, or file://');
        return;
      }
      let payload: ExportPayload | null = null;

      try {
        payload = JSON.parse(content) as ExportPayload;
      } catch {
        payload = await tryDecryptExport(content, importPassphrase.trim());
        if (!payload) {
          Alert.alert('Import failed', 'Could not read the file. Check the path and passphrase and try again.');
          return;
        }
      }

      const imported = await ExportRepository.importPayload(state.userId, payload!);

      setImportModalVisible(false);
      setImportFileUrl('');
      setImportPassphrase('');
      Alert.alert('Import complete', `Imported ${imported} records.`);
    } catch {
      Alert.alert('Import failed', 'Could not read the file. Check the path and try again.');
    }
  }

  const totalPreview = previewCounts.tasks + previewCounts.events + previewCounts.transactions;

  return (
    <PageScaffold title="Export" subtitle="Secure data snapshot" eyebrow="Data" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Configuration Card */}
        <AppCard>
          <View style={styles.cardHeader}>
            <MaterialIcons name="description" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Format</Text>
          </View>
          <View style={styles.chipRow}>
            {(['JSON', 'CSV'] as const).map((f) => (
              <Pressable
                key={f}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  format === f && [styles.chipActive, { backgroundColor: colors.primary + '22', borderColor: colors.primary }],
                ]}
                onPress={() => setFormat(f)}
              >
                <Text
                  style={[styles.chipText, { color: colors.textSecondary }, format === f && { color: colors.primary }]}
                >
                  {f}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.cardHeader, { marginTop: 12 }]}>
            <MaterialIcons name="folder" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Domain</Text>
          </View>
          <View style={styles.chipRow}>
            {(['ALL', 'TASKS', 'EVENTS', 'TRANSACTIONS'] as const).map((d) => (
              <Pressable
                key={d}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  domain === d && [styles.chipActive, { backgroundColor: colors.primary + '22', borderColor: colors.primary }],
                ]}
                onPress={() => setDomain(d)}
              >
                <Text
                  style={[styles.chipText, { color: colors.textSecondary }, domain === d && { color: colors.primary }]}
                >
                  {d === 'ALL' ? 'All' : d.charAt(0) + d.slice(1).toLowerCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.cardHeader, { marginTop: 12 }]}>
            <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Date range</Text>
          </View>
          <View style={styles.chipRow}>
            {(['ALL_TIME', 'LAST_30_DAYS', 'LAST_7_DAYS'] as const).map((p) => (
              <Pressable
                key={p}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  datePreset === p && [
                    styles.chipActive,
                    { backgroundColor: colors.primary + '22', borderColor: colors.primary },
                  ],
                ]}
                onPress={() => setDatePreset(p)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.textSecondary },
                    datePreset === p && { color: colors.primary },
                  ]}
                >
                  {p === 'ALL_TIME' ? 'All time' : p === 'LAST_30_DAYS' ? 'Last 30 days' : 'Last 7 days'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.encryptionRow, { marginTop: 12 }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="lock" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Encryption</Text>
            </View>
            <Switch
              value={encryptionEnabled}
              onValueChange={setEncryptionEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          {encryptionEnabled ? (
            <TextInput
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="Enter passphrase"
              secureTextEntry
              style={[
                styles.passphraseInput,
                { borderColor: colors.border, backgroundColor: colors.surfaceElevated, color: colors.textPrimary },
              ]}
              placeholderTextColor={colors.textTertiary}
            />
          ) : null}
        </AppCard>

        {/* Preview Card */}
        <AppCard>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Estimated records</Text>
          <View style={styles.previewRow}>
            <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Tasks</Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>{previewCounts.tasks}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Events</Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>{previewCounts.events}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Transactions</Text>
            <Text style={[styles.previewValue, { color: colors.textPrimary }]}>{previewCounts.transactions}</Text>
          </View>
          <View style={[styles.previewRow, styles.previewTotal]}>
            <Text style={[styles.previewLabel, { color: colors.textPrimary }]}>Total</Text>
            <Text style={[styles.previewValue, { color: colors.primary }]}>{totalPreview}</Text>
          </View>
        </AppCard>

        {/* Export Button */}
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }, isExporting && styles.buttonDisabled]}
          onPress={exportData}
          disabled={isExporting}
        >
          {isExporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Export now</Text>}
        </Pressable>

        {/* Import Button */}
        <Pressable
          style={[styles.button, styles.buttonSecondary, { borderColor: colors.primary }]}
          onPress={importData}
        >
          <Text style={[styles.buttonText, { color: colors.primary }]}>Import from file</Text>
        </Pressable>

        {/* Result Card */}
        {latestResult ? (
          <AppCard>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Latest export</Text>
            <Text style={[styles.resultMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {latestResult.filename.split('/').pop()}
            </Text>
            <Text style={[styles.resultMeta, { color: colors.textTertiary }]}>
              {latestResult.record_count} records · {new Date(latestResult.created_at).toLocaleString()}
            </Text>
            <Pressable style={[styles.shareButton, { borderColor: colors.primary }]} onPress={shareLatest}>
              <Text style={[styles.shareButtonText, { color: colors.primary }]}>Share</Text>
            </Pressable>
          </AppCard>
        ) : null}

        {/* History Card */}
        {history.length > 0 ? (
          <AppCard>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Recent exports</Text>
            <View style={styles.historyList}>
              {history.map((item) => (
                <View key={item.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.historyFilename, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.filename.split('/').pop()}
                  </Text>
                  <Text style={[styles.historyMeta, { color: colors.textTertiary }]}>
                    {item.record_count} records · {new Date(item.created_at).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </AppCard>
        ) : null}

        {/* Import Modal */}
        <Modal visible={importModalVisible} transparent animationType="slide" onRequestClose={() => setImportModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setImportModalVisible(false)} />
            <View style={[styles.modalSheet, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Import from file</Text>
                <Pressable onPress={() => setImportModalVisible(false)} hitSlop={8}>
                  <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.modalContent}>
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
                  Paste a URL to your exported .lifeos or .json file
                </Text>
                <TextInput
                  value={importFileUrl}
                  onChangeText={setImportFileUrl}
                  placeholder="https://... or file:///..."
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
                />
                <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                  Passphrase (if encrypted)
                </Text>
                <TextInput
                  value={importPassphrase}
                  onChangeText={setImportPassphrase}
                  placeholder="Enter passphrase (optional)"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
                />
                <Pressable
                  style={[styles.button, { backgroundColor: colors.primary, marginTop: 16 }]}
                  onPress={doImportFromUrl}
                >
                  <Text style={styles.buttonText}>Import</Text>
                </Pressable>
                <Pressable
                  style={[styles.buttonSecondary, { marginTop: 8 }]}
                  onPress={shareLatest}
                  disabled={!latestResult}
                >
                  <Text style={[styles.buttonTextSecondary, { color: latestResult ? colors.primary : colors.textTertiary }]}>
                    Share latest export instead
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  scrollContent: { gap: 12, paddingBottom: 220 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...LifeOSTypography.titleSmall },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {},
  chipText: { ...LifeOSTypography.labelMedium },
  encryptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  passphraseInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  previewTotal: { marginTop: 12, paddingTop: 8 },
  previewLabel: { ...LifeOSTypography.bodyMedium },
  previewValue: { ...LifeOSTypography.bodyMedium },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...LifeOSTypography.labelLarge, color: '#fff' },
  buttonTextSecondary: { ...LifeOSTypography.labelMedium, textAlign: 'center' },
  resultMeta: { ...LifeOSTypography.bodySmall, marginTop: 4 },
  shareButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  shareButtonText: { ...LifeOSTypography.labelMedium },
  historyList: { marginTop: 8, gap: 8 },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1 },
  historyFilename: { ...LifeOSTypography.bodySmall },
  historyMeta: { ...LifeOSTypography.bodySmall, marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingTop: 8,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { ...LifeOSTypography.headlineSmall },
  modalContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 12 },
  modalLabel: { ...LifeOSTypography.bodySmall },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...LifeOSTypography.bodyMedium,
  },
});
