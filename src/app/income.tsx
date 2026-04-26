import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useAuthSession } from '@/core/auth/session-context';
import { usePlannerData } from '@/core/hooks/use-planner-data';
import type { IncomeRecord } from '@/core/repositories/planner-repositories';
import { EntityFormSheet, type FieldDef } from '@/core/ui/components/EntityFormSheet';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

const INCOME_FIELDS: FieldDef[] = [
  { name: 'source', kind: 'text', label: 'Source', placeholder: 'e.g. Salary' },
  { name: 'amount', kind: 'number', label: 'Amount (KES)', placeholder: '0' },
  { name: 'date', kind: 'date', label: 'Date (YYYY-MM-DD)' },
  { name: 'note', kind: 'text', label: 'Note (optional)', multiline: true },
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

export default function IncomeScreen() {
  const router = useRouter();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const { incomes, createIncome, updateIncome, deleteIncome } = usePlannerData(state.userId);
  const [editing, setEditing] = useState<IncomeRecord | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <PageScaffold title="Income" subtitle="Track sources and inflows" eyebrow="Income" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {incomes.map((income) => (
          <Pressable
            key={income.id}
            onPress={() => setEditing(income)}
            accessibilityRole="button"
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>{income.source}</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {new Date(income.date).toLocaleDateString()}
            </Text>
            <Text style={[styles.amount, { color: colors.primary }]}>
              KES {income.amount.toFixed(2)}
            </Text>
            {income.note ? (
              <Text style={[styles.note, { color: colors.textTertiary }]}>{income.note}</Text>
            ) : null}
          </Pressable>
        ))}

        {!incomes.length ? (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>
            No income entries yet.{'\n'}Tap “Add income” to log an inflow.
          </Text>
        ) : null}

        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setCreating(true)}
          accessibilityRole="button"
          accessibilityLabel="Add income"
        >
          <Text style={styles.addButtonText}>+ Add income</Text>
        </Pressable>
      </ScrollView>

      <EntityFormSheet
        visible={creating}
        title="Log income"
        fields={INCOME_FIELDS}
        initialValues={{ date: toDateInput(Date.now()) }}
        onSubmit={async (values) => {
          const source = String(values.source ?? '').trim();
          const amount = Number(values.amount ?? 0);
          if (!source || !Number.isFinite(amount) || amount <= 0) return;
          await createIncome({
            source,
            amount,
            date: parseDateInput(String(values.date ?? '')) ?? Date.now(),
            note: String(values.note ?? ''),
          });
        }}
        onClose={() => setCreating(false)}
      />

      <EntityFormSheet
        visible={!!editing}
        title="Edit income"
        fields={INCOME_FIELDS}
        initialValues={editing ? { ...editing, date: toDateInput(editing.date) } : {}}
        destructiveLabel="Delete entry"
        onDestructive={async () => {
          if (editing) await deleteIncome(editing.id);
        }}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateIncome(editing.id, {
            source: String(values.source ?? editing.source).trim(),
            amount: Number(values.amount ?? editing.amount),
            date: parseDateInput(String(values.date ?? '')) ?? editing.date,
            note: String(values.note ?? editing.note),
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
  amount: { ...LifeOSTypography.headlineMedium },
  note: { ...LifeOSTypography.bodySmall, fontStyle: 'italic' },
  empty: { ...LifeOSTypography.bodySmall, textAlign: 'center', marginTop: 32, lineHeight: 22 },
  addButton: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  addButtonText: { color: '#fff', ...LifeOSTypography.labelLarge },
});
