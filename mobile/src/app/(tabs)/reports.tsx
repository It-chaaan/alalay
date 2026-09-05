import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { cashFlowComparison } from '@/utils/cash-flow-comparison';

const palette = {
  background: '#F4F7F1', surface: '#FFFFFF', ink: '#11231C', muted: '#5D6C65', accent: '#0F8A6B',
  accentDark: '#08654E', accentPale: '#D8EFE2', expensePale: '#FBE3DC', line: '#DCE8E0',
  danger: '#B42318', warning: '#B7791F', expense: '#D96C55', savings: '#159A8A',
};

type ReportPeriod = 'this_month' | 'last_month' | 'one_year';
type AnalyticsTab = 'spending' | 'cashflow' | 'savings';
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

function SpendingByCategory({ categories, embedded = false }: { categories: Category[]; embedded?: boolean }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const visibleCategories = expanded ? categories : categories.slice(0, 6);
  return <View style={embedded ? undefined : styles.card}><View style={styles.sectionHeading}><Text style={styles.cardEyebrow}>Spending by category</Text><Text style={styles.cardHint}>{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</Text></View>{categories.length ? <View style={{ flexDirection: width < 360 ? 'column' : 'row', alignItems: width < 360 ? 'stretch' : 'center', gap: 20, marginTop: 12 }}><Donut categories={categories} /><View style={{ flex: 1, gap: 9 }}>{visibleCategories.map((category) => <View key={category.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><View style={[styles.legendDot, { backgroundColor: getCategoryMeta(category.name).color }]} /><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={styles.legendName}>{category.name}</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>{peso(category.amount)}</Text></View><Text style={styles.legendPercent}>{Math.round(category.percent)}%</Text></View>)}{categories.length > 6 && <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)} style={{ alignSelf: 'flex-start', marginTop: 2 }}><Text style={[styles.legendPercent, { color: colors.primary }]}>{expanded ? 'Show less' : `Show all ${categories.length}`}</Text></Pressable>}</View></View> : <Text style={styles.emptyCopy}>No spending recorded.</Text>}</View>;
}

function IncomeVsSpending({ report }: { report: Report }) {
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<'income' | 'spending' | null>(null);
  // Do not use monthly_trend here: the card labels are selected-period totals,
  // so its horizontal bars must use those same canonical report values.
  const comparison = cashFlowComparison(report.total_income, report.total_expenses);
  const period = shortRangeLabel(report.range);
  const selectedAmount = selected === 'income' ? comparison.income : comparison.spending;
  const selectedRatio = selected === 'income' ? comparison.incomeRatio : comparison.spendingRatio;
  useEffect(() => setSelected(null), [report.range.start, report.range.end]);
  const bar = (key: 'income' | 'spending', label: 'Income' | 'Spending', amount: number, ratio: number, color: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${peso(amount)}, ${period}, ${Math.round(ratio * 100)} percent of the comparison maximum`}
      onPress={() => setSelected((current) => current === key ? null : key)}
      style={styles.cashFlowBarButton}
    >
      <View style={styles.cashFlowLabelRow}>
        <Text style={styles.chartMetricLabel}>{label}</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={[styles.cashFlowAmount, { color }]}>{peso(amount)}</Text>
      </View>
      <View style={styles.cashFlowTrack}>
        <View style={[styles.cashFlowFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </Pressable>
  );
  return <View accessibilityRole="image" accessibilityLabel={`Income ${peso(comparison.income)} compared with spending ${peso(comparison.spending)} for ${period}`}>
    <View style={styles.cashFlowBars}>
      {bar('income', 'Income', comparison.income, comparison.incomeRatio, palette.savings)}
      {bar('spending', 'Spending', comparison.spending, comparison.spendingRatio, palette.expense)}
    </View>
    {selected ? <View accessibilityLiveRegion="polite" style={[styles.chartTooltip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, shadowColor: colors.shadow }]}><View style={[styles.tooltipAccent, { backgroundColor: selected === 'income' ? palette.savings : palette.expense }]} /><View><Text style={[styles.tooltipTitle, { color: colors.textPrimary }]}>{selected === 'income' ? 'Income' : 'Spending'}</Text><Text style={[styles.tooltipAmount, { color: colors.textPrimary }]}>{peso(selectedAmount)}</Text><Text style={[styles.tooltipText, { color: colors.textSecondary }]}>{(selectedRatio * 100).toFixed(1)}% of comparison maximum</Text></View></View> : null}
  </View>;
}

function SavingsProgress({ report, embedded = false }: { report: Report; embedded?: boolean }) {
  const { colors } = useAppTheme();
  const savedPercent = Math.max(0, Math.min(100, report.savings_rate));
  const spentPercent = report.total_income > 0 ? Math.max(0, Math.min(100, report.total_expenses / report.total_income * 100)) : 0;
  return <View style={embedded ? undefined : styles.progressCard}><View style={styles.sectionHeading}><Text style={styles.cardEyebrow}>Savings progress</Text><TrendingUp size={17} color={palette.savings} /></View><Text style={styles.savingsValue}>{peso(Math.max(0, report.net_savings))} saved</Text><Text style={styles.cardSubtitle}>{report.total_income ? `${Math.round(savedPercent)}% of income` : 'Income needed to calculate savings'}</Text><SegmentedBar accessibilityLabel={`Saved ${Math.round(savedPercent)} percent and spent ${Math.round(spentPercent)} percent`} segments={[{ key: 'saved', value: savedPercent, color: palette.savings }, { key: 'spent', value: spentPercent, color: palette.expense }]} trackColor={colors.primarySoft} height={9} /><View style={styles.progressMeta}><Text style={styles.metaText}>Saved {peso(Math.max(0, report.net_savings))}</Text><Text style={styles.metaText}>Spent {peso(report.total_expenses)}</Text></View>{report.savings.active_goals ? <Text style={styles.smallNote}>{report.savings.active_goals} active savings goal{report.savings.active_goals === 1 ? '' : 's'}</Text> : null}</View>;
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

function AnalyticsWorkspace({ report, activeTab, onTabChange, onDetails }: { report: Report; activeTab: AnalyticsTab; onTabChange: (tab: AnalyticsTab) => void; onDetails: () => void }) {
  const tabs: { key: AnalyticsTab; label: string }[] = [{ key: 'spending', label: 'Spending' }, { key: 'cashflow', label: 'Cash flow' }, { key: 'savings', label: 'Savings' }];
  return <View style={styles.analyticsCard}><View style={styles.analyticsTabs}>{tabs.map((tab) => <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }} onPress={() => onTabChange(tab.key)} style={[styles.analyticsTab, activeTab === tab.key && styles.analyticsTabActive]}><Text style={[styles.analyticsTabText, activeTab === tab.key && styles.analyticsTabTextActive]}>{tab.label}</Text></Pressable>)}</View><View style={styles.analyticsBody}>{activeTab === 'spending' ? <SpendingByCategory categories={report.categories} embedded /> : activeTab === 'cashflow' ? <><View style={styles.sectionHeading}><View><Text style={styles.cardEyebrow}>Income vs spending</Text><Text style={styles.cardSubtitle}>{report.range.days > 45 ? 'Monthly view' : 'Selected period'}</Text></View><Text style={styles.cardHint}>Tap a bar</Text></View><IncomeVsSpending report={report} /></> : <SavingsProgress report={report} embedded />}</View><Pressable accessibilityRole="button" accessibilityLabel={activeTab === 'spending' ? 'View all spending categories' : `View ${activeTab === 'cashflow' ? 'cash flow' : 'savings'} details`} onPress={onDetails} style={({ pressed }) => [styles.detailsButton, { minWidth: 132, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, pressed && styles.detailsButtonPressed]}><Text style={styles.detailsButtonText}>{activeTab === 'spending' ? 'View all categories' : 'View details'} <Text>›</Text></Text></Pressable></View>;
}

function AnalyticsDetailsSheet({ report, tab, onClose }: { report: Report; tab: AnalyticsTab | null; onClose: () => void }) {
  const { colors } = useAppTheme();
  const comparison = cashFlowComparison(report.total_income, report.total_expenses);
  return <Modal visible={tab !== null} transparent animationType="slide" onRequestClose={onClose}><Pressable style={styles.sheetBackdrop} onPress={onClose}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}><View style={styles.detailsHandle} /><View style={styles.sheetHeader}><View><Text style={styles.cardEyebrow}>{tab === 'spending' ? 'Spending details' : tab === 'cashflow' ? 'Cash flow details' : 'Savings details'}</Text><Text style={styles.sheetTitle}>{shortRangeLabel(report.range)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close report details" onPress={onClose} style={styles.sheetClose}><Text style={styles.sheetCloseText}>×</Text></Pressable></View><ScrollView contentContainerStyle={styles.sheetContent}>{tab === 'spending' ? <><View style={styles.sheetRow}><Text style={styles.sheetRowLabel}>Total spending</Text><Text style={styles.sheetRowValue}>{peso(report.total_expenses)}</Text></View>{report.categories.length ? report.categories.map((category) => <View key={category.name} style={styles.sheetRow}><Text style={styles.sheetRowLabel}>{category.name}</Text><Text style={styles.sheetRowValue}>{peso(category.amount)} · {Math.round(category.percent)}%</Text></View>) : <Text style={styles.emptyCopy}>No spending recorded for this period.</Text>}</> : tab === 'cashflow' ? <><View style={styles.sheetRow}><Text style={styles.sheetRowLabel}>Total income</Text><Text style={styles.sheetRowValue}>{peso(comparison.income)} · {(comparison.incomeRatio * 100).toFixed(1)}%</Text></View><View style={styles.sheetRow}><Text style={styles.sheetRowLabel}>Total spending</Text><Text style={styles.sheetRowValue}>{peso(comparison.spending)} · {(comparison.spendingRatio * 100).toFixed(1)}%</Text></View><View style={styles.sheetRow}><Text style={styles.sheetRowLabel}>Net cash flow</Text><Text style={styles.sheetRowValue}>{peso(report.net_savings, true)}</Text></View></> : <><View style={styles.sheetRow}><Text style={styles.sheetRowLabel}>Net savings</Text><Text style={styles.sheetRowValue}>{peso(report.net_savings, true)}</Text></View><View style={styles.sheetRow}><Text style={styles.sheetRowLabel}>Savings rate</Text><Text style={styles.sheetRowValue}>{Math.round(report.savings_rate)}%</Text></View><View style={styles.sheetRow}><Text style={styles.sheetRowLabel}>Active savings goals</Text><Text style={styles.sheetRowValue}>{report.savings.active_goals}</Text></View><Text style={styles.smallNote}>Net savings is income minus spending; it is not assumed to be a savings-goal contribution.</Text></>}</ScrollView></Pressable></Pressable></Modal>;
}

function highestSpending(values: SpendingPoint[]) { return values.reduce<SpendingPoint | null>((best, value) => value.amount > (best?.amount ?? 0) ? value : best, null); }
function readableDate(date: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date.slice(0, 10)}T12:00:00`)); }
function SafeAreaView(props: SafeAreaViewProps) { const { colors } = useAppTheme(); return <NativeSafeAreaView {...props} style={[props.style, { backgroundColor: colors.background }]} />; }

export default function ReportsScreen() {
  const { colors } = useAppTheme();
  styles = makeStyles({ ...palette, background: colors.background, surface: colors.surfaceElevated, ink: colors.textPrimary, muted: colors.textSecondary, accent: colors.primary, accentDark: colors.primary, accentPale: colors.primarySoft, line: colors.border });
  const bottomNavClearance = useBottomNavClearance(); const router = useRouter();
  const [period, setPeriod] = useState<ReportPeriod>('this_month'); const [report, setReport] = useState<Report | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('spending'); const [detailTab, setDetailTab] = useState<AnalyticsTab | null>(null);
  const requestId = useRef(0);
  const refresh = useCallback(async () => { const currentRequest = ++requestId.current; setLoading(true); setError(''); try { const params = new URLSearchParams({ period }); const response = normalizeReport(await authenticatedApiRequest<ReportInput>(`/api/reports/summary?${params.toString()}`)); if (currentRequest === requestId.current) setReport(response); } catch { if (currentRequest === requestId.current) setError('We couldn’t load your reports right now. Please try again.'); } finally { if (currentRequest === requestId.current) setLoading(false); } }, [period]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const peak = report ? highestSpending(report.charts.daily_spending) : null;

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><FinancialScreenHeader title="Reports" onBack={() => router.back()} rightAction={<NotificationHeaderButton />} /><ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]} showsVerticalScrollIndicator={false}>
    <View style={styles.filterContainer}><View style={styles.periods}>{periodOptions.map((option) => <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={`${option.label} reports`} accessibilityState={{ selected: period === option.value }} onPress={() => setPeriod(option.value)} style={[styles.periodChip, period === option.value && styles.periodChipActive]}><Text numberOfLines={1} style={[styles.periodText, period === option.value && styles.periodTextActive]}>{option.label}</Text></Pressable>)}</View></View>
    {loading ? <View style={styles.loadingDashboard}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading insights…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Reports unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : report ? <>
      <View accessibilityRole="summary" accessibilityLabel={`Selected period ${shortRangeLabel(report.range)}. Income ${peso(report.total_income)}. Spending ${peso(report.total_expenses)}. Net savings ${peso(report.net_savings, true)}.`} style={styles.summaryCard}><Text style={styles.cardEyebrow}>Selected period</Text><Text style={styles.summaryTitle}>{shortRangeLabel(report.range)}</Text><View style={styles.summaryMetrics}><View style={styles.summaryMetric}><Text style={styles.metricLabel}>Income</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.summaryIncome}>{peso(report.total_income)}</Text></View><View style={styles.summaryMetric}><Text style={styles.metricLabel}>Spending</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.summaryExpense}>{peso(report.total_expenses)}</Text></View><View style={styles.summaryMetric}><Text style={styles.metricLabel}>Net savings</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.summaryNet, report.net_savings < 0 && styles.warning]}>{peso(report.net_savings, true)}</Text></View></View></View>
      <AnalyticsWorkspace report={report} activeTab={analyticsTab} onTabChange={setAnalyticsTab} onDetails={() => setDetailTab(analyticsTab)} />
      <BudgetProgress report={report} />
      {peak ? <View style={styles.peakRow}><TrendingDown size={16} color={colors.primary} /><Text style={styles.peakText}>Peak spending <Text style={styles.peakStrong}>{readableDate(peak.date)} · {peso(peak.amount)}</Text></Text></View> : null}
    </> : <View style={styles.loadingDashboard}><Text style={styles.cardTitle}>No report data yet</Text><Text style={styles.muted}>Add a few financial records to see insights here.</Text></View>}
  </ScrollView>{report ? <AnalyticsDetailsSheet report={report} tab={detailTab} onClose={() => setDetailTab(null)} /> : null}</SafeAreaView>;
}

function makeStyles(themePalette: typeof palette) { const p = themePalette; return StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background }, content: { padding: 18, paddingTop: 12, gap: 12 },
  filterContainer: { padding: 4, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }, periods: { flexDirection: 'row', gap: 4 }, periodChip: { minHeight: 44, flex: 1, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, periodChipActive: { backgroundColor: p.accentPale }, periodText: { color: p.muted, fontSize: 12, fontWeight: '800' }, periodTextActive: { color: p.ink, fontWeight: '900' },
  customCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }, customDates: { flex: 1, gap: 8 },
  card: { padding: 16, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }, summaryCard: { padding: 18, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }, cardEyebrow: { color: p.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }, cardTitle: { color: p.ink, fontSize: 16, fontWeight: '900' }, cardSubtitle: { marginTop: 3, color: p.muted, fontSize: 12, fontWeight: '600' }, cardHint: { color: p.muted, fontSize: 11, fontWeight: '700' }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, summaryTitle: { marginTop: 6, color: p.ink, fontSize: 19, fontWeight: '900' }, summaryMetrics: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 20 }, summaryMetric: { flex: 1, minWidth: 0 }, metricLabel: { color: p.muted, fontSize: 11, fontWeight: '700' }, summaryIncome: { marginTop: 4, color: p.savings, fontSize: 17, fontWeight: '900' }, summaryExpense: { marginTop: 4, color: p.expense, fontSize: 17, fontWeight: '900' }, summaryNet: { marginTop: 4, color: p.savings, fontSize: 17, fontWeight: '900' }, warning: { color: p.danger },
  chartMetricLabel: { color: p.muted, fontSize: 11, fontWeight: '700' }, cashFlowBars: { gap: 16, marginTop: 16 }, cashFlowBarButton: { gap: 7 }, cashFlowLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }, cashFlowAmount: { flexShrink: 1, fontSize: 16, fontWeight: '900', textAlign: 'right' }, cashFlowTrack: { height: 12, overflow: 'hidden', borderRadius: 6, backgroundColor: p.accentPale }, cashFlowFill: { height: '100%', borderRadius: 6 }, chartTooltip: { zIndex: 2, flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, elevation: 4, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, tooltipAccent: { width: 4, alignSelf: 'stretch', borderRadius: 2 }, tooltipTitle: { fontSize: 11, fontWeight: '900' }, tooltipAmount: { marginTop: 2, fontSize: 15, fontWeight: '900' }, tooltipText: { marginTop: 2, fontSize: 10, fontWeight: '700' }, legendDot: { width: 7, height: 7, borderRadius: 4 },
  duoRow: { flexDirection: 'row', gap: 12 }, categoryCard: { flex: 1, minWidth: 0 }, progressCard: { flex: 1, minWidth: 0, padding: 14, borderRadius: 18, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, justifyContent: 'flex-start' }, analyticsCard: { padding: 12, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }, analyticsTabs: { flexDirection: 'row', gap: 5, padding: 4, borderRadius: 14, backgroundColor: p.background }, analyticsTab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, analyticsTabActive: { backgroundColor: p.accentPale }, analyticsTabText: { color: p.muted, fontSize: 11, fontWeight: '800' }, analyticsTabTextActive: { color: p.ink, fontWeight: '900' }, analyticsBody: { padding: 4, minHeight: 190 }, detailsButton: { alignSelf: 'flex-end', padding: 8 }, detailsButtonText: { color: p.accent, fontSize: 12, fontWeight: '900' }, sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }, sheet: { maxHeight: '78%', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sheetTitle: { marginTop: 4, color: p.ink, fontSize: 17, fontWeight: '900' }, sheetClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: p.background }, sheetCloseText: { color: p.ink, fontSize: 24, lineHeight: 28 }, sheetRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.line }, sheetRowLabel: { flex: 1, color: p.ink, fontSize: 12, fontWeight: '800' }, sheetRowValue: { color: p.muted, fontSize: 11, fontWeight: '700' }, donutWrap: { alignSelf: 'center', marginTop: 10 }, donutCenter: { alignItems: 'center', width: 60 }, donutPercent: { color: p.ink, fontSize: 16, fontWeight: '900' }, donutLabel: { maxWidth: 58, marginTop: 1, color: p.muted, fontSize: 8, fontWeight: '800', textAlign: 'center' }, compactLegend: { gap: 8, marginTop: 10 }, compactLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, legendName: { flex: 1, color: p.ink, fontSize: 10, fontWeight: '700' }, legendPercent: { color: p.muted, fontSize: 10, fontWeight: '800' }, savingsValue: { marginTop: 14, color: p.savings, fontSize: 18, fontWeight: '900' }, allocationTrack: { height: 9, overflow: 'hidden', flexDirection: 'row', borderRadius: 5, backgroundColor: p.accentPale }, progressMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 8 }, metaText: { flex: 1, color: p.muted, fontSize: 9, fontWeight: '700' }, smallNote: { marginTop: 11, color: p.muted, fontSize: 10, fontWeight: '700' }, emptyCopy: { marginTop: 16, color: p.muted, fontSize: 11, lineHeight: 16 },
  budgetPercent: { fontSize: 13, fontWeight: '900' }, budgetTrack: { height: 9, marginTop: 15, overflow: 'hidden', borderRadius: 5, backgroundColor: p.accentPale }, budgetFill: { height: '100%', borderRadius: 5 }, peakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }, peakText: { color: p.muted, fontSize: 11, fontWeight: '700' }, peakStrong: { color: p.ink, fontWeight: '900' },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }, insightIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: p.accentPale }, insightCopy: { flex: 1 }, insightTitle: { color: p.ink, fontSize: 11, fontWeight: '900' }, insightText: { marginTop: 2, color: p.muted, fontSize: 10, lineHeight: 15 }, loadingDashboard: { minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 9 }, muted: { color: p.muted, fontSize: 12, lineHeight: 18 }, retry: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: p.accentPale }, retryText: { color: p.accent, fontSize: 12, fontWeight: '900' }, detailsButtonPressed: { opacity: 0.68 }, detailsHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 14, backgroundColor: p.line }, sheetContent: { paddingBottom: 24 },
}); }

let styles = makeStyles(palette);
