import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useAuthSession } from '@/core/auth/session-context';
import { usePlannerData } from '@/core/hooks/use-planner-data';
import { FinanceRepository, type CategoryMonthlySpend } from '@/core/repositories/finance-repository';
import type { BudgetRecord } from '@/core/repositories/planner-repositories';
import { BudgetProgressIndicator } from '@/core/ui/components/BudgetProgressIndicator';
import { EntityFormSheet, type FieldDef } from '@/core/ui/components/EntityFormSheet';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

const BUDGET_FIELDS: FieldDef[] = [
  { name: 'category', kind: 'text', label: 'Category', placeholder: 'e.g. Food' },
  { name: 'limit_amount', kind: 'number', label: 'Monthly limit (KES)', placeholder: '0' },
  { name: 'month_key', kind: 'text', label: 'Month (YYYY-MM, optional)', placeholder: new Date().toISOString().slice(0, 7) },
];

export default function BudgetScreen() {
  const router = useRouter();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const { budgets, createBudget, updateBudget, deleteBudget } = usePlannerData(state.userId);
  const [categorySpend, setCategorySpend] = useState<CategoryMonthlySpend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<BudgetRecord | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      try {
        if (!state.userId) return;
        const monthKey = new Date().toISOString().slice(0, 7);
        const spend = await FinanceRepository.getMonthlySpendByCategory(state.userId, monthKey);
        if (mounted) setCategorySpend(spend);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [state.userId, budgets]);

  const spendByCategory = useMemo(
    () => new Map(categorySpend.map((item) => [item.category.toLowerCase(), item.total])),
    [categorySpend],
  );

  return (
    <PageScaffold title="Budget" subtitle="Monthly category envelopes" eyebrow="Planning" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {budgets.map((budget) => (
              <Pressable key={budget.id} onPress={() => setEditing(budget)} accessibilityRole="button">
                <BudgetProgressIndicator
                  label={budget.category}
                  spent={spendByCategory.get(budget.category.toLowerCase()) ?? 0}
                  limit={budget.limit_amount}
                />
              </Pressable>
            ))}
            {!budgets.length ? (
              <Text style={[styles.empty, { color: colors.textTertiary }]}>
                No budget envelopes configured yet. Tap “Add envelope” to create one.
              </Text>
            ) : null}
          </>
        )}

        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setCreating(true)}
          accessibilityRole="button"
          accessibilityLabel="Add budget envelope"
        >
          <Text style={styles.addButtonText}>+ Add envelope</Text>
        </Pressable>
      </ScrollView>

      <EntityFormSheet
        visible={creating}
        title="New budget envelope"
        fields={BUDGET_FIELDS}
        initialValues={{ month_key: new Date().toISOString().slice(0, 7) }}
        onSubmit={async (values) => {
          const category = String(values.category ?? '').trim();
          const limit = Number(values.limit_amount ?? 0);
          if (!category || !Number.isFinite(limit) || limit <= 0) return;
          await createBudget({
            category,
            limit_amount: limit,
            month_key: String(values.month_key ?? '').trim() || undefined,
          });
        }}
        onClose={() => setCreating(false)}
      />

      <EntityFormSheet
        visible={!!editing}
        title="Edit envelope"
        fields={BUDGET_FIELDS}
        initialValues={editing ? { ...editing } : {}}
        destructiveLabel="Delete envelope"
        onDestructive={async () => {
          if (editing) await deleteBudget(editing.id);
        }}
        onSubmit={async (values) => {
          if (!editing) return;
          const category = String(values.category ?? editing.category).trim();
          const limit = Number(values.limit_amount ?? editing.limit_amount);
          await updateBudget(editing.id, {
            category,
            limit_amount: limit,
            month_key: String(values.month_key ?? editing.month_key).trim(),
          });
        }}
        onClose={() => setEditing(null)}
      />
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 220 },
  loader: { marginTop: 48 },
  empty: { ...LifeOSTypography.bodySmall, textAlign: 'center' },
  addButton: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  addButtonText: { color: '#fff', ...LifeOSTypography.labelLarge },
});
