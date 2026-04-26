import { Text, View, StyleSheet } from 'react-native';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { AppCard } from '@/core/ui/components/AppCard';
import { LifeOSColors, LifeOSTypography } from '@/core/ui/design/tokens';

export function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  return (
    <PageScaffold title={title} subtitle={description}>
      <AppCard mode="glass">
        <View style={styles.row}>
          <Text style={styles.title}>Module scaffold ready</Text>
          <Text style={styles.body}>This screen is wired in navigation and ready for feature logic integration.</Text>
        </View>
      </AppCard>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  title: { ...LifeOSTypography.titleMedium, color: LifeOSColors.light.textPrimary },
  body: { ...LifeOSTypography.bodyMedium, color: LifeOSColors.light.textSecondary },
});