export type SmsInboxMessage = {
  body: string;
  address?: string;
  timestamp?: number;
};

export type LifeOsSmsNativeModule = {
  readMpesaInbox(limit: number): Promise<SmsInboxMessage[]>;
  drainQueuedMpesaMessages(limit: number): Promise<SmsInboxMessage[]>;
  startMpesaReceiver(): Promise<void>;
  stopMpesaReceiver(): Promise<void>;
};

export {};
