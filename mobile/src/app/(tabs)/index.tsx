import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  ChevronRight,
  Droplets,
  FileText,
  Home,
  MoreHorizontal,
  ReceiptText,
  Repeat,
  Target,
  WalletCards,
} from 'lucide-react-native';

import { AlalayChatHead } from '@/components/alalay-chat-head';
import { useLegacyWalletSwipeResponder } from '@/components/legacy-wallet-swipe-responder';
import { BalanceVisibilityToggle } from '@/components/balance-visibility-toggle';
import { ProfileHeaderButton } from '@/components/profile-header-button';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import {
  combineRecentTransactions,
  dateKeyInManila,
  derivedStatus,
  fetchExpenses,
  fetchFinanceItems,
  fetchRecentIncome,
  fetchWallets,
  subscribeFinancialMutations,
  totalWalletAvailableBalance,
  type FinanceItem,
  type RecentTransaction,
  type WalletRecord,
} from '@/services/finance';
import { useCurrentProfile } from '@/hooks/use-current-profile';
import { getProfileFirstName } from '@/services/profile';
import { useAppTheme } from '@/theme/theme';
import { formatCurrency } from '@/utils/currency';
import { GlassSurface } from '@/components/glass-surface';
import { useWalletBalanceVisibility } from '@/hooks/use-balance-visibility';
import { StatusBadge } from '@/components/status-badge';
import { BrandLogo } from '@/components/brand-logo';
import { cycleIndex, visibleWallets, walletSlotOffset } from '@/utils/wallet-stack';
import { createRequestGate } from '@/utils/request-gate';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  return formatCurrency(value);
}

function formatBalancePeso(value: number) {
  const formatted = formatCurrency(Math.abs(value));
  return value < 0 ? `−${formatted}` : formatted;
}

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const bottomNavClearance = useBottomNavClearance();
  const [financeItems, setFinanceItems] = useState<FinanceItem[]>([]);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState('');
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState('');
  const { profile } = useCurrentProfile();
  const financeRefreshGate = useRef(createRequestGate<void>()).current;

  const refreshFinance = useCallback(
    () =>
      financeRefreshGate(async () => {
        setFinanceLoading(true);
        setWalletLoading(true);
        setFinanceError('');
        setWalletError('');
        try {
          const [items, expenseRows, incomeRows] = await Promise.all([
            fetchFinanceItems(),
            fetchExpenses(),
            fetchRecentIncome(),
          ]);
          setFinanceItems(items);
          setRecentTransactions(combineRecentTransactions(expenseRows, incomeRows));
          try {
            setWallets(await fetchWallets());
            setWalletError('');
          } catch (walletFetchError) {
            setWalletError(
              walletFetchError instanceof Error
                ? walletFetchError.message
                : 'Wallets could not load.',
            );
          }
        } catch (error) {
          setFinanceError(error instanceof Error ? error.message : 'Bills could not load.');
          setWalletError('Wallets could not load.');
        } finally {
          setFinanceLoading(false);
          setWalletLoading(false);
        }
      }),
    [financeRefreshGate],
  );

  const firstName = profile ? getProfileFirstName(profile.name) : 'there';

  useFocusEffect(
    useCallback(() => {
      void refreshFinance();
    }, [refreshFinance]),
  );
  useEffect(
    () =>
      subscribeFinancialMutations(() => {
        void refreshFinance();
      }),
    [refreshFinance],
  );

  const recentTransactionRows = recentTransactions.slice(0, 5);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <ProfileHeaderButton />
          <View style={styles.greetingBlock}>
            <Text accessibilityRole="header" style={[styles.greeting, { color: colors.ink }]}>
              {getGreeting()}{' '}
              <Text style={[styles.greetingName, { color: colors.ink }]}>{firstName}!</Text>
            </Text>
            <Text style={[styles.date, { color: colors.muted }]}>
              {new Intl.DateTimeFormat('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }).format(new Date())}
            </Text>
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

        <WalletHero
          accountId={profile?.userId}
          wallets={wallets}
          walletLoading={walletLoading}
          walletError={walletError}
        />
        <QuickActionsCard />

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>This month</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            {
              financeItems.filter(
                (item) =>
                  item.dueDate.slice(0, 7) === dateKeyInManila().slice(0, 7) &&
                  !item.isOverdueFromPreviousMonth,
              ).length
            }{' '}
            items
          </Text>
        </View>
        <GlassSurface style={styles.listCard} padding={0}>
          {financeLoading ? (
            <View style={styles.inlineState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                Loading bills…
              </Text>
            </View>
          ) : financeError ? (
            <View style={styles.inlineState}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{financeError}</Text>
            </View>
          ) : financeItems.length ? (
            financeItems
              .filter(
                (item) =>
                  item.dueDate.slice(0, 7) === dateKeyInManila().slice(0, 7) &&
                  !item.isOverdueFromPreviousMonth,
              )
              .slice(0, 5)
              .map((item) => <FinanceRow key={`${item.source}-${item.id}`} item={item} />)
          ) : (
            <View style={styles.inlineState}>
              <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>No bills yet</Text>
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                Use Add to create your first bill or subscription.
              </Text>
            </View>
          )}
        </GlassSurface>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Recent transactions
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/expenses')}>
            <Text style={[styles.link, { color: colors.primary }]}>See all</Text>
          </Pressable>
        </View>
        <GlassSurface style={styles.listCard} padding={0}>
          {financeLoading ? (
            <View style={styles.inlineState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                Loading transactions…
              </Text>
            </View>
          ) : financeError ? (
            <View style={styles.inlineState}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{financeError}</Text>
            </View>
          ) : recentTransactionRows.length ? (
            recentTransactionRows.map((transaction) => (
              <RecentTransactionRow key={transaction.id} transaction={transaction} />
            ))
          ) : (
            <View style={styles.inlineState}>
              <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
                No transactions yet
              </Text>
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                Your recent income and expenses will appear here.
              </Text>
            </View>
          )}
        </GlassSurface>
      </ScrollView>

      <AlalayChatHead />
    </SafeAreaView>
  );
}

// Retained as a compatibility reference for the previous dashboard card.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SummaryCard({
  summary,
  loading,
  wallets,
  walletLoading,
  walletError,
}: {
  summary: DashboardSummary | null;
  loading: boolean;
  wallets: WalletRecord[];
  walletLoading: boolean;
  walletError: string;
}) {
  const { colors } = useAppTheme();
  const { visible, toggle } = useWalletBalanceVisibility();
  const availableBalance = totalWalletAvailableBalance(wallets);
  const balanceUnavailable = Boolean(walletError) || walletLoading || availableBalance === null;
  const amountsVisible = visible === true;
  const mask = '••••••';
  const balanceLabel = balanceUnavailable
    ? walletLoading
      ? 'loading'
      : 'unavailable'
    : amountsVisible
      ? formatBalancePeso(availableBalance)
      : 'hidden';
  const expensesLabel =
    loading || !summary
      ? 'loading'
      : amountsVisible
        ? formatPeso(summary.monthly_expenses)
        : 'hidden';
  const incomeLabel =
    loading || !summary
      ? 'loading'
      : amountsVisible
        ? formatPeso(summary.monthly_income)
        : 'hidden';
  return (
    <View style={styles.balanceStack}>
      <View
        accessible={false}
        importantForAccessibility="no"
        style={[styles.balanceRearCard, { backgroundColor: colors.balanceRear }]}
      />
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Total Balance ${balanceLabel}. Expenses ${expensesLabel}. Income ${incomeLabel}.`}
        style={[
          styles.summaryCard,
          { backgroundColor: colors.balance, borderColor: colors.primary },
        ]}
      >
        <View
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no"
          style={styles.walletDecoration}
        >
          <View style={styles.walletBack} />
          <View style={styles.walletFront}>
            <View style={styles.walletSlot} />
            <View style={styles.walletButton} />
          </View>
        </View>
        <View style={styles.balanceHeader}>
          <Text style={styles.summaryEyebrow}>TOTAL BALANCE</Text>
          <BalanceVisibilityToggle
            visible={amountsVisible}
            onToggle={toggle}
            iconColor={colors.textOnPrimaryMuted}
            positioned
            accessibilityLabel={
              amountsVisible ? 'Hide financial amounts' : 'Show financial amounts'
            }
          />
        </View>
        <Text
          accessibilityElementsHidden={!amountsVisible}
          importantForAccessibility={amountsVisible ? 'yes' : 'no'}
          adjustsFontSizeToFit
          minimumFontScale={0.58}
          numberOfLines={1}
          style={styles.balanceValue}
        >
          {balanceUnavailable
            ? walletLoading
              ? 'Loading…'
              : 'Unavailable'
            : amountsVisible
              ? formatBalancePeso(availableBalance)
              : mask}
        </Text>
        <View
          style={[
            styles.supportingMetrics,
            { backgroundColor: 'rgba(5,43,32,0.28)', borderColor: 'rgba(216,239,226,0.18)' },
          ]}
        >
          <View style={styles.supportingMetric}>
            <View style={styles.metricLabelRow}>
              <View style={styles.expenseIcon}>
                <ArrowDown size={15} color="#FFD3D0" strokeWidth={2.8} />
              </View>
              <Text style={styles.metricLabel}>Expenses</Text>
            </View>
            <Text
              accessibilityElementsHidden={!amountsVisible}
              importantForAccessibility={amountsVisible ? 'yes' : 'no'}
              style={styles.metricValue}
            >
              {loading || !summary
                ? 'Loading…'
                : amountsVisible
                  ? formatPeso(summary.monthly_expenses)
                  : mask}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.supportingMetric}>
            <View style={styles.metricLabelRow}>
              <View style={styles.incomeIcon}>
                <ArrowUp size={15} color="#C4F5D5" strokeWidth={2.8} />
              </View>
              <Text style={styles.metricLabel}>Income</Text>
            </View>
            <Text
              accessibilityElementsHidden={!amountsVisible}
              importantForAccessibility={amountsVisible ? 'yes' : 'no'}
              style={styles.metricValue}
            >
              {loading || !summary
                ? 'Loading…'
                : amountsVisible
                  ? formatPeso(summary.monthly_income)
                  : mask}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

type QuickAction = {
  id: string;
  label: string;
  accessibilityLabel: string;
  icon: Icon;
  iconBackground: string;
  active?: boolean;
};

const navigationQuickActions = [
  {
    id: 'expense',
    label: 'Expense',
    accessibilityLabel: 'Add expense',
    icon: BanknoteArrowDown,
    href: '/(tabs)/expenses',
  },
  {
    id: 'income',
    label: 'Income',
    accessibilityLabel: 'Add income',
    icon: BanknoteArrowUp,
    href: '/(tabs)/income',
  },
  {
    id: 'bills',
    label: 'Bills',
    accessibilityLabel: 'Open bills',
    icon: ReceiptText,
    href: '/(tabs)/bills',
  },
  {
    id: 'subscription',
    label: 'Subscription',
    accessibilityLabel: 'Open subscriptions',
    icon: Repeat,
    href: '/(tabs)/subscriptions',
  },
] as const;

function WalletHero({
  accountId,
  wallets,
  walletLoading,
  walletError,
}: {
  accountId?: string;
  wallets: WalletRecord[];
  walletLoading: boolean;
  walletError: string;
}) {
  const { colors } = useAppTheme();
  const { visible, toggle } = useWalletBalanceVisibility();
  const amountsVisible = visible === true;
  const mask = '••••••';
  const [frontIndex, setFrontIndex] = useState(0);
  const frontWalletId = useRef<string | null>(null);
  const cycleLocked = useRef(false);
  const previousAccountId = useRef(accountId);
  const currentFrontId = wallets[frontIndex]?.id ?? null;
  useEffect(() => {
    if (accountId && previousAccountId.current && accountId !== previousAccountId.current) {
      setFrontIndex(0);
      frontWalletId.current = null;
    }
    previousAccountId.current = accountId;
  }, [accountId]);
  useEffect(() => {
    const preservedIndex = frontWalletId.current
      ? wallets.findIndex((wallet) => wallet.id === frontWalletId.current)
      : -1;
    setFrontIndex((current) => {
      if (wallets.length === 0) return 0;
      if (preservedIndex >= 0) return preservedIndex;
      return Math.min(current, wallets.length - 1);
    });
  }, [wallets]);
  useEffect(() => {
    frontWalletId.current = currentFrontId;
  }, [currentFrontId]);
  const visibleCards = useMemo(() => visibleWallets(wallets, frontIndex), [wallets, frontIndex]);
  const selectedWallet = wallets[frontIndex];
  const selectedBalanceLabel =
    selectedWallet?.account_type === 'credit' ? 'OUTSTANDING BALANCE' : 'AVAILABLE BALANCE';
  const selectedBalance =
    selectedWallet?.account_type === 'credit'
      ? Number(selectedWallet.balance)
      : Number(selectedWallet?.available_balance);
  const selectedPosition = wallets.length ? frontIndex + 1 : 0;
  const advance = useCallback(
    (steps: number) => {
      if (cycleLocked.current || wallets.length < 2) return;
      cycleLocked.current = true;
      setFrontIndex((current) => cycleIndex(current, wallets.length, steps));
      setTimeout(() => {
        cycleLocked.current = false;
      }, 320);
    },
    [wallets.length],
  );
  useEffect(() => {
    if (visibleCards[0])
      AccessibilityInfo.announceForAccessibility(`${visibleCards[0].name} selected`);
  }, [visibleCards]);

  const unavailable =
    Boolean(walletError) ||
    walletLoading ||
    wallets.some(
      (wallet) =>
        wallet.account_type !== 'credit' &&
        (wallet.available_balance === undefined ||
          !Number.isFinite(Number(wallet.available_balance))),
    );
  const walletSwipeResponder = useLegacyWalletSwipeResponder(wallets.length, advance);
  return (
    <View style={styles.walletHero}>
      <View
        pointerEvents="none"
        style={[
          styles.rearWalletCover,
          { backgroundColor: colors.balanceRear, borderColor: colors.primary },
        ]}
      />
      <View pointerEvents="none" style={styles.rearWalletHighlight} />
      <View
        pointerEvents="none"
        style={[styles.pocketRim, { backgroundColor: colors.balanceRear }]}
      />
      <View pointerEvents="none" style={styles.pocketCurve}>
        <Svg width="100%" height="72" viewBox="0 0 360 72" preserveAspectRatio="none">
          <Path d="M0 2 C74 60 286 60 360 2 L360 72 L0 72 Z" fill={colors.balance} />
        </Svg>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.walletPocket,
          { backgroundColor: colors.balance, borderColor: colors.primary },
        ]}
      />
      <View pointerEvents="none" style={styles.pocketStitch} />
      <View style={styles.walletHeroHeader}>
        <Text style={styles.summaryEyebrow}>{selectedBalanceLabel}</Text>
        <BalanceVisibilityToggle
          visible={amountsVisible}
          onToggle={toggle}
          iconColor={colors.textOnPrimaryMuted}
          positioned
          accessibilityLabel={amountsVisible ? 'Hide balances' : 'Show balances'}
        />
      </View>
      <Text
        accessibilityLabel={
          unavailable
            ? 'Available balance unavailable'
            : amountsVisible
              ? `${selectedBalanceLabel.toLowerCase()} ${formatBalancePeso(selectedBalance)}`
              : `${selectedBalanceLabel.toLowerCase()} hidden`
        }
        style={styles.balanceValue}
      >
        {unavailable
          ? walletLoading
            ? 'Loading…'
            : 'Unavailable'
          : amountsVisible
            ? formatBalancePeso(selectedBalance)
            : mask}
      </Text>
      {unavailable ? (
        <View style={styles.walletState}>
          <ActivityIndicator color={colors.textOnPrimary} />
          <Text style={styles.walletStateText}>{walletError || 'Loading wallets…'}</Text>
        </View>
      ) : wallets.length === 0 ? (
        <View style={styles.walletState}>
          <Text style={styles.walletStateText}>No wallets yet</Text>
          <Text style={styles.walletStateHint}>Add a wallet to start tracking your balance.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/wallets')}>
            <Text style={styles.walletAction}>Add wallet</Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={styles.cardStack}
          accessibilityLabel={`Wallet cards, ${wallets.length} available`}
          {...walletSwipeResponder.panHandlers}
        >
          {visibleCards.map((wallet, slotIndex) => (
            <WalletStackCard
              key={wallet.id}
              wallet={wallet}
              slotIndex={slotIndex}
              visible={amountsVisible}
              onSelect={() => {
                if (slotIndex > 0) advance(slotIndex);
              }}
            />
          ))}
          <Text style={styles.walletCount}>
            {selectedPosition} of {wallets.length}
          </Text>
        </View>
      )}
      {wallets.length > 1 && !unavailable ? <View style={styles.walletPager}></View> : null}
    </View>
  );
}

const WalletStackCard = memo(function WalletStackCard({
  wallet,
  slotIndex,
  visible,
  onSelect,
}: {
  wallet: WalletRecord;
  slotIndex: number;
  visible: boolean;
  onSelect: () => void;
}) {
  const { colors } = useAppTheme();
  const type =
    wallet.account_type === 'credit'
      ? 'Credit Card'
      : wallet.institution_type === 'e_wallet'
        ? 'E-Wallet'
        : wallet.account_purpose === 'savings'
          ? 'Savings'
          : wallet.is_default_cash
            ? 'Cash'
            : wallet.account_type === 'debit'
              ? 'Debit Card'
              : typeLabel(wallet.institution_type);
  const availableBalanceLabel = !visible
    ? 'hidden'
    : formatBalancePeso(
        Number(wallet.account_type === 'credit' ? wallet.balance : wallet.available_balance),
      );
  const balanceLabel = !visible ? '••••••' : formatBalancePeso(Number(wallet.balance));
  const translateY = useSharedValue(walletSlotOffset(slotIndex));
  const scale = useSharedValue(slotIndex === 0 ? 1 : slotIndex === 1 ? 0.97 : 0.94);
  useEffect(() => {
    translateY.value = withTiming(walletSlotOffset(slotIndex), {
      duration: 260,
    });
    scale.value = withTiming(slotIndex === 0 ? 1 : slotIndex === 1 ? 0.97 : 0.94, {
      duration: 260,
    });
  }, [scale, slotIndex, translateY]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
  return (
    <Animated.View
      style={[
        styles.walletStackCard,
        animatedStyle,
        {
          backgroundColor: slotIndex === 0 ? colors.primary : colors.balanceRear,
          borderColor: slotIndex === 0 ? colors.primarySoft : colors.balance,
          zIndex: 100 - slotIndex,
          elevation: 100 - slotIndex,
        },
      ]}
    >
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityState={{ selected: slotIndex === 0 }}
        accessibilityLabel={`${slotIndex === 0 ? 'Selected' : 'Select'} ${wallet.name}, ${type}${wallet.last_four ? ` ending in ${wallet.last_four}` : ''}, ${wallet.account_type === 'credit' ? `Amount owed ${availableBalanceLabel}` : visible ? `Available balance ${availableBalanceLabel}` : 'balance hidden'}`}
        onPress={onSelect}
        style={styles.walletCardContent}
      >
        <View style={styles.walletCardLogo}>
          <BrandLogo
            name={wallet.name}
            entity="wallet"
            institutionKey={wallet.institution_key}
            category={wallet.institution_type}
            size={38}
          />
        </View>
        <View style={styles.walletCardCopy}>
          <Text numberOfLines={1} style={[styles.walletCardName, { color: colors.textOnPrimary }]}>
            {wallet.name}
          </Text>
          <Text numberOfLines={1} style={[styles.rowMeta, { color: colors.textOnPrimaryMuted }]}>
            {type}
            {wallet.last_four ? ` • ${wallet.last_four}` : ''}
          </Text>
        </View>
        <View style={styles.walletCardBalanceArea}>
          {wallet.account_type === 'credit' ? (
            <Text
              numberOfLines={1}
              style={[styles.walletCardAmountLabel, { color: colors.textOnPrimaryMuted }]}
            >
              Amount owed
            </Text>
          ) : null}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            style={[styles.walletCardBalance, { color: colors.textOnPrimary }]}
          >
            {visible ? availableBalanceLabel : balanceLabel}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

function QuickActionsCard() {
  const { colors } = useAppTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [moreOpen, setMoreOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const cardRef = useRef<View>(null);
  const progress = useSharedValue(0);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
  }, []);
  const closeMore = useCallback(() => {
    if (!moreOpen || closing) return;
    setClosing(true);
    progress.set(withTiming(0, { duration: reduceMotion ? 0 : 150 }));
    setTimeout(
      () => {
        setMoreOpen(false);
        setClosing(false);
      },
      reduceMotion ? 0 : 160,
    );
  }, [closing, moreOpen, progress, reduceMotion]);
  const openMore = useCallback(() => {
    if (moreOpen) return closeMore();
    cardRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setMoreOpen(true);
      progress.set(0);
      progress.set(withTiming(1, { duration: reduceMotion ? 0 : 210 }));
    });
  }, [closeMore, moreOpen, progress, reduceMotion]);
  useEffect(() => {
    if (!moreOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeMore();
      return true;
    });
    return () => subscription.remove();
  }, [closeMore, moreOpen]);
  const menuAnimation = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: 10 - progress.get() * 10 }, { scale: 0.96 + progress.get() * 0.04 }],
  }));
  return (
    <View
      ref={cardRef}
      style={[
        styles.quickActionsCard,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.shortcutRow}>
        {navigationQuickActions.map((action) => (
          <Shortcut
            key={action.id}
            action={{ ...action, iconBackground: colors.surfaceSecondary }}
            onPress={() => router.push(action.href)}
          />
        ))}
        <Shortcut
          action={{
            id: 'more',
            label: 'More',
            accessibilityLabel: 'Open more quick actions',
            icon: MoreHorizontal,
            iconBackground: colors.surfaceSecondary,
            active: moreOpen,
          }}
          onPress={openMore}
        />
      </View>
      <Modal
        visible={moreOpen || closing}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeMore}
      >
        <Pressable style={styles.moreBackdrop} onPress={closeMore}>
          <AnimatedPressable
            style={[
              styles.moreMenu,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              anchor && {
                left: Math.max(12, Math.min(anchor.x + anchor.width - 250, screenWidth - 262)),
                top: Math.max(12, Math.min(anchor.y - 136, screenHeight - 190)),
              },
              menuAnimation,
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Goals"
              onPress={() => {
                if (closing) return;
                closeMore();
                router.push('/(tabs)/savings');
              }}
              style={styles.moreMenuItem}
            >
              <Target size={20} color={colors.primary} />
              <Text style={[styles.moreMenuLabel, { color: colors.textPrimary }]}>Goals</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Loans and Debt"
              onPress={() => {
                if (closing) return;
                closeMore();
                router.push('/loans');
              }}
              style={styles.moreMenuItem}
            >
              <WalletCards size={20} color={colors.primary} />
              <Text style={[styles.moreMenuLabel, { color: colors.textPrimary }]}>
                Loans &amp; Debt
              </Text>
            </Pressable>
          </AnimatedPressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// Retained as a compatibility reference for the previous wallet list.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WalletQuickView({
  wallets,
  loading,
  error,
}: {
  wallets: WalletRecord[];
  loading: boolean;
  error: string;
}) {
  const { colors } = useAppTheme();
  if (loading)
    return (
      <GlassSurface style={styles.listCard} padding={0}>
        <View style={styles.inlineState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>Loading wallets…</Text>
        </View>
      </GlassSurface>
    );
  if (error)
    return (
      <GlassSurface style={styles.listCard} padding={0}>
        <View style={styles.inlineState}>
          <Text style={[styles.errorText, { color: colors.danger }]}>
            Wallets unavailable. Your other dashboard sections are still available.
          </Text>
        </View>
      </GlassSurface>
    );
  return (
    <GlassSurface style={styles.listCard} padding={0}>
      {wallets.map((wallet, index) => (
        <Pressable
          key={wallet.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${wallet.name} wallet`}
          onPress={() =>
            router.push({ pathname: '/(tabs)/wallets', params: { walletId: wallet.id } })
          }
          style={({ pressed }) => [
            styles.walletRow,
            index === Math.min(wallets.length, 3) - 1 && styles.rowLast,
            pressed && styles.pressed,
          ]}
        >
          <BrandLogo
            name={wallet.name}
            entity="wallet"
            institutionKey={wallet.institution_key}
            category={wallet.institution_type}
            size={36}
          />
          <View style={styles.rowMain}>
            <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.textPrimary }]}>
              {wallet.name}
            </Text>
            <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
              {wallet.account_type === 'credit'
                ? 'Credit'
                : wallet.institution_type === 'e_wallet'
                  ? 'E-Wallet'
                  : wallet.account_type === 'debit'
                    ? 'Debit'
                    : typeLabel(wallet.institution_type)}{' '}
              · PHP
            </Text>
          </View>
          <Text style={[styles.walletBalance, { color: colors.textPrimary }]}>
            {formatBalancePeso(
              Number(wallet.account_type === 'credit' ? wallet.balance : wallet.available_balance),
            )}
          </Text>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
      ))}
      {!wallets.length ? (
        <View style={styles.inlineState}>
          <Text style={styles.stateTitle}>No wallets yet</Text>
          <Text style={styles.stateText}>Your Cash wallet will appear here once it is ready.</Text>
        </View>
      ) : null}
      {wallets.length > 3 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/wallets')}
          style={styles.moreWallets}
        >
          <Text style={styles.moreWalletsText}>
            + {wallets.length - 3} more wallet{wallets.length - 3 === 1 ? '' : 's'}
          </Text>
        </Pressable>
      ) : null}
    </GlassSurface>
  );
}

function typeLabel(type: string) {
  return type === 'e_wallet'
    ? 'E-wallet'
    : type === 'digital_bank'
      ? 'Digital bank'
      : type === 'bank'
        ? 'Bank'
        : type === 'cash'
          ? 'Cash'
          : 'Other';
}

function FinanceRow({ item }: { item: FinanceItem }) {
  const { colors } = useAppTheme();
  const status = derivedStatus(item);
  const icon =
    item.source === 'subscription'
      ? Repeat
      : item.category.toLowerCase().includes('water')
        ? Droplets
        : FileText;
  const FinanceIcon = icon;
  const iconColor =
    status === 'Overdue'
      ? colors.danger
      : status === 'Due today' || status === 'Due soon'
        ? colors.warning
        : colors.primary;
  const dateLabel = formatUpcomingDate(item.dueDate);
  const metadata =
    item.source === 'subscription'
      ? `Subscription · Renews ${dateLabel}`
      : `${item.category} · Due ${dateLabel}`;
  return (
    <View
      accessibilityLabel={`${item.name}, ${formatPeso(item.amount)}, ${metadata}, ${status}.`}
      style={styles.row}
    >
      <View accessible={false} style={styles.rowIcon}>
        <FinanceIcon size={18} color={iconColor} strokeWidth={1.8} />
      </View>
      <View style={styles.rowMain}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.textPrimary }]}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={[styles.rowMeta, { color: colors.textSecondary }]}>
          {metadata}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={[styles.rowAmount, { color: colors.textPrimary }]}
        >
          {formatPeso(item.amount)}
        </Text>
        <StatusBadge status={status} variant="compact" />
      </View>
    </View>
  );
}

function formatUpcomingDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const currentYear = Number(dateKeyInManila().slice(0, 4));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(year === currentYear ? {} : { year: 'numeric' }),
  }).format(date);
}

function RecentTransactionRow({ transaction }: { transaction: RecentTransaction }) {
  const { colors } = useAppTheme();
  const isIncome = transaction.sourceType === 'income';
  const Icon = isIncome ? ArrowUpRight : WalletCards;
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: isIncome ? colors.primarySoft : colors.accentMuted },
        ]}
      >
        <Icon size={18} color={isIncome ? colors.primary : colors.danger} strokeWidth={2.2} />
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{transaction.title}</Text>
        <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
          {transaction.category} · {isIncome ? 'Income' : 'Expense'} ·{' '}
          {formatTransactionDate(transaction.occurredAt)}
        </Text>
      </View>
      <Text style={[styles.expenseAmount, { color: isIncome ? colors.primary : colors.danger }]}>
        {isIncome ? '+' : '−'}
        {formatPeso(Math.abs(transaction.amount))}
      </Text>
    </View>
  );
}

function formatTransactionDate(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
}

function getGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );
  return hour >= 5 && hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';
}

function Shortcut({ action, onPress }: { action: QuickAction; onPress: () => void }) {
  const { colors } = useAppTheme();
  const IconComponent = action.icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      accessibilityState={action.id === 'more' ? { expanded: Boolean(action.active) } : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
    >
      <View
        accessible={false}
        importantForAccessibility="no"
        style={[
          styles.shortcutIcon,
          {
            backgroundColor: action.active ? colors.primarySoft : action.iconBackground,
            borderColor: action.active ? colors.primary : colors.border,
          },
        ]}
      >
        <IconComponent size={22} color={colors.primary} strokeWidth={2} />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        style={[styles.shortcutLabel, { color: colors.textPrimary }]}
      >
        {action.label}
      </Text>
    </Pressable>
  );
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
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  profileImage: { width: 44, height: 44, borderRadius: 22 },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D92D20',
  },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionHint: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  link: { color: palette.accent, fontSize: 13, fontWeight: '800' },
  walletHero: { height: 306, marginTop: 18, position: 'relative' },
  rearWalletCover: {
    position: 'absolute',
    top: 8,
    left: 4,
    right: 4,
    height: 171,
    borderTopLeftRadius: 33,
    borderTopRightRadius: 33,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 1,
    zIndex: 0,
  },
  rearWalletHighlight: {
    position: 'absolute',
    top: 19,
    left: 17,
    right: 17,
    height: 46,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(216,239,226,0.20)',
    zIndex: 1,
  },
  pocketRim: {
    position: 'absolute',
    top: 110,
    left: 10,
    right: 10,
    height: 85,
    borderRadius: 28,
    opacity: 0.9,
    shadowColor: '#063224',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 30,
    zIndex: 30,
  },
  pocketCurve: {
    position: 'absolute',
    top: 99,
    left: 4,
    right: 4,
    height: 72,
    zIndex: 31,
    elevation: 31,
  },
  walletPocket: {
    position: 'absolute',
    top: 133,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 30,
    borderWidth: 1,
    zIndex: 40,
    elevation: 40,
  },
  pocketStitch: {
    position: 'absolute',
    top: 151,
    left: 22,
    right: 22,
    height: 124,
    borderRadius: 23,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(216,239,226,0.35)',
    zIndex: 41,
    elevation: 41,
  },
  walletHeroHeader: {
    position: 'absolute',
    top: 168,
    left: 26,
    right: 26,
    zIndex: 42,
    elevation: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletState: { zIndex: 7, alignItems: 'center', justifyContent: 'center', minHeight: 185 },
  walletStateText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  walletStateHint: { marginTop: 6, color: '#D8EFE2', fontSize: 12, textAlign: 'center' },
  walletAction: { marginTop: 14, color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  cardStack: {
    position: 'absolute',
    top: 16,
    left: 18,
    right: 18,
    height: 166,
    zIndex: 10,
    elevation: 10,
  },
  walletStackCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 148,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 20,
  },
  walletCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    gap: 12,
    transform: [{ translateY: -6 }],
  },
  walletCardLogo: { flexShrink: 0 },
  walletCardCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  walletCardName: {
    maxWidth: '100%',
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'left',
  },
  walletCardBalanceArea: { flexShrink: 0, maxWidth: '47%', alignItems: 'flex-end' },
  walletCardAmountLabel: {
    marginBottom: 2,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  walletCardBalance: {
    maxWidth: '100%',
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
  },
  walletPager: {
    position: 'absolute',
    left: 42,
    right: 42,
    bottom: 2,
    zIndex: 50,
    elevation: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  walletPagerText: { color: '#D8EFE2', fontSize: 12, fontWeight: '800' },
  walletCount: {
    position: 'absolute',
    right: 26,
    bottom: 17,
    zIndex: 42,
    elevation: 42,
    color: '#D8EFE2',
    fontSize: 11,
    fontWeight: '800',
  },
  walletDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(216,239,226,0.38)' },
  walletDotSelected: { width: 20, backgroundColor: '#FFFFFF' },
  balanceStack: { position: 'relative', marginTop: 18, paddingTop: 12 },
  balanceRearCard: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 38,
    borderRadius: 20,
    backgroundColor: '#63B995',
    opacity: 0.9,
  },
  summaryCard: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    paddingHorizontal: 17,
    paddingTop: 19,
    paddingBottom: 17,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: palette.accent,
    shadowColor: '#063224',
    shadowOpacity: 0.16,
    shadowRadius: 9,
    elevation: 4,
  },
  walletDecoration: {
    position: 'absolute',
    right: 8,
    bottom: 30,
    width: 122,
    height: 126,
    opacity: 0.13,
    transform: [{ rotate: '-18deg' }],
  },
  walletBack: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 92,
    height: 72,
    borderRadius: 17,
    backgroundColor: '#6FC39B',
    transform: [{ rotate: '-18deg' }],
  },
  walletFront: {
    position: 'absolute',
    right: 0,
    bottom: 3,
    width: 112,
    height: 76,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#B4E4C9',
    backgroundColor: '#174D3D',
    transform: [{ rotate: '18deg' }],
  },
  walletSlot: {
    position: 'absolute',
    left: 15,
    right: 15,
    top: 17,
    height: 22,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#8ED2AE',
  },
  walletButton: {
    position: 'absolute',
    right: 12,
    bottom: -14,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#B4E4C9',
    backgroundColor: '#2B7458',
  },
  balanceHeader: {
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
  },
  summaryEyebrow: {
    color: '#D8EFE2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  balanceValue: {
    position: 'absolute',
    top: 198,
    left: 26,
    right: 64,
    zIndex: 42,
    elevation: 42,
    marginTop: 0,
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'left',
  },
  supportingMetrics: {
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    minHeight: 70,
    marginTop: 21,
    paddingVertical: 12,
    borderRadius: 19,
    borderWidth: 1,
  },
  supportingMetric: { flex: 1, alignItems: 'center' },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabel: { color: '#D8EFE2', fontSize: 11, fontWeight: '800' },
  metricDivider: { width: 1, marginVertical: 2, backgroundColor: 'rgba(216,239,226,0.22)' },
  expenseIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(217,108,85,0.34)',
  },
  incomeIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(196,245,213,0.22)',
  },
  metricValue: { marginTop: 5, color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  quickActionsCard: {
    marginTop: 18,
    paddingHorizontal: 10,
    paddingTop: 13,
    paddingBottom: 11,
    borderRadius: 22,
    borderWidth: 1,
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },
  shortcutRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  shortcut: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 5,
    borderRadius: 14,
  },
  shortcutPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  shortcutIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  shortcutLabel: {
    width: '100%',
    marginTop: 6,
    color: palette.ink,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  moreBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  moreMenu: {
    position: 'absolute',
    width: 250,
    padding: 8,
    borderWidth: 1,
    borderRadius: 18,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  moreMenuItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 13,
  },
  moreMenuLabel: { fontSize: 14, fontWeight: '800' },
  insightPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 18,
    backgroundColor: palette.accentPale,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  insightCopy: { flex: 1, marginHorizontal: 11 },
  insightTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  insightText: { marginTop: 3, color: palette.muted, fontSize: 12, lineHeight: 17 },
  listCard: {
    paddingHorizontal: 15,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 70,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  walletIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  walletInitial: { fontSize: 11, fontWeight: '900' },
  walletBalance: { marginRight: 4, color: palette.ink, fontSize: 13, fontWeight: '900' },
  moreWallets: { alignItems: 'center', paddingVertical: 13 },
  moreWalletsText: { color: palette.accent, fontSize: 12, fontWeight: '900' },
  inlineState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 92,
    paddingVertical: 16,
  },
  inlineEmpty: {
    alignItems: 'center',
    marginTop: 8,
    padding: 16,
    borderRadius: 17,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  stateTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  stateText: {
    marginTop: 5,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  errorText: { color: palette.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentPale,
  },
  rowIconDanger: { backgroundColor: '#FCE8E6' },
  rowMain: { flex: 1, minWidth: 0, marginLeft: 11, marginRight: 12 },
  rowTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  rowMeta: { marginTop: 4, color: palette.muted, fontSize: 11 },
  rowRight: { alignItems: 'flex-end', minWidth: 84, maxWidth: 118 },
  rowAmount: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  expenseAmount: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  quickAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 16,
    borderRadius: 17,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.accentSoft,
  },
  quickAddText: { marginLeft: 8, color: palette.accent, fontSize: 13, fontWeight: '800' },
  dismissLayer: { ...StyleSheet.absoluteFill, zIndex: 4 },
  chatHead: {
    position: 'absolute',
    right: 20,
    bottom: 112,
    zIndex: 6,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    shadowColor: '#063224',
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 5,
  },
  insightBubble: {
    position: 'absolute',
    right: 20,
    bottom: 176,
    zIndex: 7,
    width: 265,
    padding: 15,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: '#063224',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bubbleTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  bubbleText: { marginTop: 9, color: palette.muted, fontSize: 13, lineHeight: 19 },
  bubbleLink: { marginTop: 10, color: palette.accent, fontSize: 12, fontWeight: '900' },
  addMenu: {
    position: 'absolute',
    right: 12,
    zIndex: 8,
    maxWidth: 272,
    padding: 14,
    borderRadius: 19,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: '#063224',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 7,
  },
  addMenuTitle: { marginBottom: 10, color: palette.muted, fontSize: 11, fontWeight: '800' },
  addGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addMenuItem: {
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 5,
  },
  addMenuLabel: { color: palette.ink, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  formOverlay: { ...StyleSheet.absoluteFill, zIndex: 20, justifyContent: 'flex-end' },
  formDismiss: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,35,28,0.28)' },
  formKeyboard: { maxHeight: '88%' },
  formCard: {
    padding: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: palette.surface,
    shadowColor: '#063224',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  formEyebrow: { color: palette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  formTitle: { marginTop: 4, color: palette.ink, fontSize: 22, fontWeight: '900' },
  formClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  formInput: {
    minHeight: 50,
    marginBottom: 11,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.background,
    color: palette.ink,
    fontSize: 14,
  },
  cycleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 11 },
  cycleChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.line,
  },
  cycleChipActive: { backgroundColor: palette.accentPale, borderColor: palette.accent },
  cycleText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  cycleTextActive: { color: palette.accent, fontWeight: '900' },
  formError: {
    marginBottom: 10,
    color: palette.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  formSubmit: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: palette.accent,
  },
  formSubmitDisabled: { opacity: 0.6 },
  formSubmitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  bottomNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    height: 68,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: '#063224',
    shadowOpacity: 0.14,
    shadowRadius: 13,
    elevation: 7,
    zIndex: 5,
  },
  navItem: { width: 50, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  navLabelActive: { color: palette.accent, fontWeight: '900' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.accent },
  addButton: {
    width: 58,
    height: 58,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: palette.accent,
    shadowColor: '#063224',
    shadowOpacity: 0.25,
    shadowRadius: 9,
    elevation: 8,
  },
  pressed: { opacity: 0.78 },
});
