import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { MoreHorizontal, Plus, Repeat, ScanLine, Search, ShoppingCart } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { billCategories, DatePickerField, parseAmount, expenseCategories, ExpenseCategoryPicker, FinanceFormSheet, FormTextInput, formPalette, PaymentMethodChips } from '@/components/finance-form';
import { authenticatedApiRequest } from '@/services/api';
import { fetchExpenses, fetchWallets, type BillRecord, type ExpenseRecord } from '@/services/finance';
import { FinancialOverviewCard } from '@/components/financial-overview-card';
import { WalletPickerModal, type Wallet } from '@/components/wallet-picker';
import { ProfileHeaderButton } from '@/components/profile-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';

type ExpenseItem = ExpenseRecord & { source: 'expense' | 'bill'; payment_method: string; created_at?: string };
type ExpenseGroup = { date: string; subtotal: number; items: ExpenseItem[] };
type DashboardSummary = { monthly_expenses: number; monthly_expenses_delta_percent: number | null };

const categoryColors: Record<string, string> = { Food: '#E8775D', Groceries: '#D89B1D', Transport: '#5D8FC4', Bills: '#0F8A6B', Entertainment: '#8D70AD', Home: '#4D9A73', Other: '#8B8B8B' };

function peso(value: number) { return '₱' + Math.round(value).toLocaleString('en-PH'); }

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? String(new Date().getFullYear());
  const month = parts.find((part) => part.type === 'month')?.value ?? String(new Date().getMonth() + 1).padStart(2, '0');
  return year + '-' + month;
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(date.slice(0, 10) + 'T12:00:00'));
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(month + '-01T12:00:00'));
}

function categoryIcon(name: string) {
  const normalized = name.toLowerCase();
  if (normalized === 'subscriptions') return Repeat;
  return [...expenseCategories, ...billCategories].find((option) => option.label.toLowerCase() === normalized)?.icon ?? MoreHorizontal;
}

function categoryColor(name: string, index = 0) {
  return categoryColors[name] ?? [formPalette.accent, '#5D8FC4', '#8D70AD', '#D89B1D'][index % 4];
}

function groupByDate(items: ExpenseItem[]): ExpenseGroup[] {
  const groups = new Map<string, ExpenseGroup>();
  items.slice().sort((left, right) => (right.date + (right.created_at ?? right.id)).localeCompare(left.date + (left.created_at ?? left.id))).forEach((item) => {
    const date = item.date.slice(0, 10);
    const group = groups.get(date);
    if (group) {
      group.items.push(item);
      group.subtotal += Number(item.amount) || 0;
    } else {
      groups.set(date, { date, subtotal: Number(item.amount) || 0, items: [item] });
    }
  });
  return Array.from(groups.values());
}

function mergeExpenseRows(expenses: ExpenseRecord[], bills: BillRecord[]): ExpenseItem[] {
  return [
    ...expenses.map((expense) => ({ ...expense, source: 'expense' as const, payment_method: expense.payment_method || 'other' })),
    ...bills.filter((bill) => bill.status === 'paid').map((bill) => ({
      id: bill.id,
      merchant: bill.title,
      amount: bill.amount,
      category: bill.category,
      date: bill.paid_at?.slice(0, 10) ?? bill.due_date,
      payment_method: 'bill',
      source: 'bill' as const,
      created_at: bill.paid_at ?? undefined,
    })),
  ];
}

export default function ExpensesScreen() {
  const { colors } = useAppTheme();
  styles = makeStyles({ ...formPalette, background: colors.background, surface: colors.surfaceElevated, ink: colors.textPrimary, muted: colors.textSecondary, accent: colors.primary, accentDark: colors.primary, accentPale: colors.primarySoft, balance: colors.balance, line: colors.border });
  const bottomNavClearance = useBottomNavClearance();
  const month = currentMonthKey();
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [expenses, bills, dashboardSummary, walletRows] = await Promise.all([
        fetchExpenses(),
        authenticatedApiRequest<BillRecord[]>('/api/bills'),
        authenticatedApiRequest<DashboardSummary>('/api/dashboard/summary'),
        fetchWallets(),
      ]);
      setItems(mergeExpenseRows(expenses, bills));
      setSummary(dashboardSummary);
      setWallets(walletRows as Wallet[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Expenses could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const monthItems = useMemo(() => items.filter((item) => item.date.slice(0, 7) === month), [items, month]);
  const filteredItems = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? monthItems.filter((item) => item.merchant.toLowerCase().includes(value)) : monthItems;
  }, [monthItems, query]);
  const rowTotal = monthItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const total = summary?.monthly_expenses ?? rowTotal;
  const groups = useMemo(() => groupByDate(filteredItems), [filteredItems]);
  const hasAnyExpenses = items.length > 0;

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
    <FinancialScreenHeader title="Expenses" onBack={() => router.back()} rightAction={<ProfileHeaderButton />} />
    {loading ? <View style={styles.center}><ActivityIndicator color={formPalette.accent} /><Text style={styles.centerCopy}>Loading expenses…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Expenses unavailable</Text><Text style={styles.cardCopy}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]} showsVerticalScrollIndicator={false}>
      <FinancialOverviewCard title="EXPENSES OVERVIEW" context={monthLabel(month).split(' ')[0].toUpperCase()} value={peso(total)} supportingInfo={`${monthItems.length} transaction${monthItems.length === 1 ? '' : 's'} this month${summary?.monthly_expenses_delta_percent !== null && summary?.monthly_expenses_delta_percent !== undefined ? ` · ${summary.monthly_expenses_delta_percent > 0 ? '↑' : summary.monthly_expenses_delta_percent < 0 ? '↓' : '→'} ${Math.abs(summary.monthly_expenses_delta_percent).toFixed(1)}% vs last month` : ''}`} accessibilityLabel={`Expenses overview. Total spent: ${peso(total)}.`} />
      <View style={styles.actionRow}><Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/ocr')} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><ScanLine size={17} color={formPalette.accent} /><Text style={styles.secondaryActionText}>Scan receipt</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Plus size={18} color="#fff" /><Text style={styles.primaryActionText}>Log expense</Text></Pressable></View>
      <View style={styles.search}><Search size={17} color={formPalette.muted} /><TextInput accessibilityLabel="Search expenses" value={query} onChangeText={setQuery} placeholder="Search expenses" placeholderTextColor={formPalette.muted} style={styles.searchInput} /></View>
      {groups.length ? groups.map((group) => <View key={group.date} style={styles.group}><View style={styles.groupHeader}><Text style={styles.groupDate}>{dateLabel(group.date)}</Text><Text style={styles.groupTotal}>{peso(group.subtotal)}</Text></View><View style={styles.listCard}>{group.items.map((item) => <ExpenseRow key={item.source + '-' + item.id} item={item} onEdit={() => item.source === 'expense' ? setEditing(item) : router.push('/(tabs)/bills')} onDeleted={refresh} />)}</View></View>) : <View style={styles.emptyCard}><View style={styles.emptyIcon}><ShoppingCart size={25} color={formPalette.accent} /></View><Text style={styles.emptyTitle}>{hasAnyExpenses ? 'No expenses in ' + monthLabel(month) : 'No expenses yet'}</Text><Text style={styles.emptyCopy}>{hasAnyExpenses ? 'Log a new expense to start tracking this month.' : 'Log an expense to get started and see your spending here.'}</Text><Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={styles.emptyAction}><Plus size={17} color="#fff" /><Text style={styles.emptyActionText}>Log expense</Text></Pressable></View>}
    </ScrollView>}
    {creating && <ExpenseForm wallets={wallets} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await refresh(); }} />}
    {editing && <ExpenseForm wallets={wallets} item={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); }} />}
  </SafeAreaView>;
}

function ExpenseRow({ item, onEdit, onDeleted }: { item: ExpenseItem; onEdit: () => void; onDeleted: () => Promise<void> }) {
  const Icon = categoryIcon(item.category);
  const typeLabel = item.source === 'bill' ? 'Bill' : item.payment_method === 'other' ? 'Other' : item.payment_method;
  const remove = () => Alert.alert('Delete expense?', `${item.merchant} will be removed.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await authenticatedApiRequest(`/api/${item.source === 'bill' ? 'bills' : 'expenses'}/${item.id}`, { method: 'DELETE' }); await onDeleted(); } catch (error) { Alert.alert('Could not delete', error instanceof Error ? error.message : 'Try again.'); } } }]);
  return <View style={styles.expenseRow}><View style={[styles.expenseIcon, { backgroundColor: categoryColor(item.category) + '22' }]}><Icon size={19} color={categoryColor(item.category)} /></View><View style={styles.expenseMain}><Text numberOfLines={1} style={styles.expenseName}>{item.merchant}</Text><View style={styles.tags}><Text style={styles.categoryTag}>{item.custom_category || item.category}</Text><Text style={styles.typeTag}>{typeLabel}</Text></View></View><Text style={styles.expenseAmount}>{peso(Number(item.amount))}</Text><Pressable accessibilityRole="button" accessibilityLabel={`More options for ${item.merchant}`} onPress={() => Alert.alert('Expense options', item.merchant, [{ text: 'Edit', onPress: onEdit }, { text: 'Delete', style: 'destructive', onPress: remove }, { text: 'Cancel', style: 'cancel' }])} style={styles.moreButton}><MoreHorizontal size={20} color={formPalette.muted} /></Pressable></View>;
}

function ExpenseForm({ wallets, item, onClose, onSaved }: { wallets: Wallet[]; item?: ExpenseRecord; onClose: () => void; onSaved: () => Promise<void> }) {
  const [note, setNote] = useState(item?.merchant ?? '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [customCategory, setCustomCategory] = useState(item?.custom_category ?? '');
  const [date, setDate] = useState(item?.date ?? new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState(item?.payment_method ?? '');
  const [walletId, setWalletId] = useState<string | null>(item?.wallet_id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const value = parseAmount(amount);
    if (!note.trim() || value === null || value <= 0) {
      setError('Add a note and a valid amount.');
      return;
    }
    if (!category || !walletId || !paymentMethod) {
      setError('Choose a category, wallet, and payment method to continue.');
      return;
    }
    if (category === 'Other' && !customCategory.trim()) {
      setError('Please specify a category.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await authenticatedApiRequest(item ? `/api/expenses/${item.id}` : '/api/expenses', { method: item ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchant: note.trim(), amount: value, category, categories: [category], custom_category: category === 'Other' ? customCategory.trim() : null, payment_method: paymentMethod, date, wallet_id: walletId }) });
      await onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save this expense.');
    } finally {
      setSaving(false);
    }
  };

  return <FinanceFormSheet title="New expense" eyebrow="QUICK ENTRY" amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel="Save expense" onSave={() => void save()} onClose={onClose}>
    <FormTextInput label="Note" value={note} onChangeText={setNote} placeholder="e.g. Lunch with the team" />
    <ExpenseCategoryPicker value={category} onChange={setCategory} customCategory={customCategory} onCustomCategoryChange={setCustomCategory} />
    <ExpenseWalletField wallets={wallets} value={walletId} onChange={setWalletId} />
    <PaymentMethodChips value={paymentMethod} onChange={setPaymentMethod} />
    <DatePickerField label="Date" value={date} onChange={setDate} compact />
  </FinanceFormSheet>;
}

function ExpenseWalletField({ wallets, value, onChange }: { wallets: Wallet[]; value: string | null; onChange: (value: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const selected = wallets.find((wallet) => wallet.id === value);
  return <View style={styles.walletField}><Text style={styles.formLabel}>Paid from</Text><Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.walletTrigger}><Text style={[styles.walletValue, !selected && styles.walletPlaceholder]}>{selected?.name ?? 'Select wallet'}</Text><Text style={styles.walletChevron}>{'›'}</Text></Pressable><WalletPickerModal visible={open} wallets={wallets} onClose={() => setOpen(false)} onChange={(walletId) => { onChange(walletId); setOpen(false); }} allowUnset /></View>;
}

function makeStyles(themePalette: typeof formPalette) { const formPalette = themePalette; return StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  safe: { flex: 1, backgroundColor: formPalette.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16, backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  titleWrap: { flex: 1, marginLeft: 8 },
  eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 3, color: formPalette.ink, fontSize: 24, fontWeight: '900' },
  monthBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, backgroundColor: formPalette.accentPale },
  monthBadgeText: { color: formPalette.accent, fontSize: 11, fontWeight: '900' },
  content: { padding: 20, paddingBottom: 42 },
  heroCard: { minHeight: 176, overflow: 'hidden', padding: 19, borderRadius: 22, backgroundColor: formPalette.balance, position: 'relative' },
  heroOrb: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -55, top: -62, backgroundColor: 'rgba(255,255,255,0.045)' },
  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: { color: '#D8EFE2', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroMonth: { color: '#BFE3D0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
  heroLabel: { color: '#D8EFE2', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  heroTrend: { fontSize: 11, fontWeight: '900' },
  heroTrendUp: { color: '#FFD3D0' },
  heroTrendDown: { color: '#C4F5D5' },
  heroValue: { marginTop: 2, color: '#FFFFFF', fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  heroSubtitle: { marginTop: 3, color: '#D8EFE2', fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  primaryAction: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 25, backgroundColor: formPalette.accent },
  primaryActionText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  secondaryAction: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 25, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.accent },
  secondaryActionText: { color: formPalette.accent, fontSize: 12, fontWeight: '900' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 46, marginTop: 22, paddingHorizontal: 12, borderRadius: 14, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line },
  searchInput: { flex: 1, color: formPalette.ink, fontSize: 13 },
  group: { marginTop: 20 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  groupDate: { color: formPalette.muted, fontSize: 13, fontWeight: '800' },
  groupTotal: { color: formPalette.ink, fontSize: 12, fontWeight: '900' },
  listCard: { overflow: 'hidden', borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line },
  expenseRow: { flexDirection: 'row', alignItems: 'center', minHeight: 72, padding: 13, borderBottomWidth: 1, borderBottomColor: formPalette.line },
  expenseIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  expenseMain: { flex: 1, marginLeft: 11 },
  expenseName: { color: formPalette.ink, fontSize: 14, fontWeight: '900' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  categoryTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, color: formPalette.accentDark, backgroundColor: formPalette.accentPale, fontSize: 10, fontWeight: '800', overflow: 'hidden' },
  typeTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, color: formPalette.muted, backgroundColor: formPalette.background, fontSize: 10, fontWeight: '700', overflow: 'hidden' },
  expenseAmount: { marginLeft: 8, color: formPalette.ink, fontSize: 14, fontWeight: '900' },
  moreButton: { width: 34, height: 40, marginLeft: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  card: { margin: 20, padding: 18, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line },
  cardTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' },
  cardCopy: { marginTop: 8, color: formPalette.muted, fontSize: 13, lineHeight: 20 },
  retry: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: formPalette.accentPale },
  retryText: { color: formPalette.accent, fontSize: 12, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerCopy: { marginTop: 10, color: formPalette.muted, fontSize: 13 },
  emptyCard: { alignItems: 'center', marginTop: 20, padding: 24, borderRadius: 22, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line },
  emptyIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: formPalette.accentPale },
  emptyTitle: { marginTop: 15, color: formPalette.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { marginTop: 8, color: formPalette.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptyAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 50, marginTop: 18, paddingHorizontal: 22, borderRadius: 25, backgroundColor: formPalette.accent },
  emptyActionText: { color: '#fff', fontWeight: '900' },
  walletField: { marginTop: 15 },
  walletTrigger: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 14, backgroundColor: formPalette.background, borderWidth: 1, borderColor: formPalette.line },
  walletValue: { flex: 1, color: formPalette.ink, fontSize: 13, fontWeight: '800' },
  walletPlaceholder: { color: formPalette.muted, fontWeight: '600' },
  walletChevron: { color: formPalette.muted, fontSize: 24, lineHeight: 24 },
  formLabel: { marginBottom: 9, color: formPalette.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  pressed: { opacity: 0.72 },
}); }
let styles = makeStyles(formPalette);
