import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView as NativeSafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';
import { CalendarDays } from 'lucide-react-native';

import { DatePickerField } from '@/components/finance-form';
import { authenticatedApiRequest } from '@/services/api';
import { SegmentedRing } from '@/components/segmented-ring';
import { ProfileHeaderButton } from '@/components/profile-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';

const palette = {
  background: '#F4F7F1', surface: '#FFFFFF', ink: '#11231C', muted: '#5D6C65', accent: '#0F8A6B',
  accentDark: '#08654E', accentPale: '#D8EFE2', expensePale: '#FBE3DC', line: '#DCE8E0',
  danger: '#B42318', warning: '#B7791F', expense: '#D96C55', savings: '#159A8A',
};

type ReportPeriod = 'this_month' | 'last_month' | 'last_3_months' | 'custom';
type Range = { period: ReportPeriod; start: string; end: string; label: string; days: number; budgetMonths: number };
type Category = { name: string; amount: number; percent: number };
type SpendingPoint = { date: string; amount: number };
type Report = {
  range: Range;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  budget_utilization: number;
  budget: { total_budget: number; spent: number; remaining: number; over_budget_categories: { name: string }[] };
  savings: { total_saved: number; goal_progress: number; active_goals: number };
  categories: Category[];
  charts: { daily_spending: SpendingPoint[] };
};
type ReportInput = Partial<Report> & {
  range?: Partial<Range>;
  budget?: Partial<Report['budget']> | null;
  savings?: Partial<Report['savings']> | null;
  charts?: Partial<Report['charts']> | null;
};

const periodOptions: { label: string; value: ReportPeriod }[] = [
  { label: 'This month', value: 'this_month' }, { label: 'Last month', value: 'last_month' },
  { label: 'Last 3 months', value: 'last_3_months' }, { label: 'Custom', value: 'custom' },
];
const categoryColors = ['#E8775D', '#5D8FC4', '#4D9A73', '#D89B1D', '#4778C7', '#5DA9D6', '#8D70AD', '#8B8B8B'];

function numberOrZero(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function peso(value: number, signed = false) {
  const sign = signed && value < 0 ? '−' : '';
  return `${sign}₱${Math.abs(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
}
function manilaDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}
function initialCustomRange() { const date = manilaDateValue(new Date()); return { from: `${date.slice(0, 7)}-01`, to: date }; }

function normalizeReport(input?: ReportInput | null): Report {
  const source = input ?? {};
  const budget: Partial<Report['budget']> = source.budget ?? {};
  const savings: Partial<Report['savings']> = source.savings ?? {};
  const charts: Partial<Report['charts']> = source.charts ?? {};
  const range: Partial<Range> = source.range ?? {};
  const totalBudget = numberOrZero(budget.total_budget);
  const spent = numberOrZero(budget.spent ?? source.total_expenses);
  return {
    range: { period: range.period ?? 'this_month', start: range.start ?? '', end: range.end ?? '', label: range.label ?? 'Selected period', days: numberOrZero(range.days), budgetMonths: numberOrZero(range.budgetMonths) || 1 },
    total_income: numberOrZero(source.total_income), total_expenses: numberOrZero(source.total_expenses),
    net_savings: numberOrZero(source.net_savings), savings_rate: numberOrZero(source.savings_rate), budget_utilization: numberOrZero(source.budget_utilization),
    budget: { total_budget: totalBudget, spent, remaining: numberOrZero(budget.remaining ?? totalBudget - spent), over_budget_categories: Array.isArray(budget.over_budget_categories) ? budget.over_budget_categories : [] },
    savings: { total_saved: numberOrZero(savings.total_saved), goal_progress: numberOrZero(savings.goal_progress), active_goals: numberOrZero(savings.active_goals) },
    categories: Array.isArray(source.categories) ? source.categories : [],
    charts: { daily_spending: Array.isArray(charts.daily_spending) ? charts.daily_spending : [] },
  };
}

function Donut({ categories }: { categories: Category[] }) {
  const top = categories[0];
  return <View style={styles.donutWrap}><SegmentedRing radius={42} trackColor={palette.accentPale} segments={categories.map((category, index) => ({ key: category.name, value: category.amount, color: categoryColors[index % categoryColors.length] }))}><View style={styles.donutCenter}><Text style={styles.donutPercent}>{top ? `${Math.round(top.percent)}%` : '0%'}</Text><Text style={styles.donutLabel}>{top?.name ?? 'No spend'}</Text></View></SegmentedRing></View>;
}
function readableDate(date: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date.slice(0, 10)}T12:00:00`)); }
function chartData(values: SpendingPoint[], days: number) {
  if (days <= 45) return values.map((item) => ({ ...item, label: readableDate(item.date) }));
  const bucket = days <= 120 ? 7 : 30;
  const grouped = new Map<string, SpendingPoint>();
  values.forEach((item) => { const date = new Date(`${item.date.slice(0, 10)}T12:00:00`); date.setDate(date.getDate() - (bucket === 7 ? date.getDay() : date.getDate() - 1)); const key = date.toISOString().slice(0, 10); grouped.set(key, { date: key, amount: (grouped.get(key)?.amount ?? 0) + item.amount }); });
  return [...grouped.values()].map((item) => ({ ...item, label: bucket === 7 ? `Week of ${readableDate(item.date)}` : readableDate(item.date) }));
}
function DailySpendingChart({ values, days }: { values: SpendingPoint[]; days: number }) {
  const data = useMemo(() => chartData(values, days), [values, days]);
  const [selected, setSelected] = useState<(typeof data)[number] | null>(null);
  if (!data.length || data.every((item) => item.amount === 0)) return <View style={styles.emptyInner}><Text style={styles.muted}>No expenses recorded for this period.</Text></View>;
  const max = Math.max(1, ...data.map((item) => item.amount));
  const highest = data.reduce((best, item) => item.amount > best.amount ? item : best, data[0]);
  return <View><View style={styles.chartTop}><View><Text style={styles.chartMode}>{days <= 45 ? 'Daily spending' : days <= 120 ? 'Weekly spending' : 'Monthly spending'}</Text><Text style={styles.chartScale}>{peso(max)} peak</Text></View>{selected ? <View style={styles.tooltip}><Text style={styles.tooltipDate}>{selected.label}</Text><Text style={styles.tooltipAmount}>{peso(selected.amount)} spent</Text></View> : null}</View><View style={styles.barChart}><View style={styles.yAxis}>{[max, max / 2, 0].map((tick) => <Text key={tick} style={styles.yLabel}>{tick === 0 ? '₱0' : `₱${Math.round(tick / 1000)}k`}</Text>)}</View><View style={styles.plot}><View style={styles.gridLines}>{[0, 1, 2].map((line) => <View key={line} style={styles.gridLine} />)}</View><View style={styles.bars}>{data.map((item) => <Pressable key={item.date} accessibilityRole="button" accessibilityLabel={`${item.label}: ${peso(item.amount)} spent`} onPress={() => setSelected(item)} style={[styles.barSlot, selected?.date === item.date && styles.barSlotSelected]}><View style={[styles.bar, { height: `${Math.max(item.amount ? 3 : 0, item.amount / max * 100)}%` }]} /></Pressable>)}</View></View></View><View style={styles.chartLabels}><Text style={styles.chartLabel}>{data[0]?.label}</Text><Text style={styles.chartLabel}>{data[Math.floor(data.length / 2)]?.label}</Text><Text style={styles.chartLabel}>{data[data.length - 1]?.label}</Text></View><Text style={styles.insight}>Highest spending period · {highest.label} · {peso(highest.amount)}</Text></View>;
}
function SavingsAllocation({ income, expenses, savings, rate }: { income: number; expenses: number; savings: number; rate: number }) {
  if (!income && !expenses) return <View style={styles.emptyInner}><Text style={styles.muted}>No financial activity for this period.</Text></View>;
  const saved = Math.max(0, Math.min(100, rate));
  const spent = Math.max(0, Math.min(100, income ? expenses / income * 100 : 100));
  return <View><View style={styles.allocationTrack}><View style={[styles.allocationSaved, { width: `${saved}%` }]} /><View style={[styles.allocationSpent, { width: `${spent}%` }]} /></View><View style={styles.allocationLegend}><Text style={styles.allocationLabel}>Saved {rate.toFixed(1)}% · {peso(Math.max(0, savings))}</Text><Text style={styles.allocationLabel}>Spent {Math.max(0, 100 - rate).toFixed(1)}% · {peso(expenses)}</Text></View></View>;
}
function BudgetProgress({ total, spent, remaining }: { total: number; spent: number; remaining: number }) {
  if (!total) return <View style={styles.emptyInner}><Text style={styles.muted}>No budget set for this period.</Text></View>;
  const percent = Math.round(spent / total * 100); const fill = Math.min(100, Math.max(0, spent / total * 100));
  const color = percent > 100 ? palette.danger : percent >= 90 ? palette.expense : percent >= 70 ? palette.warning : palette.savings;
  return <View><View style={styles.budgetTrack}><View style={[styles.budgetFill, { width: `${fill}%`, backgroundColor: color }]} /></View><View style={styles.budgetMeta}><Text style={styles.budgetPercent}>{percent}% used</Text><Text style={styles.budgetRemaining}>{remaining >= 0 ? `${peso(remaining)} remaining` : `${peso(Math.abs(remaining))} over`}</Text></View></View>;
}

function SafeAreaView(props: SafeAreaViewProps) { const { colors } = useAppTheme(); return <NativeSafeAreaView {...props} style={[props.style, { backgroundColor: colors.background }]} />; }

export default function ReportsScreen() {
  const bottomNavClearance = useBottomNavClearance(); const router = useRouter();
  const [period, setPeriod] = useState<ReportPeriod>('this_month'); const [customRange, setCustomRange] = useState(initialCustomRange); const [report, setReport] = useState<Report | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { const params = new URLSearchParams({ period }); if (period === 'custom') { params.set('from', customRange.from); params.set('to', customRange.to); } setReport(normalizeReport(await authenticatedApiRequest<ReportInput>(`/api/reports/summary?${params.toString()}`))); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Reports could not load.'); } finally { setLoading(false); } }, [customRange.from, customRange.to, period]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]} showsVerticalScrollIndicator={false}><FinancialScreenHeader title="Reports" onBack={() => router.back()} rightAction={<ProfileHeaderButton />} /><View style={styles.filterContainer}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>{periodOptions.map((option) => <Pressable key={option.value} onPress={() => setPeriod(option.value)} style={[styles.periodChip, period === option.value && styles.periodChipActive]}><Text style={[styles.periodText, period === option.value && styles.periodTextActive]}>{option.label}</Text></Pressable>)}</ScrollView></View>{period === 'custom' ? <View style={styles.customCard}><CalendarDays size={18} color={palette.accent} /><View style={styles.customDates}><DatePickerField label="From" value={customRange.from} onChange={(from) => setCustomRange((current) => ({ ...current, from }))} /><DatePickerField label="To" value={customRange.to} onChange={(to) => setCustomRange((current) => ({ ...current, to }))} /></View></View> : null}{loading ? <View style={styles.state}><ActivityIndicator color={palette.accent} /><Text style={styles.muted}>Loading report…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Reports unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : report ? <><View style={styles.card}><Text style={styles.cardEyebrow}>Expense distribution</Text><Text style={styles.cardSubtitle}>Where your spending went</Text>{report.categories.length ? <View style={styles.donutRow}><Donut categories={report.categories} /><View style={styles.legend}>{report.categories.slice(0, 6).map((category, index) => <View key={category.name} style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: categoryColors[index % categoryColors.length] }]} /><Text style={styles.legendName} numberOfLines={1}>{category.name}</Text><Text style={styles.legendAmount}>{peso(category.amount)} · {Math.round(category.percent)}%</Text></View>)}</View></View> : <View style={styles.emptyInner}><Text style={styles.muted}>No spending to categorize yet.</Text></View>}</View><View style={[styles.card, styles.expenseCard]}><Text style={styles.cardEyebrow}>Total expenses</Text><Text style={[styles.metricValue, styles.expenseValue]}>{peso(report.total_expenses)}</Text><Text style={styles.cardSubtitle}>{report.charts.daily_spending.filter((item) => item.amount > 0).length} transaction days during this period</Text><View style={styles.trend}><DailySpendingChart values={report.charts.daily_spending} days={report.range.days} /></View></View><View style={[styles.card, styles.savingsCard]}><Text style={styles.cardEyebrow}>Net savings</Text><Text style={[styles.metricValue, report.net_savings < 0 ? styles.warning : styles.savingsValue]}>{peso(report.net_savings, true)}</Text><Text style={styles.cardSubtitle}>{report.net_savings < 0 ? `You spent ${peso(Math.abs(report.net_savings))} more than you earned` : `${report.savings_rate.toFixed(1)}% savings rate`}</Text><Text style={styles.chartLabelTitle}>Income allocation</Text><SavingsAllocation income={report.total_income} expenses={report.total_expenses} savings={report.net_savings} rate={report.savings_rate} /><Text style={styles.insight}>{report.net_savings < 0 ? `You spent ${peso(Math.abs(report.net_savings))} more than you earned` : report.net_savings === 0 ? 'Nothing remained after spending' : `You kept ${report.savings_rate.toFixed(1)}% of your income`}</Text></View><View style={[styles.card, styles.budgetCard]}><Text style={styles.cardEyebrow}>Budget used</Text><Text style={[styles.metricValue, report.budget.remaining < 0 ? styles.warning : styles.budgetValue]}>{report.budget.total_budget ? `${report.budget_utilization}%` : 'No budget set'}</Text><Text style={styles.cardSubtitle}>{report.budget.total_budget ? `${peso(report.budget.spent)} of ${peso(report.budget.total_budget)}` : 'Set a budget to track progress'}</Text><Text style={styles.chartLabelTitle}>Budget progress</Text><BudgetProgress total={report.budget.total_budget} spent={report.budget.spent} remaining={report.budget.remaining} /><Text style={styles.insight}>{report.budget.total_budget ? report.budget.remaining >= 0 ? `You have ${peso(report.budget.remaining)} remaining` : `You are ${peso(Math.abs(report.budget.remaining))} over budget` : 'No budget set for this period.'}</Text></View></> : null}{!loading && !error && !report ? <View style={styles.state}><Text style={styles.cardTitle}>No report data yet</Text><Text style={styles.muted}>Add a few financial records to see insights here.</Text></View> : null}</ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background }, content: { padding: 24, paddingTop: 14, gap: 14 },
  filterContainer: { padding: 6, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: 'rgba(220,232,224,0.9)' }, periods: { gap: 6 },
  periodChip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 13, justifyContent: 'center' }, periodChipActive: { backgroundColor: palette.accent }, periodText: { color: palette.muted, fontSize: 12, fontWeight: '800' }, periodTextActive: { color: '#FFFFFF' },
  customCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }, customDates: { flex: 1, gap: 10 },
  card: { padding: 16, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }, expenseCard: { borderTopWidth: 3, borderTopColor: palette.expense }, savingsCard: { borderTopWidth: 3, borderTopColor: palette.savings }, budgetCard: { borderTopWidth: 3, borderTopColor: palette.warning },
  cardEyebrow: { color: palette.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' }, cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' }, cardSubtitle: { marginTop: 3, color: palette.muted, fontSize: 11, fontWeight: '600' }, metricValue: { marginTop: 7, color: palette.ink, fontSize: 28, fontWeight: '900' }, chartLabelTitle: { marginTop: 18, marginBottom: 9, color: palette.ink, fontSize: 12, fontWeight: '900' }, expenseValue: { color: palette.expense }, savingsValue: { color: palette.savings }, budgetValue: { color: palette.warning }, warning: { color: palette.warning },
  donutRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }, donutWrap: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' }, donutCenter: { alignItems: 'center', maxWidth: 82 }, donutPercent: { color: palette.ink, fontSize: 20, fontWeight: '900' }, donutLabel: { marginTop: 2, color: palette.muted, fontSize: 9, fontWeight: '800', textAlign: 'center' }, legend: { flex: 1, gap: 9 }, legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, legendDot: { width: 8, height: 8, borderRadius: 4 }, legendName: { flex: 1, color: palette.ink, fontSize: 10, fontWeight: '700' }, legendAmount: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  trend: { marginTop: 16 }, chartTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 38 }, chartMode: { color: palette.ink, fontSize: 12, fontWeight: '900' }, chartScale: { marginTop: 3, color: palette.muted, fontSize: 10, fontWeight: '700' }, tooltip: { alignItems: 'flex-end', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: palette.expensePale }, tooltipDate: { color: palette.expense, fontSize: 10, fontWeight: '800' }, tooltipAmount: { marginTop: 2, color: palette.ink, fontSize: 11, fontWeight: '900' }, barChart: { flexDirection: 'row', height: 150, marginTop: 10 }, yAxis: { width: 38, justifyContent: 'space-between', paddingVertical: 2 }, yLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' }, plot: { flex: 1, position: 'relative', borderBottomWidth: 1, borderBottomColor: palette.line }, gridLines: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' }, gridLine: { borderTopWidth: 1, borderTopColor: palette.line, borderStyle: 'dashed' }, bars: { height: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 2 }, barSlot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 1 }, barSlotSelected: { backgroundColor: palette.expensePale, borderRadius: 4 }, bar: { width: '100%', borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: palette.expense }, chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }, chartLabel: { maxWidth: '32%', color: palette.muted, fontSize: 9, fontWeight: '700' }, insight: { marginTop: 14, color: palette.muted, fontSize: 11, fontWeight: '800' },
  allocationTrack: { flexDirection: 'row', height: 18, overflow: 'hidden', borderRadius: 9, backgroundColor: palette.line }, allocationSaved: { backgroundColor: palette.savings }, allocationSpent: { backgroundColor: palette.expense }, allocationLegend: { marginTop: 10, gap: 7 }, allocationLabel: { color: palette.muted, fontSize: 11, fontWeight: '700' }, budgetTrack: { height: 18, overflow: 'hidden', borderRadius: 9, backgroundColor: palette.line }, budgetFill: { height: '100%', borderRadius: 9 }, budgetMeta: { marginTop: 9, flexDirection: 'row', justifyContent: 'space-between' }, budgetPercent: { color: palette.ink, fontSize: 11, fontWeight: '900' }, budgetRemaining: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  state: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 }, emptyInner: { paddingVertical: 24, alignItems: 'center' }, muted: { color: palette.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' }, retry: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: palette.accent }, retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
