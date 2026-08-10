import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Pencil, PiggyBank, WalletCards } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChipRow, evaluateAmountExpression, FinanceFormSheet, budgetCategories, formPalette, savingsBudgetOption } from '@/components/finance-form';
import { authenticatedApiRequest } from '@/services/api';
import { SegmentedRing } from '@/components/segmented-ring';
import { ProfileHeaderButton } from '@/components/profile-header-button';

type Category = { id: string; name: string; budget: number; spent: number; percent: number; color?: string; goal?: boolean };
type GoalAlloc = { goal_id: string; title: string; amount: number; progress_percent: number };
type Summary = { month: string; monthly_income: number; budget_amount: number; spent_amount: number; saved_amount: number; remaining_budget: number; categories: Category[]; monthly_savings_budget: number; goal_allocation_total: number; general_savings: number; unallocated_savings: number; unallocated_income: number; savings_auto_distribute: boolean; remaining_savings_behavior: 'auto_general' | 'leave_unallocated' | 'ask_monthly'; goal_allocations: GoalAlloc[] };
type BudgetEntry = { id: string; name: string; budget: number };

const categoryColors: Record<string, string> = { Food: '#E8775D', Transport: '#5D8FC4', Rent: '#4D9A73', Electricity: '#D89B1D', Internet: '#4778C7', Water: '#5DA9D6', Subscriptions: '#8D70AD', Other: '#8B8B8B' };
const preferenceOptions = [
  { value: 'auto_general', label: 'General savings' },
  { value: 'leave_unallocated', label: 'Leave unallocated' },
  { value: 'ask_monthly', label: 'Ask monthly' },
] as const;

const peso = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;

function currentManilaMonth() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? String(new Date().getFullYear());
  const month = parts.find((part) => part.type === 'month')?.value ?? String(new Date().getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function categoryIcon(name: string) {
  return budgetCategories.find((option) => option.label.toLowerCase() === name.toLowerCase())?.icon ?? budgetCategories[budgetCategories.length - 1].icon;
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
}

export default function Budget() {
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

  return <SafeAreaView style={styles.safe}>
     <View style={styles.header}><Pressable accessibilityLabel="Back to dashboard" onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={formPalette.ink} /></Pressable><View style={styles.titleWrap}><Text style={styles.eyebrow}>MONEY PLAN</Text><Text style={styles.title}>Budget</Text></View><ProfileHeaderButton /></View>
    {loading ? <View style={styles.center}><ActivityIndicator color={formPalette.accent} /><Text style={styles.muted}>Loading budget…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Budget unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : !data ? <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><BudgetRingSummary categories={[]} remaining={0} spent={0} budgeted={0} /><View style={styles.emptyCard}><View style={styles.emptyIcon}><WalletCards size={24} color={formPalette.accent} /></View><Text style={styles.emptyTitle}>No budget set for {label} yet</Text><Text style={styles.emptyCopy}>Set category limits and a monthly savings budget to give this month a clear plan.</Text><Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.emptyAction}><Text style={styles.emptyActionText}>Create Budget</Text></Pressable></View></ScrollView> : <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <BudgetRingSummary categories={data.categories.filter((category) => !category.goal)} remaining={data.remaining_budget} spent={spent} budgeted={budgeted} />
      <View style={styles.tip}><WalletCards size={20} color="#fff" /><Text style={styles.tipText}>{data.unallocated_income >= 0 ? `${peso(data.unallocated_income)} of income is unallocated this month.` : `Budget is ${peso(Math.abs(data.unallocated_income))} above income.`}</Text></View>
      <Section title="Category budgets" action={<Pressable accessibilityRole="button" accessibilityLabel="Edit budget" onPress={() => setOpen(true)} style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}><Pencil size={14} color={formPalette.accent} /><Text style={styles.sectionActionText}>Edit Budget</Text></Pressable>}><View style={styles.categoryList}>{data.categories?.filter((category) => !category.goal).map((category) => <BudgetCategoryRow key={category.id} category={category} />)}<SavingsBudgetRow summary={data} /></View></Section>
    </ScrollView>}
    {open && <BudgetForm month={month} summary={data} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refresh(); }} />}
  </SafeAreaView>;
}

function BudgetRingSummary({ categories, remaining, spent, budgeted }: { categories: Category[]; remaining: number; spent: number; budgeted: number }) {
  const colorFor = (category: Category) => category.color ?? categoryColors[category.name] ?? formPalette.accent;
  const segments = categories.filter((category) => category.spent > 0).map((category) => ({ key: category.id, value: category.spent, color: colorFor(category) }));
  return <View style={styles.ringSummary} accessibilityLabel={budgeted > 0 ? `${peso(remaining)} remaining. ${peso(spent)} spent of ${peso(budgeted)} budgeted.` : 'No category budgeted yet.'}>
    <Text style={styles.ringEyebrow}>BUDGET OVERVIEW</Text>
    <SegmentedRing size={210} strokeWidth={24} trackColor={formPalette.accentPale} segments={segments}>
      <View style={styles.ringCenter}><Text style={styles.ringLabel}>REMAINING</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.ringValue}>{budgeted > 0 ? peso(remaining) : '—'}</Text></View>
    </SegmentedRing>
    <Text style={styles.ringSupporting}>{budgeted > 0 ? `${peso(spent)} spent of ${peso(budgeted)} budgeted` : 'No category budgeted yet'}</Text>
    {categories.length ? <View style={styles.ringLegend}>{categories.map((category) => <View key={category.id} style={styles.legendChip}><View style={[styles.legendDot, { backgroundColor: colorFor(category) }]} /><Text style={styles.legendText}>{category.name}</Text></View>)}</View> : null}
  </View>;
}

function BudgetCategoryRow({ category }: { category: Category }) {
  const over = category.spent > category.budget;
  const color = category.color ?? categoryColors[category.name] ?? formPalette.accent;
  const CategoryIcon = categoryIcon(category.name);
  const tone = over ? formPalette.danger : color;
  return <BudgetProgressRow icon={<CategoryIcon size={19} color={tone} />} title={category.name} detail={`${peso(category.spent)} / ${peso(category.budget)} · ${category.percent}%`} percent={category.percent} color={tone} warning={over ? `This category is short by ${peso(category.spent - category.budget)} this month.` : undefined} />;
}

function SavingsBudgetRow({ summary }: { summary: Summary }) {
  const budget = Math.max(0, summary.monthly_savings_budget);
  const allocated = Math.min(budget, Math.max(0, summary.goal_allocation_total));
  const percent = budget > 0 ? Math.round((allocated / budget) * 100) : 0;
  const unallocated = Math.max(0, budget - allocated);
  return <View><BudgetProgressRow icon={<PiggyBank size={19} color={formPalette.accent} />} title="Savings" detail={`${peso(allocated)} / ${peso(budget)} · ${percent}%`} percent={percent} color={formPalette.accent} />{unallocated > 0 ? <Pressable accessibilityRole="link" accessibilityLabel={`Assign ${peso(unallocated)} unallocated savings`} onPress={() => router.push('/(tabs)/savings')} style={({ pressed }) => [styles.savingsNudge, pressed && styles.pressed]}><Text style={styles.savingsNudgeText}>{peso(unallocated)} unallocated — tap to assign</Text></Pressable> : null}</View>;
}

function BudgetProgressRow({ icon, title, detail, percent, color, warning }: { icon: ReactNode; title: string; detail: string; percent: number; color: string; warning?: string }) {
  const safePercent = Math.min(100, Math.max(0, percent));
  return <View style={styles.categoryCard}><View style={styles.categoryHeader}><View style={[styles.categoryIcon, { backgroundColor: `${color}22` }]}>{icon}</View><View style={styles.categoryMain}><Text numberOfLines={1} style={styles.categoryName}>{title}</Text><Text style={[styles.categoryAmounts, warning && styles.over]}>{detail}</Text></View><Text style={[styles.categoryPercent, { color }]}>{percent}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${safePercent}%`, backgroundColor: color }]} /></View>{warning ? <Text style={styles.warning}>{warning}</Text> : null}</View>;
}

function BudgetForm({ month, summary, onClose, onSaved }: { month: string; summary: Summary | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const initialEntries = useMemo(() => {
    const current = summary?.categories.filter((category) => !category.goal) ?? [];
    if (current.length) return current.map(({ id, name, budget }) => ({ id, name, budget }));
    return budgetCategories.map((category) => ({ id: `budget-${category.label.toLowerCase()}`, name: category.label, budget: 0 }));
  }, [summary]);
  const [entries] = useState<BudgetEntry[]>(initialEntries);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(initialEntries.map((entry) => [entry.id, entry.budget ? String(entry.budget) : ''])));
  const [selectedId, setSelectedId] = useState(initialEntries[0]?.id ?? 'savings');
  const [savingsDraft, setSavingsDraft] = useState(summary?.monthly_savings_budget ? String(summary.monthly_savings_budget) : '');
  const [autoDistribute, setAutoDistribute] = useState(Boolean(summary?.savings_auto_distribute));
  const [preference, setPreference] = useState<Summary['remaining_savings_behavior']>(summary?.remaining_savings_behavior ?? 'auto_general');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isSavings = selectedId === 'savings';
  const selectedEntry = entries.find((entry) => entry.id === selectedId);
  const amount = isSavings ? savingsDraft : drafts[selectedId] ?? '';
  const options = useMemo(() => {
    const known = new Set(budgetCategories.map((category) => category.label.toLowerCase()));
    const extras = entries.filter((entry) => !known.has(entry.name.toLowerCase())).map((entry) => ({ label: entry.name, icon: budgetCategories[budgetCategories.length - 1].icon }));
    return [...budgetCategories, ...extras, savingsBudgetOption];
  }, [entries]);
  const selectedLabel = isSavings ? savingsBudgetOption.label : selectedEntry?.name ?? 'Category';

  const changeAmount = (value: string) => {
    if (isSavings) setSavingsDraft(value);
    else setDrafts((current) => ({ ...current, [selectedId]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const categories = entries.map((entry) => ({ id: entry.id, name: entry.name, budget: evaluateAmountExpression(drafts[entry.id] ?? '') ?? 0 }));
      categories.push({ id: 'savings', name: 'Monthly Savings Budget', budget: evaluateAmountExpression(savingsDraft) ?? 0 });
      await authenticatedApiRequest('/api/budget', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, categories, auto_distribute_savings: autoDistribute, remaining_savings_behavior: preference }) });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this budget.');
    } finally {
      setSaving(false);
    }
  };

  return <FinanceFormSheet title={summary ? 'Edit budget' : 'Create budget'} eyebrow={monthLabel(month).toUpperCase()} amount={amount} onAmountChange={changeAmount} error={error} saving={saving} saveLabel={summary ? 'Save budget' : 'Create budget'} onSave={() => void save()} onClose={onClose}>
    <Text style={styles.formHint}>Set the monthly limit for one category at a time.</Text>
    <CategoryChipRow label="Budget category" value={isSavings ? savingsBudgetOption.label : selectedLabel} onChange={(label) => { if (label === savingsBudgetOption.label) setSelectedId('savings'); else setSelectedId(entries.find((entry) => entry.name === label)?.id ?? selectedId); }} options={options} />
    <View style={styles.limitPreview}><Text style={styles.limitLabel}>{selectedLabel}</Text><Text style={[styles.limitLabel, { fontSize: 13 }]}>{amount ? `₱${amount}` : 'No limit set'}</Text></View>
    <View style={styles.recurring}><View style={styles.recurringCopy}><Text style={styles.recurringTitle}>Auto-distribute savings</Text><Text style={styles.muted}>Plan goal allocations from this month’s savings budget.</Text></View><Switch accessibilityLabel="Auto-distribute savings" value={autoDistribute} onValueChange={setAutoDistribute} trackColor={{ false: '#D7E1DC', true: formPalette.accent }} thumbColor="#FFFFFF" /></View>
    <View style={styles.preference}><Text style={styles.preferenceLabel}>Remaining savings</Text><View style={styles.preferenceRow}>{preferenceOptions.map((option) => <Pressable key={option.value} onPress={() => setPreference(option.value)} style={({ pressed }) => [styles.preferenceChip, preference === option.value && styles.preferenceActive, pressed && styles.pressed]}><Text style={[styles.preferenceText, preference === option.value && styles.preferenceTextActive]}>{option.label}</Text></Pressable>)}</View></View>
  </FinanceFormSheet>;
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) { return <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{action}</View>{children}</View>; }

const styles = StyleSheet.create({
  savingsNudge: { minHeight: 28, justifyContent: 'center', marginTop: -2, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFF4D6' },
  savingsNudgeText: { color: '#9A6700', fontSize: 11, fontWeight: '800' },
  safe: { flex: 1, backgroundColor: formPalette.background }, header: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line }, back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, titleWrap: { flex: 1, marginLeft: 12 }, eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { marginTop: 3, color: formPalette.ink, fontSize: 23, fontWeight: '900' }, content: { padding: 20, paddingTop: 16, paddingBottom: 44 }, tip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: formPalette.accent }, tipText: { flex: 1, color: '#fff', fontSize: 12, lineHeight: 18, fontWeight: '700' }, ringSummary: { alignItems: 'center', marginBottom: 16, paddingVertical: 10 }, ringEyebrow: { marginBottom: 14, color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, ringCenter: { width: 135, alignItems: 'center' }, ringLabel: { color: formPalette.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, ringValue: { width: 130, marginTop: 5, color: formPalette.ink, fontSize: 25, fontWeight: '900', textAlign: 'center' }, ringSupporting: { marginTop: 14, color: formPalette.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' }, ringLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 14 }, legendChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendText: { color: formPalette.muted, fontSize: 10, fontWeight: '800' }, section: { marginTop: 22, padding: 16, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, sectionHeading: { minHeight: 42, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sectionTitle: { flex: 1, color: formPalette.ink, fontSize: 16, fontWeight: '900' }, sectionAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 21, backgroundColor: formPalette.accentPale }, sectionActionText: { color: formPalette.accentDark, fontSize: 11, fontWeight: '900' }, categoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, track: { height: 8, marginTop: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: formPalette.accentPale }, fill: { height: '100%', borderRadius: 4, backgroundColor: formPalette.accent }, categoryList: { gap: 10 }, categoryCard: { padding: 14, borderRadius: 17, backgroundColor: formPalette.background }, categoryIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, categoryMain: { flex: 1, marginLeft: 10 }, categoryName: { color: formPalette.ink, fontSize: 14, fontWeight: '900' }, categoryAmounts: { marginTop: 4, color: formPalette.muted, fontSize: 11, fontWeight: '700' }, categoryPercent: { color: formPalette.accent, fontSize: 13, fontWeight: '900' }, over: { color: formPalette.danger }, warning: { marginTop: 8, color: formPalette.danger, fontSize: 11, fontWeight: '800' }, allocationContext: { marginTop: -8, marginBottom: 16, color: formPalette.muted, fontSize: 11, lineHeight: 17, fontWeight: '600' }, allocationTotal: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }, allocationTotalLabel: { color: formPalette.muted, fontSize: 11, fontWeight: '800' }, allocationTotalValue: { color: formPalette.ink, fontSize: 22, fontWeight: '900' }, allocationLegend: { gap: 9, marginTop: 13 }, allocationLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, allocationDot: { width: 9, height: 9, borderRadius: 5 }, unallocatedDot: { backgroundColor: '#AAB5AF' }, allocationLegendLabel: { flex: 1, color: formPalette.muted, fontSize: 11, fontWeight: '700' }, allocationLegendAmount: { color: formPalette.ink, fontSize: 11, fontWeight: '900' }, allocationPrompt: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, backgroundColor: formPalette.accentPale }, allocationPromptCopy: { flex: 1 }, allocationPromptTitle: { color: formPalette.accentDark, fontSize: 12, fontWeight: '900' }, allocationPromptText: { marginTop: 3, color: formPalette.muted, fontSize: 10, fontWeight: '700' }, goalAllocations: { gap: 10, marginTop: 18 }, goalAllocationsTitle: { color: formPalette.ink, fontSize: 12, fontWeight: '900' }, noGoalAllocation: { marginTop: 18, padding: 14, borderRadius: 15, backgroundColor: formPalette.background, color: formPalette.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' }, muted: { marginTop: 4, color: formPalette.muted, fontSize: 12, lineHeight: 18 }, card: { margin: 20, padding: 18, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, cardTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' }, retry: { alignSelf: 'flex-start', marginTop: 14, padding: 10, borderRadius: 15, backgroundColor: formPalette.accentPale }, retryText: { color: formPalette.accent, fontWeight: '900' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, emptyCard: { alignItems: 'center', margin: 20, padding: 24, borderRadius: 22, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, emptyIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: formPalette.accentPale }, emptyTitle: { marginTop: 15, color: formPalette.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' }, emptyCopy: { marginTop: 8, color: formPalette.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' }, emptyAction: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18, paddingHorizontal: 24, borderRadius: 25, backgroundColor: formPalette.accent }, emptyActionText: { color: '#fff', fontWeight: '900' }, pressed: { opacity: 0.72 }, formHint: { color: formPalette.muted, fontSize: 12, lineHeight: 18 }, limitPreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: formPalette.accentPale }, limitLabel: { color: formPalette.accentDark, fontSize: 12, fontWeight: '900' }, recurring: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: 15, borderRadius: 17, backgroundColor: formPalette.background }, recurringCopy: { flex: 1, paddingRight: 10 }, recurringTitle: { color: formPalette.ink, fontSize: 14, fontWeight: '900' }, preference: { marginTop: 16 }, preferenceLabel: { marginBottom: 8, color: formPalette.muted, fontSize: 11, fontWeight: '900' }, preferenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, preferenceChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 15, backgroundColor: formPalette.background }, preferenceActive: { backgroundColor: formPalette.accentPale, borderWidth: 1, borderColor: formPalette.accent }, preferenceText: { color: formPalette.muted, fontSize: 11, fontWeight: '800' }, preferenceTextActive: { color: formPalette.accentDark },
});
