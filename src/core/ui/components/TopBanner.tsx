import { Text, StyleSheet, View } from 'react-native';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

type Tone = 'ERROR' | 'WARNING' | 'SUCCESS' | 'INFO';

const lightToneColors: Record<Tone, string> = {
  ERROR: '#FEECEC',
  WARNING: '#FFF4E5',
  SUCCESS: '#ECF7ED',
  INFO: '#EAF4FF',
};

const darkToneColors: Record<Tone, string> = {
  ERROR: '#3B1515',
  WARNING: '#3B2A10',
  SUCCESS: '#163318',
  INFO: '#102038',
};

export function TopBanner({ tone, title, message }: { tone: Tone; title: string; message: string }) {
  const colors = useLifeOSColors();
  const isDark = colors.background === '#0B0F14';
  const bgColor = isDark ? darkToneColors[tone] : lightToneColors[tone];

  return (
    <View
      style={[styles.container, { backgroundColor: bgColor, borderColor: colors.border }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, padding: 12, borderWidth: 1 },
  title: { ...LifeOSTypography.labelLarge },
  message: { ...LifeOSTypography.bodySmall },
});
