import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronRight, Droplets, FileText, Home, Receipt, Repeat, ShoppingCart, Target, WalletCards } from 'lucide-react-native';

import { AlalayChatHead } from '@/components/alalay-chat-head';
import { ProfileHeaderButton } from '@/components/profile-header-button';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { authenticatedApiRequest } from '@/services/api';
import { combineRecentTransactions, derivedStatus, fetchExpenses, fetchFinanceItems, fetchRecentIncome, fetchWallets, subscribeFinancialMutations, totalWalletBalance, type FinanceItem, type RecentTransaction, type WalletRecord } from '@/services/finance';
import { walletInitials } from '@/constants/wallets';
import { useCurrentProfile } from '@/hooks/use-current-profile';
import { getProfileFirstName } from '@/services/profile';
import { useAppTheme } from '@/theme/theme';
import { GlassSurface } from '@/components/glass-surface';

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

/* legacy mock fixtures removed from rendering
const goals = [
  { key: 'emergency', name: 'Emergency Fund', saved: '₱67,500', target: '₱100,000', percent: 68, color: palette.accent },
  { key: 'travel', name: 'Baguio Weekend', saved: '₱12,000', target: '₱20,000', percent: 60, color: '#5E9BC5' },
];
*/

type Icon = typeof Home;
type DashboardSummary = {
  total_bills_this_month: number;
  monthly_expenses: number;
  monthly_income: number;
  net_savings: number;
  net_savings_trend_percent: number | null;
};

function formatPeso(value: number) {
  return `₱${Math.round(value).toLocaleString('en-PH')}`;
}

function formatBalancePeso(value: number) {
  const sign = value < 0 ? String.fromCharCode(0x2212) : '';
  return sign + String.fromCharCode(0x20B1) + Math.abs(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const bottomNavClearance = useBottomNavClearance();
  const [financeItems, setFinanceItems] = useState<FinanceItem[]>([]);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState('');
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState('');
  const { profile } = useCurrentProfile();

  const refreshFinance = useCallback(async () => {
    setFinanceLoading(true);
    setWalletLoading(true);
    setFinanceError('');
    setWalletError('');
    try {
      const [items, expenseRows, incomeRows, summary] = await Promise.all([
        fetchFinanceItems(),
        fetchExpenses(),
        fetchRecentIncome(),
        authenticatedApiRequest<DashboardSummary>('/api/dashboard/summary'),
      ]);
      setFinanceItems(items);
      setRecentTransactions(combineRecentTransactions(expenseRows, incomeRows));
      setDashboardSummary(summary);
      try {
        setWallets(await fetchWallets());
        setWalletError('');
      } catch (walletFetchError) {
        setWalletError(walletFetchError instanceof Error ? walletFetchError.message : 'Wallets could not load.');
      }
    } catch (error) {
      setFinanceError(error instanceof Error ? error.message : 'Bills could not load.');
      setWalletError('Wallets could not load.');
    } finally {
      setFinanceLoading(false);
      setWalletLoading(false);
    }
  }, []);

  const firstName = profile ? getProfileFirstName(profile.name) : 'there';

  useFocusEffect(useCallback(() => { void refreshFinance(); }, [refreshFinance]));
  useEffect(() => subscribeFinancialMutations(() => { void refreshFinance(); }), [refreshFinance]);

  const recentTransactionRows = recentTransactions.slice(0, 5);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <ProfileHeaderButton />
          <View style={styles.greetingBlock}>
            <Text accessibilityRole="header" style={[styles.greeting, { color: colors.ink }]}>{getGreeting()} <Text style={[styles.greetingName, { color: colors.ink }]}>{firstName}!</Text></Text>
            <Text style={[styles.date, { color: colors.muted }]}>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationHeaderButton />
            {/* legacy notification/settings controls removed; profile owns both destinations */}
          </View>
          {/*
            <Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={() => Alert.alert('Notifications', 'You’re all caught up.') }>
              <Bell size={21} color={palette.ink} strokeWidth={1.8} />
              <View style={styles.notificationDot} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/settings')}>
              <Settings size={21} color={palette.ink} strokeWidth={1.8} />
            </Pressable>
          */}
        </View>

        <SummaryCard summary={dashboardSummary} loading={financeLoading} wallets={wallets} walletLoading={walletLoading} walletError={walletError} />
          <GlassSurface style={styles.shortcutContainer} padding={8}><View style={styles.shortcutRow}><Shortcut icon={ShoppingCart} label="Expense" onPress={() => router.push('/(tabs)/expenses')} /><Shortcut icon={ArrowUpRight} label="Income" onPress={() => router.push('/(tabs)/income')} /><Shortcut icon={Receipt} label="Bills" onPress={() => router.push('/(tabs)/bills')} /><Shortcut icon={Repeat} label="Subscription" onPress={() => router.push('/(tabs)/subscriptions')} /><Shortcut icon={Target} label="Goals" onPress={() => router.push('/(tabs)/savings')} /></View></GlassSurface>

        <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Wallets</Text><Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/wallets')}><Text style={[styles.link, { color: colors.primary }]}>View all</Text></Pressable></View>
        <WalletQuickView wallets={wallets} loading={walletLoading} error={walletError} />

        <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upcoming</Text><Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{financeItems.length} items</Text></View>
        <GlassSurface style={styles.listCard} padding={0}>{financeLoading ? <View style={styles.inlineState}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.textSecondary }]}>Loading bills…</Text></View> : financeError ? <View style={styles.inlineState}><Text style={[styles.errorText, { color: colors.danger }]}>{financeError}</Text></View> : financeItems.length ? financeItems.slice(0, 5).map((item) => <FinanceRow key={`${item.source}-${item.id}`} item={item} />) : <View style={styles.inlineState}><Text style={[styles.stateTitle, { color: colors.textPrimary }]}>No bills yet</Text><Text style={[styles.stateText, { color: colors.textSecondary }]}>Use Add to create your first bill or subscription.</Text></View>}</GlassSurface>

        <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent transactions</Text><Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/expenses')}><Text style={[styles.link, { color: colors.primary }]}>See all</Text></Pressable></View>
        <GlassSurface style={styles.listCard} padding={0}>{financeLoading ? <View style={styles.inlineState}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.textSecondary }]}>Loading transactions…</Text></View> : financeError ? <View style={styles.inlineState}><Text style={[styles.errorText, { color: colors.danger }]}>{financeError}</Text></View> : recentTransactionRows.length ? recentTransactionRows.map((transaction) => <RecentTransactionRow key={transaction.id} transaction={transaction} />) : <View style={styles.inlineState}><Text style={[styles.stateTitle, { color: colors.textPrimary }]}>No transactions yet</Text><Text style={[styles.stateText, { color: colors.textSecondary }]}>Your recent income and expenses will appear here.</Text></View>}</GlassSurface>

      </ScrollView>

      <AlalayChatHead />
    </SafeAreaView>
  );
}

function SummaryCard({ summary, loading, wallets, walletLoading, walletError }: { summary: DashboardSummary | null; loading: boolean; wallets: WalletRecord[]; walletLoading: boolean; walletError: string }) {
  const { colors } = useAppTheme();
  const balanceUnavailable = walletError || walletLoading;
  return <View style={styles.balanceStack}>
    <View accessible={false} importantForAccessibility="no" style={[styles.balanceRearCard, { backgroundColor: colors.balanceRear }]} />
    <View accessible accessibilityRole="summary" accessibilityLabel={`Total Balance ${balanceUnavailable ? walletLoading ? 'loading' : 'unavailable' : formatBalancePeso(totalWalletBalance(wallets))}. Expenses ${loading || !summary ? 'loading' : formatPeso(summary.monthly_expenses)}. Income ${loading || !summary ? 'loading' : formatPeso(summary.monthly_income)}.`} style={[styles.summaryCard, { backgroundColor: colors.balance }]}>
      <Text style={styles.summaryEyebrow}>TOTAL BALANCE</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.balanceValue}>{balanceUnavailable ? walletLoading ? 'Loading…' : 'Unavailable' : formatBalancePeso(totalWalletBalance(wallets))}</Text>
      <View style={styles.supportingMetrics}><View style={styles.supportingMetric}><View style={styles.metricLabelRow}><View style={styles.expenseIcon}><ArrowDown size={13} color="#FFD3D0" strokeWidth={2.8} /></View><Text style={styles.metricLabel}>Expenses</Text></View><Text style={styles.metricValue}>{loading || !summary ? 'Loading…' : formatPeso(summary.monthly_expenses)}</Text></View><View style={styles.supportingMetric}><View style={styles.metricLabelRow}><View style={styles.incomeIcon}><ArrowUp size={13} color="#C4F5D5" strokeWidth={2.8} /></View><Text style={styles.metricLabel}>Income</Text></View><Text style={styles.metricValue}>{loading || !summary ? 'Loading…' : formatPeso(summary.monthly_income)}</Text></View></View>
    </View>
  </View>;
}

function WalletQuickView({ wallets, loading, error }: { wallets: WalletRecord[]; loading: boolean; error: string }) {
  const { colors } = useAppTheme();
  if (loading) return <GlassSurface style={styles.listCard} padding={0}><View style={styles.inlineState}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.textSecondary }]}>Loading wallets…</Text></View></GlassSurface>;
  if (error) return <GlassSurface style={styles.listCard} padding={0}><View style={styles.inlineState}><Text style={[styles.errorText, { color: colors.danger }]}>Wallets unavailable. Your other dashboard sections are still available.</Text></View></GlassSurface>;
  return <GlassSurface style={styles.listCard} padding={0}>
    {wallets.slice(0, 3).map((wallet, index) => <Pressable key={wallet.id} accessibilityRole="button" accessibilityLabel={`Open ${wallet.name} wallet`} onPress={() => router.push({ pathname: '/(tabs)/wallets', params: { walletId: wallet.id } })} style={({ pressed }) => [styles.walletRow, index === Math.min(wallets.length, 3) - 1 && styles.rowLast, pressed && styles.pressed]}>
      <View style={[styles.walletIcon, { backgroundColor: `${wallet.color}22`, borderColor: `${wallet.color}55` }]}><Text style={[styles.walletInitial, { color: wallet.color }]}>{walletInitials(wallet.name)}</Text></View>
      <View style={styles.rowMain}><Text numberOfLines={1} style={[styles.rowTitle, { color: colors.textPrimary }]}>{wallet.name}</Text><Text style={[styles.rowMeta, { color: colors.textSecondary }]}>{typeLabel(wallet.institution_type)} · PHP</Text></View>
      <Text style={[styles.walletBalance, { color: colors.textPrimary }]}>{formatBalancePeso(Number(wallet.balance))}</Text><ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>)}
    {!wallets.length ? <View style={styles.inlineState}><Text style={styles.stateTitle}>No wallets yet</Text><Text style={styles.stateText}>Your Cash wallet will appear here once it is ready.</Text></View> : null}
    {wallets.length > 3 ? <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/wallets')} style={styles.moreWallets}><Text style={styles.moreWalletsText}>+ {wallets.length - 3} more wallet{wallets.length - 3 === 1 ? '' : 's'}</Text></Pressable> : null}
  </GlassSurface>;
}

function typeLabel(type: string) { return type === 'e_wallet' ? 'E-wallet' : type === 'digital_bank' ? 'Digital bank' : type === 'bank' ? 'Bank' : type === 'cash' ? 'Cash' : 'Other'; }

function FinanceRow({ item }: { item: FinanceItem }) {
  const { colors } = useAppTheme();
  const status = derivedStatus(item);
  const icon = item.source === 'subscription' ? Repeat : item.category.toLowerCase().includes('water') ? Droplets : FileText;
  const FinanceIcon = icon;
  return <View style={styles.row}><View style={styles.rowIcon}><FinanceIcon size={18} color={status === 'Overdue' ? colors.danger : colors.primary} strokeWidth={1.8} /></View><View style={styles.rowMain}><Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{item.name}</Text><Text style={[styles.rowMeta, { color: colors.textSecondary }]}>{item.source === 'subscription' ? 'Subscription' : item.category} · Due {item.dueDate}</Text></View><View style={styles.rowRight}><Text style={[styles.rowAmount, { color: colors.textPrimary }]}>{formatPeso(item.amount)}</Text><Text style={[styles.status, status === 'Overdue' ? styles.statusDanger : status === 'Paid' ? styles.statusPaid : styles.statusUpcoming]}>{status}</Text></View></View>;
}

function RecentTransactionRow({ transaction }: { transaction: RecentTransaction }) {
  const { colors } = useAppTheme();
  const isIncome = transaction.sourceType === 'income';
  const Icon = isIncome ? ArrowUpRight : WalletCards;
  return <View style={styles.row}><View style={[styles.rowIcon, { backgroundColor: isIncome ? colors.primarySoft : colors.accentMuted }]}><Icon size={18} color={isIncome ? colors.primary : colors.danger} strokeWidth={2.2} /></View><View style={styles.rowMain}><Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{transaction.title}</Text><Text style={[styles.rowMeta, { color: colors.textSecondary }]}>{transaction.category} · {isIncome ? 'Income' : 'Expense'} · {formatTransactionDate(transaction.occurredAt)}</Text></View><Text style={[styles.expenseAmount, { color: isIncome ? colors.primary : colors.danger }]}>{isIncome ? '+' : '−'}{formatPeso(Math.abs(transaction.amount))}</Text></View>;
}

function formatTransactionDate(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
}

function getGreeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(new Date()));
  return hour >= 5 && hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';
}

function Shortcut({ icon: IconComponent, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}><View style={[styles.shortcutIcon, { backgroundColor: colors.accentPale }]}><IconComponent size={20} color={colors.primary} strokeWidth={1.8} /></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.shortcutLabel, { color: colors.textPrimary }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: 24, paddingTop: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetingBlock: { flex: 1, marginHorizontal: 11 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  date: { marginTop: 4, color: palette.muted, fontSize: 12, fontWeight: '600' },
  greeting: { color: palette.ink, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  greetingName: { fontWeight: '900' },
  profileButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  profileImage: { width: 44, height: 44, borderRadius: 22 },
  notificationBadge: { position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D92D20' },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: palette.accent },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionHint: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  link: { color: palette.accent, fontSize: 13, fontWeight: '800' },
  balanceStack: { position: 'relative', marginTop: 18, paddingTop: 12 },
  balanceRearCard: { position: 'absolute', top: 0, left: 14, right: 14, height: 38, borderRadius: 20, backgroundColor: '#63B995', opacity: 0.9 },
  summaryCard: { width: '100%', minHeight: 172, justifyContent: 'center', paddingHorizontal: 21, paddingVertical: 23, borderRadius: 22, backgroundColor: palette.accent, shadowColor: '#063224', shadowOpacity: 0.12, shadowRadius: 7, elevation: 3 },
  summaryEyebrow: { color: '#D8EFE2', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
  balanceValue: { marginTop: 10, color: '#FFFFFF', fontSize: 36, fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
  supportingMetrics: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-around', marginTop: 24 },
  supportingMetric: { flex: 1, alignItems: 'center' },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabel: { color: '#D8EFE2', fontSize: 11, fontWeight: '800' },
  expenseIcon: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: 'rgba(217,108,85,0.32)' },
  incomeIcon: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: 'rgba(196,245,213,0.2)' },
  metricValue: { marginTop: 5, color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  shortcutContainer: { marginTop: 18, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 24, backgroundColor: 'transparent', borderWidth: 0 },
  shortcutRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  shortcut: { flex: 1, minHeight: 76, alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 7, borderRadius: 14 },
  shortcutIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accentPale, borderWidth: 1, borderColor: palette.accentSoft },
  shortcutLabel: { width: '100%', marginTop: 7, color: palette.ink, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  insightPreview: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 18, backgroundColor: palette.accentPale },
  insightIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface },
  insightCopy: { flex: 1, marginHorizontal: 11 },
  insightTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  insightText: { marginTop: 3, color: palette.muted, fontSize: 12, lineHeight: 17 },
  listCard: { paddingHorizontal: 15, borderRadius: 24, backgroundColor: 'transparent', borderWidth: 0 },
  walletRow: { flexDirection: 'row', alignItems: 'center', minHeight: 70, borderBottomWidth: 1, borderBottomColor: palette.line },
  walletIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  walletInitial: { fontSize: 11, fontWeight: '900' },
  walletBalance: { marginRight: 4, color: palette.ink, fontSize: 13, fontWeight: '900' },
  moreWallets: { alignItems: 'center', paddingVertical: 13 },
  moreWalletsText: { color: palette.accent, fontSize: 12, fontWeight: '900' },
  inlineState: { alignItems: 'center', justifyContent: 'center', minHeight: 92, paddingVertical: 16 },
  inlineEmpty: { alignItems: 'center', marginTop: 8, padding: 16, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  stateTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  stateText: { marginTop: 5, color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorText: { color: palette.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72, borderBottomWidth: 1, borderBottomColor: palette.line },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accentPale },
  rowIconDanger: { backgroundColor: '#FCE8E6' },
  rowMain: { flex: 1, marginLeft: 11 },
  rowTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  rowMeta: { marginTop: 4, color: palette.muted, fontSize: 11 },
  rowRight: { alignItems: 'flex-end' },
  rowAmount: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  status: { marginTop: 5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, fontSize: 9, fontWeight: '800', overflow: 'hidden' },
  statusDanger: { color: palette.danger, backgroundColor: '#FCE8E6' },
  statusUpcoming: { color: palette.accent, backgroundColor: palette.accentPale },
  statusPaid: { color: palette.muted, backgroundColor: '#EEF2EF' },
  expenseAmount: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  quickAdd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 54, marginTop: 16, borderRadius: 17, borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.accentSoft },
  quickAddText: { marginLeft: 8, color: palette.accent, fontSize: 13, fontWeight: '800' },
  dismissLayer: { ...StyleSheet.absoluteFillObject, zIndex: 4 },
  chatHead: { position: 'absolute', right: 20, bottom: 112, zIndex: 6, width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent, shadowColor: '#063224', shadowOpacity: 0.2, shadowRadius: 9, elevation: 5 },
  insightBubble: { position: 'absolute', right: 20, bottom: 176, zIndex: 7, width: 265, padding: 15, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, shadowColor: '#063224', shadowOpacity: 0.16, shadowRadius: 14, elevation: 6 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bubbleTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  bubbleText: { marginTop: 9, color: palette.muted, fontSize: 13, lineHeight: 19 },
  bubbleLink: { marginTop: 10, color: palette.accent, fontSize: 12, fontWeight: '900' },
  addMenu: { position: 'absolute', right: 12, zIndex: 8, maxWidth: 272, padding: 14, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, shadowColor: '#063224', shadowOpacity: 0.18, shadowRadius: 14, elevation: 7 },
  addMenuTitle: { marginBottom: 10, color: palette.muted, fontSize: 11, fontWeight: '800' },
  addGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addMenuItem: { minHeight: 70, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 8, borderRadius: 13, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.line, gap: 5 },
  addMenuLabel: { color: palette.ink, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  formOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end' },
  formDismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,35,28,0.28)' },
  formKeyboard: { maxHeight: '88%' },
  formCard: { padding: 20, paddingBottom: 30, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: palette.surface, shadowColor: '#063224', shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  formHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  formEyebrow: { color: palette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  formTitle: { marginTop: 4, color: palette.ink, fontSize: 22, fontWeight: '900' },
  formClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  formInput: { minHeight: 50, marginBottom: 11, paddingHorizontal: 15, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.background, color: palette.ink, fontSize: 14 },
  cycleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 11 },
  cycleChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.line },
  cycleChipActive: { backgroundColor: palette.accentPale, borderColor: palette.accent },
  cycleText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  cycleTextActive: { color: palette.accent, fontWeight: '900' },
  formError: { marginBottom: 10, color: palette.danger, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  formSubmit: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: palette.accent },
  formSubmitDisabled: { opacity: 0.6 },
  formSubmitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  bottomNav: { position: 'absolute', left: 16, right: 16, bottom: 12, height: 68, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 28, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, shadowColor: '#063224', shadowOpacity: 0.14, shadowRadius: 13, elevation: 7, zIndex: 5 },
  navItem: { width: 50, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  navLabelActive: { color: palette.accent, fontWeight: '900' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.accent },
  addButton: { width: 58, height: 58, marginTop: -26, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: palette.accent, shadowColor: '#063224', shadowOpacity: 0.25, shadowRadius: 9, elevation: 8 },
  pressed: { opacity: 0.78 },
});
