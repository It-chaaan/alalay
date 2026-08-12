import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Shared occupied space for the floating nav, including its protruding action button and content gap. */
export const BOTTOM_NAV_HEIGHT = 68;
export const BOTTOM_NAV_BOTTOM_OFFSET = 12;
export const BOTTOM_NAV_ACTION_PROTRUSION = 18;
export const BOTTOM_NAV_CONTENT_BUFFER = 20;
export const BOTTOM_NAV_CLEARANCE = BOTTOM_NAV_HEIGHT + BOTTOM_NAV_BOTTOM_OFFSET + BOTTOM_NAV_ACTION_PROTRUSION + BOTTOM_NAV_CONTENT_BUFFER;

export function useBottomNavClearance() {
  const insets = useSafeAreaInsets();
  return BOTTOM_NAV_CLEARANCE + insets.bottom;
}
