import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Polyline } from 'react-native-svg';
import { ArrowLeft, BarChart3, CalendarDays, ChevronRight, CircleDollarSign, WalletCards } from 'lucide-react-native';

import { DatePickerField } from '@/components/finance-form';
import { authenticatedApiRequest } from '@/services/api';
import { SegmentedRing } from '@/components/segmented-ring';
import { ProfileHeaderButton } from '@/components/profile-header-button';

const palette = {
  background: '#F4F7F1',
  surface: '#FFFFFF',
  ink: '#11231C',
  muted: '#5D6C65',
  accent: '#0F8A6B',
  accentDark: '#08654E',
  accentSoft: '#93CFB6',
  accentPale: '#D8EFE2',
  line: '#DCE8E0',
  danger: '#B42318',
  warning: '#B7791F',
};

type ReportPeriod = 'this_month' | 'last_month' | 'last_3_months' | 'custom';
type Range = { period: ReportPeriod; start: string; end: string; label: string; days: number; budgetMonths: number };
type Category = { name: string; amount: number; percent: number };
type Report = {
  range: Range;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  budget_utilization: number;
  budget: { total_budget: number; spent: number; remaining: number; over_budget_categories: { name: string }[]; };
  savings: { total_saved: number; goal_progress: number; active_goals: number };
  categories: Category[];
  charts: { daily_spending: { date: string; amount: number }[] };
};

const periodOptions: { label: string; value: ReportPeriod }[] = [
  { label: 'This month', value: 'this_month' },
  { label: 'Last month', value: 'last_month' },
  { label: 'Last 3 months', value: 'last_3_months' },
  { label: 'Custom', value: 'custom' },
];

const categoryColors = ['#E8775D', '#5D8FC4', '#4D9A73', '#D89B1D', '#4778C7', '#5DA9D6', '#8D70AD', '#8B8B8B'];

function peso(value: number, signed = false) {
  const sign = signed && value < 0 ? '−' : '';
  return `${sign}₱${Math.abs(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
}

function manilaDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? String(date.getFullYear());
  const month = parts.find((part) => part.type === 'month')?.value ?? String(date.getMonth() + 1).padStart(2, '0');
  const day = parts.find((part) => part.type === 'day')?.value ?? String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialCustomRange() {
  const today = new Date();
  const manilaToday = manilaDateValue(today);
  return { from: `${manilaToday.slice(0, 7)}-01`, to: manilaToday };
}

function sampleTrend(values: { date: string; amount: number }[]) {
  if (values.length <= 12) return values;
  const step = (values.length - 1) / 11;
  return Array.from({ length: 12 }, (_, index) => values[Math.round(index * step)]);
}

function Donut({ categories }: { categories: Category[] }) {
  const top = categories[0];

  return <View style={styles.donutWrap}>
    <SegmentedRing radius={42} trackColor={palette.accentPale} segments={categories.map((category, index) => ({ key: category.name, value: category.amount, color: categoryColors[index % categoryColors.length] }))}>
      <View style={styles.donutCenter}><Text style={styles.donutPercent}>{top ? `${Math.round(top.percent)}%` : '0%'}</Text><Text style={styles.donutLabel}>{top ? top.name : 'No spend'}</Text></View>
    </SegmentedRing>
  </View>;
}

function TrendChart({ values, width }: { values: { date: string; amount: number }[]; width: number }) {
  const data = sampleTrend(values);
  const chartWidth = Math.max(260, width - 56);
  const chartHeight = 132;
  const max = Math.max(1, ...data.map((item) => item.amount));
  const points = data.length > 1 ? data.map((item, index) => `${(index / (data.length - 1)) * chartWidth},${chartHeight - (item.amount / max) * chartHeight}`).join(' ') : `0,${chartHeight} ${chartWidth},${chartHeight}`;

  return <View>
    {values.length === 0 ? <View style={styles.emptyInner}><Text style={styles.muted}>No spending activity in this period.</Text></View> : <>
      <Svg width={chartWidth} height={chartHeight}>
        {[0, 1, 2, 3].map((line) => <Line key={line} x1="0" x2={chartWidth} y1={(line / 3) * chartHeight} y2={(line / 3) * chartHeight} stroke={palette.line} strokeDasharray="4 4" />)}
        <Polyline points={points} fill="none" stroke={palette.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={styles.chartLabels}><Text style={styles.chartLabel}>{data[0]?.date.slice(5) ?? ''}</Text><Text style={styles.chartLabel}>{data[Math.floor(data.length / 2)]?.date.slice(5) ?? ''}</Text><Text style={styles.chartLabel}>{data[data.length - 1]?.date.slice(5) ?? ''}</Text></View>
    </>}
  </View>;
}

function Kpi({ label, value, note, tone = 'default' }: { label: string; value: string; note?: string; tone?: 'default' | 'positive' | 'warning' }) {
  return <View style={styles.kpi}><Text style={styles.kpiLabel}>{label}</Text><Text style={[styles.kpiValue, tone === 'positive' && styles.positive, tone === 'warning' && styles.warning]}>{value}</Text>{note ? <Text style={styles.kpiNote}>{note}</Text> : null}</View>;
}

export default function ReportsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<ReportPeriod>('this_month');
  const [customRange, setCustomRange] = useState(initialCustomRange);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ period });
      if (period === 'custom') { params.set('from', customRange.from); params.set('to', customRange.to); }
      const nextReport = await authenticatedApiRequest<Report>(`/api/reports/summary?${params.toString()}`);
      setReport(nextReport);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Reports could not load.');
    } finally { setLoading(false); }
  }, [customRange.from, customRange.to, period]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={() => router.back()} style={styles.back}><ArrowLeft size={21} color={palette.ink} /></Pressable><View style={styles.titleWrap}><Text style={styles.eyebrow}>INSIGHTS</Text><Text style={styles.title}>Reports</Text></View><View style={styles.headerActions}><View style={styles.headerIcon}><BarChart3 size={21} color={palette.accent} /></View><ProfileHeaderButton /></View></View>
      <Text style={styles.subtitle}>{report?.range.label ?? 'Your financial picture at a glance'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>{periodOptions.map((option) => <Pressable key={option.value} onPress={() => setPeriod(option.value)} style={[styles.periodChip, period === option.value && styles.periodChipActive]}><Text style={[styles.periodText, period === option.value && styles.periodTextActive]}>{option.label}</Text></Pressable>)}</ScrollView>
      {period === 'custom' ? <View style={styles.customCard}><CalendarDays size={18} color={palette.accent} /><View style={styles.customDates}><DatePickerField label="From" value={customRange.from} onChange={(from) => setCustomRange((current) => ({ ...current, from }))} /><DatePickerField label="To" value={customRange.to} onChange={(to) => setCustomRange((current) => ({ ...current, to }))} /></View></View> : null}
      {loading ? <View style={styles.state}><ActivityIndicator color={palette.accent} /><Text style={styles.muted}>Loading report…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Reports unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : report ? <>
        <View style={styles.kpiGrid}><Kpi label="Total income" value={peso(report.total_income)} tone="positive" /><Kpi label="Total expenses" value={peso(report.total_expenses)} /><Kpi label="Net savings" value={peso(report.net_savings, true)} note={`${report.savings_rate}% savings rate`} tone={report.net_savings < 0 ? 'warning' : 'positive'} /><Kpi label="Budget use" value={`${report.budget_utilization}%`} note={report.budget.remaining < 0 ? 'Over planned budget' : `${peso(report.budget.remaining)} remaining`} tone={report.budget.remaining < 0 ? 'warning' : 'default'} /></View>
        <View style={styles.card}><Text style={styles.cardTitle}>Spending trend</Text><Text style={styles.cardSubtitle}>Daily spending · {report.range.label}</Text><View style={styles.trend}><TrendChart values={report.charts.daily_spending} width={width - 48} /></View></View>
        <View style={styles.card}><Text style={styles.cardTitle}>Expense distribution</Text><Text style={styles.cardSubtitle}>Where your spending went</Text><View style={styles.donutRow}><Donut categories={report.categories} /><View style={styles.legend}>{report.categories.length ? report.categories.slice(0, 6).map((category, index) => <View key={category.name} style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: categoryColors[index % categoryColors.length] }]} /><Text style={styles.legendName} numberOfLines={1}>{category.name}</Text><Text style={styles.legendAmount}>{peso(category.amount)} · {Math.round(category.percent)}%</Text></View>) : <Text style={styles.muted}>No categories in this period.</Text>}</View></View></View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/budget')} style={styles.summaryCard}><View style={styles.summaryIcon}><WalletCards size={19} color={palette.accent} /></View><View style={styles.summaryMain}><Text style={styles.summaryTitle}>Budget summary</Text><Text style={styles.summaryText}>{peso(report.budget.spent)} spent · {peso(report.budget.total_budget)} budgeted · {peso(report.budget.remaining, true)} remaining</Text>{report.budget.over_budget_categories.length ? <Text style={styles.warningText}>{report.budget.over_budget_categories.length} over budget</Text> : null}</View><ChevronRight size={19} color={palette.muted} /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/savings')} style={styles.summaryCard}><View style={styles.summaryIcon}><CircleDollarSign size={19} color={palette.accent} /></View><View style={styles.summaryMain}><Text style={styles.summaryTitle}>Savings summary</Text><Text style={styles.summaryText}>{peso(report.savings.total_saved)} saved · {report.savings.goal_progress}% goal progress · {report.savings.active_goals} active goal{report.savings.active_goals === 1 ? '' : 's'}</Text></View><ChevronRight size={19} color={palette.muted} /></Pressable>
      </> : null}
      {!loading && !error && !report ? <View style={styles.state}><Text style={styles.cardTitle}>No report data yet</Text><Text style={styles.muted}>Add a few financial records to see insights here.</Text></View> : null}
      <Text style={styles.footerNote}>Reports summarize the same records used across Alalay.</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, paddingTop: 14, paddingBottom: 48, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  titleWrap: { flex: 1 },
  eyebrow: { color: palette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { marginTop: 2, color: palette.ink, fontSize: 29, fontWeight: '900', letterSpacing: -0.6 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accentPale },
  subtitle: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  periods: { gap: 8, paddingVertical: 2 },
  periodChip: { paddingHorizontal: 14, minHeight: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  periodChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  periodText: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  periodTextActive: { color: '#FFFFFF' },
  customCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  customDates: { flex: 1, gap: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  kpi: { width: '48%', minHeight: 92, padding: 13, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  kpiLabel: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  kpiValue: { marginTop: 8, color: palette.ink, fontSize: 18, fontWeight: '900' },
  kpiNote: { marginTop: 4, color: palette.muted, fontSize: 10, fontWeight: '600' },
  positive: { color: palette.accentDark },
  warning: { color: palette.warning },
  card: { padding: 16, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  cardSubtitle: { marginTop: 3, color: palette.muted, fontSize: 11, fontWeight: '600' },
  trend: { marginTop: 16, alignItems: 'center' },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 6 },
  chartLabel: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  donutRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  donutWrap: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { alignItems: 'center', maxWidth: 82 },
  donutPercent: { color: palette.ink, fontSize: 20, fontWeight: '900' },
  donutLabel: { marginTop: 2, color: palette.muted, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  legend: { flex: 1, gap: 9 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { flex: 1, color: palette.ink, fontSize: 10, fontWeight: '700' },
  legendAmount: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  summaryIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accentPale },
  summaryMain: { flex: 1 },
  summaryTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  summaryText: { marginTop: 4, color: palette.muted, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  warningText: { marginTop: 3, color: palette.danger, fontSize: 10, fontWeight: '800' },
  state: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyInner: { paddingVertical: 24, alignItems: 'center' },
  muted: { color: palette.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  retry: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: palette.accent },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  footerNote: { paddingTop: 4, color: palette.muted, fontSize: 10, textAlign: 'center' },
});
