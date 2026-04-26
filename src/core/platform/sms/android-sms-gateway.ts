import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

type NativeSmsMessage = {
  body: string;
  address?: string;
  timestamp?: number;
};

type LifeOsSmsNativeModule = {
  readMpesaInbox?: (limit: number) => Promise<NativeSmsMessage[]>;
  drainQueuedMpesaMessages?: (limit: number) => Promise<NativeSmsMessage[]>;
  startMpesaReceiver?: () => Promise<void>;
  stopMpesaReceiver?: () => Promise<void>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

const nativeModule = NativeModules.LifeOsSmsModule as LifeOsSmsNativeModule | undefined;
const EVENT_SMS_RECEIVED = 'LifeOsSmsReceived';
let emitter: NativeEventEmitter | null = null;

export class AndroidSmsGateway {
  static isAvailable() {
    return Platform.OS === 'android' && Boolean(nativeModule?.readMpesaInbox);
  }

  static async readMpesaInbox(limit = 100): Promise<NativeSmsMessage[]> {
    if (!this.isAvailable() || !nativeModule?.readMpesaInbox) return [];
    return nativeModule.readMpesaInbox(limit);
  }

  static async drainQueuedMpesaMessages(limit = 100): Promise<NativeSmsMessage[]> {
    if (!this.isAvailable() || !nativeModule?.drainQueuedMpesaMessages) return [];
    return nativeModule.drainQueuedMpesaMessages(limit);
  }

  static async startRealtimeReceiver() {
    if (!this.isAvailable() || !nativeModule?.startMpesaReceiver) return;
    await nativeModule.startMpesaReceiver();
  }

  static async stopRealtimeReceiver() {
    if (!this.isAvailable() || !nativeModule?.stopMpesaReceiver) return;
    await nativeModule.stopMpesaReceiver();
  }

  static subscribeRealtime(listener: (message: NativeSmsMessage) => void) {
    if (!this.isAvailable() || !nativeModule) return () => {};
    if (!emitter) {
      emitter = new NativeEventEmitter(nativeModule as never);
    }

    const subscription = emitter.addListener(EVENT_SMS_RECEIVED, (payload: NativeSmsMessage | null) => {
      if (!payload?.body) return;
      listener(payload);
    });

    return () => {
      subscription.remove();
    };
  }
}
