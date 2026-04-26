import { Text, View, StyleSheet } from 'react-native';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSColors, LifeOSTypography } from '@/core/ui/design/tokens';

export function BudgetProgressIndicator({
  label,
  spent,
  limit,
}: {
  label: string;
  spent: number;
  limit: number;
}) {
  const colors = useLifeOSColors();
  const ratio = Math.max(0, Math.min(1, limit === 0 ? 0 : spent / limit));

  // Thresholds from spec: ≥100% → error, ≥80% → warning, else → success
  const barColor =
    ratio >= 1
      ? LifeOSColors.light.error
      : ratio >= 0.8
        ? LifeOSColors.light.warning
        : LifeOSColors.light.primary;

  const pct = Math.round(ratio * 100);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          KES {spent.toFixed(0)} / KES {limit.toFixed(0)} · {pct}%
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surface }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%` as `${number}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  label: { ...LifeOSTypography.labelMedium },
  meta: { ...LifeOSTypography.labelSmall },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
});
