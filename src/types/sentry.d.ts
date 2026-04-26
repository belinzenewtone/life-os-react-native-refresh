/**
 * Optional type declarations for @sentry/react-native.
 * The SDK is not a required dependency — telemetry gracefully degrades
 * to in-memory-only when Sentry is not installed.
 */

declare module '@sentry/react-native' {
  export function init(options: {
    dsn?: string;
    debug?: boolean;
    beforeSend?: (event: unknown) => unknown | null;
  }): void;

  export function addBreadcrumb(breadcrumb: {
    category?: string;
    message?: string;
    data?: Record<string, unknown>;
  }): void;

  export function captureException(error: Error): void;

  export function withScope(callback: (scope: {
    setContext: (name: string, context: Record<string, unknown>) => void;
    setLevel: (level: string) => void;
  }) => void): void;
}
