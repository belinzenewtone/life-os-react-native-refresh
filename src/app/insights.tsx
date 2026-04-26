import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuthSession } from '@/core/auth/session-context';
import { projectMonthSpend } from '@/core/domain/usecases/finance-usecases';
import { useInsightData } from '@/core/hooks/use-insight-data';
import { useInsights } from '@/core/hooks/use-insights';
import { useFinanceSummary } from '@/core/hooks/use-finance-summary';
import { InsightCardRepository } from '@/core/repositories/insight-card-repository';
import { AppCard } from '@/core/ui/components/AppCard';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { ShimmerSkeleton } from '@/core/ui/components/ShimmerSkeleton';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSColors, LifeOSTypography } from '@/core/ui/design/tokens';

function money(value: number) {
  return `KES ${value.toFixed(2)}`;
}

const WEEKLY_CATEGORY_COLORS = [
  LifeOSColors.categories.food,
  LifeOSColors.categories.transport,
  LifeOSColors.categories.shopping,
  LifeOSColors.categories.entertainment,
];

export default function InsightsScreen() {
  const { state } = useAuthSession();
  const router = useRouter();
  const colors = useLifeOSColors();
  const { uncategorizedCount } = useInsights(state.userId);
  const {
    isLoading,
    isRefreshing,
    weeklyChartData,
    weeklyTopCategories,
    monthlySpendData,
    cards,
    error,
    refresh,
  } = useInsightData(state.userId);
  const { summary } = useFinanceSummary(state.userId);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const elapsedDays = Math.max(1, new Date().getDate());
  const projection = projectMonthSpend({
    monthToDateSpend: summary.month,
    elapsedDays,
    daysInMonth,
  });

  const handleDismissCard = async (id: string) => {
    if (!state.userId) return;
    await InsightCardRepository.dismiss(state.userId, id);
    refresh();
  };

  if (isLoading) {
    return (
      <PageScaffold title="Insights" subtitle="Spending acceleration, pressure, and trends" variant="HERO">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </PageScaffold>
    );
  }

  const maxWeeklyAmount = Math.max(
    1,
    ...weeklyChartData.flatMap((w) => weeklyTopCategories.map((cat) => w.categoryAmounts[cat] ?? 0)),
  );

  return (
    <PageScaffold
      title="Insights"
      subtitle="Spending acceleration, pressure, and trends"
      variant="HERO"
      onBack={() => router.back()}
      actions={(
        <Pressable onPress={refresh} disabled={isRefreshing} style={styles.refreshButton}>
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="refresh" size={24} color={colors.primary} />
          )}
        </Pressable>
      )}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppCard mode="glass">
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Insight pulse</Text>
          <View style={styles.heroRow}>
            <View>
              <Text style={[styles.bigMetric, { color: colors.primary }]}>{uncategorizedCount}</Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Uncategorized transactions</Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: `${colors.primary}16` }]}>
              <MaterialIcons name="auto-graph" size={24} color={colors.primary} />
            </View>
          </View>
        </AppCard>

        <AppCard mode="elevated">
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Spending velocity</Text>
          <Text style={[styles.bigMetric, { color: colors.textPrimary }]}>{money(projection.projectedMonthSpend)}</Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Projected month spend from current pace.</Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Average per day: {money(projection.averagePerDay)}</Text>
        </AppCard>

        <AppCard mode="elevated">
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Weekly category pressure</Text>
          {weeklyTopCategories.length ? (
            <View style={styles.legendRow}>
              {weeklyTopCategories.map((cat, idx) => (
                <View key={cat} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: WEEKLY_CATEGORY_COLORS[idx] ?? colors.primary }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>{cat}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {isRefreshing ? (
            <View style={styles.loadingBlock}>
              <ShimmerSkeleton width="100%" height={80} borderRadius={8} />
              <ShimmerSkeleton width="100%" height={80} borderRadius={8} />
            </View>
          ) : (
            weeklyChartData.map((week) => (
              <View key={week.label} style={styles.weekBlock}>
                <Text style={[styles.weekLabel, { color: colors.textSecondary }]}>{week.label}</Text>
                {weeklyTopCategories.map((cat, idx) => {
                  const amount = week.categoryAmounts[cat] ?? 0;
                  const pct = (amount / maxWeeklyAmount) * 100;
                  return (
                    <View key={`${week.label}:${cat}`} style={styles.barRow}>
                      <Text style={[styles.barLabel, { color: colors.textPrimary }]} numberOfLines={1}>{cat}</Text>
                      <View style={[styles.barTrack, { backgroundColor: colors.surfaceVariant }]}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${pct}%`, backgroundColor: WEEKLY_CATEGORY_COLORS[idx] ?? colors.primary },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barValue, { color: colors.textSecondary }]}>{money(amount)}</Text>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </AppCard>

        <AppCard mode="glass">
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Monthly trend</Text>
          {isRefreshing ? (
            <View style={styles.loadingBlock}>
              <ShimmerSkeleton width="100%" height={56} borderRadius={8} />
              <ShimmerSkeleton width="100%" height={56} borderRadius={8} />
            </View>
          ) : (
            monthlySpendData.map((item, idx) => {
              const delta = idx > 0 ? item.totalSpend - item.previousTotal : 0;
              return (
                <View key={item.label} style={[styles.trendRow, { borderBottomColor: colors.border }]}> 
                  <View style={styles.trendLeft}>
                    <Text style={[styles.trendLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                    {idx > 0 ? (
                      <Text style={[styles.deltaText, { color: delta > 0 ? colors.error : colors.success }]}>
                        {delta > 0 ? '+' : ''}
                        {money(delta)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.trendValue, { color: colors.textSecondary }]}>{money(item.totalSpend)}</Text>
                </View>
              );
            })
          )}
        </AppCard>

        {error ? (
          <AppCard mode="glass">
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </AppCard>
        ) : null}

        {cards.map((card) => (
          <AppCard key={card.id} mode="elevated">
            <View style={styles.insightHeader}>
              <View style={styles.insightTitleRow}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{card.title}</Text>
                <View style={[styles.kindBadge, { backgroundColor: colors.primary + '1A' }]}>
                  <Text style={[styles.kindBadgeText, { color: colors.primary }]}>
                    {card.kind === 'DETERMINISTIC' ? 'System' : card.kind === 'AI' ? 'AI' : card.kind}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => handleDismissCard(card.id)} hitSlop={8}>
                <MaterialIcons name="close" size={20} color={colors.textTertiary} />
              </Pressable>
            </View>
            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{card.body}</Text>
          </AppCard>
        ))}
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { gap: 12, paddingBottom: 220 },
  refreshButton: { padding: 8 },
  cardTitle: { ...LifeOSTypography.titleSmall, marginBottom: 8 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigMetric: { ...LifeOSTypography.displayLarge },
  cardMeta: { ...LifeOSTypography.bodySmall, marginTop: 2 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...LifeOSTypography.labelSmall },
  loadingBlock: { gap: 10, marginTop: 8 },
  weekBlock: { marginBottom: 12 },
  weekLabel: { ...LifeOSTypography.labelSmall, marginBottom: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
  barLabel: { ...LifeOSTypography.bodySmall, width: 78 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { ...LifeOSTypography.bodySmall, width: 76, textAlign: 'right' },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trendLeft: { gap: 1 },
  trendLabel: { ...LifeOSTypography.bodyMedium },
  trendValue: { ...LifeOSTypography.bodyMedium, fontWeight: '600' },
  deltaText: { ...LifeOSTypography.bodySmall, fontWeight: '600' },
  errorText: { ...LifeOSTypography.bodySmall },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  insightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  kindBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  kindBadgeText: { ...LifeOSTypography.labelSmall, fontWeight: '700' },
  cardBody: { ...LifeOSTypography.bodyMedium },
});