import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowUpRight,
  CalendarDays,
  BriefcaseBusiness,
  Building2,
  MoreHorizontal,
  Repeat2,
  Send,
  WalletCards,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CategoryChipRow,
  DatePickerField,
  parseAmount,
  FinanceFormSheet,
  FormTextInput,
  formPalette,
  IncomeFrequencyChips,
  type IncomeFrequency,
} from '@/components/finance-form';
import { SectionAddButton } from '@/components/header-add-button';
import { FinancialOverviewCard } from '@/components/financial-overview-card';
import { WalletPicker, type Wallet } from '@/components/wallet-picker';
import { authenticatedApiRequest } from '@/services/api';
import {
  dateKeyInManila,
  fetchIncomeMonth,
  fetchWallets,
  notifyFinancialMutation,
  subscribeFinancialMutations,
} from '@/services/finance';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';
import { RecordActionSheet } from '@/components/record-action-sheet';
import { StatusBadge } from '@/components/status-badge';
import { sortCategoriesByLabel } from '@/utils/category-sorting';
import { useToast } from '@/components/toast-provider';
import { useIncomeWorkflow, type IncomeWorkflowDraft } from '@/context/income-workflow';

type Income = {
  id: string;
  source: string;
  type: string;
  custom_type?: string | null;
  amount: number | string;
  date: string;
  is_recurring: boolean;
  is_posted?: boolean;
  is_scheduled?: boolean;
  frequency?: string | null;
  wallet_id: string;
  status?: string;
  due_date?: string | null;
  received_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  transaction_id?: string | null;
};
type IncomeSummary = {
  this_month: number;
  projected_amount: number;
  upcoming_amount: number;
  overdue_amount: number;
  monthly_sources: number;
  actual_transactions: number;
  upcoming_transactions: number;
  overdue_transactions: number;
};
const incomeTypes = sortCategoriesByLabel([
  { label: 'Salary', icon: Building2 },
  { label: 'Freelance', icon: BriefcaseBusiness },
  { label: 'Business', icon: WalletCards },
  { label: 'Commission', icon: WalletCards },
  { label: 'Bonus', icon: WalletCards },
  { label: 'Overtime', icon: WalletCards },
  { label: 'Investment', icon: WalletCards },
  { label: 'Interest', icon: WalletCards },
  { label: 'Dividend', icon: WalletCards },
  { label: 'Rental Income', icon: Building2 },
  { label: 'Allowance', icon: WalletCards },
  { label: 'Remittance', icon: Send },
  { label: 'Pension', icon: WalletCards },
  { label: 'Government Benefit', icon: WalletCards },
  { label: 'Gift', icon: WalletCards },
  { label: 'Refund', icon: WalletCards },
  { label: 'Side Hustle', icon: BriefcaseBusiness },
  { label: 'Other', icon: MoreHorizontal },
]);

const incomeTypeValues = Object.fromEntries(
  incomeTypes.map(({ label }) => [label, label.toLowerCase().replace(/[^a-z0-9]+/g, '_')]),
) as Record<string, string>;

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

function monthName(month: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long' })
    .format(new Date(`${month}-01T12:00:00`))
    .toUpperCase();
}

function moveMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function shortIncomeDate(value: string | null | undefined, selectedMonth: string) {
  if (!value) return 'Not scheduled';
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return value;
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric',
    ...(year === Number(selectedMonth.slice(0, 4)) ? {} : { year: 'numeric' }),
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function incomeCardStatus(row: Income): 'Received' | 'Overdue' | 'Due soon' | 'Upcoming' | 'Inactive' {
  if (row.status === 'received' || row.is_posted) return 'Received';
  if (row.status === 'overdue') return 'Overdue';
  if (row.status === 'failed' || row.status === 'not_started') return 'Inactive';
  const date = row.due_date ?? row.date;
  const today = dateKeyInManila();
  if (date < today) return 'Overdue';
  const threshold = new Date(`${today}T12:00:00Z`);
  threshold.setUTCDate(threshold.getUTCDate() + 7);
  return date <= threshold.toISOString().slice(0, 10) ? 'Due soon' : 'Upcoming';
}

function incomeWalletName(row: Income, wallets: Wallet[]) {
  if (!row.wallet_id) return 'No destination wallet';
  return wallets.find((wallet) => wallet.id === row.wallet_id)?.name ?? 'Wallet unavailable';
}

function logIncomeFetch(event: string, details: Record<string, unknown>) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.info(`[Income] ${event}`, details);
}

export default function IncomeScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const workflow = useIncomeWorkflow();
  styles = makeStyles({
    ...formPalette,
    background: colors.background,
    surface: colors.surfaceElevated,
    ink: colors.textPrimary,
    muted: colors.textSecondary,
    accent: colors.primary,
    accentDark: colors.primary,
    accentPale: colors.primarySoft,
    balance: colors.balance,
    line: colors.border,
  });
  const bottomNavClearance = useBottomNavClearance();
  const [rows, setRows] = useState<Income[]>([]);
  const [summary, setSummary] = useState<IncomeSummary>({
    this_month: 0,
    projected_amount: 0,
    upcoming_amount: 0,
    overdue_amount: 0,
    monthly_sources: 0,
    actual_transactions: 0,
    upcoming_transactions: 0,
    overdue_transactions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sectionErrors, setSectionErrors] = useState({ recorded: '', summary: '' });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [managing, setManaging] = useState<Income | null>(null);
  const [details, setDetails] = useState<Income | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletSelection, setWalletSelection] = useState<{ id: string; version: number } | null>(
    null,
  );
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  const refresh = useCallback(
    async (trigger = 'manual') => {
      logIncomeFetch('fetch trigger', { trigger, month: selectedMonth });
      setLoading(true);
      setError('');
      logIncomeFetch('request start', { month: selectedMonth });
      const results = await Promise.allSettled([fetchIncomeMonth(selectedMonth), fetchWallets()]);
      const [incomeResult, walletRows] = results;
      const failure = (result: PromiseSettledResult<unknown>) =>
        result.status === 'rejected'
          ? result.reason instanceof Error
            ? result.reason.message
            : 'Could not load this section.'
          : '';
      setSectionErrors({
        recorded: failure(incomeResult),
        summary: failure(incomeResult),
      });
      if (incomeResult.status === 'fulfilled') {
        logIncomeFetch('request success', {
          month: selectedMonth,
          items: incomeResult.value.items.length,
        });
        setRows(
          incomeResult.value.items.map((item) => ({
            id: item.kind === 'recurring' ? item.sourceId : (item.transactionId ?? item.sourceId),
            source: item.name,
            type: item.category,
            amount: item.amount,
            date: item.receivedDate ?? item.dueDate ?? selectedMonth,
            is_recurring: item.kind === 'recurring',
            is_posted: item.status === 'received',
            is_scheduled: item.status !== 'received',
            frequency: item.frequency,
            wallet_id: item.walletId,
            status: item.status,
            due_date: item.dueDate,
            received_at: item.receivedAt,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
            transaction_id: item.transactionId,
          })),
        );
        setSummary({
          this_month: incomeResult.value.overview.projectedAmount,
          projected_amount: incomeResult.value.overview.projectedAmount,
          upcoming_amount: incomeResult.value.overview.upcomingAmount,
          overdue_amount: incomeResult.value.overview.overdueAmount,
          monthly_sources: incomeResult.value.overview.recurringSourceCount,
          actual_transactions: incomeResult.value.overview.receivedCount,
          upcoming_transactions: incomeResult.value.overview.upcomingCount,
          overdue_transactions: incomeResult.value.overview.overdueCount,
        });
      } else {
        const message = failure(incomeResult) || 'Income could not load.';
        logIncomeFetch('request failure', { month: selectedMonth, message });
        // A failed Income request must not look like a successful empty month.
        setError(message);
      }
      if (walletRows.status === 'fulfilled') setWallets(walletRows.value as Wallet[]);
      setLoading(false);
    },
    [selectedMonth],
  );

  useEffect(
    () =>
      subscribeFinancialMutations(() => {
        void refresh('financial mutation');
      }),
    [refresh],
  );
  useFocusEffect(
    useCallback(() => {
      const createdId = workflow.takeCreatedWallet();
      if (createdId) {
        setWalletSelection({ id: createdId, version: Date.now() });
        setOpen(true);
      }
      // Expo Router retains tab screens. Focus is the reliable lifecycle for
      // both the initial request and returning to an already-mounted Income tab.
      void refresh('screen focus');
    }, [refresh, workflow]),
  );

  const supportingText =
    summary.actual_transactions ||
    summary.upcoming_transactions ||
    summary.overdue_transactions ||
    summary.monthly_sources
      ? `${summary.actual_transactions} received · ${summary.upcoming_transactions} upcoming · ${summary.monthly_sources} recurring source${summary.monthly_sources === 1 ? '' : 's'}`
      : 'No income recorded this month';
  const financialBreakdown =
    summary.actual_transactions || summary.upcoming_transactions || summary.overdue_transactions
      ? `₱${Math.round(summary.projected_amount - summary.upcoming_amount - summary.overdue_amount).toLocaleString('en-PH')} received · ₱${Math.round(summary.upcoming_amount).toLocaleString('en-PH')} upcoming${summary.overdue_amount ? ` · ₱${Math.round(summary.overdue_amount).toLocaleString('en-PH')} overdue` : ''}`
      : supportingText;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <FinancialScreenHeader
        title="Income"
        onBack={() => router.back()}
        rightAction={<NotificationHeaderButton />}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={formPalette.accent} />
          <Text style={styles.muted}>Loading income…</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Income unavailable</Text>
          <Text style={styles.muted}>Check your connection and try again.</Text>
          <Pressable onPress={() => void refresh()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void refresh('pull to refresh')}
            />
          }
        >
          <FinancialOverviewCard
            title="INCOME OVERVIEW"
            context={monthName(selectedMonth)}
            value={`₱${Math.round(Number(summary.this_month)).toLocaleString('en-PH')}`}
            supportingInfo={financialBreakdown}
            accessibilityLabel={`Income overview. Total income for ${monthName(selectedMonth)}: ₱${Math.round(Number(summary.this_month)).toLocaleString('en-PH')}. ${supportingText}.`}
          />
          <View style={styles.monthPicker}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show previous income month"
              onPress={() => setSelectedMonth((month) => moveMonth(month, -1))}
              style={styles.monthButton}
            >
              <Text style={styles.monthButtonText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{monthName(selectedMonth)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show next income month"
              disabled={selectedMonth >= currentMonthKey()}
              onPress={() => setSelectedMonth((month) => moveMonth(month, 1))}
              style={[
                styles.monthButton,
                selectedMonth >= currentMonthKey() && styles.monthButtonDisabled,
              ]}
            >
              <Text style={styles.monthButtonText}>›</Text>
            </Pressable>
          </View>
          {sectionErrors.summary ? <Text style={styles.muted}>{sectionErrors.summary}</Text> : null}
          <View style={styles.listSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Income</Text>
              <SectionAddButton label="Add income" onPress={() => setOpen(true)} />
            </View>
            {sectionErrors.recorded ? (
              <Text style={styles.muted}>{sectionErrors.recorded}</Text>
            ) : null}
            {rows.length ? (
              rows.map((row) => {
                const status = incomeCardStatus(row);
                const received = status === 'Received';
                const date = received ? (row.received_at ?? row.date) : (row.due_date ?? row.date);
                return (
                <Pressable
                  key={row.id}
                  style={styles.row}
                  onPress={() => setDetails(row)}
                  accessibilityRole="button"
                  accessibilityLabel={`View details for ${row.source}`}
                >
                  <View style={styles.icon}>
                    <ArrowUpRight size={18} color={colors.primary} />
                  </View>
                  <View style={styles.main}>
                    <Text style={styles.rowTitle}>{row.source}</Text>
                    <Text style={styles.amount}>₱{Math.round(Number(row.amount)).toLocaleString('en-PH')}</Text>
                    <Text style={styles.rowDate} numberOfLines={1}>{titleCase(row.type)} · {received ? 'Received' : 'Expected'} {shortIncomeDate(date, selectedMonth)}</Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {incomeWalletName(row, wallets)}
                    </Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {row.is_recurring ? titleCase(row.frequency ?? 'recurring') : 'One-time'}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`More options for ${row.source}`}
                      onPress={(event) => { event.stopPropagation(); setManaging(row); }}
                      style={styles.more}
                    >
                      <MoreHorizontal size={20} color={colors.textSecondary} />
                    </Pressable>
                    <StatusBadge status={status} variant="plain" />
                  </View>
                </Pressable>
                );
              })
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>No income yet</Text>
                <Text style={styles.muted}>Recorded income for this month will appear here.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
      {open && (
        <IncomeForm
          wallets={wallets}
          selectedWalletId={walletSelection?.id}
          onAddWallet={(draft) => {
            workflow.saveDraft(draft);
            setOpen(false);
            router.push({
              pathname: '/(tabs)/wallets',
              params: { openAddWallet: '1', returnTo: 'income' },
            });
          }}
          onClose={() => {
            workflow.clear();
            setOpen(false);
          }}
          onSaved={async () => {
            workflow.clear();
            setOpen(false);
            await refresh();
          }}
        />
      )}
      {editing && (
        <IncomeForm
          initial={editing}
          wallets={wallets}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
      {managing && (
        <RecordActionSheet
          visible
          title="Income options"
          recordName={managing.source}
          onClose={() => setManaging(null)}
          actions={[
            {
              label: 'Edit',
              onPress: () => {
                setManaging(null);
                setEditing(managing);
              },
            },
            {
              label: 'Delete',
              tone: 'destructive',
              confirm: {
                title: `Delete ${managing.source}?`,
                message: 'Future occurrences will be cancelled. Any received history is preserved.',
              },
              onPress: async () => {
                await authenticatedApiRequest(`/api/income/${managing.id}`, { method: 'DELETE' });
                notifyFinancialMutation();
                await refresh();
                toast.success('Income deleted; received history preserved.');
              },
            },
          ]}
        />
      )}
      {details && (
        <IncomeDetailsRedesigned
          income={details}
          wallets={wallets}
          onClose={() => setDetails(null)}
        />
      )}
    </SafeAreaView>
  );
}

function incomeDateTime(value: string | null | undefined) {
  if (!value) return 'Not received yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function IncomeDetails({
  income,
  wallets,
  onClose,
}: {
  income: Income;
  wallets: Wallet[];
  onClose: () => void;
}) {
  const walletName =
    wallets.find((wallet) => wallet.id === income.wallet_id)?.name ?? 'Unavailable wallet';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.detailsSheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.sectionTitle}>Income details</Text>
          <Text style={styles.detailsName}>{income.source}</Text>
          <Text style={styles.detailsAmount}>
            ₱{Math.round(Number(income.amount)).toLocaleString('en-PH')}
          </Text>
          <Detail label="Category" value={income.type} />
          <Detail
            label="Frequency"
            value={income.is_recurring ? (income.frequency ?? 'Recurring') : 'One-time'}
          />
          <Detail
            label="Status"
            value={
              income.status === 'received'
                ? 'Received'
                : income.status === 'overdue'
                  ? 'Overdue'
                  : 'Upcoming'
            }
          />
          <Detail label="Destination wallet" value={walletName} />
          <Detail
            label="Due on"
            value={
              income.due_date ?? (income.status === 'received' ? income.date : 'Not scheduled')
            }
          />
          <Detail label="Received on" value={incomeDateTime(income.received_at)} />
          <Detail
            label="Added on"
            value={income.created_at ? incomeDateTime(income.created_at) : 'Unknown'}
          />
          {income.transaction_id ? (
            <Detail label="Wallet transaction" value={income.transaction_id} />
          ) : null}
          <Pressable style={styles.retry} onPress={onClose}>
            <Text style={styles.retryText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function friendlyIncomeDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long' }).format(
    parsed,
  );
}

function friendlyFrequency(value: string | null | undefined) {
  return (
    (
      {
        monthly: 'Every month',
        weekly: 'Every week',
        biweekly: 'Every two weeks',
        yearly: 'Every year',
      } as Record<string, string>
    )[String(value ?? '').toLowerCase()] ?? 'One-time income'
  );
}

function titleCase(value: string | null | undefined) {
  return String(value ?? 'other')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function IncomeDetailsRedesigned({
  income,
  wallets,
  onClose,
}: {
  income: Income;
  wallets: Wallet[];
  onClose: () => void;
}) {
  const walletName = incomeWalletName(income, wallets);
  const received = income.status === 'received';
  const overdue = income.status === 'overdue';
  const expectedDate = income.due_date ?? (received ? income.date : null);
  const status = received ? 'Received' : overdue ? 'Overdue' : 'Upcoming';
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 8,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 70) onClose();
        },
      }),
    [onClose],
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          {...panResponder.panHandlers}
          style={styles.detailsSheet}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.detailsHandle} />
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle}>Income details</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close income details"
              onPress={onClose}
              style={styles.detailsClose}
            >
              <X size={20} color={formPalette.muted} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.detailsContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.detailsIdentity}>
              <View style={styles.detailsIcon}>
                <ArrowUpRight size={22} color={formPalette.accent} />
              </View>
              <View style={styles.detailsIdentityCopy}>
                <Text style={styles.detailsName}>{income.source}</Text>
                <Text style={styles.detailsAmount}>
                  ₱{Math.round(Number(income.amount)).toLocaleString('en-PH')}
                </Text>
              </View>
              <StatusBadge status={status} />
            </View>
            <View style={styles.detailsSummary}>
              <View style={styles.detailsSummaryRow}>
                <CalendarDays size={18} color={formPalette.accent} />
                <View>
                  <Text style={styles.detailsSummaryLabel}>
                    {received ? 'Received on' : overdue ? 'Was expected on' : 'Expected on'}
                  </Text>
                  <Text style={styles.detailsSummaryValue}>{friendlyIncomeDate(expectedDate)}</Text>
                </View>
              </View>
              <View style={styles.detailsSummaryRow}>
                <WalletCards size={18} color={formPalette.accent} />
                <View>
                  <Text style={styles.detailsSummaryLabel}>
                    {received ? 'Added to' : 'Will be added to'}
                  </Text>
                  <Text style={styles.detailsSummaryValue}>{walletName}</Text>
                </View>
              </View>
              {income.is_recurring ? (
                <View style={styles.detailsSummaryRow}>
                  <Repeat2 size={18} color={formPalette.accent} />
                  <View>
                    <Text style={styles.detailsSummaryLabel}>Repeats</Text>
                    <Text style={styles.detailsSummaryValue}>
                      {friendlyFrequency(income.frequency)}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
            {overdue ? (
              <Text style={styles.detailsNotice}>
                This income was expected on {friendlyIncomeDate(expectedDate)} but has not been
                marked as received.
              </Text>
            ) : null}
            <Text style={styles.detailsSectionLabel}>Additional details</Text>
            <Detail label="Category" value={titleCase(income.type)} />
            {income.created_at ? (
              <Detail label="Created" value={friendlyIncomeDate(income.created_at)} />
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function IncomeSection({
  title,
  error,
  empty,
  children,
}: {
  title: string;
  error: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.listSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {error ? (
        <View style={styles.card}>
          <Text style={styles.muted}>{error}</Text>
        </View>
      ) : (
        children || (
          <View style={styles.card}>
            <Text style={styles.muted}>{empty}</Text>
          </View>
        )
      )}
    </View>
  );
}

function IncomeRow({ row }: { row: Income }) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <ArrowUpRight size={18} color={formPalette.accent} />
      </View>
      <View style={styles.main}>
        <Text style={styles.rowTitle}>{row.source}</Text>
        <Text style={styles.muted}>
          {row.is_scheduled
            ? `Recurring Â· Upcoming Â· Due ${row.date}`
            : `${row.frequency ?? 'Monthly'} Â· Recurring`}
        </Text>
      </View>
      <Text style={styles.amount}>â‚±{Math.round(Number(row.amount)).toLocaleString('en-PH')}</Text>
    </View>
  );
}

function IncomeForm({
  wallets,
  onClose,
  onSaved,
  onAddWallet,
  selectedWalletId,
  initial,
}: {
  wallets: Wallet[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onAddWallet?: (draft: IncomeWorkflowDraft) => void;
  selectedWalletId?: string;
  initial?: Income;
}) {
  const toast = useToast();
  const workflow = useIncomeWorkflow();
  const preserved = initial ? null : workflow.draft;
  useEffect(() => {
    if (!initial && workflow.draft) workflow.takeDraft();
  }, [initial, workflow]);
  const [source, setSource] = useState(preserved?.source ?? initial?.source ?? '');
  const [amount, setAmount] = useState(
    preserved?.amount ?? (initial ? String(initial.amount) : ''),
  );
  const initialType =
    incomeTypes.find((option) => incomeTypeValues[option.label] === initial?.type)?.label ??
    (initial?.custom_type ? 'Other' : 'Salary');
  const [date, setDate] = useState(preserved?.date ?? initial?.date ?? dateKeyInManila());
  const [typeLabel, setTypeLabel] = useState(preserved?.typeLabel ?? initialType);
  const [customType, setCustomType] = useState(preserved?.customType ?? initial?.custom_type ?? '');
  const [frequency, setFrequency] = useState<IncomeFrequency>(preserved?.frequency ?? 'monthly');
  const [recurring, setRecurring] = useState(preserved?.recurring ?? initial?.is_recurring ?? true);
  const [walletId, setWalletId] = useState<string | null>(
    selectedWalletId ?? preserved?.walletId ?? initial?.wallet_id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (selectedWalletId) setWalletId(selectedWalletId);
  }, [selectedWalletId]);

  const save = async () => {
    const value = parseAmount(amount);
    if (!source.trim() || value === null || value <= 0 || !walletId) {
      setError(
        !walletId
          ? 'Choose where this income will be deposited.'
          : 'Enter a source and a valid amount.',
      );
      return;
    }
    if (typeLabel === 'Other' && !customType.trim()) {
      setError('Please specify an income type.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const path = initial ? `/api/income/${initial.id}` : '/api/income';
      const result = await authenticatedApiRequest<{ is_posted?: boolean }>(path, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: source.trim(),
          type: incomeTypeValues[typeLabel],
          custom_type: typeLabel === 'Other' ? customType.trim() : null,
          amount: value,
          date,
          is_recurring: recurring,
          frequency: recurring ? frequency : null,
          wallet_id: walletId,
        }),
      });
      notifyFinancialMutation();
      await onSaved();
      toast.success(
        initial
          ? 'Income updated successfully'
          : result.is_posted === false
            ? `Income scheduled for ${date}`
            : 'Income added successfully',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this income.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinanceFormSheet
      title={initial ? 'Edit income' : 'Add income'}
      eyebrow="MONEY IN"
      amount={amount}
      onAmountChange={setAmount}
      error={error}
      saving={saving}
      saveLabel={initial ? 'Save changes' : 'Save income'}
      onSave={() => void save()}
      onClose={onClose}
    >
      <FormTextInput
        label="Source"
        value={source}
        onChangeText={setSource}
        placeholder="e.g. Freelance client"
      />
      <CategoryChipRow
        label="Income type"
        value={typeLabel}
        onChange={setTypeLabel}
        options={incomeTypes}
      />
      {typeLabel === 'Other' && (
        <FormTextInput
          label="Specify income type *"
          value={customType}
          onChangeText={setCustomType}
          placeholder="e.g. Scholarship"
        />
      )}
      <WalletPicker
        wallets={wallets}
        value={walletId}
        onChange={setWalletId}
        required
        label="Deposit to"
        excludeCredit
        onAddWallet={() =>
          onAddWallet?.({
            source,
            amount,
            typeLabel,
            customType,
            date,
            frequency,
            recurring,
            walletId,
          })
        }
      />
      <DatePickerField label="Date" value={date} onChange={setDate} />
      <View style={styles.recurring}>
        <View style={styles.recurringCopy}>
          <Text style={styles.recurringTitle}>Recurring income</Text>
          <Text style={styles.muted}>
            {recurring ? 'Automatically grouped by frequency.' : 'Save this as a one-time entry.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Recurring income"
          value={recurring}
          onValueChange={setRecurring}
          trackColor={{ false: '#D7E1DC', true: formPalette.accent }}
          thumbColor="#FFFFFF"
        />
      </View>
      {recurring && <IncomeFrequencyChips value={frequency} onChange={setFrequency} />}
      {!initial && date > dateKeyInManila() && (
        <Text style={styles.muted}>Your wallet will be credited when this income becomes due.</Text>
      )}
    </FinanceFormSheet>
  );
}

function makeStyles(themePalette: typeof formPalette) {
  const formPalette = themePalette;
  return StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 11,
    },
    safeArea: { flex: 1, backgroundColor: formPalette.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      backgroundColor: formPalette.surface,
      borderBottomWidth: 1,
      borderBottomColor: formPalette.line,
    },
    back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
    titleWrap: { flex: 1, marginLeft: 8 },
    eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
    title: { marginTop: 3, color: formPalette.ink, fontSize: 24, fontWeight: '900' },
    content: { padding: 20, paddingTop: 28, paddingBottom: 40 },
    listSection: { marginTop: 24 },
    sectionTitle: { marginBottom: 11, color: formPalette.ink, fontSize: 16, fontWeight: '900' },
    monthPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginTop: 14,
    },
    monthButton: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
      backgroundColor: formPalette.accentPale,
    },
    monthButtonDisabled: { opacity: 0.42 },
    monthButtonText: { color: formPalette.accent, fontSize: 24, fontWeight: '700', lineHeight: 27 },
    monthLabel: {
      minWidth: 118,
      color: formPalette.ink,
      fontSize: 12,
      fontWeight: '900',
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 15,
      marginBottom: 12,
      borderRadius: 17,
      backgroundColor: formPalette.surface,
      borderWidth: 1,
      borderColor: formPalette.line,
    },
    icon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      backgroundColor: formPalette.accentPale,
    },
    main: { flex: 1, minWidth: 0, marginLeft: 11 },
    rowTitle: { color: formPalette.ink, fontWeight: '900', fontSize: 14 },
    rowDate: { marginTop: 4, color: formPalette.muted, fontSize: 11, lineHeight: 15 },
    rowRight: { width: 86, alignItems: 'flex-end', marginLeft: 8, gap: 3 },
    rowStatus: {
      marginTop: 3,
      color: formPalette.muted,
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'right',
    },
    statusReceived: { color: formPalette.accent },
    statusOverdue: { color: formPalette.danger },
    statusFailed: { color: formPalette.danger },
    amount: { marginTop: 3, color: formPalette.ink, fontSize: 14, fontWeight: '900' },
    more: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      backgroundColor: formPalette.background,
    },
    muted: { marginTop: 5, color: formPalette.muted, fontSize: 12, lineHeight: 18 },
    card: {
      marginTop: 0,
      padding: 18,
      borderRadius: 18,
      backgroundColor: formPalette.surface,
      borderWidth: 1,
      borderColor: formPalette.line,
    },
    cardTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' },
    retry: {
      alignSelf: 'flex-start',
      marginTop: 14,
      padding: 10,
      borderRadius: 15,
      backgroundColor: formPalette.accentPale,
    },
    retryText: { color: formPalette.accent, fontWeight: '900' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    recurring: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      padding: 15,
      borderRadius: 17,
      backgroundColor: formPalette.background,
    },
    recurringCopy: { flex: 1, paddingRight: 10 },
    recurringTitle: { color: formPalette.ink, fontSize: 14, fontWeight: '900' },
    pressed: { opacity: 0.72 },
    modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
    detailsSheet: {
      maxHeight: '82%',
      padding: 22,
      paddingBottom: 28,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: formPalette.surface,
    },
    detailsHandle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      marginBottom: 14,
      borderRadius: 3,
      backgroundColor: formPalette.line,
    },
    detailsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    detailsTitle: { color: formPalette.ink, fontSize: 18, fontWeight: '900' },
    detailsClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    detailsContent: { paddingBottom: 12 },
    detailsIdentity: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 11 },
    detailsIcon: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: formPalette.accentPale,
    },
    detailsIdentityCopy: { flex: 1, minWidth: 0 },
    detailsSummary: {
      marginTop: 18,
      padding: 14,
      borderRadius: 16,
      backgroundColor: formPalette.background,
      borderWidth: 1,
      borderColor: formPalette.line,
      gap: 14,
    },
    detailsSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    detailsSummaryLabel: { color: formPalette.muted, fontSize: 11, fontWeight: '700' },
    detailsSummaryValue: { marginTop: 2, color: formPalette.ink, fontSize: 14, fontWeight: '900' },
    detailsNotice: {
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      color: formPalette.danger,
      backgroundColor: '#FBE7DE',
      fontSize: 12,
      lineHeight: 18,
    },
    detailsSectionLabel: {
      marginTop: 20,
      marginBottom: 4,
      color: formPalette.muted,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    detailsName: { color: formPalette.ink, fontWeight: '900', fontSize: 20 },
    detailsAmount: {
      marginTop: 6,
      marginBottom: 14,
      color: formPalette.accent,
      fontWeight: '900',
      fontSize: 25,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: formPalette.line,
    },
    detailLabel: { flex: 1, color: formPalette.muted, fontSize: 12 },
    detailValue: {
      flex: 1.4,
      color: formPalette.ink,
      textAlign: 'right',
      fontSize: 12,
      fontWeight: '700',
    },
  });
}
let styles = makeStyles(formPalette);
styles = { ...styles, more: { ...styles.more, backgroundColor: 'transparent' } };
