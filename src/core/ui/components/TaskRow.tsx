import { Pressable, Text, View, StyleSheet } from 'react-native';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSColors, LifeOSTypography } from '@/core/ui/design/tokens';

type PriorityTone = 'NEUTRAL' | 'IMPORTANT' | 'URGENT';

const stripeColor: Record<PriorityTone, string> = {
  NEUTRAL: LifeOSColors.light.primary,
  IMPORTANT: LifeOSColors.light.warning,
  URGENT: LifeOSColors.light.error,
};

export type TaskRowModel = {
  id: string;
  title: string;
  subtitle?: string;
  priorityTone: PriorityTone;
  completed: boolean;
};

export function TaskRow({
  task,
  onToggleComplete,
  onPress,
}: {
  task: TaskRowModel;
  onToggleComplete: (id: string) => void;
  onPress?: (id: string) => void;
}) {
  const colors = useLifeOSColors();

  return (
    <Pressable
      onPress={onPress ? () => onPress(task.id) : undefined}
      style={[
        styles.row,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
      accessible
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={`Task: ${task.title}${task.completed ? ', completed' : ', pending'}`}
    >
      <View style={[styles.stripe, { backgroundColor: stripeColor[task.priorityTone] }]} />
      <Pressable
        onPress={() => onToggleComplete(task.id)}
        style={[
          styles.checkbox,
          { borderColor: colors.border },
          task.completed && { backgroundColor: colors.success, borderColor: colors.success },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        accessibilityLabel={task.completed ? 'Mark incomplete' : 'Mark complete'}
      />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{task.title}</Text>
        {task.subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{task.subtitle}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    paddingRight: 12,
  },
  stripe: { width: 4, alignSelf: 'stretch' },
  checkbox: { width: 20, height: 20, borderRadius: 999, borderWidth: 2 },
  content: { flex: 1, paddingVertical: 12 },
  title: { ...LifeOSTypography.bodyMedium, fontWeight: '600' },
  subtitle: { ...LifeOSTypography.bodySmall },
});
