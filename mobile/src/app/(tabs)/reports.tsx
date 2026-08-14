import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView as NativeSafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';
import { CheckCircle2, Lightbulb, TrendingDown, TrendingUp, WalletCards } from 'lucide-react-native';

import { authenticatedApiRequest } from '@/services/api';
import { SegmentedBar, SegmentedRing } from '@/components/segmented-ring';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';
import { getCategoryMeta } from '@/constants/categories';

const palette = {
  background: '#F4F7F1', surface: '#FFFFFF', ink: '#11231C', muted: '#5D6C65', accent: '#0F8A6B',
  accentDark: '#08654E', accentPale: '#D8EFE2', expensePale: '#FBE3DC', line: '#DCE8E0',
  danger: '#B42318', warning: '#B7791F', expense: '#D96C55', savings: '#159A8A',
};

type ReportPeriod = 'this_month' | 'last_month' | 'one_year';
type Range = { period: ReportPeriod; start: string; end: string; label: string; days: number; budgetMonths: number };
type Category = { name: string; amount: number; percent: number };
type SpendingPoint = { date: string; amount: number };
type TrendPoint = { month: string; income: number; expenses: number; net: number };
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
  monthly_trend: TrendPoint[];
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
  { label: '1 year', value: 'one_year' },
];

function numberOrZero(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function peso(value: number, signed = false) { const sign = signed && value < 0 ? '−' : ''; return `${sign}₱${Math.abs(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`; }
function shortRangeLabel(range: Range) {
  if (!range.start || !range.end) return range.label;
  const start = new Date(`${range.start}T12:00:00`); const end = new Date(`${range.end}T12:00:00`);
  if (range.period === 'one_year') return `${new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(end)}`;
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start);
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end);
  return `${startLabel} – ${endLabel}`;
}

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
    total_income: numberOrZero(source.total_income), total_expenses: numberOrZero(source.total_expenses), net_savings: numberOrZero(source.net_savings), savings_rate: numberOrZero(source.savings_rate), budget_utilization: numberOrZero(source.budget_utilization),
    budget: { total_budget: totalBudget, spent, remaining: numberOrZero(budget.remaining ?? totalBudget - spent), over_budget_categories: Array.isArray(budget.over_budget_categories) ? budget.over_budget_categories : [] },
    savings: { total_saved: numberOrZero(savings.total_saved), goal_progress: numberOrZero(savings.goal_progress), active_goals: numberOrZero(savings.active_goals) },
    categories: Array.isArray(source.categories) ? [...source.categories].sort((left, right) => numberOrZero(right.amount) - numberOrZero(left.amount)) : [],
    monthly_trend: Array.isArray(source.monthly_trend) ? source.monthly_trend.map((item) => ({ month: String(item.month), income: numberOrZero(item.income), expenses: numberOrZero(item.expenses), net: numberOrZero(item.net) })) : [],
    charts: { daily_spending: Array.isArray(charts.daily_spending) ? charts.daily_spending : [] },
  };
}

function Donut({ categories }: { categories: Category[] }) {
  const { colors } = useAppTheme();
  const top = categories[0];
  return <View style={styles.donutWrap}><SegmentedRing size={132} radius={50} strokeWidth={16} trackColor={colors.primarySoft} segments={categories.map((category) => ({ key: category.name, value: category.amount, color: getCategoryMeta(category.name).color }))}><View style={{ alignItems: 'center', width: 78 }}><Text style={styles.donutPercent}>{top ? `${Math.round(top.percent)}%` : '0%'}</Text><Text numberOfLines={1} style={[styles.donutLabel, { maxWidth: 76 }]}>{top?.name ?? 'No spend'}</Text></View></SegmentedRing></View>;
}

function SpendingByCategory({ categories }: { categories: Category[] }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const visibleCategories = expanded ? categories : categories.slice(0, 6);
  return <View style={styles.card}><View style={styles.sectionHeading}><Text style={styles.cardEyebrow}>Spending by category</Text><Text style={styles.cardHint}>{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</Text></View>{categories.length ? <View style={{ flexDirection: width < 360 ? 'column' : 'row', alignItems: width < 360 ? 'stretch' : 'center', gap: 20, marginTop: 12 }}><Donut categories={categories} /><View style={{ flex: 1, gap: 9 }}>{visibleCategories.map((category) => <View key={category.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><View style={[styles.legendDot, { backgroundColor: getCategoryMeta(category.name).color }]} /><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={styles.legendName}>{category.name}</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>{peso(category.amount)}</Text></View><Text style={styles.legendPercent}>{Math.round(category.percent)}%</Text></View>)}{categories.length > 6 && <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)} style={{ alignSelf: 'flex-start', marginTop: 2 }}><Text style={[styles.legendPercent, { color: colors.primary }]}>{expanded ? 'Show less' : `Show all ${categories.length}`}</Text></Pressable>}</View></View> : <Text style={styles.emptyCopy}>No spending recorded.</Text>}</View>;
}

function IncomeVsSpending({ report }: { report: Report }) {
  const [selected, setSelected] = useState<TrendPoint | null>(null);
  const data = report.monthly_trend.length ? report.monthly_trend : [{ month: report.range.label, income: report.total_income, expenses: report.total_expenses, net: report.net_savings }];
  const max = Math.max(1, ...data.flatMap((item) => [item.income, item.expenses]));
  const shortLabel = (value: string) => /^\d{4}-\d{2}$/.test(value) ? new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(`${value}-01T12:00:00`)) : value;
  return <View><View style={styles.chartSummary}><View><Text style={styles.chartMetricLabel}>Income</Text><Text style={styles.chartIncome}>{peso(report.total_income)}</Text></View><View><Text style={styles.chartMetricLabel}>Spending</Text><Text style={styles.chartExpense}>{peso(report.total_expenses)}</Text></View>{selected ? <View style={styles.chartTooltip}><Text style={styles.tooltipTitle}>{shortLabel(selected.month)}</Text><Text style={styles.tooltipText}>↑ {peso(selected.income)}  ·  ↓ {peso(selected.expenses)}</Text></View> : null}</View><View accessibilityRole="image" accessibilityLabel={`Income ${peso(report.total_income)} compared with spending ${peso(report.total_expenses)}`} style={styles.groupedChart}>{data.map((item) => <Pressable key={item.month} accessibilityRole="button" accessibilityLabel={`${shortLabel(item.month)}: income ${peso(item.income)}, spending ${peso(item.expenses)}`} onPress={() => setSelected(item)} style={[styles.group, selected?.month === item.month && styles.groupSelected]}><View style={styles.groupBars}><View style={[styles.incomeBar, { height: `${Math.max(item.income ? 5 : 0, item.income / max * 100)}%` }]} /><View style={[styles.expenseBar, { height: `${Math.max(item.expenses ? 5 : 0, item.expenses / max * 100)}%` }]} /></View><Text numberOfLines={1} style={styles.groupLabel}>{shortLabel(item.month)}</Text></Pressable>)}</View><View style={styles.chartLegend}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: palette.savings }]} /><Text style={styles.legendText}>Income</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: palette.expense }]} /><Text style={styles.legendText}>Spending</Text></View></View></View>;
}

function SavingsProgress({ report }: { report: Report }) {
  const { colors } = useAppTheme();
  const savedPercent = Math.max(0, Math.min(100, report.savings_rate));
  const spentPercent = report.total_income > 0 ? Math.max(0, Math.min(100, report.total_expenses / report.total_income * 100)) : 0;
  return <View style={styles.progressCard}><View style={styles.sectionHeading}><Text style={styles.cardEyebrow}>Savings progress</Text><TrendingUp size={17} color={palette.savings} /></View><Text style={styles.savingsValue}>{peso(Math.max(0, report.net_savings))} saved</Text><Text style={styles.cardSubtitle}>{report.total_income ? `${Math.round(savedPercent)}% of income` : 'Income needed to calculate savings'}</Text><SegmentedBar accessibilityLabel={`Saved ${Math.round(savedPercent)} percent and spent ${Math.round(spentPercent)} percent`} segments={[{ key: 'saved', value: savedPercent, color: palette.savings }, { key: 'spent', value: spentPercent, color: palette.expense }]} trackColor={colors.primarySoft} height={9} /><View style={styles.progressMeta}><Text style={styles.metaText}>Saved {peso(Math.max(0, report.net_savings))}</Text><Text style={styles.metaText}>Spent {peso(report.total_expenses)}</Text></View>{report.savings.active_goals ? <Text style={styles.smallNote}>{report.savings.active_goals} active savings goal{report.savings.active_goals === 1 ? '' : 's'}</Text> : null}</View>;
}

function BudgetProgress({ report }: { report: Report }) {
  if (!report.budget.total_budget) return <View style={styles.progressCard}><View style={styles.sectionHeading}><Text style={styles.cardEyebrow}>Budget progress</Text><WalletCards size={17} color={palette.warning} /></View><Text style={styles.emptyCopy}>No budget set for this period.</Text></View>;
  const percent = Math.round(report.budget.spent / report.budget.total_budget * 100);
  const fill = Math.max(0, Math.min(100, report.budget.spent / report.budget.total_budget * 100));
  const color = percent > 100 ? palette.danger : percent >= 90 ? palette.expense : percent >= 70 ? palette.warning : palette.savings;
  return <View style={styles.card}><View style={styles.sectionHeading}><Text style={styles.cardEyebrow}>Budget progress</Text><Text style={[styles.budgetPercent, { color }]}>{percent}% used</Text></View><Text style={styles.cardSubtitle}>{peso(report.budget.spent)} of {peso(report.budget.total_budget)}</Text><View style={styles.budgetTrack}><View style={[styles.budgetFill, { width: `${fill}%`, backgroundColor: color }]} /></View><View style={styles.progressMeta}><Text style={styles.metaText}>{report.budget.remaining >= 0 ? `${peso(report.budget.remaining)} remaining` : `${peso(Math.abs(report.budget.remaining))} over`}</Text>{report.budget.over_budget_categories.length ? <Text style={styles.metaText}>{report.budget.over_budget_categories.length} over limit</Text> : <Text style={styles.metaText}>On track</Text>}</View></View>;
}

function Insights({ report }: { report: Report }) {
  const insights = useMemo(() => {
    const rows: { title: string; copy: string; icon: 'category' | 'trend' | 'budget' }[] = [];
    const top = report.categories[0];
    if (top) rows.push({ title: `${top.name} leads spending`, copy: `${Math.round(top.percent)}% of your expenses went to this category.`, icon: 'category' });
    if (report.total_income > 0 && report.net_savings > 0) rows.push({ title: 'You kept money this period', copy: `${Math.round(report.savings_rate)}% of income remained after spending.`, icon: 'trend' });
    if (report.budget.total_budget) rows.push({ title: report.budget.remaining >= 0 ? 'Budget is still available' : 'Budget needs attention', copy: report.budget.remaining >= 0 ? `${peso(report.budget.remaining)} remains in your selected period.` : `${peso(Math.abs(report.budget.remaining))} is over the planned budget.`, icon: 'budget' });
    return rows.slice(0, 3);
  }, [report]);
  if (!insights.length) return null;
  return <View style={styles.card}><View style={styles.sectionHeading}><Text style={styles.cardEyebrow}>Top insights</Text><Lightbulb size={17} color={palette.warning} /></View>{insights.map((item) => { const Icon = item.icon === 'category' ? TrendingDown : item.icon === 'budget' ? WalletCards : CheckCircle2; return <View key={item.title} style={styles.insightRow}><View style={styles.insightIcon}><Icon size={15} color={palette.accent} /></View><View style={styles.insightCopy}><Text style={styles.insightTitle}>{item.title}</Text><Text style={styles.insightText}>{item.copy}</Text></View></View>; })}</View>;
}

function highestSpending(values: SpendingPoint[]) { return values.reduce<SpendingPoint | null>((best, value) => value.amount > (best?.amount ?? 0) ? value : best, null); }
function readableDate(date: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date.slice(0, 10)}T12:00:00`)); }
function SafeAreaView(props: SafeAreaViewProps) { const { colors } = useAppTheme(); return <NativeSafeAreaView {...props} style={[props.style, { backgroundColor: colors.background }]} />; }

export default function ReportsScreen() {
  const { colors } = useAppTheme();
  styles = makeStyles({ ...palette, background: colors.background, surface: colors.surfaceElevated, ink: colors.textPrimary, muted: colors.textSecondary, accent: colors.primary, accentDark: colors.primary, accentPale: colors.primarySoft, line: colors.border });
  const bottomNavClearance = useBottomNavClearance(); const router = useRouter();
  const [period, setPeriod] = useState<ReportPeriod>('this_month'); const [report, setReport] = useState<Report | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const requestId = useRef(0);
  const refresh = useCallback(async () => { const currentRequest = ++requestId.current; setLoading(true); setError(''); try { const params = new URLSearchParams({ period }); const response = normalizeReport(await authenticatedApiRequest<ReportInput>(`/api/reports/summary?${params.toString()}`)); if (currentRequest === requestId.current) setReport(response); } catch { if (currentRequest === requestId.current) setError('We couldn’t load your reports right now. Please try again.'); } finally { if (currentRequest === requestId.current) setLoading(false); } }, [period]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const peak = report ? highestSpending(report.charts.daily_spending) : null;

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><FinancialScreenHeader title="Reports" onBack={() => router.back()} rightAction={<NotificationHeaderButton />} /><ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]} showsVerticalScrollIndicator={false}>
    <View style={styles.filterContainer}><View style={styles.periods}>{periodOptions.map((option) => <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={`${option.label} reports`} accessibilityState={{ selected: period === option.value }} onPress={() => setPeriod(option.value)} style={[styles.periodChip, period === option.value && styles.periodChipActive]}><Text numberOfLines={1} style={[styles.periodText, period === option.value && styles.periodTextActive]}>{option.label}</Text></Pressable>)}</View></View>
    {loading ? <View style={styles.loadingDashboard}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading insights…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Reports unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : report ? <>
      <View accessibilityRole="summary" accessibilityLabel={`Selected period ${shortRangeLabel(report.range)}. Income ${peso(report.total_income)}. Spending ${peso(report.total_expenses)}. Net savings ${peso(report.net_savings, true)}.`} style={styles.summaryCard}><Text style={styles.cardEyebrow}>Selected period</Text><Text style={styles.summaryTitle}>{shortRangeLabel(report.range)}</Text><View style={styles.summaryMetrics}><View style={styles.summaryMetric}><Text style={styles.metricLabel}>Income</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.summaryIncome}>{peso(report.total_income)}</Text></View><View style={styles.summaryMetric}><Text style={styles.metricLabel}>Spending</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.summaryExpense}>{peso(report.total_expenses)}</Text></View><View style={styles.summaryMetric}><Text style={styles.metricLabel}>Net savings</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.summaryNet, report.net_savings < 0 && styles.warning]}>{peso(report.net_savings, true)}</Text></View></View></View>
      <SpendingByCategory categories={report.categories} />
      <View style={styles.duoRow}><View style={styles.card}><View style={styles.sectionHeading}><Text style={styles.cardEyebrow}>Income vs spending</Text><Text style={styles.cardHint}>{report.range.days > 45 ? 'Monthly view' : 'Selected period'}</Text></View><IncomeVsSpending report={report} /></View><SavingsProgress report={report} /></View>
      <BudgetProgress report={report} />
      {peak ? <View style={styles.peakRow}><TrendingDown size={16} color={colors.primary} /><Text style={styles.peakText}>Peak spending <Text style={styles.peakStrong}>{readableDate(peak.date)} · {peso(peak.amount)}</Text></Text></View> : null}
      <Insights report={report} />
    </> : <View style={styles.loadingDashboard}><Text style={styles.cardTitle}>No report data yet</Text><Text style={styles.muted}>Add a few financial records to see insights here.</Text></View>}
  </ScrollView></SafeAreaView>;
}

function makeStyles(themePalette: typeof palette) { const p = themePalette; return StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background }, content: { padding: 18, paddingTop: 12, gap: 12 },
  filterContainer: { padding: 4, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }, periods: { flexDirection: 'row', gap: 4 }, periodChip: { minHeight: 44, flex: 1, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, periodChipActive: { backgroundColor: p.accentPale }, periodText: { color: p.muted, fontSize: 12, fontWeight: '800' }, periodTextActive: { color: p.ink, fontWeight: '900' },
  customCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }, customDates: { flex: 1, gap: 8 },
  card: { padding: 16, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }, summaryCard: { padding: 18, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }, cardEyebrow: { color: p.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }, cardTitle: { color: p.ink, fontSize: 16, fontWeight: '900' }, cardSubtitle: { marginTop: 3, color: p.muted, fontSize: 12, fontWeight: '600' }, cardHint: { color: p.muted, fontSize: 11, fontWeight: '700' }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, summaryTitle: { marginTop: 6, color: p.ink, fontSize: 19, fontWeight: '900' }, summaryMetrics: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 20 }, summaryMetric: { flex: 1, minWidth: 0 }, metricLabel: { color: p.muted, fontSize: 11, fontWeight: '700' }, summaryIncome: { marginTop: 4, color: p.savings, fontSize: 17, fontWeight: '900' }, summaryExpense: { marginTop: 4, color: p.expense, fontSize: 17, fontWeight: '900' }, summaryNet: { marginTop: 4, color: p.savings, fontSize: 17, fontWeight: '900' }, warning: { color: p.danger },
  chartSummary: { flexDirection: 'row', alignItems: 'flex-end', gap: 22, marginTop: 14 }, chartMetricLabel: { color: p.muted, fontSize: 11, fontWeight: '700' }, chartIncome: { marginTop: 2, color: p.savings, fontSize: 16, fontWeight: '900' }, chartExpense: { marginTop: 2, color: p.expense, fontSize: 16, fontWeight: '900' }, chartTooltip: { flex: 1, alignItems: 'flex-end', padding: 7, borderRadius: 10, backgroundColor: p.expensePale }, tooltipTitle: { color: p.ink, fontSize: 10, fontWeight: '900' }, tooltipText: { marginTop: 2, color: p.muted, fontSize: 9, fontWeight: '700' }, groupedChart: { height: 146, flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 14, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: p.line }, group: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', height: '100%', paddingHorizontal: 1, borderRadius: 9 }, groupSelected: { backgroundColor: p.accentPale }, groupBars: { width: '100%', height: '84%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 }, incomeBar: { width: 7, minHeight: 3, borderRadius: 5, backgroundColor: p.savings }, expenseBar: { width: 7, minHeight: 3, borderRadius: 5, backgroundColor: p.expense }, groupLabel: { maxWidth: 28, marginTop: 5, color: p.muted, fontSize: 8, fontWeight: '700' }, chartLegend: { flexDirection: 'row', gap: 16, marginTop: 10 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendText: { color: p.muted, fontSize: 10, fontWeight: '700' },
  duoRow: { flexDirection: 'row', gap: 12 }, categoryCard: { flex: 1, minWidth: 0 }, progressCard: { flex: 1, minWidth: 0, padding: 14, borderRadius: 18, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, justifyContent: 'flex-start' }, donutWrap: { alignSelf: 'center', marginTop: 10 }, donutCenter: { alignItems: 'center', width: 60 }, donutPercent: { color: p.ink, fontSize: 16, fontWeight: '900' }, donutLabel: { maxWidth: 58, marginTop: 1, color: p.muted, fontSize: 8, fontWeight: '800', textAlign: 'center' }, compactLegend: { gap: 8, marginTop: 10 }, compactLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, legendName: { flex: 1, color: p.ink, fontSize: 10, fontWeight: '700' }, legendPercent: { color: p.muted, fontSize: 10, fontWeight: '800' }, savingsValue: { marginTop: 14, color: p.savings, fontSize: 18, fontWeight: '900' }, allocationTrack: { height: 9, overflow: 'hidden', flexDirection: 'row', borderRadius: 5, backgroundColor: p.accentPale }, progressMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 8 }, metaText: { flex: 1, color: p.muted, fontSize: 9, fontWeight: '700' }, smallNote: { marginTop: 11, color: p.muted, fontSize: 10, fontWeight: '700' }, emptyCopy: { marginTop: 16, color: p.muted, fontSize: 11, lineHeight: 16 },
  budgetPercent: { fontSize: 13, fontWeight: '900' }, budgetTrack: { height: 9, marginTop: 15, overflow: 'hidden', borderRadius: 5, backgroundColor: p.accentPale }, budgetFill: { height: '100%', borderRadius: 5 }, peakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }, peakText: { color: p.muted, fontSize: 11, fontWeight: '700' }, peakStrong: { color: p.ink, fontWeight: '900' },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }, insightIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: p.accentPale }, insightCopy: { flex: 1 }, insightTitle: { color: p.ink, fontSize: 11, fontWeight: '900' }, insightText: { marginTop: 2, color: p.muted, fontSize: 10, lineHeight: 15 }, loadingDashboard: { minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 9 }, muted: { color: p.muted, fontSize: 12, lineHeight: 18 }, retry: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: p.accentPale }, retryText: { color: p.accent, fontSize: 12, fontWeight: '900' },
}); }

let styles = makeStyles(palette);
