const staticRoutePaths = {
  auth: '/auth',
  onboarding: '/onboarding',
  home: '/home',
  finance: '/finance',
  calendar: '/calendar',
  assistant: '/assistant',
  profile: '/profile',
  tasks: '/tasks',
  settings: '/settings',
  export: '/export',
  insights: '/insights',
  events: '/events',
  search: '/search',
  planner: '/planner',
  budget: '/budget',
  income: '/income',
  recurring: '/recurring',
  loans: '/loans',
  create: '/create',
  categorize: '/categorize',
  feeAnalytics: '/fee_analytics',
  smsDiagnostics: '/sms_diagnostics',
  review: '/review',
  learning: '/learning',
  conflicts: '/conflicts',
} as const;

export const AppRoutes = {
  ...staticRoutePaths,
  merchantDetail: (merchant: string) => `/merchant_detail/${encodeURIComponent(merchant)}`,
} as const;

export type StaticRouteName = keyof typeof staticRoutePaths;
export type RouteName = StaticRouteName | 'merchantDetail';

export type TaskRouteParams = {
  itemId?: string;
};

export type CalendarRouteParams = {
  eventId?: string;
  eventDate?: string;
};

export type MerchantDetailRouteParams = {
  merchant: string;
};

export type ParsedRouteMatch =
  | {
      name: 'tasks';
      route: string;
      params: { itemId: string | null };
    }
  | {
      name: 'calendar';
      route: string;
      params: { eventId: string | null; eventDate: string | null };
    }
  | {
      name: 'merchantDetail';
      route: string;
      params: { merchant: string };
    }
  | {
      name: Exclude<StaticRouteName, 'tasks' | 'calendar'>;
      route: string;
      params: Record<string, never>;
    };

const staticRouteEntries = Object.entries(staticRoutePaths) as [StaticRouteName, string][];
const staticRouteByPath = new Map<string, StaticRouteName>(staticRouteEntries.map(([name, path]) => [path, name]));

export function buildRoute(name: Exclude<StaticRouteName, 'tasks' | 'calendar'>): string;
export function buildRoute(name: 'tasks', params?: TaskRouteParams): string;
export function buildRoute(name: 'calendar', params?: CalendarRouteParams): string;
export function buildRoute(name: 'merchantDetail', params: MerchantDetailRouteParams): string;
export function buildRoute(name: RouteName, params?: TaskRouteParams | CalendarRouteParams | MerchantDetailRouteParams): string {
  if (name === 'merchantDetail') {
    const merchantParams = params as MerchantDetailRouteParams | undefined;
    if (!merchantParams?.merchant) {
      throw new Error('merchantDetail route requires merchant');
    }
    return AppRoutes.merchantDetail(merchantParams.merchant);
  }

  if (name === 'tasks') {
    return buildTaskRoute((params as TaskRouteParams | undefined)?.itemId);
  }

  if (name === 'calendar') {
    return buildCalendarRoute(params as CalendarRouteParams | undefined);
  }

  return staticRoutePaths[name];
}

export function parseRoute(route: string): ParsedRouteMatch | null {
  const [path] = route.split('?');

  if (path === AppRoutes.tasks) {
    return { name: 'tasks', route, params: parseTaskRoute(route) };
  }

  if (path === AppRoutes.calendar) {
    return { name: 'calendar', route, params: parseCalendarRoute(route) };
  }

  const merchant = parseMerchantDetailRoute(route).merchant;
  if (merchant) {
    return { name: 'merchantDetail', route, params: { merchant } };
  }

  const staticName = staticRouteByPath.get(path);
  if (!staticName || staticName === 'tasks' || staticName === 'calendar') {
    return null;
  }

  return { name: staticName, route, params: {} };
}

export function buildTaskRoute(itemId?: string) {
  return itemId ? `${AppRoutes.tasks}?itemId=${encodeURIComponent(itemId)}` : AppRoutes.tasks;
}

export function parseTaskRoute(route: string) {
  const [, query = ''] = route.split('?');
  const params = new URLSearchParams(query);
  return { itemId: params.get('itemId') };
}

export function buildCalendarRoute(args?: CalendarRouteParams) {
  const params = new URLSearchParams();
  if (args?.eventId) params.set('eventId', args.eventId);
  if (args?.eventDate) params.set('eventDate', args.eventDate);
  const query = params.toString();
  return query ? `${AppRoutes.calendar}?${query}` : AppRoutes.calendar;
}

export function parseCalendarRoute(route: string) {
  const [, query = ''] = route.split('?');
  const params = new URLSearchParams(query);
  return {
    eventId: params.get('eventId'),
    eventDate: params.get('eventDate'),
  };
}

export function parseMerchantDetailRoute(route: string) {
  const [path] = route.split('?');
  const prefix = '/merchant_detail/';
  if (!path.startsWith(prefix)) {
    return { merchant: null as string | null };
  }

  const encoded = path.slice(prefix.length);
  return { merchant: encoded ? decodeURIComponent(encoded) : null };
}
