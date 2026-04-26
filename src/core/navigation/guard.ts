import { AppRoutes } from './routes';

export type GuardState = {
  isLoading: boolean;
  isLoggedIn: boolean;
  onboardingCompleted: boolean;
};

export function resolveGuardRedirect(pathname: string, state: GuardState): string | null {
  if (state.isLoading) return null;

  if (!state.isLoggedIn) {
    return pathname === AppRoutes.auth ? null : AppRoutes.auth;
  }

  if (!state.onboardingCompleted) {
    return pathname === AppRoutes.onboarding ? null : AppRoutes.onboarding;
  }

  if (pathname === AppRoutes.auth || pathname === AppRoutes.onboarding) {
    return AppRoutes.home;
  }

  return null;
}
