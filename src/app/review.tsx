import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { useAuthSession } from '@/core/auth/session-context';
import { buildWeeklyReviewSnapshot } from '@/core/domain/usecases/finance-intelligence';
import { useFinanceSummary } from '@/core/hooks/use-finance-summary';
import { useInsights } from '@/core/hooks/use-insights';
import { useTasks } from '@/core/hooks/use-tasks';
import { AppCard } from '@/core/ui/components/AppCard';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export default function ReviewScreen() {
  const { state } = useAuthSession();
  const router = useRouter();
  const colors = useLifeOSColors();
  const { summary, recent, isLoading: financeLoading } = useFinanceSummary(state.userId);
  const { tasks, isLoading: tasksLoading } = useTasks(state.userId);
  const { categories } = useInsights(state.userId);
  const insights = categories.map((c) => ({ title: `${c.category}: KES ${c.total.toFixed(2)}` }));

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!financeLoading && !tasksLoading) {
      setIsLoading(false);
    }
  }, [financeLoading, tasksLoading]);

  const review = buildWeeklyReviewSnapshot({
    tasks,
    spending: summary,
    recentTransactions: recent,
    insights,
  });

  const signalText =
    review.weekOnWeekSignal === 'ON_TRACK'
      ? 'Week spend is within healthy monthly pacing.'
      : review.weekOnWeekSignal === 'WATCH'
        ? 'Week spend is elevated. Monitor discretionary categories.'
        : 'Week spend is high versus monthly pace. Activate guardrails.';

  const signalColor =
    review.weekOnWeekSignal === 'ON_TRACK'
      ? colors.success
      : review.weekOnWeekSignal === 'WATCH'
        ? colors.warning
        : colors.error;

  return (
    <PageScaffold title="Weekly Review" subtitle="Close loops and plan next moves" variant="HERO" onBack={() => router.back()}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppCard mode="glass">
          <Text style={[styles.greeting, { color: colors.textPrimary }]}>{review.greeting}</Text>
          <Text style={[styles.weekLabel, { color: colors.textSecondary }]}>{review.weekLabel}</Text>
          {review.ritual ? (
            <View style={[styles.ritualCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.ritualTitle, { color: colors.textPrimary }]}>{review.ritual.title}</Text>
              <Text style={[styles.ritualMeta, { color: colors.textSecondary }]}>{review.ritual.summary}</Text>
            </View>
          ) : null}
        </AppCard>

        <View style={styles.scoreGrid}>
          <AppCard mode="elevated" style={styles.scoreCard}>
            <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>Spend</Text>
            <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>KES {review.summary.totalSpend.toFixed(0)}</Text>
          </AppCard>
          <AppCard mode="elevated" style={styles.scoreCard}>
            <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>Done</Text>
            <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>{review.summary.tasksCompleted}</Text>
          </AppCard>
          <AppCard mode="elevated" style={styles.scoreCard}>
            <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>Pending</Text>
            <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>{review.summary.tasksPending}</Text>
          </AppCard>
        </View>

        <AppCard mode="elevated">
          <Text style={[styles.metricTitle, { color: colors.textPrimary }]}>Spending posture</Text>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Posture</Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>{review.summary.postureLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Week delta</Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>{review.summary.weekDeltaLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Top category</Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>{review.summary.topCategory ?? '—'}</Text>
          </View>
          <View style={[styles.signalPill, { backgroundColor: `${signalColor}20` }]}>
            <Text style={[styles.signalText, { color: signalColor }]}>{signalText}</Text>
          </View>
        </AppCard>

        <AppCard mode="glass">
          <Text style={[styles.metricTitle, { color: colors.textPrimary }]}>Wins</Text>
          {(review.wins.length ? review.wins : ['No wins captured yet.']).map((win, index) => (
            <Text key={index} style={[styles.bullet, { color: colors.textSecondary }]}>
              {index + 1}. {win}
            </Text>
          ))}
        </AppCard>

        <AppCard mode="elevated">
          <Text style={[styles.metricTitle, { color: colors.textPrimary }]}>Risks</Text>
          {(review.risks.length ? review.risks : ['No critical risks this week.']).map((risk, index) => (
            <Text key={index} style={[styles.bullet, { color: colors.textSecondary }]}>
              {index + 1}. {risk}
            </Text>
          ))}
        </AppCard>

        <AppCard mode="glass">
          <Text style={[styles.metricTitle, { color: colors.textPrimary }]}>Top insights</Text>
          {(review.topInsights.length ? review.topInsights : ['No top insights yet.']).map((insight, index) => (
            <Text key={index} style={[styles.bullet, { color: colors.textSecondary }]}>
              {index + 1}. {insight}
            </Text>
          ))}
        </AppCard>
      </ScrollView>
      )}
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
  greeting: { ...LifeOSTypography.headlineMedium },
  weekLabel: { ...LifeOSTypography.bodySmall, marginTop: 2 },
  ritualCard: { borderWidth: 1, borderRadius: 14, marginTop: 10, padding: 10, gap: 2 },
  ritualTitle: { ...LifeOSTypography.titleSmall },
  ritualMeta: { ...LifeOSTypography.bodySmall },
  scoreGrid: { flexDirection: 'row', gap: 8 },
  scoreCard: { flex: 1, paddingVertical: 14 },
  scoreLabel: { ...LifeOSTypography.labelSmall, textTransform: 'uppercase', letterSpacing: 0.4 },
  scoreValue: { ...LifeOSTypography.titleLarge, marginTop: 4 },
  metricTitle: { ...LifeOSTypography.titleSmall, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { ...LifeOSTypography.bodyMedium },
  value: { ...LifeOSTypography.bodyMedium, fontWeight: '600' },
  signalPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: 8 },
  signalText: { ...LifeOSTypography.labelSmall },
  bullet: { ...LifeOSTypography.bodySmall, marginVertical: 4 },
});