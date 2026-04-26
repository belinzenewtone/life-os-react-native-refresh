import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthSession } from '@/core/auth/session-context';
import { AppRoutes } from '@/core/navigation/routes';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export default function AuthScreen() {
  const { signIn, state } = useAuthSession();
  const colors = useLifeOSColors();
  const router = useRouter();
  const [email, setEmail] = useState('demo@lifeos.app');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignIn() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const success = await signIn(email, password);
      if (success) {
        router.replace(AppRoutes.onboarding);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>LifeOS</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in to your digital sanctuary</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!isLoading}
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceElevated, color: colors.textPrimary }]}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.textTertiary}
        secureTextEntry
        editable={!isLoading}
        onSubmitEditing={handleSignIn}
        returnKeyType="go"
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceElevated, color: colors.textPrimary }]}
      />

      {state.authError ? (
        <Text style={[styles.error, { color: colors.error }]}>{state.authError}</Text>
      ) : null}

      <Pressable
        style={[styles.button, { backgroundColor: colors.primary }, isLoading && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { ...LifeOSTypography.displayLarge },
  subtitle: { ...LifeOSTypography.bodyMedium, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12 },
  error: { ...LifeOSTypography.bodySmall },
  button: { marginTop: 8, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...LifeOSTypography.labelLarge, color: '#fff' },
});
