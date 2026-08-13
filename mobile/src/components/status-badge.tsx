import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/theme';

export type FinancialStatus = 'Paid' | 'Upcoming' | 'Overdue' | (string & {});

function statusPresentation(status: FinancialStatus, colors: ReturnType<typeof useAppTheme>['colors']) {
  if (status === 'Paid') return { Icon: CheckCircle2, foreground: colors.success, background: `${colors.success}22`, border: `${colors.success}55` };
  if (status === 'Overdue') return { Icon: AlertCircle, foreground: colors.danger, background: `${colors.danger}22`, border: `${colors.danger}55` };
  if (status === 'Upcoming') return { Icon: Clock3, foreground: colors.primary, background: colors.primarySoft, border: `${colors.primary}55` };
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[status-badge] Unsupported status: ${status}`);
  return { Icon: AlertCircle, foreground: colors.textSecondary, background: colors.surfaceSecondary, border: colors.border };
}

export function StatusBadge({ status }: { status: FinancialStatus }) {
  const { colors } = useAppTheme();
  const { Icon, foreground, background, border } = statusPresentation(status, colors);
  return <View accessible accessibilityLabel={`${status} status`} style={[styles.badge, { backgroundColor: background, borderColor: border }]}>
    <Icon size={13} color={foreground} strokeWidth={2.4} />
    <Text style={[styles.text, { color: foreground }]}>{status}</Text>
  </View>;
}

const styles = StyleSheet.create({
  badge: { minHeight: 28, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  text: { fontSize: 11, lineHeight: 15, fontWeight: '900' },
});
