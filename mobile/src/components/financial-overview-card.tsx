import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { formPalette } from './finance-form';
import { useAppTheme } from '@/theme/theme';
import { FinancialSummaryBackground } from '@/components/financial-summary-background';

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
  const motif = title.includes('INCOME') ? 'income' : title.includes('EXPENSE') ? 'expense' : title.includes('SUBSCRIPTION') ? 'subscriptions' : 'bills';
  return <View accessible={Boolean(accessibilityLabel)} accessibilityRole={accessibilityLabel ? 'summary' : undefined} accessibilityLabel={accessibilityLabel} style={[styles.card, { backgroundColor: colors.balance }]}><FinancialSummaryBackground motif={motif} icon={icon} /><View style={styles.content}><View style={styles.top}><Text style={[styles.eyebrow, { color: colors.textOnPrimaryMuted }]}>{title}</Text>{icon ? null : context ? <Text style={[styles.period, { color: colors.textOnPrimaryMuted }]}>{context}</Text> : null}</View><Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[styles.value, { color: colors.textOnPrimary }]}>{value}</Text><View style={styles.divider} />{supportingInfo ? <Text style={[styles.supporting, { color: colors.textOnPrimaryMuted }, supportingTone === 'warning' && styles.supportingWarning]}>{supportingInfo}</Text> : null}</View></View>;
}

const styles = StyleSheet.create({
  card: { minHeight: 158, marginBottom: 12, overflow: 'hidden', padding: 20, borderRadius: 22, backgroundColor: formPalette.accent },
  content: { zIndex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#D8EFE2', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  period: { color: '#BFE3D0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  value: { marginTop: 18, color: '#FFFFFF', fontSize: 31, fontWeight: '900', letterSpacing: -0.8 },
  divider: { height: 1, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.24)' },
  supporting: { marginTop: 11, color: '#D8EFE2', fontSize: 11, fontWeight: '700' },
  supportingWarning: { color: '#FFD3D0' },
});
