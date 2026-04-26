import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuthSession } from '@/core/auth/session-context';
import { FinanceRepository, type MerchantTransaction } from '@/core/repositories/finance-repository';
import { AppCard } from '@/core/ui/components/AppCard';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { ShimmerSkeleton } from '@/core/ui/components/ShimmerSkeleton';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export default function MerchantDetailScreen() {
  const router = useRouter();
  const { merchant } = useLocalSearchParams<{ merchant?: string }>();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const [items, setItems] = useState<MerchantTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!state.userId || !merchant) {
        if (mounted) setIsLoading(false);
        return;
      }
      try {
        const next = await FinanceRepository.listByMerchant(state.userId, String(merchant));
        if (mounted) setItems(next);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load transactions');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [merchant, state.userId]);

  const { totalSpend, transactionCount, avgAmount } = useMemo(() => {
    const spendItems = items.filter(
      (i) => i.transaction_type !== 'RECEIVED' && i.transaction_type !== 'DEPOSIT'
    );
    const total = spendItems.reduce((sum, i) => sum + i.amount, 0);
    const count = items.length;
    return {
      totalSpend: total,
      transactionCount: count,
      avgAmount: count > 0 ? total / count : 0,
    };
  }, [items]);

  return (
    <PageScaffold
      title={String(merchant ?? 'Merchant')}
      subtitle={`${items.length} transaction(s)`}
      eyebrow="Merchant"
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ShimmerSkeleton width="100%" height={80} borderRadius={12} />
            <ShimmerSkeleton width="100%" height={80} borderRadius={12} />
            <ShimmerSkeleton width="100%" height={80} borderRadius={12} />
          </View>
        ) : error ? (
          <View
            style={[
              styles.errorCard,
              { borderColor: colors.error, backgroundColor: colors.surfaceElevated },
            ]}
          >
            <MaterialIcons name="error-outline" size={24} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="receipt-long" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No transactions</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              This merchant hasn&apos;t appeared in your ledger yet.
            </Text>
          </View>
        ) : (
          <>
            <AppCard mode="elevated">
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Total Spend</Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    KSh {Math.round(totalSpend).toLocaleString('en-KE')}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Transactions</Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {transactionCount}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Avg. Amount</Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    KSh {Math.round(avgAmount).toLocaleString('en-KE')}
                  </Text>
                </View>
              </View>
            </AppCard>

            {items.map((item) => {
              const isIncome =
                item.transaction_type === 'RECEIVED' || item.transaction_type === 'DEPOSIT';
              const amountColor = isIncome ? colors.success : colors.textPrimary;
              const amountPrefix = isIncome ? '+' : '';
              const formattedDate = new Date(item.date).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              });

              return (
                <View
                  key={item.id}
                  style={[
                    styles.card,
                    { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <View style={styles.rowTop}>
                    <Text style={[styles.category, { color: colors.textTertiary }]}>
                      {item.category}
                    </Text>
                    <Text style={[styles.amount, { color: amountColor }]}>
                      {amountPrefix}KES {item.amount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={[styles.date, { color: colors.textSecondary }]}>
                      {formattedDate}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 220 },
  loadingContainer: { gap: 10, paddingTop: 10 },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: { ...LifeOSTypography.bodySmall, flex: 1 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: { ...LifeOSTypography.headlineSmall },
  emptySubtitle: { ...LifeOSTypography.bodySmall, textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: { ...LifeOSTypography.labelSmall },
  amount: { ...LifeOSTypography.headlineMedium },
  date: { ...LifeOSTypography.bodySmall },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: { ...LifeOSTypography.labelSmall },
  statValue: { ...LifeOSTypography.headlineMedium },
});
