import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthSession } from '@/core/auth/session-context';
import { FinanceRepository } from '@/core/repositories/finance-repository';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { ShimmerSkeleton } from '@/core/ui/components/ShimmerSkeleton';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export default function FeeAnalyticsScreen() {
  const { state } = useAuthSession();
  const router = useRouter();
  const colors = useLifeOSColors();
  const [isLoading, setIsLoading] = useState(true);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; total: number }[]>([]);
  const [recentFeeTransactions, setRecentFeeTransactions] = useState<Awaited<ReturnType<typeof FinanceRepository.getFeeTransactions>>>([]);
  const [totalFeesThisMonth, setTotalFeesThisMonth] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!state.userId) return;
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

      const [breakdown, transactions] = await Promise.all([
        FinanceRepository.getFeeCategoryBreakdown(state.userId, start, end),
        FinanceRepository.getFeeTransactions(state.userId, start, end),
      ]);

      if (cancelled) return;

      const total = breakdown.reduce((sum, item) => sum + (item.total ?? 0), 0);
      setCategoryBreakdown(breakdown);
      setRecentFeeTransactions(transactions);
      setTotalFeesThisMonth(total);
      setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [state.userId]);

  const maxCategoryTotal = categoryBreakdown.length > 0 ? Math.max(...categoryBreakdown.map((c) => c.total)) : 0;

  return (
    <PageScaffold title="Fee Analytics" subtitle="Service charge and messaging cost signal" eyebrow="Fees" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <>
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            <ShimmerSkeleton width="100%" height={90} borderRadius={12} />
            <ShimmerSkeleton width="100%" height={200} borderRadius={12} />
            <ShimmerSkeleton width="100%" height={200} borderRadius={12} />
          </>
        ) : (
          <>
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>This Month&apos;s Charges</Text>
              <Text style={[styles.metric, { color: colors.warning }]}>KES {totalFeesThisMonth.toFixed(2)}</Text>
            </View>

            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Category Breakdown</Text>
              {categoryBreakdown.map((item) => {
                const pct = maxCategoryTotal > 0 ? (item.total / maxCategoryTotal) * 100 : 0;
                return (
                  <View key={item.category} style={styles.breakdownRow}>
                    <View style={styles.breakdownHeader}>
                      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{item.category}</Text>
                      <Text style={[styles.rowValue, { color: colors.textSecondary }]}>KES {(item.total ?? 0).toFixed(2)}</Text>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: colors.surfaceVariant }]}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: colors.warning }]} />
                    </View>
                  </View>
                );
              })}
              {!categoryBreakdown.length ? (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>No fee transactions this month.</Text>
              ) : null}
            </View>

            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Recent Fee Transactions</Text>
              {recentFeeTransactions.map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{tx.merchant}</Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {tx.category} · {new Date(tx.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[styles.rowValue, { color: colors.warning }]}>KES {(tx.amount ?? 0).toFixed(2)}</Text>
                </View>
              ))}
              {!recentFeeTransactions.length ? (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>No recent fee transactions.</Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 220 },
  loader: { marginTop: 40 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  title: { ...LifeOSTypography.titleSmall },
  metric: { ...LifeOSTypography.headlineMedium },
  meta: { ...LifeOSTypography.bodySmall },
  breakdownRow: { gap: 4, marginVertical: 4 },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  rowLabel: { ...LifeOSTypography.bodySmall },
  rowValue: { ...LifeOSTypography.bodySmall, fontWeight: '600' },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  txLeft: { flex: 1, gap: 2 },
});
