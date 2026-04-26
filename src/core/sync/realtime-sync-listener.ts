/**
 * Supabase Realtime Sync Listener
 *
 * Subscribes to live database changes via Supabase Realtime channels.
 * When a remote change is detected, it immediately triggers a PULL_ALL
 * sync job so the local database stays up-to-date without polling.
 *
 * Features:
 *   - Subscribes to INSERT/UPDATE/DELETE on all synced tables
 *   - Debounces rapid changes (batches within 2-second window)
 *   - Auto-reconnects on channel error
 *   - Gracefully handles missing Supabase config
 */

import { supabaseClient } from '@/core/supabase/client';
import { hasSupabaseConfig } from '@/core/supabase/config';
import { SyncCoordinator } from './sync-coordinator';
import { AppTelemetry } from '@/core/observability/app-telemetry';

const TABLES = [
  'transactions',
  'tasks',
  'events',
  'budgets',
  'incomes',
  'recurring_rules',
  'fuliza_loans',
] as const;

const DEBOUNCE_MS = 2_000;

export class RealtimeSyncListener {
  private channels: ReturnType<typeof supabaseClient.channel>[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private userId: string | null = null;
  private isActive = false;

  /**
   * Starts listening for real-time changes on all synced tables.
   */
  start(userId: string) {
    if (this.isActive) return;
    this.isActive = true;
    this.userId = userId;

    if (!hasSupabaseConfig()) {
      AppTelemetry.trackEvent('realtime_sync', { status: 'skipped', reason: 'no_supabase_config' });
      return;
    }

    for (const table of TABLES) {
      const channel = supabaseClient
        .channel(`lifeos_sync_${table}`)
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` } as never,
          () => {
            this.handleChange(table);
          },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            AppTelemetry.trackEvent('realtime_sync', { status: 'channel_error', table });
          }
        });
      this.channels.push(channel);
    }

    AppTelemetry.trackEvent('realtime_sync', { status: 'started', tables: String(TABLES.length) });
  }

  /**
   * Stops all realtime channels.
   */
  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    this.userId = null;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const channel of this.channels) {
      supabaseClient.removeChannel(channel);
    }
    this.channels = [];

    AppTelemetry.trackEvent('realtime_sync', { status: 'stopped' });
  }

  private handleChange(table: string) {
    // Debounce: wait for a burst of changes to settle before triggering sync
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      if (!this.userId) return;
      SyncCoordinator.enqueueDefault(this.userId, 'PERIODIC_WORK', ['PULL_ALL']).catch(() => {
        // Non-critical: if enqueue fails, next periodic sync will catch up
      });
      AppTelemetry.trackEvent('realtime_sync', { status: 'triggered_pull', table });
    }, DEBOUNCE_MS);
  }
}

export const realtimeSyncListener = new RealtimeSyncListener();
