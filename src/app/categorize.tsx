import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuthSession } from '@/core/auth/session-context';
import { FinanceRepository, type UncategorizedTransaction } from '@/core/repositories/finance-repository';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

const categoryOptions = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Other'] as const;

export default function CategorizeScreen() {
  const router = useRouter();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const [items, setItems] = useState<UncategorizedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      try {
        if (!state.userId) return;
        const next = await FinanceRepository.listUncategorized(state.userId);
        if (mounted) setItems(next);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [state.userId]);

  async function categorize(id: string, category: string) {
    if (!state.userId || busyId) return;

    // Optimistic update — remove from list immediately
    const previous = items;
    setItems((list) => list.filter((item) => item.id !== id));
    setBusyId(id);

    try {
      await FinanceRepository.updateCategory(state.userId, id, category);
      await SyncCoordinator.enqueueDefault(state.userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(state.userId);
    } catch {
      // Rollback optimistic update on failure
      setItems(previous);
      Alert.alert('Error', 'Failed to update category. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageScaffold title="Categorize" subtitle="Resolve uncategorized transactions" eyebrow="Categorize" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {items.map((item) => (
              <View key={item.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{item.merchant}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  KES {item.amount.toFixed(2)} · {new Date(item.date).toLocaleDateString()}
                </Text>
                <View style={styles.pills}>
                  {categoryOptions.map((option) => (
                    <Pressable
                      key={option}
                      style={[
                        styles.pill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        busyId === item.id && styles.pillDisabled,
                      ]}
                      onPress={() => categorize(item.id, option)}
                      disabled={!!busyId}
                    >
                      <Text style={[styles.pillText, { color: colors.primary }]}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            {!items.length ? (
              <Text style={[styles.empty, { color: colors.textTertiary }]}>
                All transactions are categorized. ✓
              </Text>
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
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  title: { ...LifeOSTypography.bodyMedium, fontWeight: '600' },
  meta: { ...LifeOSTypography.bodySmall },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  pillDisabled: { opacity: 0.4 },
  pillText: { ...LifeOSTypography.labelSmall },
  empty: { ...LifeOSTypography.bodySmall, textAlign: 'center', marginTop: 12 },
});
