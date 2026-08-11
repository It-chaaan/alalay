import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { formPalette } from './finance-form';
import { useAppTheme } from '@/theme/theme';

type FinancialOverviewCardProps = {
  title: string;
  context?: string;
  icon?: ReactNode;
  value: string;
  supportingInfo?: string;
  supportingTone?: 'normal' | 'warning';
  accessibilityLabel?: string;
};

export function FinancialOverviewCard({ title, context, icon, value, supportingInfo, supportingTone = 'normal', accessibilityLabel }: FinancialOverviewCardProps) {
  const { colors } = useAppTheme();
  return <View accessible={Boolean(accessibilityLabel)} accessibilityRole={accessibilityLabel ? 'summary' : undefined} accessibilityLabel={accessibilityLabel} style={[styles.card, { backgroundColor: colors.balance }]}><View style={styles.top}><Text style={[styles.eyebrow, { color: colors.textOnPrimaryMuted }]}>{title}</Text>{icon ?? (context ? <Text style={[styles.period, { color: colors.textOnPrimaryMuted }]}>{context}</Text> : null)}</View><Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[styles.value, { color: colors.textOnPrimary }]}>{value}</Text><View style={styles.divider} />{supportingInfo ? <Text style={[styles.supporting, { color: colors.textOnPrimaryMuted }, supportingTone === 'warning' && styles.supportingWarning]}>{supportingInfo}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  card: { minHeight: 158, marginBottom: 12, padding: 20, borderRadius: 22, backgroundColor: formPalette.accent },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#D8EFE2', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  period: { color: '#BFE3D0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  value: { marginTop: 18, color: '#FFFFFF', fontSize: 31, fontWeight: '900', letterSpacing: -0.8 },
  divider: { height: 1, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.24)' },
  supporting: { marginTop: 11, color: '#D8EFE2', fontSize: 11, fontWeight: '700' },
  supportingWarning: { color: '#FFD3D0' },
});
