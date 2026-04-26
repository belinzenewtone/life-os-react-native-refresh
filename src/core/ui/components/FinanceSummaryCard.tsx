import { Text, View, StyleSheet } from 'react-native';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export function FinanceSummaryCard({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: string;
  tone?: 'normal' | 'danger' | 'positive';
}) {
  const colors = useLifeOSColors();
  const amountColor =
    tone === 'danger'
      ? colors.error
      : tone === 'positive'
        ? colors.success
        : colors.textPrimary;

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
      <Text style={[styles.label, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.amount, { color: amountColor }]}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  label: { ...LifeOSTypography.labelMedium, textTransform: 'uppercase' },
  amount: { ...LifeOSTypography.headlineMedium, fontVariant: ['tabular-nums'] },
});
