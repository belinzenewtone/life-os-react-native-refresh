type TelemetryEvent = {
  name: string;
  properties?: Record<string, string | number | boolean | null>;
  timestamp: string;
};

type TelemetryError = {
  message: string;
  stack?: string;
  context?: Record<string, string | number | boolean | null>;
  timestamp: string;
  severity: 'warning' | 'error' | 'fatal';
};

const MAX_PENDING = 200;

let pendingEvents: TelemetryEvent[] = [];
let pendingErrors: TelemetryError[] = [];
let sentryAvailable = false;
let sentryModule: typeof import('@sentry/react-native') | null = null;

/**
 * Attempts to initialize Sentry if the SDK is installed.
 * Call this once at app startup.
 */
export async function initTelemetry() {
  try {
    const Sentry = await import('@sentry/react-native');
    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    Sentry.init({
      dsn,
      debug: __DEV__,
      beforeSend: (event: unknown) => {
        // Filter out offline errors in development
        const ex = (event as Record<string, unknown>)?.exception as Record<string, unknown> | undefined;
        const values = ex?.values as Array<Record<string, unknown>> | undefined;
        if (__DEV__ && values?.[0]?.type === 'TypeError') {
          return null;
        }
        return event;
      },
    });
    sentryAvailable = true;
    sentryModule = Sentry;
    pendingEvents.forEach((e) => Sentry.addBreadcrumb({ category: 'app', message: e.name, data: e.properties }));
  } catch {
    // Sentry not installed — telemetry remains in-memory only
  }
}

export const AppTelemetry = {
  trackEvent(name: string, properties?: Record<string, string | number | boolean | null>) {
    pendingEvents.push({ name, properties: properties ?? {}, timestamp: new Date().toISOString() });
    if (pendingEvents.length > MAX_PENDING) pendingEvents = pendingEvents.slice(-MAX_PENDING);

    if (sentryAvailable && sentryModule) {
      sentryModule.addBreadcrumb({ category: 'app', message: name, data: properties });
    }
  },

  captureError(error: unknown, context?: Record<string, string | number | boolean | null>, severity: TelemetryError['severity'] = 'error') {
    const entry: TelemetryError = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: context ?? {},
      timestamp: new Date().toISOString(),
      severity,
    };
    pendingErrors.push(entry);
    if (pendingErrors.length > MAX_PENDING) pendingErrors = pendingErrors.slice(-MAX_PENDING);

    if (sentryAvailable && sentryModule) {
      const Sentry = sentryModule;
      Sentry.withScope((scope) => {
        if (context) scope.setContext('app', context);
        scope.setLevel(severity === 'fatal' ? 'fatal' : severity === 'warning' ? 'warning' : 'error');
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });
    }
  },

  flushEvents(): TelemetryEvent[] {
    const copy = [...pendingEvents];
    pendingEvents = [];
    return copy;
  },

  flushErrors(): TelemetryError[] {
    const copy = [...pendingErrors];
    pendingErrors = [];
    return copy;
  },

  getPendingEventCount(): number {
    return pendingEvents.length;
  },

  getPendingErrorCount(): number {
    return pendingErrors.length;
  },
};