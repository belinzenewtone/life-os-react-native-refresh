import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuthSession } from '@/core/auth/session-context';
import { usePlannerData } from '@/core/hooks/use-planner-data';
import type { RecurringRuleRecord } from '@/core/repositories/planner-repositories';
import { EntityFormSheet, type FieldDef } from '@/core/ui/components/EntityFormSheet';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

const RECURRING_FIELDS: FieldDef[] = [
  { name: 'label', kind: 'text', label: 'Label', placeholder: 'e.g. Water bill' },
  {
    name: 'kind',
    kind: 'select',
    label: 'Kind',
    options: [
      { value: 'EXPENSE', label: 'Expense' },
      { value: 'INCOME', label: 'Income' },
      { value: 'TASK', label: 'Task' },
    ],
  },
  {
    name: 'interval',
    kind: 'select',
    label: 'Interval',
    options: [
      { value: 'DAILY', label: 'Daily' },
      { value: 'WEEKLY', label: 'Weekly' },
      { value: 'MONTHLY', label: 'Monthly' },
      { value: 'YEARLY', label: 'Yearly' },
    ],
  },
  { name: 'amount', kind: 'number', label: 'Amount (KES, optional)' },
  { name: 'next_run_at', kind: 'date', label: 'Next run date (YYYY-MM-DD)' },
  { name: 'active', kind: 'toggle', label: 'Active' },
];

function toDateInput(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDateInput(s: string): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export default function RecurringScreen() {
  const router = useRouter();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const { recurringRules, createRecurring, updateRecurring, deleteRecurring, toggleRecurring } = usePlannerData(state.userId);
  const [editing, setEditing] = useState<RecurringRuleRecord | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <PageScaffold title="Recurring" subtitle="Rules for repeated automation" eyebrow="Automation" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {recurringRules.map((rule) => (
          <Pressable
            key={rule.id}
            onPress={() => setEditing(rule)}
            accessibilityRole="button"
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>{rule.label}</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {rule.kind} · {rule.interval}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              Next run: {new Date(rule.next_run_at).toLocaleString()}
            </Text>
            {typeof rule.amount === 'number' ? (
              <Text style={[styles.amount, { color: colors.primary }]}>
                KES {rule.amount.toFixed(2)}
              </Text>
            ) : null}
            <View style={styles.row}>
              <View style={[styles.statusBadge, { backgroundColor: rule.active ? colors.success + '22' : colors.border }]}>
                <Text style={[styles.statusText, { color: rule.active ? colors.success : colors.textTertiary }]}>
                  {rule.active ? 'Active' : 'Paused'}
                </Text>
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  toggleRecurring(rule.id);
                }}
                style={[styles.smallBtn, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={rule.active ? 'Pause rule' : 'Resume rule'}
              >
                <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>
                  {rule.active ? 'Pause' : 'Resume'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        ))}

        {!recurringRules.length ? (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>
            No recurring rules yet.{'\n'}Tap “Add rule” to automate a repeated transaction or task.
          </Text>
        ) : null}

        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setCreating(true)}
          accessibilityRole="button"
          accessibilityLabel="Add recurring rule"
        >
          <Text style={styles.addButtonText}>+ Add rule</Text>
        </Pressable>
      </ScrollView>

      <EntityFormSheet
        visible={creating}
        title="New recurring rule"
        fields={RECURRING_FIELDS}
        initialValues={{
          kind: 'EXPENSE',
          interval: 'MONTHLY',
          active: true,
          next_run_at: toDateInput(Date.now() + 7 * 86400000),
        }}
        onSubmit={async (values) => {
          const label = String(values.label ?? '').trim();
          if (!label) return;
          await createRecurring({
            label,
            kind: String(values.kind ?? 'EXPENSE'),
            interval: String(values.interval ?? 'MONTHLY'),
            next_run_at: parseDateInput(String(values.next_run_at ?? '')) ?? Date.now() + 7 * 86400000,
            amount: values.amount === null || values.amount === '' ? null : Number(values.amount),
            active: values.active !== false,
          });
        }}
        onClose={() => setCreating(false)}
      />

      <EntityFormSheet
        visible={!!editing}
        title="Edit recurring rule"
        fields={RECURRING_FIELDS}
        initialValues={
          editing
            ? {
                ...editing,
                active: editing.active === 1,
                next_run_at: toDateInput(editing.next_run_at),
              }
            : {}
        }
        destructiveLabel="Delete rule"
        onDestructive={async () => {
          if (editing) await deleteRecurring(editing.id);
        }}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateRecurring(editing.id, {
            label: String(values.label ?? editing.label).trim(),
            kind: String(values.kind ?? editing.kind),
            interval: String(values.interval ?? editing.interval),
            next_run_at: parseDateInput(String(values.next_run_at ?? '')) ?? editing.next_run_at,
            amount: values.amount === null || values.amount === '' ? null : Number(values.amount),
            active: values.active !== false,
          });
        }}
        onClose={() => setEditing(null)}
      />
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 220 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  title: { ...LifeOSTypography.titleSmall },
  meta: { ...LifeOSTypography.bodySmall },
  amount: { ...LifeOSTypography.bodyMedium, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { ...LifeOSTypography.labelSmall },
  smallBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  smallBtnText: { ...LifeOSTypography.labelSmall },
  empty: { ...LifeOSTypography.bodySmall, textAlign: 'center', marginTop: 32, lineHeight: 22 },
  addButton: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  addButtonText: { color: '#fff', ...LifeOSTypography.labelLarge },
});
