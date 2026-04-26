import type { CanonicalSyncMeta } from '@/core/sync/sync-types';

export type TransactionType =
  | 'SENT'
  | 'RECEIVED'
  | 'PAID'
  | 'WITHDRAWN'
  | 'AIRTIME'
  | 'PAYBILL'
  | 'BUY_GOODS'
  | 'DEPOSIT'
  | 'REVERSED'
  | 'LOAN'
  | 'FULIZA_CHARGE';

export type Transaction = CanonicalSyncMeta & {
  amount: number;
  merchant: string;
  category: string;
  date: number;
  source: 'MPESA' | 'Manual' | 'Bank';
  transaction_type: TransactionType;
  mpesa_code: string | null;
  source_hash: string | null;
  semantic_hash: string | null;
  raw_sms: string | null;
  inferred_category: string | null;
  inference_source: 'MPESA_KIND' | 'KEYWORD' | 'AMOUNT_HEURISTIC' | null;
};

export type Task = CanonicalSyncMeta & {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deadline: number | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  completed_at: number | null;
  reminder_offsets: string;
  alarm_enabled: boolean;
};

export type Event = CanonicalSyncMeta & {
  title: string;
  description: string;
  date: number;
  end_date: number | null;
  type: 'WORK' | 'PERSONAL' | 'HEALTH' | 'FINANCE' | 'OTHER';
  importance: 'NEUTRAL' | 'IMPORTANT' | 'URGENT';
  status: 'PENDING' | 'COMPLETED';
  has_reminder: boolean;
  reminder_minutes_before: number;
  kind: 'EVENT' | 'BIRTHDAY' | 'ANNIVERSARY' | 'COUNTDOWN';
  all_day: boolean;
  repeat_rule: 'NEVER' | 'DAILY' | 'MON_FRI' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  reminder_offsets: string;
  alarm_enabled: boolean;
  guests: string;
  time_zone_id: string;
  reminder_time_of_day_minutes: number;
};