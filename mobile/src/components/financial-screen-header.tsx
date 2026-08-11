import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react-native';

import { formPalette } from './finance-form';
import { useAppTheme } from '@/theme/theme';

export function FinancialScreenHeader({
  title,
  onBack,
  rightAction,
}: {
  title: string;
  onBack?: () => void;
  rightAction?: ReactNode;
}) {
  const { colors, resolvedTheme } = useAppTheme();
  return (
    <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: colors.line }]}>
      <BlurView pointerEvents="none" intensity={28} tint={resolvedTheme} style={StyleSheet.absoluteFillObject} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceTranslucent }]} />
      <View style={styles.sideSlot}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <ArrowLeft size={21} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.titleLayer}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.ink }]}>{title}</Text>
      </View>
      <View style={[styles.sideSlot, styles.rightSlot]}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { width: '100%', alignSelf: 'stretch', minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, overflow: 'hidden', backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line },
  sideSlot: { zIndex: 2, width: 44, minHeight: 42, justifyContent: 'center' },
  rightSlot: { alignItems: 'flex-end' },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  titleLayer: { flex: 1, marginLeft: 8, justifyContent: 'center' },
  title: { color: formPalette.ink, fontSize: 20, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
