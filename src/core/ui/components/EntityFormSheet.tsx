import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSSpacing, LifeOSTypography } from '@/core/ui/design/tokens';

export type FieldDef =
  | { name: string; label: string; kind: 'text'; placeholder?: string; multiline?: boolean }
  | { name: string; label: string; kind: 'number'; placeholder?: string }
  | { name: string; label: string; kind: 'date'; placeholder?: string }
  | { name: string; label: string; kind: 'select'; options: { value: string; label: string }[] }
  | { name: string; label: string; kind: 'toggle' };

export type EntityFormValues = Record<string, string | number | boolean | null>;

export function EntityFormSheet({
  visible,
  title,
  fields,
  initialValues,
  submitLabel = 'Save',
  destructiveLabel,
  onSubmit,
  onDestructive,
  onClose,
}: {
  visible: boolean;
  title: string;
  fields: FieldDef[];
  initialValues?: EntityFormValues;
  submitLabel?: string;
  destructiveLabel?: string;
  onSubmit: (values: EntityFormValues) => void | Promise<void>;
  onDestructive?: () => void | Promise<void>;
  onClose: () => void;
}) {
  const colors = useLifeOSColors();
  const [values, setValues] = useState<EntityFormValues>(initialValues ?? {});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setValues(initialValues ?? {});
      setBusy(false);
    }
  }, [visible, initialValues]);

  function setField(name: string, value: string | number | boolean | null) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit() {
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(values);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleDestructive() {
    if (!onDestructive || busy) return;
    setBusy(true);
    try {
      await onDestructive();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.fullScreen, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={[styles.topAction, { color: colors.textSecondary }]}>Back</Text>
          </Pressable>
          <Text style={[styles.topTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          <Pressable disabled={busy} onPress={handleSubmit} accessibilityRole="button">
            <Text style={[styles.topAction, { color: colors.primary }]}>
              {busy ? 'Saving...' : submitLabel}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
          {fields.map((field) => {
            const v = values[field.name];
            if (field.kind === 'select') {
              return (
                <View key={field.name} style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{field.label}</Text>
                  <View style={styles.optionRow}>
                    {field.options.map((opt) => {
                      const selected = v === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setField(field.name, opt.value)}
                          style={[
                            styles.option,
                            {
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? colors.primary + '1A' : colors.surface,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                        >
                          <Text style={{ color: selected ? colors.primary : colors.textSecondary, ...LifeOSTypography.labelMedium }}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            }
            if (field.kind === 'toggle') {
              const on = !!v;
              return (
                <View
                  key={field.name}
                  style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                >
                  <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{field.label}</Text>
                  <Pressable
                    onPress={() => setField(field.name, !on)}
                    style={[styles.toggleSwitch, { backgroundColor: on ? colors.primary : colors.border }]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                  >
                    <View style={[styles.toggleThumb, on && { transform: [{ translateX: 18 }] }]} />
                  </Pressable>
                </View>
              );
            }
            const stringValue = v == null ? '' : String(v);
            return (
              <View key={field.name} style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{field.label}</Text>
                <TextInput
                  value={stringValue}
                  onChangeText={(text) => {
                    if (field.kind === 'number') {
                      const cleaned = text.replace(/[^0-9.\-]/g, '');
                      setField(field.name, cleaned === '' ? null : Number(cleaned));
                    } else {
                      setField(field.name, text);
                    }
                  }}
                  placeholder={field.kind === 'date' ? 'YYYY-MM-DD' : field.placeholder ?? ''}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType={field.kind === 'number' ? 'decimal-pad' : 'default'}
                  multiline={field.kind === 'text' && field.multiline}
                  style={[
                    styles.input,
                    {
                      borderColor: colors.border,
                      color: colors.textPrimary,
                      backgroundColor: colors.surface,
                      minHeight: field.kind === 'text' && field.multiline ? 104 : 52,
                    },
                  ]}
                />
              </View>
            );
          })}

          {onDestructive && destructiveLabel ? (
            <Pressable
              disabled={busy}
              onPress={handleDestructive}
              style={[styles.destructive, { borderColor: colors.error, backgroundColor: colors.error + '18' }]}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.error, ...LifeOSTypography.labelMedium }}>
                {destructiveLabel}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  topBar: {
    paddingHorizontal: LifeOSSpacing.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: {
    ...LifeOSTypography.titleLarge,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  topAction: { ...LifeOSTypography.labelLarge },
  formContent: {
    paddingHorizontal: LifeOSSpacing.screenHorizontal,
    paddingTop: 14,
    paddingBottom: 180,
    gap: 14,
  },
  fieldGroup: { gap: 6 },
  label: { ...LifeOSTypography.labelSmall },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: { ...LifeOSTypography.bodyMedium },
  toggleSwitch: { width: 44, height: 26, borderRadius: 999, padding: 3, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 999, backgroundColor: '#fff' },
  destructive: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
});
