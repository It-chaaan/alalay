import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme as useSystemColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type AppearancePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceTranslucent: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  surfaceInput: string;
  input: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  ink: string;
  muted: string;
  subtle: string;
  inverse: string;
  border: string;
  divider: string;
  line: string;
  primary: string;
  primarySoft: string;
  balance: string;
  balanceRear: string;
  accent: string;
  accentDark: string;
  accentPale: string;
  accentMuted: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
  overlay: string;
  shadow: string;
};

const lightColors: ThemeColors = { background: '#F4F7F1', surface: '#FFFFFF', surfaceTranslucent: 'rgba(255,255,255,0.78)', surfaceSecondary: '#F7FAF8', surfaceElevated: '#FFFFFF', surfaceInput: '#FFFFFF', input: '#FFFFFF', textPrimary: '#11231C', textSecondary: '#5D6C65', textMuted: '#7C8A83', textOnPrimary: '#FFFFFF', ink: '#11231C', muted: '#5D6C65', subtle: '#7C8A83', inverse: '#FFFFFF', border: '#DCE8E0', divider: '#E7EFEA', line: '#DCE8E0', primary: '#0F8A6B', primarySoft: '#D8EFE2', balance: '#0F8A6B', balanceRear: '#08654E', accent: '#0F8A6B', accentDark: '#08654E', accentPale: '#D8EFE2', accentMuted: '#E8F5EE', danger: '#B42318', warning: '#B7791F', success: '#16865B', info: '#2D76B3', overlay: 'rgba(17,35,28,0.42)', shadow: '#063224' };
const darkColors: ThemeColors = { background: '#17191C', surface: '#232629', surfaceTranslucent: 'rgba(67,70,74,0.62)', surfaceSecondary: '#2A2D31', surfaceElevated: '#30343A', surfaceInput: '#292D31', input: '#292D31', textPrimary: '#F5F7F8', textSecondary: '#B8BEC4', textMuted: '#9299A0', textOnPrimary: '#FFFFFF', ink: '#F5F7F8', muted: '#B8BEC4', subtle: '#9299A0', inverse: '#FFFFFF', border: 'rgba(255,255,255,0.13)', divider: 'rgba(255,255,255,0.10)', line: 'rgba(255,255,255,0.13)', primary: '#43C995', primarySoft: '#244F42', balance: '#2E8F70', balanceRear: '#236B55', accent: '#43C995', accentDark: '#2EA779', accentPale: '#244F42', accentMuted: '#1E382F', danger: '#FF938B', warning: '#F5C86A', success: '#65D6A7', info: '#78B9EF', overlay: 'rgba(0,0,0,0.66)', shadow: '#000000' };

const STORAGE_KEY = 'alalay-appearance-preference';
async function readPreference(): Promise<AppearancePreference> { try { const value = Platform.OS === 'web' ? localStorage.getItem(STORAGE_KEY) : await SecureStore.getItemAsync(STORAGE_KEY); return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'; } catch { return 'system'; } }
async function writePreference(value: AppearancePreference) { try { if (Platform.OS === 'web') localStorage.setItem(STORAGE_KEY, value); else await SecureStore.setItemAsync(STORAGE_KEY, value); } catch { /* device-local preference is best effort */ } }

type ThemeContextValue = { preference: AppearancePreference; resolvedTheme: ResolvedTheme; colors: ThemeColors; ready: boolean; setPreference: (value: AppearancePreference) => Promise<void>; };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');
  const [ready, setReady] = useState(false);
  useEffect(() => { void readPreference().then(setPreferenceState).finally(() => setReady(true)); }, []);
  useEffect(() => { if (Platform.OS === 'web') return; const subscription = Appearance.addChangeListener(() => undefined); return () => subscription.remove(); }, []);
  const resolvedTheme: ResolvedTheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo<ThemeContextValue>(() => ({ preference, resolvedTheme, colors: resolvedTheme === 'dark' ? darkColors : lightColors, ready, setPreference: async (next) => { setPreferenceState(next); await writePreference(next); } }), [preference, resolvedTheme, ready]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() { const value = useContext(ThemeContext); if (!value) throw new Error('useAppTheme must be used inside AppThemeProvider'); return value; }
export { lightColors, darkColors };
