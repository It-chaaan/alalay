import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '@/theme/theme';

type GlassSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  radius?: number;
  padding?: number;
  selected?: boolean;
  accentTint?: boolean;
};

export function GlassSurface({ children, style, intensity = 38, radius = 24, padding, selected = false, accentTint = false }: GlassSurfaceProps) {
  const { colors, resolvedTheme } = useAppTheme();
  const tint = selected || accentTint ? `${colors.primary}2E` : 'transparent';
  return <View style={[style, styles.clip, { borderRadius: radius, borderColor: colors.border }]}><BlurView intensity={intensity} tint={resolvedTheme} style={StyleSheet.absoluteFillObject} /><View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceTranslucent }]} /><View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: tint }]} /><View style={[padding !== undefined && { padding }, { borderRadius: radius }]}>{children}</View></View>;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
