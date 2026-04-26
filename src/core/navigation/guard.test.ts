import { describe, expect, it } from 'vitest';

import { resolveGuardRedirect } from './guard';

describe('resolveGuardRedirect', () => {
  it('does nothing while auth state is loading', () => {
    const redirect = resolveGuardRedirect('/home', {
      isLoading: true,
      isLoggedIn: false,
      onboardingCompleted: false,
    });
    expect(redirect).toBeNull();
  });

  it('forces signed-out users to auth except already-auth route', () => {
    expect(
      resolveGuardRedirect('/tasks', {
        isLoading: false,
        isLoggedIn: false,
        onboardingCompleted: false,
      }),
    ).toBe('/auth');

    expect(
      resolveGuardRedirect('/auth', {
        isLoading: false,
        isLoggedIn: false,
        onboardingCompleted: false,
      }),
    ).toBeNull();
  });

  it('forces logged-in users without onboarding completion to onboarding', () => {
    expect(
      resolveGuardRedirect('/home', {
        isLoading: false,
        isLoggedIn: true,
        onboardingCompleted: false,
      }),
    ).toBe('/onboarding');

    expect(
      resolveGuardRedirect('/onboarding', {
        isLoading: false,
        isLoggedIn: true,
        onboardingCompleted: false,
      }),
    ).toBeNull();
  });

  it('routes completed users away from auth/onboarding to home', () => {
    expect(
      resolveGuardRedirect('/auth', {
        isLoading: false,
        isLoggedIn: true,
        onboardingCompleted: true,
      }),
    ).toBe('/home');

    expect(
      resolveGuardRedirect('/onboarding', {
        isLoading: false,
        isLoggedIn: true,
        onboardingCompleted: true,
      }),
    ).toBe('/home');
  });

  it('allows completed users on regular app routes', () => {
    const redirect = resolveGuardRedirect('/finance', {
      isLoading: false,
      isLoggedIn: true,
      onboardingCompleted: true,
    });
    expect(redirect).toBeNull();
  });
});
