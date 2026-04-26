import { describe, expect, it } from 'vitest';

import {
  AppRoutes,
  buildCalendarRoute,
  buildRoute,
  buildTaskRoute,
  parseCalendarRoute,
  parseMerchantDetailRoute,
  parseRoute,
  parseTaskRoute,
} from './routes';

describe('navigation routes', () => {
  it('builds static routes via typed builder', () => {
    expect(buildRoute('auth')).toBe(AppRoutes.auth);
    expect(buildRoute('onboarding')).toBe(AppRoutes.onboarding);
    expect(buildRoute('home')).toBe(AppRoutes.home);
    expect(buildRoute('finance')).toBe(AppRoutes.finance);
    expect(buildRoute('assistant')).toBe(AppRoutes.assistant);
    expect(buildRoute('profile')).toBe(AppRoutes.profile);
    expect(buildRoute('settings')).toBe(AppRoutes.settings);
    expect(buildRoute('export')).toBe(AppRoutes.export);
    expect(buildRoute('insights')).toBe(AppRoutes.insights);
    expect(buildRoute('events')).toBe(AppRoutes.events);
    expect(buildRoute('search')).toBe(AppRoutes.search);
    expect(buildRoute('planner')).toBe(AppRoutes.planner);
    expect(buildRoute('budget')).toBe(AppRoutes.budget);
    expect(buildRoute('income')).toBe(AppRoutes.income);
    expect(buildRoute('recurring')).toBe(AppRoutes.recurring);
    expect(buildRoute('loans')).toBe(AppRoutes.loans);
    expect(buildRoute('create')).toBe(AppRoutes.create);
    expect(buildRoute('categorize')).toBe(AppRoutes.categorize);
    expect(buildRoute('feeAnalytics')).toBe(AppRoutes.feeAnalytics);
    expect(buildRoute('smsDiagnostics')).toBe(AppRoutes.smsDiagnostics);
    expect(buildRoute('review')).toBe(AppRoutes.review);
    expect(buildRoute('learning')).toBe(AppRoutes.learning);
    expect(buildRoute('conflicts')).toBe(AppRoutes.conflicts);
  });

  it('encodes merchant detail route params safely', () => {
    const route = AppRoutes.merchantDetail("Cafe & Bar/Westlands");
    expect(route).toBe('/merchant_detail/Cafe%20%26%20Bar%2FWestlands');
    expect(buildRoute('merchantDetail', { merchant: "Cafe & Bar/Westlands" })).toBe(route);
    expect(parseMerchantDetailRoute(route)).toEqual({ merchant: 'Cafe & Bar/Westlands' });
    expect(parseMerchantDetailRoute('/tasks')).toEqual({ merchant: null });
  });

  it('builds and parses task deep-link params', () => {
    const built = buildTaskRoute('task_42');
    expect(built).toBe('/tasks?itemId=task_42');
    expect(parseTaskRoute(built)).toEqual({ itemId: 'task_42' });
    expect(parseTaskRoute('/tasks')).toEqual({ itemId: null });
  });

  it('builds and parses calendar deep-link params', () => {
    const built = buildCalendarRoute({
      eventId: 'event_9',
      eventDate: '2026-04-23',
    });
    expect(built).toBe('/calendar?eventId=event_9&eventDate=2026-04-23');
    expect(parseCalendarRoute(built)).toEqual({
      eventId: 'event_9',
      eventDate: '2026-04-23',
    });
    expect(parseCalendarRoute('/calendar')).toEqual({
      eventId: null,
      eventDate: null,
    });
  });

  it('parses known route contracts and rejects unknown routes', () => {
    expect(parseRoute('/settings')).toEqual({
      name: 'settings',
      route: '/settings',
      params: {},
    });
    expect(parseRoute('/tasks?itemId=task_7')).toEqual({
      name: 'tasks',
      route: '/tasks?itemId=task_7',
      params: { itemId: 'task_7' },
    });
    expect(parseRoute('/calendar?eventId=ev_2&eventDate=2026-04-23')).toEqual({
      name: 'calendar',
      route: '/calendar?eventId=ev_2&eventDate=2026-04-23',
      params: { eventId: 'ev_2', eventDate: '2026-04-23' },
    });
    expect(parseRoute('/merchant_detail/Shell%20Nairobi')).toEqual({
      name: 'merchantDetail',
      route: '/merchant_detail/Shell%20Nairobi',
      params: { merchant: 'Shell Nairobi' },
    });
    expect(parseRoute('/unknown')).toBeNull();
  });
});
