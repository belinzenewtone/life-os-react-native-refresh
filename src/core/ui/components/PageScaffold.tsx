import React, { type PropsWithChildren, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSSpacing, LifeOSTypography } from '@/core/ui/design/tokens';

type HeaderVariant = 'HERO' | 'COMPACT';

type PageScaffoldProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
  variant?: HeaderVariant;
  actions?: ReactNode;
  topBanner?: ReactNode;
  /** When provided, a back arrow is rendered in the header. */
  onBack?: () => void;
}>;

function PageScaffoldInner({
  title,
  subtitle,
  eyebrow,
  variant = 'COMPACT',
  actions,
  topBanner,
  onBack,
  children,
}: PageScaffoldProps) {
  const colors = useLifeOSColors();

  const backButton = onBack ? (
    <Pressable
      onPress={onBack}
      hitSlop={8}
      accessibilityLabel="Go back"
      style={[styles.backButton, { backgroundColor: `${colors.primary}14` }]}
    >
      <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
    </Pressable>
  ) : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {topBanner}
        <View style={[styles.header, variant === 'HERO' && styles.headerHero]}>
          {variant === 'HERO' ? (
            <View style={styles.headerText}>
              {backButton}
              {eyebrow ? (
                <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>{eyebrow}</Text>
              ) : null}
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.headerRow}>
              <View style={styles.headerLeading}>
                {backButton}
                <View style={styles.headerText}>
                  {eyebrow ? (
                    <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>{eyebrow}</Text>
                  ) : null}
                  <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                  {subtitle ? (
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
                  ) : null}
                </View>
              </View>
              {actions}
            </View>
          )}
          {variant === 'HERO' ? actions : null}
        </View>
        {children}
      </View>
    </SafeAreaView>
  );
}

export const PageScaffold = React.memo(PageScaffoldInner);

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    paddingTop: LifeOSSpacing.screenTop,
    paddingHorizontal: LifeOSSpacing.screenHorizontal,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerHero: { marginTop: 8, flexDirection: 'column', alignItems: 'flex-start' },
  headerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerText: { flex: 1, gap: 2 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  eyebrow: {
    ...LifeOSTypography.labelSmall,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { ...LifeOSTypography.headlineLarge },
  heroTitle: { ...LifeOSTypography.displayLarge },
  subtitle: { ...LifeOSTypography.bodyMedium },
});
