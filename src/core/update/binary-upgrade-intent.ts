import { Linking } from 'react-native';

export function launchBinaryDownload(storeUrl: string): void {
  Linking.openURL(storeUrl);
}
