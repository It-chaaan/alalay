import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { FileText, Pencil, Repeat, Search, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authenticatedApiRequest } from '@/services/api';
import { fetchWallets } from '@/services/finance';
import { WalletPicker, type Wallet } from '@/components/wallet-picker';
import { FinancialOverviewCard } from '@/components/financial-overview-card';
import { SectionAddButton } from '@/components/header-add-button';
import { deleteFinanceItem, derivedStatus, fetchFinanceItems, markFinanceItemPaid, type FinanceItem } from '@/services/finance';
import { CategoryChipRow, DatePickerField, parseAmount, FinanceFormSheet, FrequencyChips, billCategories, type Frequency, FormTextInput } from '@/components/finance-form';
import { ProfileHeaderButton } from '@/components/profile-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';

const palette = { background: '#F4F7F1', surface: '#FFFFFF', ink: '#11231C', muted: '#5D6C65', accent: '#0F8A6B', accentPale: '#D8EFE2', line: '#DCE8E0', danger: '#B42318' };

type EditorProps = { item: FinanceItem; onClose: () => void; onSaved: () => Promise<void> };
type BillFilter = 'All' | 'Upcoming' | 'Overdue' | 'Paid';

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

function monthName(month: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(`${month}-01T12:00:00`)).toUpperCase();
}

export default function BillsScreen() {
  const { colors } = useAppTheme();
  const bottomNavClearance = useBottomNavClearance();
  const [items, setItems] = useState<FinanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FinanceItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<BillFilter>('All');
  const [query, setQuery] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try { const [financeItems, walletRows] = await Promise.all([fetchFinanceItems(), fetchWallets()]); setItems(financeItems); setWallets(walletRows as Wallet[]); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Bills could not load.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const markPaid = async (item: FinanceItem) => {
    try { await markFinanceItemPaid(item); await refresh(); } catch (requestError) { Alert.alert('Could not update', requestError instanceof Error ? requestError.message : 'Try again.'); }
  };

  const remove = (item: FinanceItem) => Alert.alert('Delete item?', `${item.name} will be removed from your list.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteFinanceItem(item); await refresh(); } catch (requestError) { Alert.alert('Could not delete', requestError instanceof Error ? requestError.message : 'Try again.'); } } }]);

  const bills = items.filter((item) => item.source === 'bill');
  const statuses = bills.map((item) => derivedStatus(item));
  const filteredBills = bills.filter((item) => (filter === 'All' || derivedStatus(item) === filter) && item.name.toLowerCase().includes(query.toLowerCase()));
  const month = currentMonthKey();
  const monthlyBills = bills.filter((item) => item.dueDate.slice(0, 7) === month);
  const totalBillsThisMonth = monthlyBills.reduce((sum, item) => sum + item.amount, 0);
  const monthlyStatuses = monthlyBills.map((item) => derivedStatus(item));
  const dueThisWeek = monthlyBills.filter((item) => { const days = Math.round((new Date(`${item.dueDate}T12:00:00`).getTime() - Date.now()) / 86400000); return days >= 0 && days <= 7 && derivedStatus(item) !== 'Paid'; }).length;
  const overdue = monthlyStatuses.filter((status) => status === 'Overdue').length;
  const unpaid = monthlyBills.filter((item) => derivedStatus(item) !== 'Paid').reduce((sum, item) => sum + item.amount, 0);

  return <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
    <FinancialScreenHeader title="Bills" onBack={() => router.back()} rightAction={<ProfileHeaderButton />} />
    {loading ? <View style={styles.center}><ActivityIndicator color={palette.accent} /><Text style={styles.centerCopy}>Loading bills and subscriptions…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Could not load bills</Text><Text style={styles.cardCopy}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]} showsVerticalScrollIndicator={false}>
      <FinancialOverviewCard eyebrow="BILLS OVERVIEW" period={monthName(month)} primaryLabel="TOTAL BILLS THIS MONTH" value={`₱${Math.round(totalBillsThisMonth).toLocaleString('en-PH')}`} supportingText={`₱${Math.round(unpaid).toLocaleString('en-PH')} unpaid · ${dueThisWeek} due this week · ${overdue} overdue`} supportingTone={overdue > 0 ? 'warning' : 'normal'} />
      <View style={styles.controls}><View style={styles.search}><Search size={17} color={palette.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search bills" placeholderTextColor={palette.muted} style={styles.searchInput} /></View><View style={styles.filters}>{(['All', 'Upcoming', 'Overdue', 'Paid'] as const).map((value) => <Pressable key={value} onPress={() => setFilter(value)} style={({ pressed }) => [styles.filter, filter === value && styles.filterActive, pressed && styles.filterPressed]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value} {value === 'All' ? bills.length : statuses.filter((status) => status === value).length}</Text></Pressable>)}</View></View>
      <View style={styles.listSection}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Bills</Text><SectionAddButton label="Add bill" onPress={() => setCreating(true)} /></View>{filteredBills.length ? filteredBills.map((item) => <BillCard key={`${item.source}-${item.id}`} item={item} onPaid={() => void markPaid(item)} onEdit={() => setEditing(item)} onDelete={() => remove(item)} />) : <View style={styles.card}><Text style={styles.cardTitle}>{bills.length ? 'No matching bills' : 'No bills yet'}</Text><Text style={styles.cardCopy}>Add a bill to start tracking due dates and payment status.</Text></View>}</View>
    </ScrollView>}
    {editing && <BillEditor wallets={wallets} item={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); }} />}
    {creating && <NewBillForm wallets={wallets} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await refresh(); }} />}
  </SafeAreaView>;
}

function BillCard({ item, onPaid, onEdit, onDelete }: { item: FinanceItem; onPaid: () => void; onEdit: () => void; onDelete: () => void }) {
  const status = derivedStatus(item);
  return <View style={styles.billCard}><View style={styles.billTop}><View style={styles.billIcon}>{item.source === 'subscription' ? <Repeat size={19} color={palette.accent} /> : <FileText size={19} color={palette.accent} />}</View><View style={styles.billMain}><Text style={styles.billName}>{item.name}</Text><Text style={styles.billMeta}>{item.source === 'subscription' ? 'Subscription' : item.custom_category || item.category} · Due {item.dueDate}</Text></View><Text style={styles.billAmount}>₱{Math.round(item.amount).toLocaleString('en-PH')}</Text></View><View style={styles.billBottom}><Text style={[styles.status, status === 'Overdue' && styles.statusOverdue, status === 'Paid' && styles.statusPaid]}>{status}</Text><View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} onPress={onEdit} style={styles.actionButton}><Pencil size={16} color={palette.muted} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.name}`} onPress={onDelete} style={styles.actionButton}><Trash2 size={16} color={palette.danger} /></Pressable>{status !== 'Paid' && <Pressable accessibilityRole="button" onPress={onPaid} style={styles.paidButton}><Text style={styles.paidText}>{item.source === 'subscription' ? 'Mark renewed' : 'Mark paid'}</Text></Pressable>}</View></View></View>;
}

function BillEditor({ wallets, item, onClose, onSaved }: EditorProps & { wallets: Wallet[] }) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [category, setCategory] = useState(item.category === 'Subscriptions' ? 'Entertainment' : item.category);
  const [customCategory, setCustomCategory] = useState('');
  const [date, setDate] = useState(item.dueDate);
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>(item.frequency ?? 'monthly');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [walletId, setWalletId] = useState<string | null>(item.wallet_id ?? null);

  const save = async () => {
    const parsedAmount = Number(amount);
    if (!name.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Enter a name, valid amount, and date as YYYY-MM-DD.'); return; }
    if (item.source === 'bill' && (!category.trim() || !walletId)) { setError('Choose a category and wallet before saving.'); return; }
    if (item.source === 'bill' && category === 'Other' && !customCategory.trim()) { setError('Please specify a category.'); return; }
    setSaving(true); setError('');
    try {
      if (item.source === 'bill') await authenticatedApiRequest(`/api/bills/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: name.trim(), amount: parsedAmount, category: category.trim(), custom_category: category === 'Other' ? customCategory.trim() : null, due_date: date, recurring: item.recurring, frequency: item.recurring ? frequency : null, wallet_id: walletId }) });
      else await authenticatedApiRequest(`/api/subscriptions/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), amount: parsedAmount, category: category.trim(), custom_category: category === 'Other' ? customCategory.trim() : null, renewal_date: date, billing_cycle: frequency, wallet_id: walletId }) });
      await onSaved();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save this item.'); } finally { setSaving(false); }
  };

  return <View style={styles.overlay}><Pressable accessibilityLabel="Close editor" onPress={onClose} style={styles.dismiss} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editorKeyboard}><ScrollView contentContainerStyle={styles.editor} keyboardShouldPersistTaps="handled"><View style={styles.editorHeader}><View><Text style={styles.eyebrow}>EDIT {item.source === 'subscription' ? 'SUBSCRIPTION' : 'BILL'}</Text><Text style={styles.editorTitle}>{item.name}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable></View><TextInput accessibilityLabel="Name" value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={palette.muted} style={styles.input} /><TextInput accessibilityLabel="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={palette.muted} style={styles.input} />{item.source === 'bill' && <TextInput accessibilityLabel="Category" value={category} onChangeText={setCategory} placeholder="Category" placeholderTextColor={palette.muted} style={styles.input} />}{item.source === 'bill' && category === 'Other' && <TextInput accessibilityLabel="Specify category" value={customCategory} onChangeText={setCustomCategory} placeholder="Specify category" placeholderTextColor={palette.muted} style={styles.input} />}<View style={styles.frequencyRow}>{(['monthly', 'weekly', 'quarterly', 'yearly'] as const).map((value) => <Pressable key={value} onPress={() => setFrequency(value)} style={[styles.frequencyChip, frequency === value && styles.frequencyActive]}><Text style={[styles.frequencyText, frequency === value && styles.frequencyTextActive]}>{value}</Text></Pressable>)}</View><TextInput accessibilityLabel="Due date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={styles.input} />{item.source === 'bill' && <WalletPicker wallets={wallets} value={walletId} onChange={setWalletId} required label="Paid from" />}{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={styles.saveButton}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save changes</Text>}</Pressable></ScrollView></KeyboardAvoidingView></View>;
}

function NewBillForm({ wallets, onClose, onSaved }: { wallets: Wallet[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('Electricity');
  const [customCategory, setCustomCategory] = useState('');
  const [frequency, setFrequency] = useState<Frequency | 'one-time'>('one-time');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);

  const save = async () => {
    const value = parseAmount(amount);
    if (!name.trim() || value === null || value <= 0 || !category || !walletId) {
      setError('Enter a biller name and a valid amount.');
      return;
    }
    if (category === 'Other' && !customCategory.trim()) { setError('Please specify a category.'); return; }
    setSaving(true);
    setError('');
    try {
      await authenticatedApiRequest('/api/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: name.trim(), amount: value, category, custom_category: category === 'Other' ? customCategory.trim() : null, due_date: date, recurring: frequency !== 'one-time', frequency: frequency === 'one-time' ? null : frequency, status: 'unpaid', wallet_id: walletId }) });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this bill.');
    } finally {
      setSaving(false);
    }
  };

  return <FinanceFormSheet title="Add bill" eyebrow="BILLS" amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel="Save bill" onSave={() => void save()} onClose={onClose}>
    <FormTextInput label="Biller name" value={name} onChangeText={setName} placeholder="e.g. Meralco" />
    <CategoryChipRow value={category} onChange={setCategory} options={billCategories} label="Category *" customValue={customCategory} onCustomValueChange={setCustomCategory} customLabel="Specify category *" />
    <WalletPicker wallets={wallets} value={walletId} onChange={setWalletId} required label="Paid from" />
    <DatePickerField label="Due date" value={date} onChange={setDate} />
    <FrequencyChips value={frequency} onChange={setFrequency} includeOneTime />
  </FinanceFormSheet>;
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 10, borderRadius: 18, backgroundColor: palette.accent }, addText: { color: '#fff', fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 12 }, stat: { flex: 1, padding: 12, borderRadius: 15, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }, statLabel: { color: palette.muted, fontSize: 10, fontWeight: '700' }, statValue: { marginTop: 6, color: palette.ink, fontSize: 15, fontWeight: '900' }, controls: { marginTop: 22 }, search: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 46, marginBottom: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }, searchInput: { flex: 1, color: palette.ink, fontSize: 13 }, filters: { flexDirection: 'row', alignItems: 'center', padding: 3, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.68)', borderWidth: 1, borderColor: 'rgba(220,232,224,0.9)', overflow: 'hidden' }, filter: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderRadius: 18 }, filterActive: { backgroundColor: palette.accent }, filterPressed: { opacity: 0.8 }, filterText: { color: palette.muted, fontSize: 11, fontWeight: '800' }, filterTextActive: { color: '#FFFFFF' }, listSection: { marginTop: 24 }, sectionTitle: { marginBottom: 11, color: palette.ink, fontSize: 16, fontWeight: '900' },
  safeArea: { flex: 1, backgroundColor: palette.background }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.line }, backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }, titleWrap: { flex: 1, marginLeft: 8 }, eyebrow: { color: palette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { marginTop: 3, color: palette.ink, fontSize: 24, fontWeight: '900' }, iconCircle: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: palette.accentPale }, content: { padding: 20, paddingBottom: 36 }, intro: { marginBottom: 16, color: palette.muted, fontSize: 14, lineHeight: 20 }, billCard: { marginBottom: 12, padding: 15, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }, billTop: { flexDirection: 'row', alignItems: 'center' }, billIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: palette.accentPale }, billMain: { flex: 1, marginLeft: 11 }, billName: { color: palette.ink, fontSize: 14, fontWeight: '900' }, billMeta: { marginTop: 4, color: palette.muted, fontSize: 11 }, billAmount: { color: palette.ink, fontSize: 14, fontWeight: '900' }, billBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 }, status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, color: palette.accent, backgroundColor: palette.accentPale, fontSize: 10, fontWeight: '900', overflow: 'hidden' }, statusOverdue: { color: palette.danger, backgroundColor: '#FCE8E6' }, statusPaid: { color: palette.muted, backgroundColor: '#EEF2EF' }, actions: { flexDirection: 'row', alignItems: 'center', gap: 5 }, actionButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.background }, paidButton: { minHeight: 34, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.accent }, paidText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, centerCopy: { marginTop: 10, color: palette.muted, fontSize: 13 }, card: { margin: 20, padding: 18, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }, cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' }, cardCopy: { marginTop: 8, color: palette.muted, fontSize: 14, lineHeight: 21 }, retry: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: palette.accentPale }, retryText: { color: palette.accent, fontSize: 12, fontWeight: '900' }, overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end' }, dismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,35,28,0.28)' }, editorKeyboard: { maxHeight: '88%' }, editor: { padding: 20, paddingBottom: 30, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: palette.surface }, editorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }, editorTitle: { marginTop: 4, color: palette.ink, fontSize: 20, fontWeight: '900' }, closeText: { color: palette.ink, fontSize: 30, lineHeight: 30 }, input: { minHeight: 50, marginBottom: 11, paddingHorizontal: 15, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.background, color: palette.ink, fontSize: 14 }, frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 11 }, frequencyChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.line }, frequencyActive: { backgroundColor: palette.accentPale, borderColor: palette.accent }, frequencyText: { color: palette.muted, fontSize: 12, fontWeight: '700' }, frequencyTextActive: { color: palette.accent, fontWeight: '900' }, error: { marginBottom: 10, color: palette.danger, fontSize: 12, fontWeight: '700' }, saveButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: palette.accent }, saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, pressed: { opacity: 0.76 },
});
