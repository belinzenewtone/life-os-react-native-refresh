import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthSessionProvider, useAuthSession } from '@/core/auth/session-context';
import { AppBootstrapProvider, useAppBootstrap } from '@/core/bootstrap/app-bootstrap-context';
import { AppTelemetry } from '@/core/observability/app-telemetry';
import { resolveGuardRedirect } from '@/core/navigation/guard';
import { AppRoutes } from '@/core/navigation/routes';
import { useBiometricLock } from '@/core/security/biometric-lock';
import { OtaUpdatePromptHost } from '@/core/update/ota-update-prompt-host';
import { AppPermissionsOrchestrator } from '@/core/permissions/app-permissions-orchestrator';
import { LifeOSColors, LifeOSTypography } from '@/core/ui/design/tokens';

function GuardedLayout() {
  const { state, signOut } = useAuthSession();
  const { isReady, settings } = useAppBootstrap();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = pathname === AppRoutes.auth || pathname === AppRoutes.onboarding;
  const biometric = useBiometricLock(settings.biometricEnabled, !isPublic && state.isLoggedIn);

  useEffect(() => {
    const redirect = resolveGuardRedirect(pathname, {
      isLoading: state.isLoading,
      isLoggedIn: state.isLoggedIn,
      onboardingCompleted: state.onboardingCompleted,
    });
    if (redirect) router.replace(redirect as never);
  }, [pathname, router, state.isLoading, state.isLoggedIn, state.onboardingCompleted]);

  useEffect(() => {
    const onError = (event: Event | { error?: unknown; message?: string }) => {
      const asError = event as { error?: unknown; message?: string };
      AppTelemetry.captureError(asError.error ?? event, { context: 'global_error', message: asError.message ?? '' }, 'fatal');
    };
    const onRejection = (event: Event | { reason?: unknown }) => {
      const asRejection = event as { reason?: unknown };
      AppTelemetry.captureError(asRejection.reason ?? event, { context: 'unhandled_rejection' }, 'error');
    };
    if (typeof window === 'undefined') return;
    if (typeof window.addEventListener !== 'function' || typeof window.removeEventListener !== 'function') return;

    window.addEventListener('error', onError as EventListener);
    window.addEventListener('unhandledrejection', onRejection as EventListener);
    return () => {
      window.removeEventListener('error', onError as EventListener);
      window.removeEventListener('unhandledrejection', onRejection as EventListener);
    };
  }, []);

  if (state.isLoading || !isReady) {
    return (
      <View style={styles.centered}><ActivityIndicator size="large" color={LifeOSColors.light.primary} /></View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tasks" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="export" />
        <Stack.Screen name="insights" />
        <Stack.Screen name="events" />
        <Stack.Screen name="search" />
        <Stack.Screen name="planner" />
        <Stack.Screen name="budget" />
        <Stack.Screen name="income" />
        <Stack.Screen name="recurring" />
        <Stack.Screen name="loans" />
        <Stack.Screen name="create" />
        <Stack.Screen name="categorize" />
        <Stack.Screen name="fee_analytics" />
        <Stack.Screen name="merchant_detail/[merchant]" />
        <Stack.Screen name="review" />
        <Stack.Screen name="learning" />
        <Stack.Screen name="conflicts" />
        <Stack.Screen name="sms_diagnostics" />
      </Stack>

      <OtaUpdatePromptHost enabled={state.isLoggedIn} />
      <AppPermissionsOrchestrator currentRoute={pathname} enabled={state.isLoggedIn} />

      <Modal
        transparent
        visible={!biometric.isUnlocked && state.isLoggedIn && !isPublic && biometric.canAuthenticate}
        animationType="fade"
      >
        <View style={styles.lockOverlay}>
          <View style={styles.lockCard}>
            <Text style={styles.lockTitle}>Unlock LifeOS</Text>
            {biometric.error ? <Text style={styles.lockError}>{biometric.error}</Text> : null}
            <Pressable style={styles.lockButton} onPress={biometric.unlock}><Text style={styles.lockButtonText}>Unlock</Text></Pressable>
            <Pressable onPress={signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={!biometric.isUnlocked && state.isLoggedIn && !isPublic && !biometric.canAuthenticate}
        animationType="fade"
      >
        <View style={styles.lockOverlay}>
          <View style={styles.lockCard}>
            <Text style={styles.lockTitle}>LifeOS</Text>
            <Text style={[styles.lockError, { marginBottom: 12 }]}>
              Biometric authentication is not available on this device.
            </Text>
            <Pressable style={styles.lockButton} onPress={signOut}><Text style={styles.lockButtonText}>Sign in</Text></Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthSessionProvider>
        <RootGate />
      </AuthSessionProvider>
    </GestureHandlerRootView>
  );
}

function RootGate() {
  const { state } = useAuthSession();
  return (
    <AppBootstrapProvider userId={state.userId}>
      <GuardedLayout />
    </AppBootstrapProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: LifeOSColors.light.background },
  lockOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  lockCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 12 },
  lockTitle: { ...LifeOSTypography.headlineSmall, color: LifeOSColors.light.textPrimary, textAlign: 'center' },
  lockError: { ...LifeOSTypography.bodySmall, color: LifeOSColors.light.error, textAlign: 'center' },
  lockButton: { borderRadius: 12, backgroundColor: LifeOSColors.light.primary, paddingVertical: 12, alignItems: 'center' },
  lockButtonText: { ...LifeOSTypography.labelLarge, color: '#fff' },
  signOutText: { ...LifeOSTypography.labelMedium, color: LifeOSColors.light.textSecondary, textAlign: 'center' },
});
