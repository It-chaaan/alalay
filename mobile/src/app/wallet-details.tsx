import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowDownToLine,
  ArrowDownUp,
  ArrowUpRight,
  CreditCard,
  MoreHorizontal,
  WalletCards,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { BOTTOM_NAV_CLEARANCE } from '@/components/bottom-nav-clearance';
import { RecordActionSheet } from '@/components/record-action-sheet';
import { BrandLogo } from '@/components/brand-logo';
import { type Wallet } from '@/components/wallet-picker';
import { WalletPicker } from '@/components/wallet-picker';
import { DatePickerField, FinanceFormSheet, FormTextInput, parseAmount } from '@/components/finance-form';
import { fetchWallets, notifyFinancialMutation, repayCreditAccount } from '@/services/finance';
import { authenticatedApiRequest } from '@/services/api';
import { useAppTheme } from '@/theme/theme';
import { DepositForm, EditWalletSheet, TransferForm } from './(tabs)/wallets';

type WalletWithDates = Wallet & { created_at?: string | null; updated_at?: string | null };
type WalletTransaction = {
  id: string;
  kind: string;
  label: string;
  category?: string;
  date: string;
  amount: number;
};
type WalletDetail = {
  wallet: WalletWithDates;
  transactions?: WalletTransaction[];
  transactionError?: string;
  interestEstimate?: { enabled: boolean; annual_interest_rate?: number | string; estimated_daily_interest?: number | string; estimated_accrued_interest?: number | string };
};

const peso = (value: number | string) =>
  `₱${Math.round(Number(value) || 0).toLocaleString('en-PH')}`;
const typeLabel = (type: string) =>
  type === 'e_wallet'
    ? 'E-wallet'
    : type === 'digital_bank'
      ? 'Digital bank'
      : type === 'bank'
        ? 'Bank'
        : type === 'cash'
          ? 'Cash'
          : 'Other';
const dateLabel = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(
        new Date(value),
      )
    : null;
const interestLabel = (value?: number | string) => {
  const amount = Number(value ?? 0);
  return amount > 0 && amount < 0.01 ? 'Less than ₱0.01 accrued' : peso(amount);
};
const todayIso = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export default function WalletDetailsScreen() {
  const { colors } = useAppTheme();
  const { walletId } = useLocalSearchParams<{ walletId?: string }>();
  const [detail, setDetail] = useState<WalletDetail | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionOpen, setActionOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [payCardOpen, setPayCardOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!walletId) {
      setError('This wallet could not be identified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [nextDetail, nextWallets] = await Promise.all([
        authenticatedApiRequest<WalletDetail>(`/api/wallets/${walletId}`),
        fetchWallets(),
      ]);
      setDetail(nextDetail);
      setWallets(nextWallets as Wallet[]);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Wallet details could not load.',
      );
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  useEffect(() => {
    void load();
  }, [load]);

  const wallet = detail?.wallet;
  const interestEstimate = detail?.interestEstimate;
  const transactions = useMemo(
    () => (detail?.transactions ?? []).slice(0, 5),
    [detail?.transactions],
  );
  const finishMutation = async () => {
    notifyFinancialMutation();
    await load();
  };
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/wallets');
  };
  const removeWallet = async () => {
    if (!wallet) return;
    await authenticatedApiRequest(`/api/wallets/${wallet.id}`, { method: 'DELETE' });
    notifyFinancialMutation();
    goBack();
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <FinancialScreenHeader
        title="Wallet details"
        onBack={goBack}
        rightAction={<NotificationHeaderButton />}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            Loading wallet details…
          </Text>
        </View>
      ) : error || !wallet ? (
        <View style={styles.center}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Wallet details unavailable
          </Text>
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            {error || 'Wallet not found.'}
          </Text>
          <Pressable
            onPress={() => void load()}
            style={[styles.retry, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: colors.textOnPrimary, fontWeight: '800' }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: BOTTOM_NAV_CLEARANCE }]}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.balanceCard,
                { backgroundColor: wallet.color, borderColor: colors.border },
              ]}
            >
              <BrandLogo
                name={wallet.name}
                entity="wallet"
                institutionKey={wallet.institution_key}
                category={wallet.institution_type}
                size={48}
              />
              <WalletCards size={22} color="#FFFFFF" style={styles.cardIcon} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Wallet options"
                onPress={() => setActionOpen(true)}
                style={styles.options}
              >
                <MoreHorizontal size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.walletName}>{wallet.name}</Text>
              <Text style={styles.walletMeta}>
                {wallet.account_type === 'credit'
                  ? 'Credit'
                  : wallet.account_type === 'debit'
                    ? 'Debit'
                    : typeLabel(wallet.institution_type)}{' '}
                · PHP
              </Text>
              <View style={styles.cardDivider} />
              <Text style={styles.balanceLabel}>
                {wallet.account_type === 'credit' ? 'OUTSTANDING' : 'AVAILABLE TO SPEND'}
              </Text>
              <Text style={styles.balance}>{peso(wallet.account_type === 'credit' ? wallet.balance : (wallet.available_balance ?? wallet.balance))}</Text>
              {wallet.account_type !== 'credit' ? (
                <Text style={styles.balanceSubtext}>
                  Total {peso(wallet.total_balance ?? wallet.balance)}{Number(wallet.reserved_for_goals ?? 0) > 0 ? ` · Reserved ${peso(wallet.reserved_for_goals ?? 0)}` : ''}
                </Text>
              ) : null}
            </View>
            <View style={styles.actions}>
              {wallet.account_type === 'credit' ? (
                <>
                  <Pressable onPress={() => setPayCardOpen(true)} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
                    <ArrowDownToLine size={21} color={colors.textOnPrimary} />
                    <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>Pay card</Text>
                  </Pressable>
                  <Pressable onPress={() => setPurchaseOpen(true)} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
                    <CreditCard size={21} color={colors.textOnPrimary} />
                    <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>Record purchase</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={() => setDepositOpen(true)} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
                    <ArrowDownToLine size={21} color={colors.textOnPrimary} />
                    <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>Deposit</Text>
                  </Pressable>
                  <Pressable onPress={() => setTransferOpen(true)} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
                    <ArrowDownUp size={21} color={colors.textOnPrimary} />
                    <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>Transfer</Text>
                  </Pressable>
                </>
              )}
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              About this wallet
            </Text>
            <View
              style={[
                styles.infoCard,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <InfoRow
                label="Wallet type"
                value={typeLabel(wallet.institution_type)}
                colors={colors}
              />
              {wallet.account_type ? <InfoRow label="Account type" value={wallet.account_type === 'credit' ? 'Credit · Money you owe' : 'Debit · Money you own'} colors={colors} /> : null}
              {wallet.account_purpose ? <InfoRow label="Account purpose" value={wallet.account_purpose === 'savings' ? 'Savings' : 'Everyday'} colors={colors} /> : null}
              {wallet.earns_interest ? <InfoRow label="Interest" value={`${wallet.annual_interest_rate ?? 0}% yearly · ${wallet.interest_credit_frequency ?? 'Unspecified'}`} colors={colors} /> : null}
              <InfoRow label="Currency" value="PHP" colors={colors} />
              {interestEstimate?.enabled ? (
                <>
                  <InfoRow label="Interest tracking" value="Estimate only" colors={colors} />
                  <InfoRow label="Annual rate" value={`${interestEstimate.annual_interest_rate}%`} colors={colors} />
                  <InfoRow label="Estimated daily interest" value={interestLabel(interestEstimate.estimated_daily_interest)} colors={colors} />
                  <InfoRow label="Estimated accrued interest" value={interestLabel(interestEstimate.estimated_accrued_interest)} colors={colors} />
                  <Text style={[styles.reservationHint, { color: colors.textSecondary }]}>This estimate uses your confirmed physical Wallet balance. It does not change your balance until your bank credits interest and you record the actual amount.</Text>
                </>
              ) : null}
              {wallet.account_type !== 'credit' ? (
                <>
                  <InfoRow label="Total balance" value={peso(wallet.total_balance ?? wallet.balance)} colors={colors} />
                  <InfoRow label="Reserved for Goals" value={peso(wallet.reserved_for_goals ?? 0)} colors={colors} />
                  <InfoRow label="Available to spend" value={peso(wallet.available_balance ?? wallet.balance)} colors={colors} />
                  <Text style={[styles.reservationHint, { color: colors.textSecondary }]}>Reserved money stays in this Wallet, but is set aside for Savings Goals and cannot be spent normally.</Text>
                </>
              ) : null}
              {wallet.account_type === 'credit' ? (
                <>
                  <InfoRow label="Outstanding balance" value={peso(wallet.balance)} colors={colors} />
                  <InfoRow label="Credit limit" value={wallet.credit_limit == null ? 'Not configured' : peso(wallet.credit_limit)} colors={colors} />
                  <InfoRow label="Available credit" value={wallet.credit_limit == null ? 'Not configured' : peso(Math.max(0, Number(wallet.credit_limit) - Number(wallet.balance)))} colors={colors} />
                  <InfoRow label="Payment due date" value={dateLabel(wallet.payment_due_date) ?? 'Not configured'} colors={colors} />
                  <InfoRow label="Payment wallet" value={wallets.find((candidate) => candidate.id === wallet.payment_wallet_id)?.name ?? 'Not configured'} colors={colors} />
                  <InfoRow label="Payment rule" value={wallet.payment_rule === 'fixed_amount' ? `Fixed amount${wallet.fixed_payment_amount != null ? ` · ${peso(wallet.fixed_payment_amount)}` : ''}` : wallet.payment_rule === 'full_outstanding' ? 'Full outstanding balance' : wallet.payment_rule === 'minimum_due' ? 'Minimum amount due' : 'Not configured'} colors={colors} />
                  <InfoRow label="Auto-record payment" value={wallet.auto_record_payment ? 'Enabled' : 'Disabled'} colors={colors} />
                </>
              ) : null}
              {dateLabel(wallet.created_at) ? (
                <InfoRow label="Created on" value={dateLabel(wallet.created_at)!} colors={colors} />
              ) : null}
              {dateLabel(wallet.updated_at) ? (
                <InfoRow
                  label="Last updated"
                  value={dateLabel(wallet.updated_at)!}
                  colors={colors}
                />
              ) : null}
            </View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                Recent transactions
              </Text>
            </View>
            {detail.transactionError ? (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.muted, { color: colors.textSecondary }]}>
                  {detail.transactionError}
                </Text>
                <Pressable onPress={() => void load()}>
                  <Text style={[styles.retryLink, { color: colors.primary }]}>Retry</Text>
                </Pressable>
              </View>
            ) : transactions.length ? (
              transactions.map((transaction) => (
                <TransactionRow
                  key={`${transaction.kind}-${transaction.id}`}
                  transaction={transaction}
                  colors={colors}
                />
              ))
            ) : (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No transactions yet
                </Text>
                <Text style={[styles.muted, { color: colors.textSecondary }]}>
                  Activity linked to this wallet will appear here.
                </Text>
              </View>
            )}
          </ScrollView>
          <RecordActionSheet
            visible={actionOpen}
            title="Wallet options"
            recordName={wallet.name}
            onClose={() => setActionOpen(false)}
            actions={[
              {
                label: 'Edit',
                onPress: () => {
                  setActionOpen(false);
                  setEditing(true);
                },
              },
              ...(!wallet.is_default_cash
                ? [
                    {
                      label: 'Delete',
                      tone: 'destructive' as const,
                      confirm: {
                        title: `Delete ${wallet.name}?`,
                        message: 'Linked financial history will be preserved.',
                      },
                      onPress: removeWallet,
                    },
                  ]
                : []),
            ]}
          />
          {depositOpen ? (
            <DepositForm
              wallet={wallet}
              onClose={() => setDepositOpen(false)}
              onSaved={async () => {
                setDepositOpen(false);
                await finishMutation();
              }}
            />
          ) : null}
          {transferOpen ? (
            <TransferForm
              wallets={wallets}
              initialFrom={wallet.id}
              onClose={() => setTransferOpen(false)}
              onSaved={async () => {
                setTransferOpen(false);
                await finishMutation();
              }}
            />
          ) : null}
          {payCardOpen ? <CreditPaymentForm wallet={wallet} wallets={wallets} onClose={() => setPayCardOpen(false)} onSaved={async () => { setPayCardOpen(false); await finishMutation(); }} /> : null}
          {purchaseOpen ? <CreditPurchaseForm wallet={wallet} onClose={() => setPurchaseOpen(false)} onSaved={async () => { setPurchaseOpen(false); await finishMutation(); }} /> : null}
          {editing ? (
            <EditWalletSheet
              wallet={wallet}
              onClose={() => setEditing(false)}
              onSaved={async () => {
                setEditing(false);
                await finishMutation();
              }}
            />
          ) : null}
        </>
      )}
    </SafeAreaView>
  );
}

function CreditPaymentForm({
  wallet,
  wallets,
  onClose,
  onSaved,
}: {
  wallet: WalletWithDates;
  wallets: Wallet[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const eligibleWallets = wallets.filter((candidate) => candidate.account_type !== 'credit' && candidate.is_active !== false);
  const [amount, setAmount] = useState(String(Math.max(0, Number(wallet.balance))));
  const [paymentWalletId, setPaymentWalletId] = useState<string | null>(wallet.payment_wallet_id ?? eligibleWallets[0]?.id ?? null);
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const requestKey = useRef(`mobile-card-payment-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const paymentWallet = eligibleWallets.find((candidate) => candidate.id === paymentWalletId);
  const save = async () => {
    const value = parseAmount(amount);
    if (value === null || value <= 0) return setError('Enter a payment amount greater than zero.');
    if (!paymentWallet) return setError('Choose a payment wallet.');
    if (value > Number(wallet.balance)) return setError(`Payment cannot exceed the outstanding balance of ${peso(wallet.balance)}.`);
    if (value > Number(paymentWallet.available_balance ?? paymentWallet.balance)) return setError(`Insufficient available balance in ${paymentWallet.name} to pay ${peso(value)}.`);
    setSaving(true);
    setError('');
    try {
      await repayCreditAccount(wallet.id, {
        payment_wallet_id: paymentWallet.id,
        principal_amount: value,
        payment_date: date,
        idempotency_key: requestKey.current,
      });
      await onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not record the card payment.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <FinanceFormSheet title="Pay card" eyebrow={wallet.name.toUpperCase()} amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel="Record payment" onSave={() => void save()} onClose={onClose}>
      <WalletPicker wallets={eligibleWallets} value={paymentWalletId} onChange={setPaymentWalletId} required label="Payment wallet" excludeCredit activeOnly />
      {paymentWallet ? <Text style={styles.formHint}>{peso(paymentWallet.available_balance ?? paymentWallet.balance)} available to spend in {paymentWallet.name}</Text> : null}
      <Text style={styles.formHint}>This tracks a balance transfer in Alalay. It does not send a real payment to the bank and is not recorded as another expense.</Text>
      <DatePickerField label="Payment date" value={date} onChange={setDate} />
    </FinanceFormSheet>
  );
}

function CreditPurchaseForm({
  wallet,
  onClose,
  onSaved,
}: {
  wallet: WalletWithDates;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const value = parseAmount(amount);
    if (!merchant.trim() || value === null || value <= 0) return setError('Add a merchant and purchase amount.');
    setSaving(true);
    setError('');
    try {
      await authenticatedApiRequest('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: merchant.trim(), amount: value, category: 'Other', categories: ['Other'], custom_category: 'Credit card purchase', date, payment_method: 'card', wallet_id: wallet.id }),
      });
      notifyFinancialMutation();
      await onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not record the card purchase.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <FinanceFormSheet title="Record purchase" eyebrow={wallet.name.toUpperCase()} amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel="Record purchase" onSave={() => void save()} onClose={onClose}>
      <FormTextInput label="Merchant" value={merchant} onChangeText={setMerchant} placeholder="e.g. Grocery store" />
      <Text style={styles.formHint}>This records an expense and increases this card’s outstanding balance.</Text>
      <DatePickerField label="Purchase date" value={date} onChange={setDate} />
    </FinanceFormSheet>
  );
}

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
      <Text style={[styles.muted, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function TransactionRow({
  transaction,
  colors,
}: {
  transaction: WalletTransaction;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const incoming = transaction.amount >= 0;
  const isGoalReservation = transaction.kind === 'goal_allocation';
  return (
    <View
      style={[
        styles.transaction,
        { backgroundColor: colors.surfaceTransaction, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.transactionIcon,
          { backgroundColor: isGoalReservation || incoming ? colors.primarySoft : `${colors.danger}33` },
        ]}
      >
        {incoming || isGoalReservation ? (
          <ArrowDownToLine size={19} color={colors.primary} />
        ) : (
          <ArrowUpRight size={19} color={colors.danger} />
        )}
      </View>
      <View style={styles.transactionCopy}>
        <Text style={[styles.transactionName, { color: colors.textPrimary }]} numberOfLines={1}>
          {transaction.label}
        </Text>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>
          {transaction.category ?? transaction.kind.replace('_', ' ')} · {transaction.date}
        </Text>
      </View>
      <Text
        style={[styles.transactionAmount, { color: incoming || isGoalReservation ? colors.primary : colors.danger }]}
      >
        {incoming ? '+' : '−'}
        {peso(Math.abs(transaction.amount))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  title: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  muted: { fontSize: 12, lineHeight: 18 },
  retry: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 18 },
  balanceCard: { minHeight: 274, padding: 20, borderRadius: 24, borderWidth: 1 },
  cardIcon: { position: 'absolute', top: 22, right: 20 },
  options: {
    position: 'absolute',
    top: 14,
    right: 52,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  walletName: { marginTop: 18, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  walletMeta: { marginTop: 5, color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: '600' },
  cardDivider: { height: 1, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.24)' },
  balanceLabel: {
    marginTop: 20,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  balance: { marginTop: 6, color: '#FFFFFF', fontSize: 36, fontWeight: '900' },
  balanceSubtext: { marginTop: 5, color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '700' },
  reservationHint: { paddingTop: 12, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 12 },
  action: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 29,
  },
  actionText: { fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.74 },
  sectionTitle: { marginTop: 4, marginBottom: -6, fontSize: 18, fontWeight: '900' },
  infoCard: { paddingHorizontal: 16, borderRadius: 18, borderWidth: 1 },
  infoRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoValue: { fontSize: 14, fontWeight: '800' },
  sectionHeader: { marginTop: 2 },
  transaction: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  transactionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  transactionCopy: { flex: 1, minWidth: 0 },
  transactionName: { fontSize: 14, fontWeight: '900' },
  transactionAmount: { fontSize: 14, fontWeight: '900' },
  emptyCard: { padding: 18, borderRadius: 18, borderWidth: 1 },
  emptyTitle: { marginBottom: 3, fontSize: 14, fontWeight: '900' },
  formHint: { color: '#5D6C65', fontSize: 12, lineHeight: 18 },
  retryLink: { marginTop: 8, fontSize: 13, fontWeight: '900' },
});
