import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, type AppStateStatus } from 'react-native';
import { useEffect, useRef, useState } from 'react';

const BIOMETRIC_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export function useBiometricLock(enabled: boolean, shouldProtect: boolean) {
  const [isUnlocked, setIsUnlocked] = useState(!enabled || !shouldProtect);
  const [error, setError] = useState<string | null>(null);
  const [canAuthenticate, setCanAuthenticate] = useState(false);
  const backgroundedAtMsRef = useRef<number>(Date.now());

  useEffect(() => {
    setIsUnlocked(!enabled || !shouldProtect);
    setError(null);

    if (!enabled || !shouldProtect) {
      setCanAuthenticate(false);
      return;
    }

    let mounted = true;
    async function check() {
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const level = await LocalAuthentication.getEnrolledLevelAsync();
        const hasBiometric = types.length > 0;
        const isEnrolled = level !== LocalAuthentication.SecurityLevel.NONE;
        if (mounted) setCanAuthenticate(hasBiometric && isEnrolled);
      } catch {
        if (mounted) setCanAuthenticate(false);
      }
    }
    check();
    return () => {
      mounted = false;
    };
  }, [enabled, shouldProtect]);

  useEffect(() => {
    const onStateChange = async (nextState: AppStateStatus) => {
      if (!enabled || !shouldProtect) return;
      if (nextState === 'background') {
        backgroundedAtMsRef.current = Date.now();
      }
      if (nextState === 'active') {
        const shouldLock = Date.now() - backgroundedAtMsRef.current > BIOMETRIC_LOCK_TIMEOUT_MS;
        if (shouldLock) {
          setIsUnlocked(false);
        }
      }
    };

    const subscription = AppState.addEventListener('change', onStateChange);
    return () => subscription.remove();
  }, [enabled, shouldProtect]);

  const unlock = async () => {
    if (!enabled || !shouldProtect) {
      setIsUnlocked(true);
      return;
    }
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock LifeOS',
        fallbackLabel: 'Use device passcode',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        setIsUnlocked(true);
        setError(null);
      } else {
        setError(result.error ?? 'Authentication failed');
      }
    } catch (err) {
      setError('Authentication error');
    }
  };

  return { isUnlocked, error, unlock, canAuthenticate };
}