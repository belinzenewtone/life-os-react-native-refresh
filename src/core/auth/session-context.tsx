import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { AuthSessionStore } from '@/core/security/auth-session-store';
import { hasSupabaseConfig } from '@/core/supabase/config';
import { supabaseClient } from '@/core/supabase/client';

type AuthState = {
  isLoading: boolean;
  isLoggedIn: boolean;
  onboardingCompleted: boolean;
  userId: string | null;
  authError: string | null;
};

type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isLoggedIn: false,
    onboardingCompleted: false,
    userId: null,
    authError: null,
  });

  useEffect(() => {
    let mounted = true;
    Promise.all([AuthSessionStore.read(), supabaseClient.auth.getSession()]).then(([snapshot, supabaseSession]) => {
      if (!mounted) return;
      const userId = supabaseSession.data.session?.user.id ?? snapshot.userId;
      const accessToken = supabaseSession.data.session?.access_token ?? snapshot.accessToken;
      setState((previous) => ({
        ...previous,
        isLoading: false,
        isLoggedIn: Boolean(accessToken && userId),
        onboardingCompleted: snapshot.onboardingCompleted,
        userId,
      }));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((previous) => ({ ...previous, authError: null }));
    const canUseSupabase = hasSupabaseConfig() && password.length > 0;

    if (canUseSupabase) {
      const result = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (result.error || !result.data.session) {
        setState((previous) => ({
          ...previous,
          authError: result.error?.message ?? 'Unable to sign in.',
          isLoggedIn: false,
        }));
        return false;
      }

      const accessToken = result.data.session.access_token;
      const userId = result.data.session.user.id;
      const onboardingCompleted = await AuthSessionStore.readOnboardingCompleted(userId);
      await AuthSessionStore.write({ accessToken, userId });
      setState((previous) => ({
        ...previous,
        isLoggedIn: true,
        userId,
        onboardingCompleted,
        authError: null,
      }));
      return true;
    }

    const userId = email.trim().toLowerCase() || 'demo-user';
    const onboardingCompleted = await AuthSessionStore.readOnboardingCompleted(userId);
    await AuthSessionStore.write({ accessToken: `session:${Date.now()}`, userId });
    setState((previous) => ({
      ...previous,
      isLoggedIn: true,
      userId,
      onboardingCompleted,
      authError: null,
    }));
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await supabaseClient.auth.signOut();
    await AuthSessionStore.clear();
    setState((previous) => ({
      ...previous,
      isLoggedIn: false,
      onboardingCompleted: false,
      userId: null,
      authError: null,
    }));
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (!state.userId) return;
    await AuthSessionStore.setOnboardingCompleted(state.userId, true);
    setState((previous) => ({ ...previous, onboardingCompleted: true }));
  }, [state.userId]);

  const value = useMemo(() => ({ state, signIn, signOut, completeOnboarding }), [completeOnboarding, signIn, signOut, state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider');
  }
  return context;
}
