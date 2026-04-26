import { type ReactNode, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

type SwipeActionWrapperProps = {
  children: ReactNode;
  onSwipeRightComplete?: () => void;
  onSwipeLeftDelete?: () => void;
};

export function SwipeActionWrapper({
  children,
  onSwipeRightComplete,
  onSwipeLeftDelete,
}: SwipeActionWrapperProps) {
  const colors = useLifeOSColors();
  const swipeRef = useRef<Swipeable>(null);

  const handleSwipeOpen = (direction: 'left' | 'right') => {
    if (direction === 'left' && onSwipeRightComplete) {
      onSwipeRightComplete();
    }
    if (direction === 'right' && onSwipeLeftDelete) {
      onSwipeLeftDelete();
    }
    swipeRef.current?.close();
  };

  return (
    <Swipeable
      ref={swipeRef}
      onSwipeableOpen={handleSwipeOpen}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={54}
      rightThreshold={54}
      renderLeftActions={() => (
        <View style={[styles.actionWrap, styles.left, { backgroundColor: colors.success }]}>
          <Text style={styles.actionText}>Complete</Text>
        </View>
      )}
      renderRightActions={() => (
        <View style={[styles.actionWrap, styles.right, { backgroundColor: colors.error }]}>
          <Text style={styles.actionText}>Delete</Text>
        </View>
      )}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionWrap: {
    width: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  right: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionText: {
    ...LifeOSTypography.labelMedium,
    color: '#fff',
    fontWeight: '700',
  },
});
