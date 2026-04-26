import { Modal, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export function SuperAddBottomSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (value: { kind: 'TASK' | 'EVENT'; title: string }) => void;
}) {
  const colors = useLifeOSColors();
  const [kind, setKind] = useState<'TASK' | 'EVENT'>('TASK');
  const [title, setTitle] = useState('');

  // Reset form state each time the sheet opens
  useEffect(() => {
    if (visible) {
      setKind('TASK');
      setTitle('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Quick Add</Text>

          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggle,
                { borderColor: colors.border },
                kind === 'TASK' && { backgroundColor: colors.primary + '1A', borderColor: colors.primary },
              ]}
              onPress={() => setKind('TASK')}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === 'TASK' }}
              accessibilityLabel="Create a task"
            >
              <Text style={[styles.toggleText, { color: kind === 'TASK' ? colors.primary : colors.textSecondary }]}>
                Task
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.toggle,
                { borderColor: colors.border },
                kind === 'EVENT' && { backgroundColor: colors.primary + '1A', borderColor: colors.primary },
              ]}
              onPress={() => setKind('EVENT')}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === 'EVENT' }}
              accessibilityLabel="Create an event"
            >
              <Text style={[styles.toggleText, { color: kind === 'EVENT' ? colors.primary : colors.textSecondary }]}>
                Event
              </Text>
            </Pressable>
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
          />

          <Pressable
            style={[styles.submit, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (!title.trim()) return;
              onSubmit({ kind, title: title.trim() });
              setTitle('');
              onClose();
            }}
          >
            <Text style={styles.submitText}>Save</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  title: { ...LifeOSTypography.titleLarge },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  toggleText: { ...LifeOSTypography.labelMedium },
  input: { borderWidth: 1, borderRadius: 10, padding: 12 },
  submit: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  submitText: { color: '#fff', ...LifeOSTypography.labelLarge },
});
