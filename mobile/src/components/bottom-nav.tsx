import { router, usePathname } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { BarChart3, Home, ScanLine, Wallet, WalletCards } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_BOTTOM_OFFSET, BOTTOM_NAV_HEIGHT } from './bottom-nav-clearance';
import { useModalVisibility } from './modal-visibility';
import { useAppTheme } from '@/theme/theme';
import { BlurView } from 'expo-blur';

const palette = { surface: '#FFFFFF', ink: '#11231C', muted: '#5D6C65', accent: '#0F8A6B', line: '#DCE8E0' };
type Icon = typeof Home;

export function BottomNav() {
  const { colors, resolvedTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { modalCount } = useModalVisibility();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (modalCount > 0 || keyboardVisible) return null;
  const isActive = (route: string) => pathname === route || pathname.startsWith(`${route}/`) || pathname === `/(tabs)${route}` || pathname.startsWith(`/(tabs)${route}/`);
  return <View style={[styles.bottomNavOuter, { bottom: BOTTOM_NAV_BOTTOM_OFFSET + insets.bottom }]}>
    <View style={[styles.glassNavSurface, { borderColor: colors.border, shadowColor: colors.shadow }]}>
      <BlurView pointerEvents="none" intensity={38} tint={resolvedTheme} style={StyleSheet.absoluteFillObject} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceTranslucent, borderRadius: 28 }]} />
    <NavItem icon={Home} label="Home" active={pathname === '/' || pathname === '/(tabs)'} onPress={() => router.replace('/(tabs)')} />
    <NavItem icon={Wallet} label="Wallet" active={isActive('/wallets') || pathname === '/wallet-details'} onPress={() => router.replace('/(tabs)/wallets')} />
      <View style={styles.cameraSpacer} />
      <NavItem icon={WalletCards} label="Budget" active={isActive('/budget')} onPress={() => router.replace('/(tabs)/budget')} />
      <NavItem icon={BarChart3} label="Reports" active={isActive('/reports')} onPress={() => router.replace('/(tabs)/reports')} />
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Scan receipt" onPress={() => router.replace('/(tabs)/ocr')} style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary, shadowColor: colors.shadow }, pressed && styles.pressed]}><ScanLine size={25} color={colors.inverse} strokeWidth={2.4} /></Pressable>
  </View>;
}

function NavItem({ icon: IconComponent, label, active, onPress }: { icon: Icon; label: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><IconComponent size={20} color={active ? colors.accent : colors.muted} strokeWidth={active ? 2.4 : 2.1} /><Text style={[styles.navLabel, { color: active ? colors.accent : colors.muted }, active && styles.navLabelActive]}>{label}</Text>{active && <View style={[styles.navDot, { backgroundColor: colors.accent }]} />}</Pressable>;
}

const styles = StyleSheet.create({
  bottomNavOuter: { position: 'absolute', left: 16, right: 16, height: BOTTOM_NAV_HEIGHT, overflow: 'visible', zIndex: 50 },
  glassNavSurface: { position: 'absolute', left: 0, right: 0, bottom: 0, height: BOTTOM_NAV_HEIGHT, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 28, overflow: 'hidden', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, shadowColor: '#063224', shadowOpacity: 0.14, shadowRadius: 13, elevation: 7 },
  cameraSpacer: { width: 58, height: 58 },
  navItem: { width: 50, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3, outlineWidth: 0 },
  navLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  navLabelActive: { color: palette.accent, fontWeight: '900' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.accent },
  addButton: { position: 'absolute', left: '50%', marginLeft: -29, top: -18, width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: palette.accent, shadowColor: '#063224', shadowOpacity: 0.25, shadowRadius: 9, elevation: 8, zIndex: 60, outlineWidth: 0 },
  pressed: { opacity: 0.72 },
});
