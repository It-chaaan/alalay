import { useMemo } from 'react';
import { PanResponder } from 'react-native';

// PanResponder invokes callbacks outside React. Keep this legacy RN bridge
// isolated so React Compiler can optimize its callers.
export function useLegacyWalletSwipeResponder(
  walletCount: number,
  advance: (steps: number) => void,
) {
  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          walletCount > 1 &&
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > 32) advance(gestureState.dx < 0 ? 1 : -1);
        },
      }),
    [advance, walletCount],
  );
}
