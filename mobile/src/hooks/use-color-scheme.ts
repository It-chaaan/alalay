import { useAppTheme } from '@/theme/theme';

export function useColorScheme() {
  return useAppTheme().resolvedTheme;
}
