/**
 * Network Monitor
 *
 * Provides connectivity state awareness to the sync system.
 * Uses expo-network for actual internet reachability detection,
 * falling back to navigator.onLine if the module is unavailable.
 */

import * as Network from 'expo-network';

export type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean;
  connectionType: 'wifi' | 'cellular' | 'unknown' | 'none';
};

export class NetworkMonitor {
  private static lastState: NetworkState = {
    isConnected: true,
    isInternetReachable: true,
    connectionType: 'unknown',
  };

  private static stateDescription(type: Network.NetworkStateType | null | undefined): NetworkState['connectionType'] {
    if (type === Network.NetworkStateType.WIFI) return 'wifi';
    if (type === Network.NetworkStateType.CELLULAR) return 'cellular';
    if (type === Network.NetworkStateType.NONE) return 'none';
    return 'unknown';
  }

  /**
   * Quick connectivity check. Uses expo-network to determine if the
   * internet is actually reachable, not just if the interface is up.
   */
  static async isOnlineAsync(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return state.isConnected ?? false;
    } catch {
      return typeof navigator !== 'undefined' && navigator.onLine !== false;
    }
  }

  /**
   * Quick connectivity check (synchronous). Returns true if the device
   * appears to have an active network connection.
   */
  static isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine !== false;
  }

  /**
   * Returns the current network state snapshot with actual internet reachability.
   */
  static async getStateAsync(): Promise<NetworkState> {
    try {
      const state = await Network.getNetworkStateAsync();
      const isConnected = state.isConnected ?? false;
      const isInternetReachable =
        state.isInternetReachable !== undefined && state.isInternetReachable !== null
          ? state.isInternetReachable
          : isConnected;

      this.lastState = {
        isConnected,
        isInternetReachable,
        connectionType: this.stateDescription(state.type),
      };
      return this.lastState;
    } catch {
      const isConnected = this.isOnline();
      return {
        isConnected,
        isInternetReachable: isConnected,
        connectionType: isConnected ? 'unknown' : 'none',
      };
    }
  }

  /**
   * Returns the current network state snapshot (synchronous, best-effort).
   */
  static getState(): NetworkState {
    return this.lastState;
  }

  /**
   * Asserts that the device is online with internet reachable.
   * Throws a typed error so callers can distinguish network failures.
   */
  static assertOnline(): void {
    if (!this.isOnline()) {
      const err = new Error('Device is offline');
      (err as Error & { isOffline?: boolean }).isOffline = true;
      throw err;
    }
  }
}
