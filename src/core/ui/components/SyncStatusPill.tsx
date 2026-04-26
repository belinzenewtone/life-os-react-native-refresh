import { Text, StyleSheet, View } from 'react-native';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

type SyncState = 'SYNCED' | 'SYNCING' | 'QUEUED' | 'FAILED';

export function SyncStatusPill({ state }: { state: SyncState | string }) {
  const colors = useLifeOSColors();
  const color =
    state === 'SYNCED'
      ? colors.success
      : state === 'FAILED'
        ? colors.error
        : colors.warning;

  return (
    <View
      style={[styles.pill, { borderColor: color }]}
      accessibilityLabel={`Sync status: ${state}`}
    >
      <Text style={[styles.text, { color }]}>{state}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { ...LifeOSTypography.labelSmall },
});
