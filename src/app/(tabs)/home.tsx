import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuthSession } from '@/core/auth/session-context';
import { useDashboardData } from '@/core/hooks/use-dashboard-data';
import { buildRoute } from '@/core/navigation/routes';
import { AppCard } from '@/core/ui/components/AppCard';
import { FadeInView } from '@/core/ui/components/FadeInView';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

function formatKes(value: number) {
  return `KSh ${Math.round(value).toLocaleString('en-KE')}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useLifeOSColors();
  const { state } = useAuthSession();
  const { isLoading, summary, tasks, nextEvent, ritual } = useDashboardData(state.userId);

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const pendingTaskCount = useMemo(
    () => tasks.filter((t) => t.status !== 'COMPLETED').length,
    [tasks],
  );

  const nextEventLabel = nextEvent
    ? nextEvent.all_day
      ? 'All day'
      : new Date(nextEvent.date).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
    : 'No event';

  const weeklyTitle = ritual?.title || 'Weekly reset';
  const weeklySummary = ritual?.summary || 'Month net is down. Open Review and decide where to trim.';

  return (
    <PageScaffold
      variant="COMPACT"
      title="Today"
      subtitle={dateLabel}
      actions={
        <Pressable
          onPress={() => router.push(buildRoute('profile') as never)}
          hitSlop={8}
          accessibilityLabel="Profile"
          style={[styles.profileIconButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        >
          <MaterialIcons name="person-outline" size={22} color={colors.textPrimary} />
        </Pressable>
      }
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FadeInView style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <AppCard mode="elevated" style={styles.greetingCard}>
            <Text style={[styles.greetingEyebrow, { color: colors.primary }]}>Daily focus</Text>
            <Text style={[styles.greetingTitle, { color: colors.textPrimary }]}>{greeting}, Belinze</Text>
            <Text style={[styles.greetingBody, { color: colors.textSecondary }]}>
              Review priorities, schedule, and your spend trend.
            </Text>
          </AppCard>

          <View style={styles.summaryRow}>
            <AppCard mode="elevated" style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Today</Text>
              <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatKes(summary.today)}</Text>
            </AppCard>
            <AppCard mode="elevated" style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Week</Text>
              <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatKes(summary.week)}</Text>
            </AppCard>
          </View>

          <AppCard mode="elevated" style={styles.agendaCard}>
            <Pressable style={styles.agendaRow} onPress={() => router.push(buildRoute('tasks') as never)}>
              <View style={styles.agendaLeft}>
                <MaterialIcons name="check-circle-outline" size={22} color={colors.primary} />
                <Text style={[styles.agendaTitle, { color: colors.textPrimary }]}>Tasks</Text>
              </View>
              <View style={styles.agendaRight}>
                <Text style={[styles.agendaValue, { color: colors.textSecondary }]}>
                  {pendingTaskCount > 0 ? `${pendingTaskCount} pending` : 'All done'}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable style={styles.agendaRow} onPress={() => router.push(buildRoute('calendar') as never)}>
              <View style={styles.agendaLeft}>
                <MaterialIcons name="calendar-month" size={22} color={colors.primary} />
                <Text style={[styles.agendaTitle, { color: colors.textPrimary }]}>Next Event</Text>
              </View>
              <View style={styles.agendaRight}>
                <Text style={[styles.agendaValue, { color: colors.textSecondary }]}>{nextEventLabel}</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable style={styles.agendaRow} onPress={() => router.push(buildRoute('insights') as never)}>
              <View style={styles.agendaLeft}>
                <MaterialIcons name="insights" size={22} color={colors.primary} />
                <Text style={[styles.agendaTitle, { color: colors.textPrimary }]}>Insights</Text>
              </View>
              <View style={styles.agendaRight}>
                <Text style={[styles.agendaValue, { color: colors.textSecondary }]}>Trends</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable style={styles.agendaRow} onPress={() => router.push(buildRoute('search') as never)}>
              <View style={styles.agendaLeft}>
                <MaterialIcons name="search" size={22} color={colors.primary} />
                <Text style={[styles.agendaTitle, { color: colors.textPrimary }]}>Search</Text>
              </View>
              <View style={styles.agendaRight}>
                <Text style={[styles.agendaValue, { color: colors.textSecondary }]}>Explore</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
              </View>
            </Pressable>
          </AppCard>

          <AppCard mode="elevated" style={styles.weeklyCard}>
            <View style={styles.weeklyHeader}>
              <Text style={[styles.weeklyTitle, { color: colors.textPrimary }]}>{weeklyTitle}</Text>
              <Pressable onPress={() => router.push(buildRoute('review') as never)}>
                <Text style={[styles.weeklyAction, { color: colors.primary }]}>Open Weekly Review</Text>
              </Pressable>
            </View>
            <Text style={[styles.weeklyBody, { color: colors.textSecondary }]}>{weeklySummary}</Text>
          </AppCard>
        </ScrollView>
        </FadeInView>
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
  profileIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { gap: 14, paddingBottom: 220 },
  greetingCard: { gap: 4 },
  greetingEyebrow: { ...LifeOSTypography.titleMedium },
  greetingTitle: { ...LifeOSTypography.headlineLarge },
  greetingBody: { ...LifeOSTypography.bodyLarge },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, gap: 2 },
  summaryLabel: { ...LifeOSTypography.titleMedium },
  summaryValue: { ...LifeOSTypography.headlineLarge },
  agendaCard: { paddingTop: 8, paddingBottom: 8 },
  agendaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
  },
  agendaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  agendaRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  agendaTitle: { ...LifeOSTypography.headlineSmall },
  agendaValue: { ...LifeOSTypography.titleMedium },
  divider: { height: StyleSheet.hairlineWidth },
  weeklyCard: { gap: 10 },
  weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  weeklyTitle: { ...LifeOSTypography.headlineMedium, flex: 1 },
  weeklyAction: { ...LifeOSTypography.titleMedium },
  weeklyBody: { ...LifeOSTypography.bodyLarge },
});