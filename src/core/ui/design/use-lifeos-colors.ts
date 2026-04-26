import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppBootstrap } from '@/core/bootstrap/app-bootstrap-context';
import { LifeOSColors } from './tokens';

/**
 * Returns the correct LifeOS color palette respecting the user's theme preference.
 * Priority: user setting (light/dark) > system setting > light fallback.
 */
export function useLifeOSColors() {
  const systemScheme = useColorScheme();
  const { settings } = useAppBootstrap();
  const effectiveScheme =
    settings.themeMode === 'system' ? systemScheme : settings.themeMode;
  return effectiveScheme === 'dark' ? LifeOSColors.dark : LifeOSColors.light;
}
