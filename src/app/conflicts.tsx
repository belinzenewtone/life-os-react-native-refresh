import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthSession } from '@/core/auth/session-context';
import { ConflictRepository, type ConflictItem } from '@/core/repositories/conflict-repository';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export default function ConflictsScreen() {
  const router = useRouter();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const [items, setItems] = useState<ConflictItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isResolvingAll, setIsResolvingAll] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      try {
        if (!state.userId) return;
        const next = await ConflictRepository.listConflicts(state.userId);
        if (mounted) setItems(next);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [state.userId]);

  async function resolve(item: ConflictItem, strategy: 'LOCAL' | 'REMOTE') {
    if (!state.userId || busyId) return;
    setBusyId(item.id);
    try {
      await ConflictRepository.resolveConflict(state.userId, item.table, item.id, strategy);
      setItems((prev) => prev.filter((i) => !(i.table === item.table && i.id === item.id)));
    } catch {
      Alert.alert('Error', 'Failed to resolve conflict. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function resolveAll() {
    if (!state.userId || isResolvingAll) return;
    setIsResolvingAll(true);
    try {
      await ConflictRepository.resolveAllConflicts(state.userId, 'REMOTE');
      setItems([]);
    } catch {
      Alert.alert('Error', 'Failed to resolve all conflicts. Please try again.');
    } finally {
      setIsResolvingAll(false);
    }
  }

  const grouped = items.reduce<Record<string, ConflictItem[]>>((acc, item) => {
    if (!acc[item.table]) acc[item.table] = [];
    acc[item.table].push(item);
    return acc;
  }, {});

  return (
    <PageScaffold title="Sync conflicts" subtitle="Resolve pending local vs remote changes" eyebrow="Sync" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {items.length > 0 ? (
              <Pressable
                style={[
                  styles.resolveAllButton,
                  { backgroundColor: colors.primary },
                  isResolvingAll && styles.buttonDisabled,
                ]}
                onPress={resolveAll}
                disabled={isResolvingAll}
              >
                <Text style={styles.resolveAllText}>Resolve all (keep remote)</Text>
              </Pressable>
            ) : null}

            {Object.entries(grouped).map(([table, tableItems]) => (
              <View
                key={table}
                style={[
                  styles.card,
                  { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                ]}
              >
                <Text style={[styles.tableTitle, { color: colors.textPrimary }]}>{table}</Text>
                {tableItems.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Text style={[styles.preview, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.preview || item.id}
                      </Text>
                      <Text style={[styles.meta, { color: colors.textSecondary }]}>
                        {new Date(item.updated_at).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.actions}>
                      <Pressable
                        style={[
                          styles.actionButton,
                          { borderColor: colors.border },
                          busyId === item.id && styles.buttonDisabled,
                        ]}
                        onPress={() => resolve(item, 'LOCAL')}
                        disabled={!!busyId}
                      >
                        <Text style={[styles.actionText, { color: colors.primary }]}>Keep local</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.actionButton,
                          { borderColor: colors.border },
                          busyId === item.id && styles.buttonDisabled,
                        ]}
                        onPress={() => resolve(item, 'REMOTE')}
                        disabled={!!busyId}
                      >
                        <Text style={[styles.actionText, { color: colors.primary }]}>Keep remote</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {!items.length ? (
              <Text style={[styles.empty, { color: colors.textTertiary }]}>No unresolved conflicts.</Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 220 },
  loader: { marginTop: 48 },
  resolveAllButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 6,
  },
  resolveAllText: { ...LifeOSTypography.labelLarge, color: '#fff' },
  buttonDisabled: { opacity: 0.4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  tableTitle: { ...LifeOSTypography.titleSmall, textTransform: 'capitalize' },
  row: { gap: 8 },
  rowInfo: { gap: 2 },
  preview: { ...LifeOSTypography.bodyMedium, fontWeight: '600' },
  meta: { ...LifeOSTypography.bodySmall },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionText: { ...LifeOSTypography.labelSmall },
  empty: { ...LifeOSTypography.bodySmall, textAlign: 'center', marginTop: 12 },
});
