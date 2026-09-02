import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/theme';
import { StatusBadge, type FinancialStatus } from './status-badge';

type Detail = { label: string; value: string };

export function FinancialItemDetailsSheet({ visible, title, name, amount, status, details, onClose, actions }: {
  visible: boolean; title: string; name: string; amount: string; status: FinancialStatus;
  details: Detail[]; onClose: () => void; actions?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
      <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated, paddingBottom: Math.max(20, insets.bottom + 12) }]} onPress={(event) => event.stopPropagation()}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}><Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Close ${title.toLowerCase()}`} onPress={onClose} style={styles.close}><X size={20} color={colors.textSecondary} /></Pressable></View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.identity}><View style={styles.identityCopy}><Text style={[styles.name, { color: colors.textPrimary }]}>{name}</Text><Text style={[styles.amount, { color: colors.primary }]}>{amount}</Text></View><StatusBadge status={status} /></View>
          <View style={[styles.details, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>{details.map((detail) => <View key={detail.label} style={styles.row}><Text style={[styles.label, { color: colors.textSecondary }]}>{detail.label}</Text><Text style={[styles.value, { color: colors.textPrimary }]}>{detail.value}</Text></View>)}</View>
          {actions}
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'flex-end' }, sheet: { maxHeight: '86%', paddingHorizontal: 20, borderTopLeftRadius: 26, borderTopRightRadius: 26 }, handle: { alignSelf: 'center', width: 42, height: 4, marginTop: 10, borderRadius: 2 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }, title: { fontSize: 23, fontWeight: '900' }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, content: { paddingBottom: 6 }, identity: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 }, identityCopy: { flex: 1, minWidth: 0 }, name: { fontSize: 21, fontWeight: '900' }, amount: { marginTop: 4, fontSize: 27, fontWeight: '900' }, details: { gap: 13, marginTop: 20, padding: 15, borderWidth: 1, borderRadius: 17 }, row: { gap: 3 }, label: { fontSize: 11, fontWeight: '800' }, value: { fontSize: 15, fontWeight: '800' } });
