import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowUpRight, BriefcaseBusiness, Building2, MoreHorizontal, Send, WalletCards } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChipRow, DatePickerField, parseAmount, FinanceFormSheet, FormTextInput, formPalette, IncomeFrequencyChips, type IncomeFrequency } from '@/components/finance-form';
import { SectionAddButton } from '@/components/header-add-button';
import { FinancialOverviewCard } from '@/components/financial-overview-card';
import { WalletPicker, type Wallet } from '@/components/wallet-picker';
import { authenticatedApiRequest } from '@/services/api';
import { fetchWallets } from '@/services/finance';
import { ProfileHeaderButton } from '@/components/profile-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';

type Income = { id: string; source: string; type: string; amount: number | string; date: string; is_recurring: boolean; frequency?: string; wallet_id: string };
type IncomeSummary = { this_month: number; monthly_sources: number; actual_transactions: number };

const incomeTypes = [
  { label: 'Salary', icon: Building2 },
  { label: 'Freelance', icon: BriefcaseBusiness },
  { label: 'Business', icon: WalletCards },
  { label: 'Commission', icon: WalletCards }, { label: 'Bonus', icon: WalletCards }, { label: 'Overtime', icon: WalletCards },
  { label: 'Investment', icon: WalletCards }, { label: 'Interest', icon: WalletCards }, { label: 'Dividend', icon: WalletCards }, { label: 'Rental Income', icon: Building2 },
  { label: 'Allowance', icon: WalletCards },
  { label: 'Remittance', icon: Send },
  { label: 'Pension', icon: WalletCards }, { label: 'Government Benefit', icon: WalletCards }, { label: 'Gift', icon: WalletCards }, { label: 'Refund', icon: WalletCards },
  { label: 'Side Hustle', icon: BriefcaseBusiness }, { label: 'Other', icon: MoreHorizontal },
];

const incomeTypeValues = Object.fromEntries(incomeTypes.map(({ label }) => [label, label.toLowerCase().replace(/[^a-z0-9]+/g, '_')])) as Record<string, string>;

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

function monthName(month: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(`${month}-01T12:00:00`)).toUpperCase();
}

export default function IncomeScreen() {
  const bottomNavClearance = useBottomNavClearance();
  const [rows, setRows] = useState<Income[]>([]);
  const [summary, setSummary] = useState<IncomeSummary>({ this_month: 0, monthly_sources: 0, actual_transactions: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [income, incomeSummary, walletRows] = await Promise.all([
        authenticatedApiRequest<Income[]>('/api/income'),
        authenticatedApiRequest<IncomeSummary>('/api/income/summary'),
        fetchWallets(),
      ]);
      setRows(income);
      setSummary(incomeSummary);
      setWallets(walletRows as Wallet[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Income could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const currentMonth = currentMonthKey();
  const supportingText = summary.monthly_sources > 0
    ? `${summary.monthly_sources} monthly income source${summary.monthly_sources === 1 ? '' : 's'}${summary.actual_transactions ? ` · ${summary.actual_transactions} recorded transaction${summary.actual_transactions === 1 ? '' : 's'}` : ''}`
    : summary.actual_transactions > 0
      ? `${summary.actual_transactions} recorded income transaction${summary.actual_transactions === 1 ? '' : 's'} this month`
      : 'No income recorded this month';

  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
    <FinancialScreenHeader title="Income" onBack={() => router.back()} rightAction={<ProfileHeaderButton />} />
    {loading ? <View style={styles.center}><ActivityIndicator color={formPalette.accent} /><Text style={styles.muted}>Loading income…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Income unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]} showsVerticalScrollIndicator={false}><FinancialOverviewCard eyebrow="INCOME OVERVIEW" period={monthName(currentMonth)} primaryLabel="TOTAL INCOME" value={`₱${Math.round(Number(summary.this_month)).toLocaleString('en-PH')}`} supportingText={supportingText} /><View style={styles.listSection}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent income</Text><SectionAddButton label="Add income" onPress={() => setOpen(true)} /></View>{rows.length ? rows.map((row) => <View key={row.id} style={styles.row}><View style={styles.icon}><ArrowUpRight size={18} color={formPalette.accent} /></View><View style={styles.main}><Text style={styles.rowTitle}>{row.source}</Text><Text style={styles.muted}>{row.type} · {row.is_recurring ? row.frequency ?? 'Recurring' : 'One-time'} · {row.date}</Text></View><Text style={styles.amount}>₱{Math.round(Number(row.amount)).toLocaleString('en-PH')}</Text></View>) : <View style={styles.card}><Text style={styles.cardTitle}>No income yet</Text><Text style={styles.muted}>No income records yet.</Text></View>}</View></ScrollView>}
    {open && <IncomeForm wallets={wallets} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refresh(); }} />}
  </SafeAreaView>;
}

function IncomeForm({ wallets, onClose, onSaved }: { wallets: Wallet[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [typeLabel, setTypeLabel] = useState('Salary');
  const [customType, setCustomType] = useState('');
  const [frequency, setFrequency] = useState<IncomeFrequency>('monthly');
  const [recurring, setRecurring] = useState(true);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const value = parseAmount(amount);
    if (!source.trim() || value === null || value <= 0 || !walletId) {
      setError(!walletId ? 'Choose where this income will be deposited.' : 'Enter a source and a valid amount.');
      return;
    }
    if (typeLabel === 'Other' && !customType.trim()) { setError('Please specify an income type.'); return; }
    setSaving(true);
    setError('');
    try {
      await authenticatedApiRequest('/api/income', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: source.trim(), type: incomeTypeValues[typeLabel], custom_type: typeLabel === 'Other' ? customType.trim() : null, amount: value, date, is_recurring: recurring, frequency: recurring ? frequency : null, wallet_id: walletId }) });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this income.');
    } finally {
      setSaving(false);
    }
  };

  return <FinanceFormSheet title="Add income" eyebrow="MONEY IN" amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel="Save income" onSave={() => void save()} onClose={onClose}>
    <FormTextInput label="Source" value={source} onChangeText={setSource} placeholder="e.g. Freelance client" />
    <CategoryChipRow label="Income type" value={typeLabel} onChange={setTypeLabel} options={incomeTypes} />
    {typeLabel === 'Other' && <FormTextInput label="Specify income type *" value={customType} onChangeText={setCustomType} placeholder="e.g. Scholarship" />}
    <WalletPicker wallets={wallets} value={walletId} onChange={setWalletId} required label="Deposit to" />
    <DatePickerField label="Date" value={date} onChange={setDate} />
    <View style={styles.recurring}><View style={styles.recurringCopy}><Text style={styles.recurringTitle}>Recurring income</Text><Text style={styles.muted}>{recurring ? 'Automatically grouped by frequency.' : 'Save this as a one-time entry.'}</Text></View><Switch accessibilityLabel="Recurring income" value={recurring} onValueChange={setRecurring} trackColor={{ false: '#D7E1DC', true: formPalette.accent }} thumbColor="#FFFFFF" /></View>
    {recurring && <IncomeFrequencyChips value={frequency} onChange={setFrequency} />}
  </FinanceFormSheet>;
}

const styles = StyleSheet.create({ sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11 },
  safeArea: { flex: 1, backgroundColor: formPalette.background }, header: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line }, back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, titleWrap: { flex: 1, marginLeft: 8 }, eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { marginTop: 3, color: formPalette.ink, fontSize: 24, fontWeight: '900' }, content: { padding: 20, paddingTop: 20, paddingBottom: 40 }, listSection: { marginTop: 24 }, sectionTitle: { marginBottom: 11, color: formPalette.ink, fontSize: 16, fontWeight: '900' }, row: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10, borderRadius: 17, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: formPalette.accentPale }, main: { flex: 1, marginLeft: 11 }, rowTitle: { color: formPalette.ink, fontWeight: '900', fontSize: 14 }, amount: { color: formPalette.accent, fontWeight: '900' }, muted: { marginTop: 5, color: formPalette.muted, fontSize: 12, lineHeight: 18 }, card: { marginTop: 0, padding: 18, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, cardTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' }, retry: { alignSelf: 'flex-start', marginTop: 14, padding: 10, borderRadius: 15, backgroundColor: formPalette.accentPale }, retryText: { color: formPalette.accent, fontWeight: '900' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, recurring: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: 15, borderRadius: 17, backgroundColor: formPalette.background }, recurringCopy: { flex: 1, paddingRight: 10 }, recurringTitle: { color: formPalette.ink, fontSize: 14, fontWeight: '900' }, pressed: { opacity: 0.72 },
});
