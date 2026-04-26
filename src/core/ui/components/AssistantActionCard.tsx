import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export function AssistantActionCard({
  action,
  title,
  details,
  onApprove,
  onReject,
}: {
  action: string;
  title: string;
  details: string;
  onApprove: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
}) {
  const colors = useLifeOSColors();
  return (
    <View style={[styles.card, { borderColor: '#CDE3FF', backgroundColor: '#F2F8FF' }]}>
      <Text style={[styles.actionType, { color: colors.primary }]}>{action}</Text>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{details}</Text>
      <View style={styles.actions}>
        <Pressable style={[styles.approve, { backgroundColor: colors.success }]} onPress={onApprove}>
          <Text style={styles.approveText}>Approve</Text>
        </Pressable>
        <Pressable style={[styles.reject, { borderColor: colors.error, backgroundColor: colors.surfaceElevated }]} onPress={onReject}>
          <Text style={[styles.rejectText, { color: colors.error }]}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  actionType: { ...LifeOSTypography.labelSmall },
  cardTitle: { ...LifeOSTypography.titleSmall },
  cardBody: { ...LifeOSTypography.bodySmall },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  approve: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  approveText: { ...LifeOSTypography.labelMedium, color: '#fff' },
  reject: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  rejectText: { ...LifeOSTypography.labelMedium },
});
