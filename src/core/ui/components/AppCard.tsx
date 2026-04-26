import React, { useMemo, type ComponentProps, type PropsWithChildren } from 'react';
import { View, StyleSheet } from 'react-native';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSRadius } from '@/core/ui/design/tokens';

type AppCardMode = 'flat' | 'elevated' | 'glass';

type AppCardProps = PropsWithChildren<
  ComponentProps<typeof View> & {
    mode?: AppCardMode;
  }
>;

function AppCardInner({ mode = 'elevated', style, children, ...rest }: AppCardProps) {
  const colors = useLifeOSColors();

  const modeStyle = useMemo(() => {
    if (mode === 'glass') {
      return {
        backgroundColor: colors.glass,
        borderColor: colors.glassBorder,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 5,
      };
    }
    if (mode === 'elevated') {
      return {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 3,
      };
    }
    return { backgroundColor: colors.surface };
  }, [mode, colors.glass, colors.glassBorder, colors.surfaceElevated, colors.border, colors.surface]);

  return (
    <View style={[styles.base, modeStyle, style]} {...rest}>
      {children}
    </View>
  );
}

export const AppCard = React.memo(AppCardInner);

const styles = StyleSheet.create({
  base: {
    borderRadius: LifeOSRadius.large,
    padding: 18,
  },
});
