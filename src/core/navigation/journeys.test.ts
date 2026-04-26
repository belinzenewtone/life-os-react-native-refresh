import { describe, expect, it } from 'vitest';

import { resolveGuardRedirect } from './guard';
import { buildCalendarRoute, buildRoute, buildTaskRoute, parseCalendarRoute, parseRoute, parseTaskRoute } from './routes';

describe('journey contracts', () => {
  it('auth + onboarding journey resolves to home after completion', () => {
    const signedOutRedirect = resolveGuardRedirect('/home', {
      isLoading: false,
      isLoggedIn: false,
      onboardingCompleted: false,
    });
    expect(signedOutRedirect).toBe('/auth');

    const onboardingRedirect = resolveGuardRedirect('/home', {
      isLoading: false,
      isLoggedIn: true,
      onboardingCompleted: false,
    });
    expect(onboardingRedirect).toBe('/onboarding');

    const postOnboardingRedirect = resolveGuardRedirect('/onboarding', {
      isLoading: false,
      isLoggedIn: true,
      onboardingCompleted: true,
    });
    expect(postOnboardingRedirect).toBe('/home');
  });

  it('task deep-link journey preserves item contract', () => {
    const route = buildTaskRoute('task_abc');
    const parsed = parseTaskRoute(route);
    expect(parsed.itemId).toBe('task_abc');
  });

  it('calendar deep-link journey preserves event contract', () => {
    const route = buildCalendarRoute({ eventId: 'ev_123', eventDate: '2026-04-23' });
    const parsed = parseCalendarRoute(route);
    expect(parsed).toEqual({ eventId: 'ev_123', eventDate: '2026-04-23' });
  });

  it('merchant detail journey preserves merchant param contract', () => {
    const route = buildRoute('merchantDetail', { merchant: 'Cafe Deli / CBD' });
    const parsed = parseRoute(route);
    expect(parsed).toEqual({
      name: 'merchantDetail',
      route: '/merchant_detail/Cafe%20Deli%20%2F%20CBD',
      params: { merchant: 'Cafe Deli / CBD' },
    });
  });
});
