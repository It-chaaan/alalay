import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, ChevronRight } from 'lucide-react-native';
import { useAppTheme } from '@/theme/theme';

import type { InAppNotification } from '@/services/notifications';
import { formatRelativeDate } from '@/utils/dates';

export function NotificationRow({ item, onPress }: { item: InAppNotification; onPress?: () => void }) {
  const { colors } = useAppTheme();
  const unread = !item.read_at;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!onPress }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Bell size={18} color={colors.primary} strokeWidth={1.8} />
        </View>
        {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
      </View>
      <View style={styles.content}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
        {item.body ? <Text numberOfLines={3} style={[styles.body, { color: colors.textSecondary }]}>{item.body}</Text> : null}
        <Text style={[styles.date, { color: colors.textMuted }]}>{formatRelativeDate(item.created_at)}</Text>
      </View>
      {onPress ? <View style={styles.chev}><ChevronRight size={18} color={colors.textSecondary} /></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
  left: { width: 56, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', right: 6, top: 8, width: 10, height: 10, borderRadius: 6, borderWidth: 1.5, borderColor: '#fff' },
  content: { flex: 1, marginLeft: 6 },
  title: { fontSize: 15, fontWeight: '900' },
  body: { marginTop: 6, fontSize: 13, lineHeight: 20 },
  date: { marginTop: 8, fontSize: 11, fontWeight: '700' },
  chev: { marginLeft: 8 },
  pressed: { opacity: 0.72 },
});
