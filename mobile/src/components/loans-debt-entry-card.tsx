import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  HandCoins,
  HeartPulse,
  Info,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { useAppTheme } from '@/theme/theme';

type Props = {
  owedToMe?: number;
  iOwe?: number;
  activeCount?: number;
  isLoading?: boolean;
  hasError?: boolean;
  onPress: () => void;
};
function peso(value: number) {
  return `₱${Math.round(value).toLocaleString('en-PH')}`;
}

export function LoansDebtEntryCard({
  owedToMe,
  iOwe,
  activeCount = 0,
  isLoading = false,
  hasError = false,
  onPress,
}: Props) {
  const { colors } = useAppTheme();
  const hasSummary = owedToMe != null && iOwe != null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Loans and debt. View what you owe and what is owed to you."
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <HandCoins size={22} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Loans &amp; debt</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Stay on top of what you owe and what&apos;s owed to you
          </Text>
        </View>
        <View style={styles.details}>
          <Text style={[styles.detailsText, { color: colors.primary }]}>View details</Text>
          <ChevronRight size={21} color={colors.textSecondary} />
        </View>
      </View>
      {isLoading ? (
        <View style={styles.loadingRow}>
          <View style={[styles.placeholder, { backgroundColor: colors.surfaceSecondary }]} />
          <View style={[styles.placeholder, { backgroundColor: colors.surfaceSecondary }]} />
        </View>
      ) : hasError ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          Tap to manage loans and debt
        </Text>
      ) : hasSummary ? (
        <>
          <View style={styles.summaryRow}>
            <Summary
              label="Owed to me"
              value={peso(owedToMe!)}
              color={colors.primary}
              icon={<ArrowDownLeft size={18} color={colors.primary} />}
              support={
                activeCount
                  ? `${activeCount} active loan${activeCount === 1 ? '' : 's'}`
                  : 'No active loans'
              }
            />
            <Summary
              label="I owe"
              value={peso(iOwe!)}
              color={colors.danger}
              icon={<ArrowUpRight size={18} color={colors.danger} />}
              support={iOwe! > 0 ? 'Outstanding debt' : 'No outstanding debt'}
            />
          </View>
          <View style={[styles.healthRow, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={[styles.healthIcon, { backgroundColor: colors.primarySoft }]}>
              <HeartPulse size={18} color={colors.primary} />
            </View>
            <View style={styles.healthCopy}>
              <Text style={[styles.healthTitle, { color: colors.textPrimary }]}>
                {iOwe! > 0 ? 'Keep it healthy' : 'Looking healthy'}
              </Text>
              <Text style={[styles.healthText, { color: colors.textSecondary }]}>
                {iOwe! > 0
                  ? 'Review your outstanding balance regularly.'
                  : 'Your debt balance is clear right now.'}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </View>
        </>
      ) : (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          No loan summary available
        </Text>
      )}
    </Pressable>
  );
}

function Summary({
  label,
  value,
  color,
  icon,
  support,
}: {
  label: string;
  value: string;
  color: string;
  icon: ReactNode;
  support: string;
}) {
  return (
    <View style={[styles.summary, { borderColor: `${color}66` }]}>
      <View style={styles.summaryTop}>
        <Text style={[styles.label, { color }]}>{label.toUpperCase()}</Text>
        <Info size={15} color={color} />
      </View>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}22` }]}>{icon}</View>
      <Text style={styles.summarySupport}>{support}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 4, padding: 16, borderWidth: 1, borderRadius: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  heading: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  details: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsText: { fontSize: 11, fontWeight: '900' },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  summary: {
    flex: 1,
    minHeight: 118,
    padding: 12,
    borderWidth: 1,
    borderRadius: 15,
    position: 'relative',
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  value: { marginTop: 7, fontSize: 20, fontWeight: '900' },
  summaryIcon: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  summarySupport: { marginTop: 6, color: '#87928C', fontSize: 10, fontWeight: '700' },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 66,
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
  },
  healthIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  healthCopy: { flex: 1 },
  healthTitle: { fontSize: 13, fontWeight: '900' },
  healthText: { marginTop: 2, fontSize: 11, lineHeight: 16 },
  empty: { marginTop: 16, fontSize: 12, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  placeholder: { flex: 1, height: 54, borderRadius: 8 },
  pressed: { opacity: 0.78 },
});
