import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

type AppSnackbarProps = {
  visible: boolean;
  message: string;
  actionLabel?: string;
  durationMs?: number;
  onAction?: () => void;
  onDismiss: () => void;
};

export function AppSnackbar({
  visible,
  message,
  actionLabel,
  durationMs = 4500,
  onAction,
  onDismiss,
}: AppSnackbarProps) {
  const colors = useLifeOSColors();

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss, visible]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: '#1F2937' }]}>
        <Text style={[styles.message, { color: '#fff' }]}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={[styles.actionText, { color: colors.primaryLight }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 122,
  },
  card: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  message: {
    ...LifeOSTypography.bodySmall,
    flex: 1,
  },
  actionButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  actionText: {
    ...LifeOSTypography.labelMedium,
    fontWeight: '700',
  },
});
