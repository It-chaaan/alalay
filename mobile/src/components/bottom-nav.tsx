import { router, usePathname } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { BarChart3, Home, ScanLine, Wallet, WalletCards } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_BOTTOM_OFFSET, BOTTOM_NAV_HEIGHT } from './bottom-nav-clearance';
import { useModalVisibility } from './modal-visibility';
import { useAppTheme } from '@/theme/theme';

type Icon = typeof Home;

function navPath(width: number, height: number) {
  const radius = 28;
  const center = width / 2;
  const cradleHalfWidth = 47;
  const cradleDepth = 25;
  return `M ${radius} 0 H ${center - cradleHalfWidth} C ${center - 33} 0 ${center - 30} ${cradleDepth} ${center} ${cradleDepth} C ${center + 30} ${cradleDepth} ${center + 33} 0 ${center + cradleHalfWidth} 0 H ${width - radius} Q ${width} 0 ${width} ${radius} V ${height - radius} Q ${width} ${height} ${width - radius} ${height} H ${radius} Q 0 ${height} 0 ${height - radius} V ${radius} Q 0 0 ${radius} 0 Z`;
}

export function BottomNav() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { modalCount } = useModalVisibility();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (modalCount > 0 || keyboardVisible) return null;
  const isActive = (route: string) => pathname === route || pathname.startsWith(`${route}/`) || pathname === `/(tabs)${route}` || pathname.startsWith(`/(tabs)${route}/`);
  const path = navPath(width, BOTTOM_NAV_HEIGHT);
  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.bottomNavOuter, { bottom: BOTTOM_NAV_BOTTOM_OFFSET + insets.bottom }]}>
    {width > 0 ? <Svg pointerEvents="none" width={width} height={BOTTOM_NAV_HEIGHT} style={styles.navShape}>
      <Path d={path} fill={colors.surfaceTranslucent} stroke={colors.border} strokeWidth={1} />
    </Svg> : null}
    <View style={styles.navContent}>
      <NavItem icon={Home} label="Home" active={pathname === '/' || pathname === '/(tabs)'} onPress={() => router.replace('/(tabs)')} />
      <NavItem icon={Wallet} label="Wallet" active={isActive('/wallets') || pathname === '/wallet-details'} onPress={() => router.replace('/(tabs)/wallets')} />
      <View pointerEvents="none" style={styles.cameraSpacer} />
      <NavItem icon={WalletCards} label="Budget" active={isActive('/budget')} onPress={() => router.replace('/(tabs)/budget')} />
      <NavItem icon={BarChart3} label="Reports" active={isActive('/reports')} onPress={() => router.replace('/(tabs)/reports')} />
    </View>
    <View pointerEvents="none" accessible={false} style={[styles.scanHalo, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]} />
    <Pressable accessibilityRole="button" accessibilityLabel="Scan receipt" onPress={() => router.replace('/(tabs)/ocr')} style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary, borderColor: colors.textOnPrimary, shadowColor: colors.shadow }, pressed && styles.pressed]}><ScanLine size={25} color={colors.inverse} strokeWidth={2.4} /></Pressable>
  </View>;
}

function NavItem({ icon: IconComponent, label, active, onPress }: { icon: Icon; label: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><IconComponent size={20} color={active ? colors.accent : colors.muted} strokeWidth={active ? 2.4 : 2.1} /><Text style={[styles.navLabel, { color: active ? colors.accent : colors.muted }, active && styles.navLabelActive]}>{label}</Text>{active && <View style={[styles.navDot, { backgroundColor: colors.accent }]} />}</Pressable>;
}

const styles = StyleSheet.create({
  bottomNavOuter: { position: 'absolute', left: 16, right: 16, height: BOTTOM_NAV_HEIGHT, overflow: 'visible', zIndex: 50 },
  navShape: { position: 'absolute', left: 0, bottom: 0, zIndex: 0 },
  navContent: { position: 'absolute', left: 0, right: 0, bottom: 0, height: BOTTOM_NAV_HEIGHT, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', zIndex: 1 },
  cameraSpacer: { width: 58, height: 58 },
  navItem: { width: 50, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3, outlineWidth: 0 },
  navLabel: { fontSize: 9, fontWeight: '700' },
  navLabelActive: { fontWeight: '900' },
  navDot: { width: 4, height: 4, borderRadius: 2 },
  scanHalo: { position: 'absolute', left: '50%', marginLeft: -35, top: -24, width: 70, height: 70, borderRadius: 35, borderWidth: 1, opacity: 0.56, zIndex: 2 },
  addButton: { position: 'absolute', left: '50%', marginLeft: -29, top: -18, width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, borderWidth: 2, shadowOpacity: 0.25, shadowRadius: 9, elevation: 8, zIndex: 3, outlineWidth: 0 },
  pressed: { opacity: 0.72 },
});
