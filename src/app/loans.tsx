import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthSession } from '@/core/auth/session-context';
import { buildLoanMetrics } from '@/core/domain/usecases/finance-intelligence';
import { useFinanceSummary } from '@/core/hooks/use-finance-summary';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { ShimmerSkeleton } from '@/core/ui/components/ShimmerSkeleton';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export default function LoansScreen() {
  const router = useRouter();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const { recent, isLoading } = useFinanceSummary(state.userId);

  const loan = buildLoanMetrics(recent);

  return (
    <PageScaffold title="Loans" subtitle="Fuliza and overdraft tracking" eyebrow="Credit" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <>
            <ShimmerSkeleton width="100%" height={90} borderRadius={12} />
            <ShimmerSkeleton width="100%" height={110} borderRadius={12} />
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Recent loan events</Text>
              <View style={{ gap: 8 }}>
                {[...Array(4)].map((_, i) => (
                  <ShimmerSkeleton key={i} width="100%" height={36} borderRadius={8} />
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Outstanding</Text>
              <Text style={[styles.metric, { color: colors.primary }]}>KES {loan.outstanding.toFixed(2)}</Text>
            </View>
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Estimated available limit</Text>
              <Text style={[styles.metric, { color: colors.primary }]}>KES {loan.estimatedAvailable.toFixed(2)}</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>Borrowed {loan.borrowedTotal.toFixed(2)} · Repaid {loan.repaidTotal.toFixed(2)} · Fees {loan.feeTotal.toFixed(2)}</Text>
            </View>
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Recent loan events</Text>
              {loan.events.slice(0, 8).map((item) => (
                <View key={item.id} style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{item.merchant} · {item.kind}</Text>
                  <Text style={[styles.rowValue, { color: colors.textPrimary }]}>KES {item.amount.toFixed(2)}</Text>
                </View>
              ))}
              {!loan.events.length ? <Text style={[styles.empty, { color: colors.textTertiary }]}>No loan activity yet.</Text> : null}
            </View>
          </>
        )}
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
  label: { ...LifeOSTypography.titleSmall },
  metric: { ...LifeOSTypography.headlineMedium },
  meta: { ...LifeOSTypography.bodySmall },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { ...LifeOSTypography.bodySmall },
  rowValue: { ...LifeOSTypography.bodySmall, fontWeight: '600' },
  empty: { ...LifeOSTypography.bodySmall },
});
