import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthSession } from '@/core/auth/session-context';
import { AppRoutes } from '@/core/navigation/routes';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export default function OnboardingScreen() {
  const { completeOnboarding } = useAuthSession();
  const router = useRouter();
  const colors = useLifeOSColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome to LifeOS</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>We keep your tasks, money, calendar, and insights in one smooth command center.</Text>
      <Pressable
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={async () => {
          await completeOnboarding();
          router.replace(AppRoutes.home);
        }}
      >
        <Text style={styles.buttonText}>Finish onboarding</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { ...LifeOSTypography.headlineLarge },
  body: { ...LifeOSTypography.bodyMedium },
  button: { marginTop: 12, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { ...LifeOSTypography.labelLarge, color: '#fff' },
});
