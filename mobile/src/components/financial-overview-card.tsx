import { StyleSheet, Text, View } from 'react-native';
import { formPalette } from './finance-form';
import { useAppTheme } from '@/theme/theme';

type FinancialOverviewCardProps = {
  eyebrow: string;
  period?: string;
  primaryLabel: string;
  value: string;
  supportingText?: string;
  supportingTone?: 'normal' | 'warning';
  progressPercent?: number;
};

export function FinancialOverviewCard({ eyebrow, period, primaryLabel, value, supportingText, supportingTone = 'normal', progressPercent }: FinancialOverviewCardProps) {
  const { colors } = useAppTheme();
  const progress = progressPercent === undefined ? null : Math.min(100, Math.max(0, progressPercent));
  return <View style={[styles.card, { backgroundColor: colors.accent }]}><View style={styles.top}><Text style={[styles.eyebrow, { color: colors.accentPale }]}>{eyebrow}</Text>{period ? <Text style={[styles.period, { color: colors.accentPale }]}>{period}</Text> : null}</View><Text style={[styles.label, { color: colors.accentPale }]}>{primaryLabel}</Text><Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[styles.value, { color: colors.inverse }]}>{value}</Text>{supportingText ? <Text style={[styles.supporting, { color: colors.accentPale }, supportingTone === 'warning' && styles.supportingWarning]}>{supportingText}</Text> : null}{progress !== null ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.inverse }]} /></View> : null}</View>;
}

const styles = StyleSheet.create({
  card: { minHeight: 158, justifyContent: 'center', marginBottom: 12, padding: 20, borderRadius: 22, backgroundColor: formPalette.accent },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#D8EFE2', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  period: { color: '#BFE3D0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  label: { marginTop: 15, color: '#D8EFE2', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  value: { marginTop: 3, color: '#FFFFFF', fontSize: 31, fontWeight: '900', letterSpacing: -0.8 },
  supporting: { marginTop: 11, color: '#D8EFE2', fontSize: 11, fontWeight: '700' },
  supportingWarning: { color: '#FFD3D0' },
  progressTrack: { height: 6, marginTop: 14, overflow: 'hidden', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.24)' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#FFFFFF' },
});
