import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { MoreHorizontal, Search, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChipRow, DatePickerField, parseAmount, FinanceFormSheet, FrequencyChips, subscriptionCategories, formPalette, FormTextInput, type Frequency } from '@/components/finance-form';
import { FinancialOverviewCard } from '@/components/financial-overview-card';
import { SectionAddButton } from '@/components/header-add-button';
import { ItemManagementSheet } from '@/components/item-management-sheet';
import { WalletPicker, type Wallet } from '@/components/wallet-picker';
import { authenticatedApiRequest } from '@/services/api';
import { fetchWallets, notifyFinancialMutation, subscribeFinancialMutations } from '@/services/finance';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { BOTTOM_NAV_CLEARANCE } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';
import { BrandLogo } from '@/components/brand-logo';
import { useToast } from '@/components/toast-provider';
import { filterSubscriptions } from '@/utils/subscription-search';

type Sub = { id: string; name: string; amount: number | string; renewal_date: string; billing_cycle: Frequency; auto_renew: boolean; category?: string | null; custom_category?: string | null; logo_url?: string | null; wallet_id?: string | null; current_occurrence_date?: string; current_status?: 'paid' | 'upcoming' | 'due_today' | 'overdue'; next_renewal_date?: string | null };
type Income = { amount: number | string; is_recurring: boolean; frequency?: string };

function monthly(sub: Sub) { const amount = Number(sub.amount); return sub.billing_cycle === 'weekly' ? amount * 52 / 12 : sub.billing_cycle === 'quarterly' ? amount / 3 : sub.billing_cycle === 'yearly' ? amount / 12 : amount; }

export default function Subscriptions() {
  const { colors } = useAppTheme();
  const toast = useToast();
  styles = makeStyles({ ...formPalette, background: colors.background, surface: colors.surfaceElevated, ink: colors.textPrimary, muted: colors.textSecondary, accent: colors.primary, accentDark: colors.primary, accentPale: colors.primarySoft, balance: colors.balance, line: colors.border });
  const [rows, setRows] = useState<Sub[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sub | null>(null);
  const [managing, setManaging] = useState<Sub | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { const [subs, entries, walletRows] = await Promise.all([authenticatedApiRequest<Sub[]>('/api/subscriptions'), authenticatedApiRequest<Income[]>('/api/income'), fetchWallets()]); setRows(subs); setIncome(entries); setWallets(walletRows as Wallet[]); } catch (e) { setError(e instanceof Error ? e.message : 'Subscriptions could not load.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); return subscribeFinancialMutations(() => { void refresh(); }); }, [refresh]);

  const monthlyTotal = rows.reduce((sum, row) => sum + monthly(row), 0);
  const yearly = monthlyTotal * 12;
  const monthlyIncome = income.filter((row) => row.is_recurring).reduce((sum, row) => sum + Number(row.amount), 0);
  const percent = monthlyIncome > 0 ? monthlyTotal / monthlyIncome * 100 : null;
  const visibleRows = useMemo(() => filterSubscriptions(rows, wallets, query), [rows, wallets, query]);
  const toggle = async (row: Sub) => { try { await authenticatedApiRequest(`/api/subscriptions/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auto_renew: !row.auto_renew }) }); notifyFinancialMutation(); await refresh(); toast.success(`Subscription ${row.auto_renew ? 'paused' : 'resumed'}`); } catch { toast.error("Couldn't update subscription. Please try again."); } };
  const remove = async (row: Sub) => { setDeleting(true); setDeleteError(''); try { await authenticatedApiRequest(`/api/subscriptions/${row.id}`, { method: 'DELETE' }); notifyFinancialMutation(); setManaging(null); await refresh(); toast.success('Subscription deleted successfully'); } catch (e) { setDeleteError('Couldn\'t delete subscription. Please try again.'); throw e; } finally { setDeleting(false); } };

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><FinancialScreenHeader title="Subscriptions" onBack={() => router.back()} rightAction={<NotificationHeaderButton />} />{loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={[styles.muted, { color: colors.textSecondary }]}>Loading subscriptions…</Text></View> : error ? <View style={[styles.card, { backgroundColor: colors.surfaceTranslucent, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Subscriptions unavailable</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>{error}</Text><Pressable onPress={() => void refresh()} style={[styles.retry, { backgroundColor: colors.primarySoft }]}><Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><FinancialOverviewCard title="SUBSCRIPTIONS OVERVIEW" context={new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date()).toUpperCase()} value={`₱${Math.round(monthlyTotal).toLocaleString('en-PH')}/mo`} supportingInfo={rows.length ? `₱${Math.round(yearly).toLocaleString('en-PH')}/year · ${percent === null ? 'Income unavailable' : `${percent.toFixed(1)}% of income`}` : 'No active subscriptions'} accessibilityLabel={`Subscriptions overview. Monthly subscriptions: ₱${Math.round(monthlyTotal).toLocaleString('en-PH')}.`} /><View style={styles.listSection}><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Active subscriptions</Text><SectionAddButton label="Add subscription" onPress={() => setOpen(true)} /></View><View style={[styles.search, { backgroundColor: colors.surfaceInput, borderColor: searchFocused || query ? colors.primary : colors.border }]}><Search size={18} color={colors.textSecondary} /><TextInput accessibilityLabel="Search subscriptions" value={query} onChangeText={setQuery} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="Search subscriptions..." placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.textPrimary }]} returnKeyType="search" autoCorrect={false} /><>{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear subscription search" hitSlop={8} onPress={() => setQuery('')} style={styles.clearSearch}><X size={18} color={colors.textSecondary} /></Pressable> : null}</></View>{rows.length && !visibleRows.length ? <View style={[styles.card, styles.emptySearch, { backgroundColor: colors.surfaceTranslucent, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.textPrimary }]}>No subscriptions found</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>Try a different search.</Text></View> : visibleRows.length ? visibleRows.map((row) => <View key={row.id} style={[styles.subCard, { backgroundColor: colors.surfaceTranslucent, borderColor: colors.border }]}><View style={styles.subTop}><BrandLogo name={row.name} entity="subscription" size={42} /><View style={styles.main}><Text style={[styles.name, { color: colors.textPrimary }]}>{row.name}</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>₱{Math.round(Number(row.amount)).toLocaleString('en-PH')}/{row.billing_cycle === 'yearly' ? 'yr' : row.billing_cycle === 'quarterly' ? 'qtr' : row.billing_cycle === 'weekly' ? 'wk' : 'mo'}</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>Renews {row.renewal_date}</Text><Text style={[styles.muted, { color: row.wallet_id ? colors.textSecondary : colors.warning }]}>{row.wallet_id ? wallets.find((wallet) => wallet.id === row.wallet_id)?.name ?? 'Payment wallet' : 'Payment wallet needed'}</Text></View><View style={styles.cardActions}><Pressable accessibilityLabel={`Options for ${row.name}`} onPress={() => { setDeleteError(''); setManaging(row); }} style={[styles.more, { backgroundColor: colors.surfaceInput }]}><MoreHorizontal size={19} color={colors.textSecondary} /></Pressable><Pressable accessibilityRole="switch" accessibilityState={{ checked: row.auto_renew }} onPress={() => void toggle(row)} style={[styles.toggle, { backgroundColor: row.auto_renew ? colors.primary : colors.surfaceSecondary }]}><View style={[styles.knob, { backgroundColor: colors.textOnPrimary }, row.auto_renew && styles.knobOn]} /></Pressable></View></View></View>) : <View style={[styles.card, { backgroundColor: colors.surfaceTranslucent, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.textPrimary }]}>No subscriptions yet</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>Add a recurring service to track renewals.</Text></View>}</View></ScrollView>}{open && <SubscriptionForm wallets={wallets} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refresh(); }} />}{editing && <SubscriptionForm initial={editing} wallets={wallets} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); }} />}{managing && <ItemManagementSheet visible title="Subscription" itemName={managing.name} deleteDescription="This subscription will be removed. Past generated expenses will remain in your financial history." onClose={() => setManaging(null)} onEdit={() => setEditing(managing)} onDelete={() => remove(managing)} deleting={deleting} error={deleteError} />}</SafeAreaView>;
}

function SubscriptionForm({ wallets, onClose, onSaved, initial }: { wallets: Wallet[]; onClose: () => void; onSaved: () => Promise<void>; initial?: Sub }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [date, setDate] = useState(initial?.renewal_date ?? new Date().toISOString().slice(0, 10));
  const [cycle, setCycle] = useState<Frequency>(initial?.billing_cycle ?? 'monthly');
  const [category, setCategory] = useState(initial?.category ?? 'Other');
  const [customCategory, setCustomCategory] = useState(initial?.custom_category ?? '');
  const [reminder, setReminder] = useState(initial?.auto_renew ?? true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(initial?.wallet_id ?? null);

  const save = async () => {
    const value = parseAmount(amount);
    if (!name.trim() || value === null || value <= 0) { setError('Enter a service name and a valid amount.'); return; }
    if (!category || !walletId) { setError('Choose a category and wallet before saving.'); return; }
    if (category === 'Other' && !customCategory.trim()) { setError('Please specify a category.'); return; }
    setSaving(true); setError('');
    try {
      const path = initial ? `/api/subscriptions/${initial.id}` : '/api/subscriptions';
      await authenticatedApiRequest(path, { method: initial ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), amount: value, category, custom_category: category === 'Other' ? customCategory.trim() : null, renewal_date: date, billing_cycle: cycle, auto_renew: reminder, wallet_id: walletId }) });
      notifyFinancialMutation();
      await onSaved();
      toast.success(initial ? 'Subscription updated successfully' : 'Subscription added successfully');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this subscription.'); } finally { setSaving(false); }
  };

  return <FinanceFormSheet title={initial ? 'Edit subscription' : 'Add subscription'} eyebrow="SUBSCRIPTIONS" amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel={initial ? 'Save changes' : 'Save subscription'} onSave={() => void save()} onClose={onClose}><FormTextInput label="Service name" value={name} onChangeText={setName} placeholder="e.g. Netflix" /><CategoryChipRow label="Subscription category *" value={category} onChange={setCategory} options={subscriptionCategories} customValue={customCategory} onCustomValueChange={setCustomCategory} customLabel="Specify category *" /><WalletPicker wallets={wallets} value={walletId} onChange={setWalletId} required label="Paid from" /><DatePickerField label="Renewal date" value={date} onChange={setDate} /><FrequencyChips value={cycle} onChange={(value) => { if (value !== 'one-time') setCycle(value); }} /><View style={styles.reminder}><View style={styles.reminderCopy}><Text style={styles.reminderTitle}>Renewal reminder</Text><Text style={styles.muted}>Keep this service in your upcoming payments.</Text></View><Switch value={reminder} onValueChange={setReminder} trackColor={{ false: '#D7E1DC', true: formPalette.accent }} thumbColor="#FFFFFF" /></View></FinanceFormSheet>;
}

function makeStyles(themePalette: typeof formPalette) { const formPalette = themePalette; return StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11 },
  search: { minHeight: 48, marginBottom: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, borderWidth: 1 }, searchInput: { flex: 1, minHeight: 46, paddingVertical: 0, fontSize: 14 }, clearSearch: { width: 28, height: 40, alignItems: 'center', justifyContent: 'center' }, emptySearch: { marginBottom: 11 },
  safe: { flex: 1, backgroundColor: formPalette.background }, header: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line }, back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, titleWrap: { flex: 1, marginLeft: 8 }, eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { marginTop: 3, color: formPalette.ink, fontSize: 22, fontWeight: '900' }, content: { padding: 20, paddingBottom: BOTTOM_NAV_CLEARANCE }, listSection: { marginTop: 0 }, sectionTitle: { marginBottom: 11, color: formPalette.ink, fontSize: 16, fontWeight: '900' }, subCard: { marginBottom: 11, padding: 15, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, subTop: { flexDirection: 'row', alignItems: 'center' }, icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: formPalette.accentPale }, main: { flex: 1, marginLeft: 11 }, name: { color: formPalette.ink, fontSize: 15, fontWeight: '900' }, muted: { marginTop: 4, color: formPalette.muted, fontSize: 12, lineHeight: 18 }, cardActions: { alignItems: 'flex-end', gap: 8 }, more: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: formPalette.background }, toggle: { width: 44, height: 26, padding: 3, justifyContent: 'center', borderRadius: 14, backgroundColor: '#D7E1DC' }, toggleOn: { backgroundColor: formPalette.accent }, knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }, knobOn: { alignSelf: 'flex-end' }, card: { marginTop: 0, padding: 18, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, cardTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, retry: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: formPalette.accentPale }, retryText: { color: formPalette.accent, fontSize: 12, fontWeight: '900' }, reminder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: 15, borderRadius: 17, backgroundColor: formPalette.background }, reminderCopy: { flex: 1, paddingRight: 10 }, reminderTitle: { color: formPalette.ink, fontSize: 14, fontWeight: '900' }, pressed: { opacity: 0.72 },
}); }
let styles = makeStyles(formPalette);
