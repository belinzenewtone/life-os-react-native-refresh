export interface AuthSessionStoreContract {
  read(): Promise<{ accessToken: string | null; userId: string | null }>;
  write(session: { accessToken: string; userId: string }): Promise<void>;
  clear(): Promise<void>;
}

export interface SyncCoordinatorContract {
  enqueueDefault(trigger: 'APP_START' | 'PERIODIC_WORK' | 'USER_PULL_TO_REFRESH' | 'USER_MANUAL_RETRY'): Promise<unknown>;
}

export interface OtaUpdateServiceContract {
  checkForUpdate(): Promise<{ available: boolean }>;
}

export interface ReminderSchedulerContract {
  schedule(
    kind: 'task' | 'event',
    title: string,
    deadlineMs: number | null,
    offsets: number[],
    options?: { allDay?: boolean; timeOfDayMinutes?: number },
  ): Promise<void>;
  cancelAll(): Promise<void>;
  rescheduleAllReminders(userId: string): Promise<void>;
}

export interface AssistantProxyClientContract {
  prompt(input: { prompt: string; context?: string }): Promise<{ reply: string }>;
}

export interface SmsIngestionPort {
  ingestRealtime(rawSms: string): Promise<void>;
  ingestBackfill(limit: number): Promise<void>;
}