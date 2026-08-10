import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Keep scrollable content above the floating nav: 68px bar + 12px lift + 20px breathing room. */
export const BOTTOM_NAV_HEIGHT = 68;
export const BOTTOM_NAV_BOTTOM_OFFSET = 12;
export const BOTTOM_NAV_CONTENT_BUFFER = 20;
export const BOTTOM_NAV_CLEARANCE = BOTTOM_NAV_HEIGHT + BOTTOM_NAV_BOTTOM_OFFSET + BOTTOM_NAV_CONTENT_BUFFER;

export function useBottomNavClearance() {
  const insets = useSafeAreaInsets();
  return BOTTOM_NAV_CLEARANCE + insets.bottom;
}
