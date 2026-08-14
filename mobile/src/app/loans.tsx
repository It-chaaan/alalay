import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { authenticatedApiRequest } from '@/services/api';
import { useAppTheme } from '@/theme/theme';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';

type Loan = { id: string; direction: 'lent' | 'borrowed'; counterparty: string; outstanding_principal: number; original_principal: number; due_date: string | null; status: 'active' | 'paid' | 'written_off'; interest_type: string; wallets?: { name?: string } | null };
type LoansResponse = { loans: Loan[]; summary: { owed_to_me: number; i_owe: number; net_position: number } };
const peso = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;

export default function LoansScreen() {
  const { colors } = useAppTheme();
  const { visible } = useBalanceVisibility();
  const [data, setData] = useState<LoansResponse | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setError(''); try { setData(await authenticatedApiRequest<LoansResponse>('/api/loans')); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Loans could not load.'); } }, []);
  useEffect(() => { void load(); }, [load]);
  const amount = (value: number) => visible !== false ? peso(value) : '₱•••••';
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><FinancialScreenHeader title="Loans & debt" onBack={() => router.back()} />
    {!data && !error ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : error ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Loans unavailable</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>{error}</Text><Pressable onPress={() => void load()}><Text style={[styles.retry, { color: colors.primary }]}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textSecondary }]}>Principal is tracked separately from income and spending. Only actual interest affects reports.</Text>
      <View style={styles.summaryRow}><Summary label="Owed to me" value={amount(data!.summary.owed_to_me)} color={colors.primary} surface={colors.surface} /><Summary label="I owe" value={amount(data!.summary.i_owe)} color={colors.danger} surface={colors.surface} /></View>
      <View style={[styles.net, { backgroundColor: colors.primarySoft }]}><Text style={[styles.netLabel, { color: colors.textSecondary }]}>NET LOAN POSITION</Text><Text style={[styles.netValue, { color: colors.textPrimary }]}>{amount(data!.summary.net_position)}</Text></View>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>Active and history</Text>
      {data!.loans.length ? data!.loans.map((loan) => <View key={loan.id} style={[styles.loan, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.loanTop}><View><Text style={[styles.title, { color: colors.textPrimary }]}>{loan.counterparty}</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>{loan.direction === 'lent' ? 'They owe you' : 'You owe them'} · {loan.wallets?.name ?? 'Wallet'}</Text></View><Text style={[styles.status, { color: loan.status === 'active' ? colors.primary : colors.textSecondary }]}>{loan.status.replace('_', ' ')}</Text></View><Text style={[styles.balance, { color: colors.textPrimary }]}>{amount(loan.outstanding_principal)}</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>{loan.due_date ? `Due ${loan.due_date}` : 'No due date'} · {loan.interest_type === 'none' ? 'No interest' : `${loan.interest_type} interest`}</Text></View>) : <Text style={[styles.muted, { color: colors.textSecondary }]}>No loans or debt recorded yet.</Text>}
    </ScrollView>}
  </SafeAreaView>;
}
function Summary({ label, value, color, surface }: { label: string; value: string; color: string; surface: string }) { return <View style={[styles.summary, { backgroundColor: surface }]}><Text style={[styles.netLabel, { color }]}>{label.toUpperCase()}</Text><Text style={[styles.summaryValue, { color }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, gap: 12, paddingBottom: 112 }, intro: { fontSize: 13, lineHeight: 19 }, summaryRow: { flexDirection: 'row', gap: 12 }, summary: { flex: 1, minHeight: 96, padding: 15, borderRadius: 18 }, netLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, summaryValue: { marginTop: 10, fontSize: 20, fontWeight: '900' }, net: { padding: 16, borderRadius: 18 }, netValue: { marginTop: 6, fontSize: 24, fontWeight: '900' }, heading: { marginTop: 12, fontSize: 17, fontWeight: '900' }, loan: { padding: 16, borderWidth: 1, borderRadius: 18 }, loanTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, title: { fontSize: 15, fontWeight: '900' }, status: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }, balance: { marginTop: 14, fontSize: 22, fontWeight: '900' }, muted: { marginTop: 4, fontSize: 12, lineHeight: 18 }, card: { margin: 20, padding: 18, borderWidth: 1, borderRadius: 18 }, retry: { marginTop: 14, fontWeight: '900' } });
