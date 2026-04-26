import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getDatabase } from '@/core/data/database/client';
import { SettingsStore } from '@/core/preferences/settings-store';

type NotificationsModule = typeof import('expo-notifications');

let cachedNotifications: NotificationsModule | null = null;
let didSetHandler = false;

function isExpoGo() {
  return Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
}

async function getNotificationsModule() {
  if (Platform.OS === 'web' || isExpoGo()) return null;
  if (!cachedNotifications) {
    cachedNotifications = await import('expo-notifications');
  }
  return cachedNotifications;
}

async function ensureNotificationHandler() {
  const Notifications = await getNotificationsModule();
  if (!Notifications || didSetHandler) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  didSetHandler = true;
}

// ── Channels ────────────────────────────────────────────────────────────────

const TASK_CHANNEL = 'lifeos-task-reminders';
const EVENT_CHANNEL = 'lifeos-event-reminders';

async function ensureChannels() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync(TASK_CHANNEL, {
    name: 'Task Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    description: 'Reminders for upcoming tasks and deadlines',
  });

  await Notifications.setNotificationChannelAsync(EVENT_CHANNEL, {
    name: 'Event Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    description: 'Reminders for calendar events',
  });
}

// ── Scheduling ──────────────────────────────────────────────────────────────

/**
 * Jitter compensation: expo-notifications may fire slightly late.
 * We schedule reminders slightly earlier to compensate.
 * This is especially important for time-sensitive task deadlines.
 */
const JITTER_COMPENSATION_MS = 30_000; // 30 seconds

/**
 * Max offsets per entity (matching Kotlin's 10-offset limit).
 */
const MAX_OFFSETS = 10;

const LIFEOS_TAG = 'lifeos';

export class ReminderScheduler {
  static async requestPermissions() {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return false;

    await ensureNotificationHandler();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  }

  /**
   * Cancels all LifeOS notifications by tag.
   * Safe: only cancels notifications we scheduled, not other apps'.
   */
  static async cancelAll() {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const lifeosIds = scheduled
        .filter((n) => (n.content.data as Record<string, unknown>)?.tag === LIFEOS_TAG)
        .map((n) => n.identifier);
      await Promise.all(lifeosIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    } catch {
      // If fetching fails, fall back to cancel-all (device-level, not app-level in most cases)
    }
  }

  /**
   * Cancels all scheduled notifications for a specific entity (task or event).
   */
  static async cancelByEntity(entityId: string) {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const entityIds = scheduled
        .filter((n) => (n.content.data as Record<string, unknown>)?.entityId === entityId)
        .map((n) => n.identifier);
      await Promise.all(entityIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    } catch {
      // Non-fatal
    }
  }

  /**
   * Schedules multiple reminder offsets for a task or event.
   * Deduplicates: cancels existing notifications for the same entity before scheduling.
   * @param kind - 'task' or 'event' (determines notification channel and styling)
   * @param entityId - Unique ID of the task or event (used for deduplication)
   * @param title - Display title
   * @param deadlineMs - Target timestamp in milliseconds
   * @param offsets - Array of offset minutes (e.g. [1440, 60, 15] = 1 day, 1 hour, 15 min before)
   * @param options.allDay - If true, offsets are treated as days-before + time-of-day
   * @param options.timeOfDayMinutes - For all-day events: minutes from midnight to fire (default 480 = 8am)
   */
  static async schedule(
    kind: 'task' | 'event',
    entityId: string,
    title: string,
    deadlineMs: number | null,
    offsets: number[],
    options?: { allDay?: boolean; timeOfDayMinutes?: number },
  ) {
    if (!deadlineMs) return;
    const settings = await SettingsStore.read();
    if (!settings.notificationsEnabled) return;
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;

    await ensureNotificationHandler();
    await ensureChannels();

    // Deduplicate: cancel existing notifications for this entity first
    await this.cancelByEntity(entityId);

    const safeOffsets = offsets
      .slice(0, MAX_OFFSETS)
      .filter((n) => Number.isFinite(n) && n >= 0);

    const channelId = kind === 'task' ? TASK_CHANNEL : EVENT_CHANNEL;
    const displayTitle = kind === 'task' ? 'Task Reminder' : 'Event Reminder';

    for (const offset of safeOffsets) {
      let triggerMs: number;

      if (options?.allDay) {
        // All-day event: offset is days-before, fire at user's preferred time-of-day
        const todMinutes = options.timeOfDayMinutes ?? 480;
        const eventDate = new Date(deadlineMs);
        const reminderDate = new Date(
          eventDate.getFullYear(),
          eventDate.getMonth(),
          eventDate.getDate() - offset,
          Math.floor(todMinutes / 60),
          todMinutes % 60,
        );
        triggerMs = reminderDate.getTime();
      } else {
        // Regular event/task: offset is minutes-before deadline
        triggerMs = deadlineMs - offset * 60 * 1000;
      }

      // Apply jitter compensation (schedule slightly earlier)
      triggerMs -= JITTER_COMPENSATION_MS;

      if (triggerMs <= Date.now()) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: displayTitle,
          body: title,
          sound: false,
          data: { tag: LIFEOS_TAG, entityId, kind, offset },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(triggerMs),
          channelId,
        },
      });
    }
  }

  static async rescheduleAllReminders(userId: string) {
    const settings = await SettingsStore.read();
    if (!settings.notificationsEnabled) return;

    await this.cancelAll();
    const db = await getDatabase();

    // ── Tasks ──────────────────────────────────────────────────────────────
    const tasks = await db.getAllAsync<{
      id: string;
      title: string;
      deadline: number | null;
      reminder_offsets: string;
      alarm_enabled: number;
    }>('SELECT id,title,deadline,reminder_offsets,alarm_enabled FROM tasks WHERE user_id = ? AND deleted_at IS NULL AND status != "COMPLETED"', userId);

    for (const task of tasks) {
      if (!task.deadline) continue;
      if (task.alarm_enabled !== 1) continue;
      const offsets = task.reminder_offsets
        .split(',')
        .map((s: string) => parseInt(s.trim(), 10))
        .filter((n: number) => Number.isFinite(n) && n > 0);
      if (!offsets.length) continue;
      await this.schedule('task', task.id, task.title, task.deadline, offsets);
    }

    // ── Events ─────────────────────────────────────────────────────────────
    const events = await db.getAllAsync<{
      id: string;
      title: string;
      date: number;
      reminder_offsets: string;
      alarm_enabled: number;
      all_day: number;
      reminder_time_of_day_minutes: number;
    }>('SELECT id,title,date,reminder_offsets,alarm_enabled,all_day,reminder_time_of_day_minutes FROM events WHERE user_id = ? AND deleted_at IS NULL AND status != "COMPLETED"', userId);

    for (const event of events) {
      if (!event.date) continue;
      if (event.alarm_enabled !== 1) continue;
      const offsets = event.reminder_offsets
        .split(',')
        .map((s: string) => parseInt(s.trim(), 10))
        .filter((n: number) => Number.isFinite(n) && n > 0);
      if (!offsets.length) continue;
      await this.schedule('event', event.id, event.title, event.date, offsets, {
        allDay: event.all_day === 1,
        timeOfDayMinutes: event.reminder_time_of_day_minutes,
      });
    }
  }
}
