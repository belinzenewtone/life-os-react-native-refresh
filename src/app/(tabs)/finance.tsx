import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useAuthSession } from '@/core/auth/session-context';
import { useFinanceSummary } from '@/core/hooks/use-finance-summary';
import { useImportAudit } from '@/core/hooks/use-import-audit';
import { useInsights } from '@/core/hooks/use-insights';
import { buildRoute } from '@/core/navigation/routes';
import { AndroidSmsGateway } from '@/core/platform/sms/android-sms-gateway';
import { MpesaIngestionService } from '@/core/platform/sms/mpesa-ingestion-service';
import { FinanceRepository, type CategoryMonthlySpend, type RecentTransaction } from '@/core/repositories/finance-repository';
import { BudgetRepository, type BudgetRecord } from '@/core/repositories/planner-repositories';
import { FulizaRepository } from '@/core/repositories/fuliza-repository';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';
import { AppCard } from '@/core/ui/components/AppCard';
import { EntityFormSheet, type EntityFormValues, type FieldDef } from '@/core/ui/components/EntityFormSheet';
import { FadeInView } from '@/core/ui/components/FadeInView';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { ShimmerSkeleton } from '@/core/ui/components/ShimmerSkeleton';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

type FilterPeriod = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';

const PERIODS: FilterPeriod[] = ['ALL', 'TODAY', 'WEEK', 'MONTH'];

const txFields: FieldDef[] = [
  { name: 'merchant', label: 'Merchant', kind: 'text' },
  { name: 'amount', label: 'Amount', kind: 'number' },
  { name: 'category', label: 'Category', kind: 'text' },
  {
    name: 'transaction_type',
    label: 'Type',
    kind: 'select',
    options: [
      { value: 'PAID', label: 'Paid' },
      { value: 'RECEIVED', label: 'Received' },
      { value: 'DEPOSIT', label: 'Deposit' },
    ],
  },
  { name: 'date', label: 'Date', kind: 'date' },
];

function formatDateInput(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatKes(value: number) {
  return `KSh ${Math.round(value).toLocaleString('en-KE')}`;
}

function formatTxDate(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function periodStart(period: FilterPeriod) {
  const now = new Date();
  if (period === 'ALL') return 0;
  if (period === 'TODAY') {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
  }
  if (period === 'WEEK') {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const week = new Date(now);
    week.setDate(now.getDate() + diff);
    week.setHours(0, 0, 0, 0);
    return week.getTime();
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

export default function FinanceScreen() {
  const router = useRouter();
  const { txId: routeTxIdRaw } = useLocalSearchParams<{ txId?: string | string[] }>();
  const colors = useLifeOSColors();
  const { state } = useAuthSession();
  const { summary, recent, reload: reloadFinance, isLoading } = useFinanceSummary(state.userId);
  const { items: importAudit, reload: reloadAudit } = useImportAudit(state.userId);
  const { uncategorizedCount } = useInsights(state.userId);

  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [categorySpend, setCategorySpend] = useState<CategoryMonthlySpend[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [period, setPeriod] = useState<FilterPeriod>('MONTH');
  const [query, setQuery] = useState('');
  const [isCreatingTx, setIsCreatingTx] = useState(false);
  const [editingTx, setEditingTx] = useState<RecentTransaction | null>(null);
  const [handledRouteTxId, setHandledRouteTxId] = useState<string | null>(null);
  const [fulizaData, setFulizaData] = useState<{ outstanding: number; limit: number; count: number } | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!state.userId) return;
      const monthKey = new Date().toISOString().slice(0, 7);
      const [nextBudgets, nextSpend] = await Promise.all([
        BudgetRepository.list(state.userId),
        FinanceRepository.getMonthlySpendByCategory(state.userId, monthKey),
      ]);
      if (!mounted) return;
      setBudgets(nextBudgets);
      setCategorySpend(nextSpend);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [state.userId]);

  useEffect(() => {
    let mounted = true;
    async function loadFuliza() {
      if (!state.userId) return;
      const status = await FulizaRepository.getStatus(state.userId);
      const outstanding = status.net_outstanding;
      const limit = status.limit_amount;
      const count = outstanding > 0 ? 1 : 0;
      if (!mounted) return;
      setFulizaData({ outstanding, limit, count });
    }
    loadFuliza();
    return () => {
      mounted = false;
    };
  }, [state.userId]);

  const spendByCategory = useMemo(
    () => new Map(categorySpend.map((item) => [item.category.toLowerCase(), item.total])),
    [categorySpend],
  );

  const totalBudget = useMemo(
    () => budgets.reduce((sum, b) => sum + b.limit_amount, 0),
    [budgets],
  );

  const totalSpent = useMemo(
    () => budgets.reduce((sum, b) => sum + (spendByCategory.get(b.category.toLowerCase()) ?? 0), 0),
    [budgets, spendByCategory],
  );

  const budgetRatio = totalBudget > 0 ? Math.min(1, totalSpent / totalBudget) : 0;

  const feeTotal = useMemo(
    () =>
      recent
        .filter((tx) => ['FULIZA_CHARGE', 'WITHDRAWN', 'PAYBILL', 'AIRTIME'].includes(tx.transaction_type))
        .reduce((sum, tx) => sum + tx.amount, 0),
    [recent],
  );

  const pendingCount = importAudit.filter(
    (item) => item.status === 'LOW_CONFIDENCE' || item.status === 'PENDING_REVIEW',
  ).length;
  const importedCount = importAudit.filter((item) => item.status === 'IMPORTED').length;
  const duplicatesCount = importAudit.filter((item) => item.status === 'DUPLICATE').length;
  const issuesCount = importAudit.filter((item) => item.status === 'ERROR').length;

  const latestAuditAge = useMemo(() => {
    if (!importAudit.length) return 'No import activity yet';
    const latest = new Date(importAudit[0].created_at).getTime();
    const diffMin = Math.max(1, Math.round((Date.now() - latest) / 60000));
    return `Updated ${diffMin} min ago`;
  }, [importAudit]);

  const filteredRecent = useMemo(() => {
    const minTs = periodStart(period);
    const needle = query.trim().toLowerCase();

    return recent
      .filter((tx) => tx.date >= minTs)
      .filter((tx) => {
        if (!needle) return true;
        return (
          tx.merchant.toLowerCase().includes(needle) ||
          tx.category.toLowerCase().includes(needle) ||
          tx.amount.toString().includes(needle)
        );
      });
  }, [period, query, recent]);

  const routeTxId = Array.isArray(routeTxIdRaw) ? routeTxIdRaw[0] : routeTxIdRaw;

  useEffect(() => {
    if (!routeTxId || handledRouteTxId === routeTxId) return;
    const target = recent.find((tx) => tx.id === routeTxId);
    if (!target) return;
    setEditingTx(target);
    setHandledRouteTxId(routeTxId);
  }, [handledRouteTxId, recent, routeTxId]);

  async function reloadCards() {
    if (!state.userId) return;
    const monthKey = new Date().toISOString().slice(0, 7);
    const [nextBudgets, nextSpend] = await Promise.all([
      BudgetRepository.list(state.userId),
      FinanceRepository.getMonthlySpendByCategory(state.userId, monthKey),
    ]);
    setBudgets(nextBudgets);
    setCategorySpend(nextSpend);
  }

  async function handleImport(days: number = 30) {
    if (!state.userId || isImporting) return;
    setIsImporting(true);
    try {
      const messages = await AndroidSmsGateway.readMpesaInbox(days);
      if (messages.length) {
        for (const message of messages) {
          await MpesaIngestionService.ingestSms(state.userId, message.body, message.timestamp);
        }
      } else {
        await MpesaIngestionService.ingestSample(state.userId);
      }
      await reloadAudit();
      await reloadFinance();
      await reloadCards();
      await SyncCoordinator.enqueueDefault(state.userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(state.userId);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleCloudRefresh() {
    if (!state.userId || isImporting) return;
    setIsImporting(true);
    try {
      await SyncCoordinator.enqueueDefault(state.userId, 'USER_PULL_TO_REFRESH', ['PULL_ALL']);
      await SyncCoordinator.runPending(state.userId);
      await reloadFinance();
      await reloadAudit();
      await reloadCards();
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDeleteTransaction(id: string) {
    if (!state.userId) return;
    await FinanceRepository.deleteTransaction(state.userId, id);
    await reloadFinance();
    await SyncCoordinator.enqueueDefault(state.userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
    await SyncCoordinator.runPending(state.userId);
  }

  async function handleCreateTx(values: EntityFormValues) {
    if (!state.userId) return;
    const merchant = String(values.merchant ?? '').trim();
    const amount = Number(values.amount ?? 0);
    if (!merchant || !Number.isFinite(amount) || amount <= 0) return;

    const dateInput = String(values.date ?? '').trim();
    const parsedDate = dateInput ? new Date(dateInput).getTime() : Date.now();

    await FinanceRepository.createExpense(state.userId, {
      merchant,
      amount,
      category: String(values.category ?? 'Other').trim() || 'Other',
      transactionType: String(values.transaction_type ?? 'PAID'),
      date: Number.isNaN(parsedDate) ? Date.now() : parsedDate,
      source: 'Manual',
    });

    await reloadFinance();
    await SyncCoordinator.enqueueDefault(state.userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
    await SyncCoordinator.runPending(state.userId);
  }

  async function handleUpdateTx(values: EntityFormValues) {
    if (!state.userId || !editingTx) return;
    const patch: {
      merchant?: string;
      amount?: number;
      category?: string;
      transaction_type?: string;
      date?: number;
    } = {};
    if (typeof values.merchant === 'string') patch.merchant = values.merchant;
    if (typeof values.amount === 'number') patch.amount = values.amount;
    if (typeof values.category === 'string') patch.category = values.category;
    if (typeof values.transaction_type === 'string') patch.transaction_type = values.transaction_type;
    if (typeof values.date === 'string' && values.date.trim()) {
      const parsed = new Date(values.date).getTime();
      if (!Number.isNaN(parsed)) patch.date = parsed;
    }

    await FinanceRepository.updateTransaction(state.userId, editingTx.id, patch);
    await reloadFinance();
    await SyncCoordinator.enqueueDefault(state.userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
    await SyncCoordinator.runPending(state.userId);
    setEditingTx(null);
  }

  async function handleDeleteTx() {
    if (!state.userId || !editingTx) return;
    await FinanceRepository.deleteTransaction(state.userId, editingTx.id);
    await reloadFinance();
    await SyncCoordinator.enqueueDefault(state.userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
    await SyncCoordinator.runPending(state.userId);
    setEditingTx(null);
  }

  return (
    <PageScaffold title="Finance" subtitle="Track spending, imports, and ledger health" eyebrow="Money OS" variant="COMPACT">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppCard mode="elevated" style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTextWrap}>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Finance</Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>Track spending, imports, and ledger health</Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable style={styles.iconButton} onPress={() => setIsCreatingTx(true)}>
                <MaterialIcons name="add" size={24} color={colors.primary} />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => router.push(buildRoute('export') as never)}>
                <MaterialIcons name="file-download" size={24} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        </AppCard>

        <AppCard mode="elevated" style={styles.importCard}>
          <View style={styles.importHead}>
            <View>
              <Text style={[styles.importTitle, { color: colors.textPrimary }]}>Import health</Text>
              <Text style={[styles.importMeta, { color: colors.textTertiary }]}>{latestAuditAge}</Text>
            </View>
            <Pressable
              onPress={() =>
                router.push((Platform.OS === 'android' ? buildRoute('smsDiagnostics') : buildRoute('search')) as never)
              }
            >
              <Text style={[styles.reviewText, { color: colors.primary }]}>Review</Text>
            </Pressable>
          </View>
          <Text style={[styles.importBody, { color: colors.textSecondary }]}>No import activity yet</Text>
          <Text style={[styles.importBody, { color: colors.textSecondary }]}>Recent ledger activity is visible</Text>
          <Pressable
            style={[styles.importButton, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}35` }]}
            onPress={() => {
              if (Platform.OS !== 'android') {
                handleCloudRefresh();
                return;
              }
              setImportModalVisible(true);
            }}
            disabled={isImporting}
          >
            {isImporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.importButtonText, { color: colors.primary }]}>
                {Platform.OS === 'android' ? 'Import SMS now' : 'Refresh cloud now'}
              </Text>
            )}
          </Pressable>
          <Text style={[styles.importStats, { color: colors.textTertiary }]}>{importedCount} imported · {pendingCount} pending review</Text>
        </AppCard>

        {isLoading ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
              <ShimmerSkeleton width="48%" height={86} borderRadius={14} />
              <ShimmerSkeleton width="48%" height={86} borderRadius={14} />
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
              <ShimmerSkeleton width="100%" height={170} borderRadius={14} />
            </ScrollView>
          </>
        ) : (
          <FadeInView style={{ gap: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
              <AppCard mode="elevated" style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Today</Text>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatKes(summary.today)}</Text>
              </AppCard>
              <AppCard mode="elevated" style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Week</Text>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatKes(summary.week)}</Text>
              </AppCard>
              <AppCard mode="elevated" style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Month</Text>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatKes(summary.month)}</Text>
              </AppCard>
            </ScrollView>

            {importAudit.length > 0 && (
              <AppCard mode="flat" style={[styles.healthCard, { borderColor: colors.border }]}>
                <View style={styles.healthHead}>
                  <View>
                    <Text style={[styles.healthTitle, { color: colors.textPrimary }]}>Import status</Text>
                    <Text style={[styles.healthMeta, { color: colors.textTertiary }]}>{latestAuditAge}</Text>
                  </View>
                  <Pressable onPress={() => router.push(buildRoute('categorize') as never)}>
                    <Text style={[styles.reviewText, { color: colors.primary }]}>Review</Text>
                  </Pressable>
                </View>
                <Text style={[styles.healthBody, { color: colors.textSecondary }]}>
                  {importedCount} imported · {pendingCount} pending review · {duplicatesCount} duplicates · {issuesCount} issues
                </Text>
              </AppCard>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricScroll}>
              <AppCard mode="elevated" style={styles.metricCard}>
                <Text style={[styles.metricTitle, { color: colors.textPrimary }]}>Budget</Text>
                <Text style={[styles.metricAmount, { color: colors.textSecondary }]}>{formatKes(totalSpent)} of {formatKes(totalBudget)}</Text>
                <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}> 
                  <View style={[styles.progressFill, { width: `${Math.round(budgetRatio * 100)}%`, backgroundColor: budgetRatio >= 0.9 ? '#FF9A76' : colors.primary }]} />
                </View>
                <Text style={[styles.metricHint, { color: budgetRatio >= 0.9 ? '#FFB78E' : colors.textTertiary }]}>Near limit · {Math.round(budgetRatio * 100)}%</Text>
              </AppCard>

              <AppCard mode="elevated" style={styles.metricCard}>
                <Text style={[styles.metricTitle, { color: colors.textPrimary }]}>Service Charges</Text>
                <Text style={[styles.metricValueLarge, { color: colors.warning }]}>{formatKes(feeTotal)}</Text>
                <Text style={[styles.metricHint, { color: colors.textSecondary }]}>Airtime, Fuliza and service fees</Text>
              </AppCard>
            </ScrollView>
          </FadeInView>
        )}

        {uncategorizedCount > 0 && (
          <AppCard mode="flat" style={[styles.uncategorizedCard, { borderColor: colors.warning, backgroundColor: `${colors.warning}15` }]}>
            <View style={styles.healthHead}>
              <View>
                <Text style={[styles.healthTitle, { color: colors.textPrimary }]}>{uncategorizedCount} uncategorized transactions</Text>
                <Text style={[styles.healthBody, { color: colors.textSecondary }]}>Organize them to get better insights.</Text>
              </View>
              <Pressable onPress={() => router.push(buildRoute('categorize') as never)}>
                <Text style={[styles.reviewText, { color: colors.primary }]}>Organize</Text>
              </Pressable>
            </View>
          </AppCard>
        )}
        {fulizaData && (fulizaData.outstanding > 0 || fulizaData.count > 0) && (
          <AppCard mode="flat" style={[styles.fulizaCard, { borderColor: colors.border }]}>
            <Text style={[styles.healthTitle, { color: colors.textPrimary }]}>Fuliza</Text>
            <Text style={[styles.healthBody, { color: colors.textSecondary }]}>
              {fulizaData.count} active loan(s) · Outstanding: KSh {Math.round(fulizaData.outstanding).toLocaleString('en-KE')} · Limit: KSh {Math.round(fulizaData.limit).toLocaleString('en-KE')}
            </Text>
          </AppCard>
        )}

        <AppCard mode="elevated" style={styles.exportCard}>
          <View style={styles.exportRow}>
            <Text style={[styles.exportTitle, { color: colors.textPrimary }]}>Exports and reports</Text>
            <Pressable onPress={() => router.push(buildRoute('export') as never)}>
              <Text style={[styles.reviewText, { color: colors.primary }]}>Open export center</Text>
            </Pressable>
          </View>
          <Text style={[styles.exportBody, { color: colors.textSecondary }]}>Create a CSV, JSON, or shareable report from visible transactions.</Text>
        </AppCard>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScroll}>
          {PERIODS.map((item) => {
            const active = period === item;
            return (
              <Pressable
                key={item}
                onPress={() => setPeriod(item)}
                style={[
                  styles.periodChip,
                  { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}2A` : colors.surfaceElevated },
                ]}
              >
                <Text style={[styles.periodText, { color: active ? colors.primary : colors.textSecondary }]}>
                  {item === 'ALL' ? 'All' : item === 'TODAY' ? 'Today' : item === 'WEEK' ? 'Week' : 'Month'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}> 
          <MaterialIcons name="search" size={22} color={colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search merchant, category, code or amount..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
        </View>

        <View style={styles.txSectionHeader}>
          <Text style={[styles.txHeading, { color: colors.textPrimary }]}>Transactions</Text>
          <Text style={[styles.txHeadingRight, { color: colors.primary }]}>
            {period === 'TODAY' ? 'Today' : period === 'WEEK' ? 'This Week' : period === 'MONTH' ? 'This Month' : 'All'}
          </Text>
        </View>

        <AppCard mode="elevated" style={styles.txContainer}>
          {filteredRecent.map((tx) => (
            <View key={tx.id} style={[styles.txCard, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
              <View style={styles.txTopRow}>
                <Pressable onPress={() => router.push(buildRoute('merchantDetail', { merchant: tx.merchant }) as never)}>
                  <Text style={[styles.txMerchant, { color: colors.primary }]}>{tx.merchant}</Text>
                </Pressable>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.txAmount, { color: tx.transaction_type === 'RECEIVED' || tx.transaction_type === 'DEPOSIT' ? colors.success : colors.textPrimary }]}>
                    {tx.transaction_type === 'RECEIVED' || tx.transaction_type === 'DEPOSIT' ? '+' : ''}{formatKes(tx.amount)}
                  </Text>
                  {tx.transaction_cost != null && tx.transaction_cost > 0 ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>+ {formatKes(tx.transaction_cost)} cost</Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.txMeta, { color: colors.textSecondary }]}>{tx.category || 'Uncategorized'} · {formatTxDate(tx.date)}</Text>
              <View style={styles.txActionRow}>
                <Pressable onPress={() => router.push(buildRoute('categorize') as never)}>
                  <Text style={[styles.txAction, { color: colors.primary }]}>Category</Text>
                </Pressable>
                <Pressable onPress={() => {
                  Alert.alert('Delete transaction?', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => handleDeleteTransaction(tx.id) },
                  ]);
                }}>
                  <Text style={[styles.txAction, { color: '#FF9A8A' }]}>Delete</Text>
                </Pressable>
                <Pressable onPress={() => setEditingTx(tx)}>
                  <Text style={[styles.txAction, { color: colors.textTertiary }]}>Edit</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {!filteredRecent.length ? (
            <Text style={[styles.empty, { color: colors.textTertiary }]}>No transactions for this filter.</Text>
          ) : null}
        </AppCard>
      </ScrollView>

      <EntityFormSheet
        visible={isCreatingTx}
        title="New transaction"
        fields={txFields}
        initialValues={{ transaction_type: 'PAID', date: formatDateInput(Date.now()), category: 'Other' }}
        submitLabel="Save"
        onSubmit={handleCreateTx}
        onClose={() => setIsCreatingTx(false)}
      />

      <EntityFormSheet
        visible={editingTx !== null}
        title="Edit transaction"
        fields={txFields}
        initialValues={
          editingTx
            ? {
                merchant: editingTx.merchant,
                amount: editingTx.amount,
                category: editingTx.category,
                transaction_type: editingTx.transaction_type,
                date: formatDateInput(editingTx.date),
              }
            : undefined
        }
        submitLabel="Save"
        destructiveLabel="Delete"
        onSubmit={handleUpdateTx}
        onDestructive={handleDeleteTx}
        onClose={() => setEditingTx(null)}
      />

      {/* Import SMS Dark Modal */}
      <Modal visible={importModalVisible} transparent animationType="fade" onRequestClose={() => setImportModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setImportModalVisible(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Import SMS</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Choose time range</Text>
            {[
              { label: 'LAST 90 DAYS', days: 90 },
              { label: 'LAST 30 DAYS', days: 30 },
              { label: 'LAST 7 DAYS', days: 7 },
            ].map((option) => (
              <Pressable
                key={option.days}
                style={styles.modalOption}
                onPress={() => {
                  setImportModalVisible(false);
                  handleImport(option.days);
                }}
              >
                <Text style={[styles.modalOptionText, { color: colors.primary }]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 220 },
  heroCard: { paddingBottom: 12 },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  heroTextWrap: { flex: 1, gap: 2 },
  heroTitle: { ...LifeOSTypography.headlineLarge },
  heroSubtitle: { ...LifeOSTypography.bodyLarge },
  heroActions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importCard: { gap: 8 },
  importHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  importTitle: { ...LifeOSTypography.headlineMedium },
  importMeta: { ...LifeOSTypography.bodySmall },
  reviewText: { ...LifeOSTypography.labelLarge },
  importBody: { ...LifeOSTypography.bodyLarge },
  importButton: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  importButtonText: { ...LifeOSTypography.labelLarge },
  importStats: { ...LifeOSTypography.bodySmall },
  summaryScroll: { gap: 10, paddingRight: 4 },
  summaryCard: { width: 160, paddingVertical: 14 },
  summaryLabel: { ...LifeOSTypography.titleMedium },
  summaryValue: { ...LifeOSTypography.headlineLarge },
  metricScroll: { gap: 10 },
  metricCard: { width: 270, gap: 8 },
  metricTitle: { ...LifeOSTypography.headlineMedium },
  metricAmount: { ...LifeOSTypography.bodyLarge },
  metricValueLarge: { ...LifeOSTypography.displayLarge },
  metricHint: { ...LifeOSTypography.bodyMedium },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  exportCard: { gap: 6 },
  exportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  exportTitle: { ...LifeOSTypography.headlineMedium, flex: 1 },
  exportBody: { ...LifeOSTypography.bodyLarge },
  periodScroll: { gap: 8, paddingBottom: 2 },
  periodChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  periodText: { ...LifeOSTypography.titleSmall },
  searchBox: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    ...LifeOSTypography.bodyLarge,
    paddingVertical: 10,
  },
  txSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txHeading: { ...LifeOSTypography.headlineMedium },
  txHeadingRight: { ...LifeOSTypography.titleMedium },
  txContainer: { gap: 10 },
  txCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  txTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  txMerchant: { ...LifeOSTypography.headlineSmall },
  txAmount: { ...LifeOSTypography.headlineSmall },
  txMeta: { ...LifeOSTypography.bodyMedium },
  txActionRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
  txAction: { ...LifeOSTypography.titleSmall },
  empty: { ...LifeOSTypography.bodyMedium, textAlign: 'center', paddingVertical: 4 },
  healthCard: { gap: 8, borderWidth: 1 },
  healthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthTitle: { ...LifeOSTypography.headlineMedium },
  healthMeta: { ...LifeOSTypography.bodySmall },
  healthBody: { ...LifeOSTypography.bodyLarge },
  uncategorizedCard: { gap: 8, borderWidth: 1 },
  guardrailCard: { gap: 8, borderWidth: 1 },
  guardrailTitle: { ...LifeOSTypography.headlineMedium },
  guardrailSubtitle: { ...LifeOSTypography.bodyMedium },
  velocityCard: { gap: 8, borderWidth: 1 },
  fulizaCard: { gap: 8, borderWidth: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  modalSheet: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 320,
    gap: 4,
  },
  modalTitle: { ...LifeOSTypography.headlineMedium, marginBottom: 4 },
  modalSubtitle: { ...LifeOSTypography.bodyLarge, marginBottom: 16 },
  modalOption: {
    paddingVertical: 14,
    alignItems: 'flex-end',
  },
  modalOptionText: { ...LifeOSTypography.labelLarge, fontWeight: '600' },
});
