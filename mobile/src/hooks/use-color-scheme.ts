/**
 * The mobile product currently uses a light-only visual theme.
 * Keep this behind the shared hook so every screen and navigation surface
 * derives the same palette instead of reading the device appearance directly.
 */
export function useColorScheme() {
  return 'light' as const;
}
