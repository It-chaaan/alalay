import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart3, Camera, Home, Wallet, WalletCards } from 'lucide-react-native';
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
  if (modalCount > 0) return null;
  const isActive = (route: string) => pathname === route || pathname.startsWith(`${route}/`);
  return <View style={[styles.bottomNav, { bottom: BOTTOM_NAV_BOTTOM_OFFSET + insets.bottom, backgroundColor: 'transparent', borderColor: colors.border, shadowColor: colors.shadow }]}><BlurView pointerEvents="none" intensity={38} tint={resolvedTheme} style={StyleSheet.absoluteFillObject} /><View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceTranslucent, borderRadius: 28 }]} />
    <NavItem icon={Home} label="Home" active={isActive('/(tabs)') || pathname === '/'} onPress={() => router.replace('/(tabs)')} />
    <NavItem icon={Wallet} label="Wallet" active={isActive('/(tabs)/wallets')} onPress={() => router.replace('/(tabs)/wallets')} />
    <Pressable accessibilityRole="button" accessibilityLabel="Open OCR scanner" onPress={() => router.replace('/(tabs)/ocr')} style={({ pressed }) => [styles.addButton, { backgroundColor: colors.accent, shadowColor: colors.shadow }, pressed && styles.pressed]}><Camera size={25} color={colors.inverse} strokeWidth={2} /></Pressable>
    <NavItem icon={WalletCards} label="Budget" active={isActive('/(tabs)/budget')} onPress={() => router.replace('/(tabs)/budget')} />
    <NavItem icon={BarChart3} label="Reports" active={isActive('/(tabs)/reports')} onPress={() => router.replace('/(tabs)/reports')} />
  </View>;
}

function NavItem({ icon: IconComponent, label, active, onPress }: { icon: Icon; label: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><IconComponent size={20} color={active ? colors.accent : colors.muted} strokeWidth={active ? 2.1 : 1.7} /><Text style={[styles.navLabel, { color: active ? colors.accent : colors.muted }, active && styles.navLabelActive]}>{label}</Text>{active && <View style={[styles.navDot, { backgroundColor: colors.accent }]} />}</Pressable>;
}

const styles = StyleSheet.create({
  bottomNav: { position: 'absolute', left: 16, right: 16, height: BOTTOM_NAV_HEIGHT, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 28, overflow: 'hidden', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, shadowColor: '#063224', shadowOpacity: 0.14, shadowRadius: 13, elevation: 7, zIndex: 50 },
  navItem: { width: 50, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  navLabelActive: { color: palette.accent, fontWeight: '900' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.accent },
  addButton: { width: 58, height: 58, marginTop: -26, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: palette.accent, shadowColor: '#063224', shadowOpacity: 0.25, shadowRadius: 9, elevation: 8 },
  pressed: { opacity: 0.72 },
});
