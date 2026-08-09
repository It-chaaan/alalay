import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type DimensionValue } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, MoreHorizontal, Plus, ScanLine, Search, ShoppingCart, Tag } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChipRow, DatePickerField, evaluateAmountExpression, expenseCategories, FinanceFormSheet, FormTextInput, formPalette, PaymentMethodChips } from '@/components/finance-form';
import { authenticatedApiRequest } from '@/services/api';
import { fetchExpenses, type BillRecord, type ExpenseRecord } from '@/services/finance';

type ExpenseItem = ExpenseRecord & { source: 'expense' | 'bill'; payment_method: string; created_at?: string };
type CategoryTotal = { category: string; amount: number; percent: number; color: string };
type ExpenseGroup = { date: string; subtotal: number; items: ExpenseItem[] };

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
  return expenseCategories.find((option) => option.label.toLowerCase() === name.toLowerCase())?.icon ?? MoreHorizontal;
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
  const month = currentMonthKey();
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [expenses, bills] = await Promise.all([fetchExpenses(), authenticatedApiRequest<BillRecord[]>('/api/bills')]);
      setItems(mergeExpenseRows(expenses, bills));
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
  const total = monthItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const categories = Array.from(new Set(monthItems.map((item) => item.category)));
  const breakdown = useMemo<CategoryTotal[]>(() => categories.map((category, index) => {
    const amount = monthItems.filter((item) => item.category === category).reduce((sum, item) => sum + Number(item.amount), 0);
    return { category, amount, percent: total ? amount / total * 100 : 0, color: categoryColor(category, index) };
  }).sort((left, right) => right.amount - left.amount), [categories, monthItems, total]);
  const groups = useMemo(() => groupByDate(filteredItems), [filteredItems]);
  const hasAnyExpenses = items.length > 0;

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><ArrowLeft size={21} color={formPalette.ink} /></Pressable><View style={styles.titleWrap}><Text style={styles.eyebrow}>SPENDING</Text><Text style={styles.title}>Expenses</Text></View><View style={styles.monthBadge}><Text style={styles.monthBadgeText}>{monthLabel(month).split(' ')[0]}</Text></View></View>
    {loading ? <View style={styles.center}><ActivityIndicator color={formPalette.accent} /><Text style={styles.centerCopy}>Loading expenses…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Expenses unavailable</Text><Text style={styles.cardCopy}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.stats}><Stat label="Total spent" value={peso(total)} /><Stat label="Categories" value={String(categories.length)} /><Stat label="Transactions" value={String(monthItems.length)} /></View>
      <View style={styles.actionRow}><Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/ocr')} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><ScanLine size={17} color={formPalette.accent} /><Text style={styles.secondaryActionText}>Scan receipt</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Plus size={18} color="#fff" /><Text style={styles.primaryActionText}>Log expense</Text></Pressable></View>
      <View style={styles.breakdownCard}><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Spending by category</Text><Text style={styles.sectionHint}>{monthLabel(month)}</Text></View><Tag size={18} color={formPalette.accent} /></View><View style={styles.segmentBar}>{breakdown.length ? breakdown.map((item) => <View key={item.category} style={[styles.segment, { width: (String(item.percent) + '%') as DimensionValue, backgroundColor: item.color }]} />) : <View style={[styles.segment, styles.emptySegment]} />}</View>{breakdown.length ? <View style={styles.legend}>{breakdown.map((item) => <View key={item.category} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: item.color }]} /><View style={styles.legendCopy}><Text numberOfLines={1} style={styles.legendName}>{item.category}</Text><Text style={styles.legendAmount}>{peso(item.amount)} · {item.percent.toFixed(1)}%</Text></View></View>)}</View> : <Text style={styles.emptyBreakdown}>Log an expense to see where your money is going.</Text>}</View>
      <View style={styles.search}><Search size={17} color={formPalette.muted} /><TextInput accessibilityLabel="Search expenses" value={query} onChangeText={setQuery} placeholder="Search expenses" placeholderTextColor={formPalette.muted} style={styles.searchInput} /></View>
      {groups.length ? groups.map((group) => <View key={group.date} style={styles.group}><View style={styles.groupHeader}><Text style={styles.groupDate}>{dateLabel(group.date)}</Text><Text style={styles.groupTotal}>{peso(group.subtotal)}</Text></View><View style={styles.listCard}>{group.items.map((item) => <ExpenseRow key={item.source + '-' + item.id} item={item} />)}</View></View>) : <View style={styles.emptyCard}><View style={styles.emptyIcon}><ShoppingCart size={25} color={formPalette.accent} /></View><Text style={styles.emptyTitle}>{hasAnyExpenses ? 'No expenses in ' + monthLabel(month) : 'No expenses yet'}</Text><Text style={styles.emptyCopy}>{hasAnyExpenses ? 'Log a new expense to start tracking this month.' : 'Log an expense to get started and see your spending here.'}</Text><Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={styles.emptyAction}><Plus size={17} color="#fff" /><Text style={styles.emptyActionText}>Log expense</Text></Pressable></View>}
    </ScrollView>}
    {creating && <ExpenseForm onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await refresh(); }} />}
  </SafeAreaView>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

function ExpenseRow({ item }: { item: ExpenseItem }) {
  const Icon = categoryIcon(item.category);
  const typeLabel = item.source === 'bill' ? 'Bill' : item.payment_method === 'other' ? 'Other' : item.payment_method;
  return <View style={styles.expenseRow}><View style={[styles.expenseIcon, { backgroundColor: categoryColor(item.category) + '22' }]}><Icon size={19} color={categoryColor(item.category)} /></View><View style={styles.expenseMain}><Text numberOfLines={1} style={styles.expenseName}>{item.merchant}</Text><View style={styles.tags}><Text style={styles.categoryTag}>{item.category}</Text><Text style={styles.typeTag}>{typeLabel}</Text></View></View><Text style={styles.expenseAmount}>{peso(Number(item.amount))}</Text></View>;
}

function ExpenseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const quickFills = [{ label: 'Lunch', amount: '380', category: 'Food' }, { label: 'Groceries', amount: '1200', category: 'Groceries' }, { label: 'Grab ride', amount: '250', category: 'Transport' }];

  const save = async () => {
    const value = evaluateAmountExpression(amount);
    if (!note.trim() || value === null || value <= 0) {
      setError('Add a note and a valid amount.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await authenticatedApiRequest('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchant: note.trim(), amount: value, category, payment_method: paymentMethod, date }) });
      await onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save this expense.');
    } finally {
      setSaving(false);
    }
  };

  return <FinanceFormSheet title="New expense" eyebrow="QUICK ENTRY" amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel="Save expense" onSave={() => void save()} onClose={onClose}>
    <FormTextInput label="Note" value={note} onChangeText={setNote} placeholder="e.g. Lunch with the team" />
    <View style={styles.recent}><Text style={styles.formLabel}>Recent expenses</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>{quickFills.map((item) => <Pressable key={item.label} onPress={() => { setNote(item.label); setAmount(item.amount); setCategory(item.category); }} style={({ pressed }) => [styles.quickFill, pressed && styles.pressed]}><Text style={styles.quickLabel}>{item.label}</Text><Text style={styles.quickAmount}>{peso(Number(item.amount))}</Text></Pressable>)}</ScrollView></View>
    <CategoryChipRow value={category} onChange={setCategory} options={expenseCategories} />
    <PaymentMethodChips value={paymentMethod} onChange={setPaymentMethod} />
    <DatePickerField label="Date" value={date} onChange={setDate} />
  </FinanceFormSheet>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: formPalette.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16, backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  titleWrap: { flex: 1, marginLeft: 8 },
  eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 3, color: formPalette.ink, fontSize: 24, fontWeight: '900' },
  monthBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, backgroundColor: formPalette.accentPale },
  monthBadgeText: { color: formPalette.accent, fontSize: 11, fontWeight: '900' },
  content: { padding: 20, paddingBottom: 42 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minHeight: 78, justifyContent: 'center', padding: 12, borderRadius: 15, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line },
  statLabel: { color: formPalette.muted, fontSize: 10, fontWeight: '700' },
  statValue: { marginTop: 6, color: formPalette.ink, fontSize: 15, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  primaryAction: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 25, backgroundColor: formPalette.accent },
  primaryActionText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  secondaryAction: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 25, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.accent },
  secondaryActionText: { color: formPalette.accent, fontSize: 12, fontWeight: '900' },
  breakdownCard: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' },
  sectionHint: { marginTop: 4, color: formPalette.muted, fontSize: 11 },
  segmentBar: { flexDirection: 'row', height: 24, marginTop: 16, overflow: 'hidden', borderRadius: 12, backgroundColor: formPalette.background },
  segment: { height: '100%' },
  emptySegment: { width: '100%', backgroundColor: formPalette.line },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 },
  legendItem: { width: '47%', flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 9, height: 9, marginRight: 7, borderRadius: 5 },
  legendCopy: { flex: 1 },
  legendName: { color: formPalette.ink, fontSize: 11, fontWeight: '800' },
  legendAmount: { marginTop: 2, color: formPalette.muted, fontSize: 10 },
  emptyBreakdown: { marginTop: 13, color: formPalette.muted, fontSize: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 46, marginTop: 18, paddingHorizontal: 12, borderRadius: 14, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line },
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
  recent: { marginTop: 15 },
  formLabel: { marginBottom: 9, color: formPalette.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  recentRow: { gap: 8, paddingRight: 20 },
  quickFill: { minWidth: 108, padding: 12, borderRadius: 15, backgroundColor: formPalette.background },
  quickLabel: { color: formPalette.ink, fontSize: 12, fontWeight: '900' },
  quickAmount: { marginTop: 5, color: formPalette.accent, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
