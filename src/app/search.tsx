import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { useAuthSession } from '@/core/auth/session-context';
import { useSearch } from '@/core/hooks/use-search';
import { buildCalendarRoute, buildRoute, buildTaskRoute } from '@/core/navigation/routes';
import { AppCard } from '@/core/ui/components/AppCard';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

type SearchFilter = 'all' | 'task' | 'event' | 'birthday' | 'anniversary' | 'countdown' | 'finance' | 'recurring';

type QuickLink = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  route: 'tasks' | 'calendar' | 'insights' | 'finance';
};

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT = 5;
const EXPAND_LIMIT = 5;

const FILTERS: { key: SearchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'task', label: 'Tasks' },
  { key: 'event', label: 'Events' },
  // TODO: refine BIRTHDAY filter to query only birthday events instead of all events
  { key: 'birthday', label: 'Birthday' },
  // TODO: refine ANNIVERSARY filter to query only anniversary events instead of all events
  { key: 'anniversary', label: 'Anniversary' },
  // TODO: refine COUNTDOWN filter to query only countdown events instead of all events
  { key: 'countdown', label: 'Countdown' },
  // TODO: refine FINANCE filter to query only finance transactions instead of all transactions
  { key: 'finance', label: 'Finance' },
  // TODO: refine RECURRING filter to query only recurring transactions/rules instead of all transactions
  { key: 'recurring', label: 'Recurring' },
];

const FILTER_MAP: Record<Exclude<SearchFilter, 'all'>, 'task' | 'event' | 'transaction'> = {
  task: 'task',
  event: 'event',
  birthday: 'event',
  anniversary: 'event',
  countdown: 'event',
  finance: 'transaction',
  recurring: 'transaction',
};

const QUICK_LINKS: QuickLink[] = [
  { label: 'Tasks', icon: 'check-circle-outline', route: 'tasks' },
  { label: 'Calendar', icon: 'calendar-today', route: 'calendar' },
  { label: 'Insights', icon: 'insights', route: 'insights' },
  { label: 'Finance', icon: 'account-balance-wallet', route: 'finance' },
];

function buildQuickRoute(route: QuickLink['route']) {
  if (route === 'tasks') return buildRoute('tasks');
  if (route === 'calendar') return buildRoute('calendar');
  return buildRoute(route);
}

function getTypeLabel(type: string) {
  if (type === 'task') return 'Tasks';
  if (type === 'event') return 'Events';
  return 'Transactions';
}

function formatItemDate(item: { eventDate?: number; timestamp?: number }): string {
  const ts = (item as any).timestamp ?? item.eventDate;
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('default', { month: 'short', day: '2-digit' });
}

export default function SearchScreen() {
  const router = useRouter();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const { results, isLoading } = useSearch(state.userId, query);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Load recent searches on mount
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const raw = await SecureStore.getItemAsync(RECENT_SEARCHES_KEY);
        if (!mounted) return;
        if (raw) {
          const parsed = JSON.parse(raw) as string[];
          setRecentSearches(parsed);
        }
      } catch {
        // ignore parse errors
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Save query to recent searches after user stops typing for 1s
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      const trimmed = query.trim();
      setRecentSearches((prev) => {
        const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, MAX_RECENT);
        SecureStore.setItemAsync(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [query]);

  function openResult(item: (typeof results)[number]) {
    if (item.type === 'task') {
      router.push(buildTaskRoute(item.id) as never);
      return;
    }

    if (item.type === 'event') {
      const eventDate = item.eventDate ? new Date(item.eventDate).toISOString().slice(0, 10) : undefined;
      router.push(
        buildCalendarRoute({
          eventId: item.id,
          eventDate,
        }) as never,
      );
      return;
    }

    router.push(`/finance?txId=${encodeURIComponent(item.id)}` as never);
  }

  async function clearRecentSearches() {
    setRecentSearches([]);
    await SecureStore.deleteItemAsync(RECENT_SEARCHES_KEY);
  }

  function runRecentSearch(term: string) {
    setQuery(term);
  }

  function toggleGroup(type: string) {
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  const filteredResults = useMemo(
    () =>
      results.filter((item) => {
        if (filter === 'all') return true;
        return item.type === FILTER_MAP[filter];
      }),
    [filter, results],
  );

  const grouped = useMemo(
    () => ({
      task: filteredResults.filter((item) => item.type === 'task'),
      event: filteredResults.filter((item) => item.type === 'event'),
      transaction: filteredResults.filter((item) => item.type === 'transaction'),
    }),
    [filteredResults],
  );

  const hasQuery = query.trim().length > 0;

  return (
    <PageScaffold
      title="Search"
      subtitle="Cross-module lookup"
      eyebrow="Global Lookup"
      variant="HERO"
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppCard mode="glass">
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Find anything instantly</Text>
          <Text style={[styles.heroMeta, { color: colors.textSecondary }]}>Tasks, events, and transactions in one place.</Text>
          {hasQuery ? (
            <Text style={[styles.heroCount, { color: colors.primary }]}>
              {filteredResults.length} result{filteredResults.length === 1 ? '' : 's'}
            </Text>
          ) : null}
        </AppCard>

        <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          <MaterialIcons name="search" size={20} color={colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks, events, transactions"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.textPrimary }]}
          />
        </View>

        {!hasQuery ? (
          <Text style={[styles.scopeHint, { color: colors.textTertiary }]}>
            Searches tasks, events, transactions, budgets, incomes, and recurring rules.
          </Text>
        ) : (
          <Pressable onPress={() => setQuery('')} style={styles.clearQueryBtn} hitSlop={8}>
            <Text style={[styles.clearQueryText, { color: colors.primary }]}>Clear</Text>
          </Pressable>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((item) => {
            const selected = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[
                  styles.filterChip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? `${colors.primary}20` : colors.surface,
                  },
                ]}
              >
                <Text style={[styles.filterText, { color: selected ? colors.primary : colors.textSecondary }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!hasQuery && recentSearches.length > 0 ? (
          <AppCard mode="elevated">
            <View style={styles.recentHeader}>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Recent</Text>
              <Pressable onPress={clearRecentSearches} hitSlop={8}>
                <Text style={[styles.clearRecentText, { color: colors.primary }]}>Clear</Text>
              </Pressable>
            </View>
            <View style={styles.recentList}>
              {recentSearches.map((term) => (
                <Pressable key={term} onPress={() => runRecentSearch(term)} style={styles.recentItem} hitSlop={4}>
                  <MaterialIcons name="history" size={18} color={colors.textSecondary} />
                  <Text style={[styles.recentItemText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {term}
                  </Text>
                </Pressable>
              ))}
            </View>
          </AppCard>
        ) : null}

        {!hasQuery ? (
          <AppCard mode="elevated">
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Quick jump</Text>
            <View style={styles.quickRow}>
              {QUICK_LINKS.map((link) => (
                <Pressable
                  key={link.label}
                  onPress={() => router.push(buildQuickRoute(link.route) as never)}
                  style={[styles.quickChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <MaterialIcons name={link.icon} size={18} color={colors.primary} />
                  <Text style={[styles.quickText, { color: colors.textSecondary }]}>{link.label}</Text>
                </Pressable>
              ))}
            </View>
          </AppCard>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {hasQuery && !isLoading && filteredResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No results</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Try a different search term or filter.
            </Text>
          </View>
        ) : null}

        {hasQuery && !isLoading
          ? (['task', 'event', 'transaction'] as const).map((type) => {
              const items = grouped[type];
              if (items.length === 0) return null;
              const isExpanded = expandedGroups[type];
              const visibleItems = isExpanded ? items : items.slice(0, EXPAND_LIMIT);
              const hiddenCount = items.length - EXPAND_LIMIT;
              return (
                <View key={type} style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                    {getTypeLabel(type)}
                  </Text>
                  {visibleItems.map((item) => {
                    const dateStr = formatItemDate(item);
                    const typeLabel = getTypeLabel(item.type).replace(/s$/, '');
                    const metaLine = dateStr ? `${typeLabel} • ${dateStr}` : typeLabel;
                    return (
                      <Pressable
                        key={`${item.type}:${item.id}`}
                        onPress={() => openResult(item)}
                        accessibilityRole="button"
                        style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                      >
                        <View style={[styles.leadingIcon, { backgroundColor: `${colors.primary}14` }]}>
                          <MaterialIcons
                            name={
                              item.type === 'task'
                                ? 'check-circle-outline'
                                : item.type === 'event'
                                  ? 'event'
                                  : 'account-balance-wallet'
                            }
                            size={18}
                            color={colors.primary}
                          />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.subtitle}
                          </Text>
                          <Text style={[styles.metaLine, { color: colors.textTertiary }]} numberOfLines={1}>
                            {metaLine}
                          </Text>
                        </View>
                        <Pressable onPress={() => openResult(item)} hitSlop={8}>
                          <Text style={[styles.openText, { color: colors.primary }]}>Open</Text>
                        </Pressable>
                      </Pressable>
                    );
                  })}
                  {hiddenCount > 0 && !isExpanded ? (
                    <Pressable onPress={() => toggleGroup(type)} style={styles.showMoreBtn} hitSlop={8}>
                      <Text style={[styles.showMoreText, { color: colors.primary }]}>
                        Show {hiddenCount} more
                      </Text>
                    </Pressable>
                  ) : null}
                  {isExpanded && items.length > EXPAND_LIMIT ? (
                    <Pressable onPress={() => toggleGroup(type)} style={styles.showMoreBtn} hitSlop={8}>
                      <Text style={[styles.showMoreText, { color: colors.primary }]}>Show less</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          : null}
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 220 },
  headerAction: { padding: 6 },
  heroTitle: { ...LifeOSTypography.titleLarge },
  heroMeta: { ...LifeOSTypography.bodySmall, marginTop: 2 },
  heroCount: { ...LifeOSTypography.labelMedium, marginTop: 10 },
  searchBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    ...LifeOSTypography.bodyMedium,
    paddingVertical: 12,
  },
  scopeHint: {
    ...LifeOSTypography.bodySmall,
    marginTop: -4,
    marginHorizontal: 4,
  },
  clearQueryBtn: {
    alignSelf: 'flex-start',
    marginHorizontal: 4,
    marginTop: -4,
  },
  clearQueryText: {
    ...LifeOSTypography.labelSmall,
  },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterText: { ...LifeOSTypography.labelSmall },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearRecentText: {
    ...LifeOSTypography.labelSmall,
  },
  recentList: {
    marginTop: 8,
    gap: 10,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentItemText: {
    ...LifeOSTypography.bodySmall,
    flex: 1,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  quickChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickText: { ...LifeOSTypography.labelSmall },
  loadingWrap: { alignItems: 'center', paddingVertical: 10 },
  section: { gap: 8 },
  sectionLabel: { ...LifeOSTypography.labelSmall, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadingIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  title: { ...LifeOSTypography.bodyMedium, fontWeight: '600' },
  meta: { ...LifeOSTypography.bodySmall },
  metaLine: { ...LifeOSTypography.bodySmall },
  openText: {
    ...LifeOSTypography.labelSmall,
  },
  showMoreBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  showMoreText: {
    ...LifeOSTypography.labelSmall,
  },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { ...LifeOSTypography.headlineSmall },
  emptySubtitle: { ...LifeOSTypography.bodySmall, textAlign: 'center' },
});
