import React, { useEffect, useRef } from 'react';
import { Animated, type ViewProps } from 'react-native';

export function FadeInView({ children, style, duration = 250, ...props }: ViewProps & { duration?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  }, [opacity, duration]);

  return (
    <Animated.View style={[{ opacity }, style]} {...props}>
      {children}
    </Animated.View>
  );
}
