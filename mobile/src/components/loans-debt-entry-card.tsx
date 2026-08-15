import { ChevronRight, HandCoins } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useAppTheme } from '@/theme/theme';

type LoansDebtEntryCardProps = {
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
}: LoansDebtEntryCardProps) {
  const { colors } = useAppTheme();
  const { visible } = useBalanceVisibility();
  const amountsVisible = visible === true;
  const hasSummary = owedToMe != null && iOwe != null;
  const accessibilitySummary =
    !hasSummary || !amountsVisible
      ? 'Loan summary hidden'
      : `${peso(owedToMe!)} owed to you. ${peso(iOwe!)} you owe. ${activeCount} active loan${activeCount === 1 ? '' : 's'}.`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Loans and debt. ${accessibilitySummary} Track what you owe and what's owed to you.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <HandCoins size={21} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Loans &amp; debt</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Track what you owe and what&apos;s owed to you
          </Text>
        </View>
        <ChevronRight size={21} color={colors.textSecondary} />
      </View>
      {isLoading ? (
        <View style={styles.loadingRow} accessibilityLabel="Loading loan summary">
          <View style={[styles.placeholder, { backgroundColor: colors.surfaceSecondary }]} />
          <View style={[styles.placeholder, { backgroundColor: colors.surfaceSecondary }]} />
        </View>
      ) : hasError ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          Tap to manage loans and debt
        </Text>
      ) : hasSummary && activeCount > 0 ? (
        <View style={styles.summaryRow}>
          <Summary
            label="Owed to me"
            value={amountsVisible ? peso(owedToMe!) : '••••••'}
            color={colors.primary}
          />
          <Summary
            label="I owe"
            value={amountsVisible ? peso(iOwe!) : '••••••'}
            color={colors.danger}
          />
          <Text style={[styles.activeCount, { color: colors.textSecondary }]}>
            {activeCount} active loan{activeCount === 1 ? '' : 's'}
          </Text>
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>No active loans yet</Text>
      )}
    </Pressable>
  );
}

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summary}>
      <Text style={[styles.label, { color }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderRadius: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  heading: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  summary: { minWidth: 110, flex: 1 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  value: { marginTop: 5, fontSize: 18, fontWeight: '900' },
  activeCount: { width: '100%', marginTop: 1, fontSize: 11 },
  empty: { marginTop: 16, fontSize: 12, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  placeholder: { flex: 1, height: 34, borderRadius: 8 },
  pressed: { opacity: 0.78 },
});
