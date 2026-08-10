import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react-native';

import { formPalette } from './finance-form';

export function FinancialScreenHeader({
  title,
  onBack,
  rightAction,
}: {
  title: string;
  onBack?: () => void;
  rightAction?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.sideSlot}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <ArrowLeft size={21} color={formPalette.ink} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.titleLayer}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
      </View>
      <View style={[styles.sideSlot, styles.rightSlot]}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8, backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line },
  sideSlot: { zIndex: 2, minWidth: 42, minHeight: 42, justifyContent: 'center' },
  rightSlot: { alignItems: 'flex-end' },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  titleLayer: { flex: 1, marginLeft: 8, justifyContent: 'center' },
  title: { color: formPalette.ink, fontSize: 20, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
