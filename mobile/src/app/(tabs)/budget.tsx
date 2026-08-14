import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, Car, Dumbbell, Gift, Heart, Home, PawPrint, Pencil, Plane, Plus, Search, ShoppingBag, WalletCards, Wrench, X, type LucideIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChipRow, parseAmount, FinanceFormSheet, budgetCategories, formPalette } from '@/components/finance-form';
import { authenticatedApiRequest } from '@/services/api';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';
import { getCategoryMeta } from '@/constants/categories';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { budgetProgressPercent, budgetUsagePercent } from '@/utils/budget-summary';

type Category = { id: string; name: string; budget: number; spent: number; percent: number; color?: string; icon?: string; goal?: boolean };
type GoalAlloc = { goal_id: string; title: string; amount: number; progress_percent: number };
type Summary = { month: string; monthly_income: number; budget_amount: number; spent_amount: number; saved_amount: number; remaining_budget: number; categories: Category[]; monthly_savings_budget: number; goal_allocation_total: number; general_savings: number; unallocated_savings: number; unallocated_income: number; savings_auto_distribute: boolean; remaining_savings_behavior: 'auto_general' | 'leave_unallocated' | 'ask_monthly'; goal_allocations: GoalAlloc[] };
type BudgetEntry = { id: string; name: string; budget: number; icon?: string; persisted: boolean };

const customCategoryIcons: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'heart', label: 'Health', icon: Heart }, { key: 'book', label: 'Learning', icon: BookOpen },
  { key: 'shopping', label: 'Shopping', icon: ShoppingBag }, { key: 'plane', label: 'Travel', icon: Plane },
  { key: 'gift', label: 'Gifts', icon: Gift }, { key: 'paw', label: 'Pets', icon: PawPrint },
  { key: 'wrench', label: 'Repairs', icon: Wrench }, { key: 'dumbbell', label: 'Fitness', icon: Dumbbell },
  { key: 'home', label: 'Home', icon: Home }, { key: 'car', label: 'Car', icon: Car },
];

const peso = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;

function currentManilaMonth() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? String(new Date().getFullYear());
  const month = parts.find((part) => part.type === 'month')?.value ?? String(new Date().getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function categoryIcon(name: string, iconKey?: string) {
  if (iconKey) {
    const custom = customCategoryIcons.find((option) => option.key === iconKey);
    if (custom) return custom.icon;
  }
  return getCategoryMeta(name).icon;
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
}

export default function Budget() {
  const { colors } = useAppTheme();
  styles = makeStyles({ ...formPalette, background: colors.background, surface: colors.surfaceElevated, ink: colors.textPrimary, muted: colors.textSecondary, accent: colors.primary, accentDark: colors.primary, accentPale: colors.primarySoft, balance: colors.balance, line: colors.border });
  const bottomNavClearance = useBottomNavClearance();
  const { visible } = useBalanceVisibility();
  const amountsVisible = visible === true;
  const [month] = useState(currentManilaMonth);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await authenticatedApiRequest<Summary | null>(`/api/budget/summary?month=${month}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Budget could not load.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void refresh(); }, [refresh]);

  const label = monthLabel(month);
  const budgeted = data?.budget_amount ?? 0;
  const spent = data?.spent_amount ?? 0;

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
     <FinancialScreenHeader title="Budget" onBack={() => router.back()} rightAction={<NotificationHeaderButton />} />
    {loading ? <View style={styles.center}><ActivityIndicator color={formPalette.accent} /><Text style={styles.muted}>Loading budget…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Budget unavailable</Text><Text style={styles.muted}>We couldn&apos;t load your budget right now. Please try again.</Text><Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : !data ? <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]} showsVerticalScrollIndicator={false}><View style={styles.emptyCard}><View style={styles.emptyIcon}><WalletCards size={24} color={formPalette.accent} /></View><Text style={styles.emptyTitle}>No budget set for {label} yet</Text><Text style={styles.emptyCopy}>Set category limits and a monthly savings budget to give this month a clear plan.</Text><Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.emptyAction}><Text style={styles.emptyActionText}>Create Budget</Text></Pressable></View></ScrollView> : <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]} showsVerticalScrollIndicator={false}>
      <BudgetSummary month={label} budgeted={budgeted} spent={spent} remaining={data.remaining_budget} amountsVisible={amountsVisible} />
      {data.unallocated_income !== 0 ? <View style={[styles.tip, data.unallocated_income < 0 && styles.tipWarning]}><WalletCards size={20} color={data.unallocated_income < 0 ? formPalette.danger : '#fff'} /><Text style={[styles.tipText, data.unallocated_income < 0 && styles.tipWarningText]}>{data.unallocated_income > 0 ? `${amountsVisible ? peso(data.unallocated_income) : '••••••'} of income is unallocated this month.` : `Budget is ${amountsVisible ? peso(Math.abs(data.unallocated_income)) : '••••••'} above income.`}</Text></View> : null}
      <Section title="Category budgets" action={<Pressable accessibilityRole="button" accessibilityLabel="Edit budget" onPress={() => setOpen(true)} style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}><Pencil size={14} color={formPalette.accent} /><Text style={styles.sectionActionText}>Edit Budget</Text></Pressable>}><View style={styles.categoryList}>{data.categories?.filter((category) => !category.goal).map((category) => <BudgetCategoryRow key={category.id} category={category} amountsVisible={amountsVisible} />)}</View></Section>
      <GoalAllocationRows summary={data} />
    </ScrollView>}
    {open && <BudgetForm month={month} summary={data} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refresh(); }} />}
  </SafeAreaView>;
}

function BudgetSummary({ month, budgeted, spent, remaining, amountsVisible }: { month: string; budgeted: number; spent: number; remaining: number; amountsVisible: boolean }) {
  const percent = budgetUsagePercent(spent, budgeted);
  const progress = budgetProgressPercent(spent, budgeted);
  const over = remaining < 0;
  const mask = '••••••';
  return <View accessibilityRole="summary" accessibilityLabel={`${percent} percent of budget used. Total budget ${amountsVisible ? peso(budgeted) : 'hidden'}. Used ${amountsVisible ? peso(spent) : 'hidden'}. Remaining ${amountsVisible ? peso(remaining) : 'hidden'}.`} style={styles.summaryCard}>
    <View style={styles.summaryHeader}><Text style={styles.summaryEyebrow}>BUDGET SUMMARY</Text><Text style={styles.summaryMonth}>{month.toUpperCase()}</Text></View>
    <View style={styles.summaryBody}><View style={styles.percentBlock}><Text style={[styles.percentValue, { color: over ? formPalette.danger : formPalette.accent }]}>{percent}%</Text><Text style={styles.percentLabel}>USED</Text></View><View style={styles.summaryMetrics}><Metric label="Total" value={amountsVisible ? peso(budgeted) : mask} /><Metric label="Used" value={amountsVisible ? peso(spent) : mask} /><Metric label="Remaining" value={amountsVisible ? (over ? `-${peso(Math.abs(remaining))}` : peso(remaining)) : mask} tone={over ? 'danger' : 'positive'} /></View></View>
    <View accessible={false} style={styles.summaryTrack}><View style={[styles.summaryFill, { width: `${progress}%`, backgroundColor: over ? formPalette.danger : formPalette.accent }]} /></View>
  </View>;
}

function Metric({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'positive' | 'danger' }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.72} style={[styles.metricValue, tone === 'positive' && styles.metricPositive, tone === 'danger' && styles.metricDanger]}>{value}</Text></View>;
}

function BudgetCategoryRow({ category, amountsVisible }: { category: Category; amountsVisible: boolean }) {
  const over = category.spent > category.budget;
  const color = getCategoryMeta(category.name).color;
  const CategoryIcon = categoryIcon(category.name, category.icon);
  const tone = over ? formPalette.danger : color;
  const remaining = category.budget - category.spent;
  return <BudgetProgressRow icon={<CategoryIcon size={19} color={tone} />} title={category.name} detail={amountsVisible ? `${peso(category.spent)} / ${peso(category.budget)}` : '•••••• / ••••••'} percent={category.percent} color={tone} remaining={amountsVisible ? (over ? `${peso(Math.abs(remaining))} over budget` : `${peso(remaining)} remaining`) : 'Balance hidden'} />;
}

function GoalAllocationRows({ summary }: { summary: Summary }) {
  const allocations = summary.goal_allocations ?? [];
  const total = summary.goal_allocation_total ?? allocations.reduce((sum, item) => sum + item.amount, 0);
  if (!allocations.length) return null;
  return <View style={styles.goalAllocationSection}><Text style={styles.goalAllocationsTitle}>Goal allocations</Text><Text style={styles.formHint}>Monthly Goal allocations are planned amounts only; they do not reduce income, wallet balances, or expenses.</Text>{allocations.map((allocation) => <View key={allocation.goal_id} style={styles.goalAllocationRow}><Text numberOfLines={1} style={styles.goalAllocationName}>{allocation.title}</Text><Text style={styles.goalAllocationAmount}>{peso(allocation.amount)}/month</Text></View>)}<View style={styles.goalAllocationTotal}><Text style={styles.goalAllocationTotalLabel}>Total goal allocations</Text><Text style={styles.goalAllocationTotalValue}>{peso(total)}</Text></View></View>;
}

function BudgetProgressRow({ icon, title, detail, percent, color, remaining }: { icon: ReactNode; title: string; detail: string; percent: number; color: string; remaining: string }) {
  const safePercent = Math.min(100, Math.max(0, percent));
  return <View accessibilityRole="summary" accessibilityLabel={`${title}, ${detail}, ${percent}% used, ${remaining}.`} style={styles.categoryCard}><View style={styles.categoryHeader}><View style={[styles.categoryIcon, { backgroundColor: `${color}22` }]}>{icon}</View><View style={styles.categoryMain}><Text numberOfLines={1} style={styles.categoryName}>{title}</Text><Text style={[styles.categoryAmounts, percent > 100 && styles.over]}>{detail}</Text></View><Text style={[styles.categoryPercent, { color }]}>{percent}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${safePercent}%`, backgroundColor: color }]} /></View><Text style={[styles.remaining, percent > 100 && styles.over]}>{remaining}</Text></View>;
}

function BudgetForm({ month, summary, onClose, onSaved }: { month: string; summary: Summary | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const initialEntries = useMemo(() => {
    const current = summary?.categories.filter((category) => !category.goal) ?? [];
    if (current.length) return current.map(({ id, name, budget, icon }) => ({ id, name, budget, icon, persisted: true }));
    return budgetCategories.slice(0, 7).map((category) => ({ id: `budget-${category.label.toLowerCase()}`, name: category.label, budget: 0, persisted: false }));
  }, [summary]);
  const [entries, setEntries] = useState<BudgetEntry[]>(initialEntries);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(initialEntries.map((entry) => [entry.id, entry.budget ? String(entry.budget) : ''])));
  const [selectedId, setSelectedId] = useState(initialEntries[0]?.id ?? '');
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [customCategoryOpen, setCustomCategoryOpen] = useState(false);
  const [customCategoryError, setCustomCategoryError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedEntry = entries.find((entry) => entry.id === selectedId);
  const amount = drafts[selectedId] ?? '';
  const options = useMemo(() => entries.map((entry) => ({ label: entry.name, icon: categoryIcon(entry.name, entry.icon) })), [entries]);
  const availableCategories = useMemo(() => budgetCategories.filter((category) => !entries.some((entry) => entry.name.toLowerCase() === category.label.toLowerCase())), [entries]);
  const selectedLabel = selectedEntry?.name ?? 'Category';

  const changeAmount = (value: string) => {
    setDrafts((current) => ({ ...current, [selectedId]: value }));
  };

  const addCategory = (label: string, icon?: string) => {
    const id = `budget-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    setEntries((current) => [...current, { id, name: label, budget: 0, icon, persisted: false }]);
    setDrafts((current) => ({ ...current, [id]: '' }));
    setSelectedId(id);
    setAddCategoryOpen(false);
  };

  const addCustomCategory = (name: string, icon: string) => {
    const label = name.trim();
    if (!label) {
      setCustomCategoryError('Enter a category name.');
      return;
    }
    if (entries.some((entry) => entry.name.trim().toLowerCase() === label.toLowerCase())) {
      setCustomCategoryError('That category is already in this budget.');
      return;
    }
    setCustomCategoryError('');
    addCategory(label, icon);
    setCustomCategoryOpen(false);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const categories = entries.filter((entry) => entry.persisted || (parseAmount(drafts[entry.id] ?? '') ?? 0) > 0).map((entry) => ({ id: entry.id, name: entry.name, budget: parseAmount(drafts[entry.id] ?? '') ?? 0, ...(entry.icon ? { icon: entry.icon } : {}) }));
      await authenticatedApiRequest('/api/budget', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, categories, auto_distribute_savings: false, remaining_savings_behavior: 'leave_unallocated' }) });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this budget.');
    } finally {
      setSaving(false);
    }
  };

  return <FinanceFormSheet title={summary ? 'Edit budget' : 'Create budget'} eyebrow={monthLabel(month).toUpperCase()} amount={amount} onAmountChange={changeAmount} error={error} saving={saving} saveLabel={summary ? 'Save budget' : 'Create budget'} onSave={() => void save()} onClose={onClose}>
    <Text style={styles.formHint}>Set the monthly limit for one category at a time.</Text>
    <CategoryChipRow label="Budget category" value={selectedLabel} onChange={(label) => setSelectedId(entries.find((entry) => entry.name === label)?.id ?? selectedId)} options={options} showAllOptions onAdd={() => setAddCategoryOpen(true)} />
    <BudgetCategoryPicker visible={addCategoryOpen} options={availableCategories} onClose={() => setAddCategoryOpen(false)} onSelect={(label) => addCategory(label)} onCustom={() => { setAddCategoryOpen(false); setCustomCategoryOpen(true); }} />
    <CustomCategorySheet visible={customCategoryOpen} error={customCategoryError} onClose={() => { setCustomCategoryOpen(false); setCustomCategoryError(''); }} onAdd={addCustomCategory} />
    <View style={styles.limitPreview}><Text style={styles.limitLabel}>{selectedLabel}</Text><Text style={[styles.limitLabel, { fontSize: 13 }]}>{amount ? `₱${amount}` : 'No limit set'}</Text></View>
  </FinanceFormSheet>;
}

function BudgetCategoryPicker({ visible, options, onClose, onSelect, onCustom }: { visible: boolean; options: { label: string; icon: LucideIcon }[]; onClose: () => void; onSelect: (label: string) => void; onCustom: () => void }) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => { if (!visible) setQuery(''); }, [visible]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.addCategoryBackdrop} onPress={onClose}>
      <Pressable style={[styles.addCategorySheet, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
        <View style={styles.addCategoryHeader}><View><Text style={[styles.addCategoryTitle, { color: colors.textPrimary }]}>Add budget category</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>Choose a category to add to this budget.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close add category" onPress={onClose} style={styles.iconClose}><X size={20} color={colors.textPrimary} /></Pressable></View>
        <View style={[styles.categorySearch, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}><Search size={18} color={colors.textSecondary} /><TextInput value={query} onChangeText={setQuery} placeholder="Search categories" placeholderTextColor={colors.textSecondary} style={[styles.categorySearchInput, { color: colors.textPrimary }]} autoCapitalize="words" /></View>
        <ScrollView contentContainerStyle={styles.addCategoryList} keyboardShouldPersistTaps="handled">
          {filtered.map(({ label, icon: Icon }) => <Pressable key={label} accessibilityRole="button" onPress={() => onSelect(label)} style={({ pressed }) => [styles.addCategoryOption, { backgroundColor: colors.surfaceInput, borderColor: colors.border }, pressed && styles.pressed]}><Icon size={18} color={getCategoryMeta(label).color} /><Text style={[styles.addCategoryText, { color: colors.textPrimary }]}>{label}</Text><Plus size={16} color={colors.primary} /></Pressable>)}
          {!filtered.length ? <Text style={[styles.muted, { color: colors.textSecondary }]}>No categories match your search.</Text> : null}
          <Pressable accessibilityRole="button" onPress={onCustom} style={({ pressed }) => [styles.addCategoryOption, styles.customCategoryOption, { backgroundColor: colors.primarySoft, borderColor: colors.primary }, pressed && styles.pressed]}><Plus size={18} color={colors.primary} /><Text style={[styles.addCategoryText, { color: colors.primary }]}>Other / Custom</Text></Pressable>
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>;
}

function CustomCategorySheet({ visible, error, onClose, onAdd }: { visible: boolean; error: string; onClose: () => void; onAdd: (name: string, icon: string) => void }) {
  const { colors } = useAppTheme();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(customCategoryIcons[0].key);
  useEffect(() => { if (!visible) { setName(''); setIcon(customCategoryIcons[0].key); } }, [visible]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.addCategoryBackdrop} onPress={onClose}>
      <Pressable style={[styles.addCategorySheet, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
        <View style={styles.addCategoryHeader}><Text style={[styles.addCategoryTitle, { color: colors.textPrimary }]}>Custom category</Text><Pressable accessibilityRole="button" accessibilityLabel="Close custom category" onPress={onClose} style={styles.iconClose}><X size={20} color={colors.textPrimary} /></Pressable></View>
        <Text style={[styles.customFieldLabel, { color: colors.textSecondary }]}>Category name *</Text>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Pet care" placeholderTextColor={colors.textSecondary} style={[styles.customNameInput, { backgroundColor: colors.surfaceInput, borderColor: colors.border, color: colors.textPrimary }]} autoCapitalize="words" />
        <Text style={[styles.customFieldLabel, { color: colors.textSecondary }]}>Choose icon</Text>
        <View style={styles.customIconGrid}>{customCategoryIcons.map(({ key, label, icon: Icon }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: icon === key }} onPress={() => setIcon(key)} style={[styles.customIconOption, { backgroundColor: colors.surfaceInput, borderColor: icon === key ? colors.primary : colors.border }, icon === key && { backgroundColor: colors.primarySoft }]}><Icon size={19} color={icon === key ? colors.primary : colors.textSecondary} /></Pressable>)}</View>
        {error ? <Text style={[styles.customCategoryError, { color: colors.danger }]}>{error}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => onAdd(name, icon)} style={({ pressed }) => [styles.customCategorySave, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={styles.customCategorySaveText}>Add category</Text></Pressable>
      </Pressable>
    </Pressable>
  </Modal>;
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) { return <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{action}</View>{children}</View>; }

function makeStyles(themePalette: typeof formPalette) { const formPalette = themePalette; return StyleSheet.create({
  goalAllocationSection: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, goalAllocationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }, goalAllocationName: { flex: 1, color: formPalette.ink, fontSize: 12, fontWeight: '800' }, goalAllocationAmount: { color: formPalette.accent, fontSize: 11, fontWeight: '900' }, goalAllocationTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: formPalette.line }, goalAllocationTotalLabel: { color: formPalette.muted, fontSize: 11, fontWeight: '800' }, goalAllocationTotalValue: { color: formPalette.ink, fontSize: 16, fontWeight: '900' }, savingsNudge: { minHeight: 28, justifyContent: 'center', marginTop: -2, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFF4D6' },
  savingsNudgeText: { color: '#9A6700', fontSize: 11, fontWeight: '800' }, remaining: { marginTop: 8, color: formPalette.muted, fontSize: 11, fontWeight: '800' },
  tipWarning: { backgroundColor: formPalette.danger + '18' }, tipWarningText: { color: formPalette.danger }, summaryCard: { marginBottom: 14, padding: 16, borderRadius: 20, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, summaryEyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, summaryMonth: { color: formPalette.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }, summaryBody: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 }, percentBlock: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34, backgroundColor: formPalette.accentPale }, percentValue: { fontSize: 18, fontWeight: '900' }, percentLabel: { marginTop: 1, color: formPalette.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, summaryMetrics: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, metric: { flex: 1, minWidth: 0 }, metricLabel: { color: formPalette.muted, fontSize: 10, fontWeight: '800' }, metricValue: { marginTop: 5, color: formPalette.ink, fontSize: 14, fontWeight: '900' }, metricPositive: { color: formPalette.accent }, metricDanger: { color: formPalette.danger }, summaryTrack: { height: 6, marginTop: 16, overflow: 'hidden', borderRadius: 3, backgroundColor: formPalette.accentPale }, summaryFill: { height: '100%', borderRadius: 3 },
  safe: { flex: 1, backgroundColor: formPalette.background }, header: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line }, back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, titleWrap: { flex: 1, marginLeft: 12 }, eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { marginTop: 3, color: formPalette.ink, fontSize: 23, fontWeight: '900' }, content: { padding: 20, paddingTop: 16, paddingBottom: 44 }, tip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: formPalette.accent }, tipText: { flex: 1, color: '#fff', fontSize: 12, lineHeight: 18, fontWeight: '700' }, ringSummary: { alignItems: 'center', marginBottom: 16, paddingVertical: 10 }, ringEyebrow: { marginBottom: 14, color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, ringCenter: { width: 135, alignItems: 'center' }, ringLabel: { color: formPalette.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, ringValue: { width: 130, marginTop: 5, color: formPalette.ink, fontSize: 25, fontWeight: '900', textAlign: 'center' }, ringSupporting: { marginTop: 14, color: formPalette.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' }, ringLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 14 }, legendChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendText: { color: formPalette.muted, fontSize: 10, fontWeight: '800' }, section: { marginTop: 22, padding: 16, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, sectionHeading: { minHeight: 42, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sectionTitle: { flex: 1, color: formPalette.ink, fontSize: 16, fontWeight: '900' }, sectionAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 21, backgroundColor: formPalette.accentPale }, sectionActionText: { color: formPalette.accentDark, fontSize: 11, fontWeight: '900' }, categoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, track: { height: 8, marginTop: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: formPalette.accentPale }, fill: { height: '100%', borderRadius: 4, backgroundColor: formPalette.accent }, categoryList: { gap: 10 }, categoryCard: { padding: 14, borderRadius: 17, backgroundColor: formPalette.background }, categoryIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, categoryMain: { flex: 1, marginLeft: 10 }, categoryName: { color: formPalette.ink, fontSize: 14, fontWeight: '900' }, categoryAmounts: { marginTop: 4, color: formPalette.muted, fontSize: 11, fontWeight: '700' }, categoryPercent: { color: formPalette.accent, fontSize: 13, fontWeight: '900' }, over: { color: formPalette.danger }, warning: { marginTop: 8, color: formPalette.danger, fontSize: 11, fontWeight: '800' }, allocationContext: { marginTop: -8, marginBottom: 16, color: formPalette.muted, fontSize: 11, lineHeight: 17, fontWeight: '600' }, allocationTotal: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }, allocationTotalLabel: { color: formPalette.muted, fontSize: 11, fontWeight: '800' }, allocationTotalValue: { color: formPalette.ink, fontSize: 22, fontWeight: '900' }, allocationLegend: { gap: 9, marginTop: 13 }, allocationLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, allocationDot: { width: 9, height: 9, borderRadius: 5 }, unallocatedDot: { backgroundColor: '#AAB5AF' }, allocationLegendLabel: { flex: 1, color: formPalette.muted, fontSize: 11, fontWeight: '700' }, allocationLegendAmount: { color: formPalette.ink, fontSize: 11, fontWeight: '900' }, allocationPrompt: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, backgroundColor: formPalette.accentPale }, allocationPromptCopy: { flex: 1 }, allocationPromptTitle: { color: formPalette.accentDark, fontSize: 12, fontWeight: '900' }, allocationPromptText: { marginTop: 3, color: formPalette.muted, fontSize: 10, fontWeight: '700' }, goalAllocations: { gap: 10, marginTop: 18 }, goalAllocationsTitle: { color: formPalette.ink, fontSize: 12, fontWeight: '900' }, noGoalAllocation: { marginTop: 18, padding: 14, borderRadius: 15, backgroundColor: formPalette.background, color: formPalette.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' }, muted: { marginTop: 4, color: formPalette.muted, fontSize: 12, lineHeight: 18 }, card: { margin: 20, padding: 18, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, cardTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' }, retry: { alignSelf: 'flex-start', marginTop: 14, padding: 10, borderRadius: 15, backgroundColor: formPalette.accentPale }, retryText: { color: formPalette.accent, fontWeight: '900' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, emptyCard: { alignItems: 'center', margin: 20, padding: 24, borderRadius: 22, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, emptyIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: formPalette.accentPale }, emptyTitle: { marginTop: 15, color: formPalette.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' }, emptyCopy: { marginTop: 8, color: formPalette.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' }, emptyAction: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18, paddingHorizontal: 24, borderRadius: 25, backgroundColor: formPalette.accent }, emptyActionText: { color: '#fff', fontWeight: '900' }, pressed: { opacity: 0.72 }, formHint: { color: formPalette.muted, fontSize: 12, lineHeight: 18 }, limitPreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: formPalette.accentPale }, limitLabel: { color: formPalette.accentDark, fontSize: 12, fontWeight: '900' }, recurring: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: 15, borderRadius: 17, backgroundColor: formPalette.background }, recurringCopy: { flex: 1, paddingRight: 10 }, recurringTitle: { color: formPalette.ink, fontSize: 14, fontWeight: '900' }, preference: { marginTop: 16 }, preferenceLabel: { marginBottom: 8, color: formPalette.muted, fontSize: 11, fontWeight: '900' }, preferenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, preferenceChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 15, backgroundColor: formPalette.background }, preferenceActive: { backgroundColor: formPalette.accentPale, borderWidth: 1, borderColor: formPalette.accent }, preferenceText: { color: formPalette.muted, fontSize: 11, fontWeight: '800' }, preferenceTextActive: { color: formPalette.accentDark }, addCategoryBackdrop: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(17,35,28,0.35)' }, addCategorySheet: { padding: 20, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: formPalette.surface }, addCategoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, addCategoryTitle: { color: formPalette.ink, fontSize: 18, fontWeight: '900' }, addCategoryList: { gap: 8 }, addCategoryOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: formPalette.background }, addCategoryText: { flex: 1, color: formPalette.ink, fontSize: 13, fontWeight: '800' },
  iconClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, categorySearch: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1 }, categorySearchInput: { flex: 1, minHeight: 46, paddingVertical: 0, fontSize: 14 }, customCategoryOption: { marginTop: 4 }, customFieldLabel: { marginTop: 12, marginBottom: 7, fontSize: 11, fontWeight: '900' }, customNameInput: { minHeight: 48, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, fontSize: 14 }, customIconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, customIconOption: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1 }, customCategoryError: { marginTop: 10, fontSize: 12, fontWeight: '700' }, customCategorySave: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18, borderRadius: 25 }, customCategorySaveText: { color: '#fff', fontSize: 13, fontWeight: '900' },
}); }
let styles = makeStyles(formPalette);
