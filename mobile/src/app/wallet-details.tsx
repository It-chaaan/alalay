import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowDownToLine, ArrowDownUp, ArrowUpRight, MoreHorizontal, WalletCards } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { BOTTOM_NAV_CLEARANCE } from '@/components/bottom-nav-clearance';
import { RecordActionSheet } from '@/components/record-action-sheet';
import { BrandLogo } from '@/components/brand-logo';
import { type Wallet } from '@/components/wallet-picker';
import { fetchWallets, notifyFinancialMutation } from '@/services/finance';
import { authenticatedApiRequest } from '@/services/api';
import { useAppTheme } from '@/theme/theme';
import { DepositForm, EditWalletSheet, TransferForm } from './(tabs)/wallets';

type WalletWithDates = Wallet & { created_at?: string | null; updated_at?: string | null };
type WalletTransaction = { id: string; kind: string; label: string; category?: string; date: string; amount: number };
type WalletDetail = { wallet: WalletWithDates; transactions?: WalletTransaction[]; transactionError?: string };

const peso = (value: number | string) => `₱${Math.round(Number(value) || 0).toLocaleString('en-PH')}`;
const typeLabel = (type: string) => type === 'e_wallet' ? 'E-wallet' : type === 'digital_bank' ? 'Digital bank' : type === 'bank' ? 'Bank' : type === 'cash' ? 'Cash' : 'Other';
const dateLabel = (value?: string | null) => value ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : null;

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
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!walletId) { setError('This wallet could not be identified.'); setLoading(false); return; }
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
      setError(requestError instanceof Error ? requestError.message : 'Wallet details could not load.');
    } finally { setLoading(false); }
  }, [walletId]);

  useEffect(() => { void load(); }, [load]);

  const wallet = detail?.wallet;
  const transactions = useMemo(() => (detail?.transactions ?? []).slice(0, 5), [detail?.transactions]);
  const finishMutation = async () => { notifyFinancialMutation(); await load(); };
  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/wallets'); };
  const removeWallet = async () => {
    if (!wallet) return;
    await authenticatedApiRequest(`/api/wallets/${wallet.id}`, { method: 'DELETE' });
    notifyFinancialMutation();
    goBack();
  };

  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}> 
    <FinancialScreenHeader title="Wallet details" onBack={goBack} rightAction={<NotificationHeaderButton />} />
    {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={[styles.muted, { color: colors.textSecondary }]}>Loading wallet details…</Text></View> : error || !wallet ? <View style={styles.center}><Text style={[styles.title, { color: colors.textPrimary }]}>Wallet details unavailable</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>{error || 'Wallet not found.'}</Text><Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: colors.primary }]}><Text style={{ color: colors.textOnPrimary, fontWeight: '800' }}>Try again</Text></Pressable></View> : <>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: BOTTOM_NAV_CLEARANCE }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.balanceCard, { backgroundColor: wallet.color, borderColor: colors.border }]}>
          <BrandLogo name={wallet.name} entity="wallet" institutionKey={wallet.institution_key} category={wallet.institution_type} size={48} />
          <WalletCards size={22} color="#FFFFFF" style={styles.cardIcon} />
          <Pressable accessibilityRole="button" accessibilityLabel="Wallet options" onPress={() => setActionOpen(true)} style={styles.options}><MoreHorizontal size={22} color="#FFFFFF" /></Pressable>
          <Text style={styles.walletName}>{wallet.name}</Text>
          <Text style={styles.walletMeta}>{typeLabel(wallet.institution_type)} · PHP</Text>
          <View style={styles.cardDivider} />
          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          <Text style={styles.balance}>{peso(wallet.balance)}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => setDepositOpen(true)} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}><ArrowDownToLine size={21} color={colors.textOnPrimary} /><Text style={[styles.actionText, { color: colors.textOnPrimary }]}>Deposit</Text></Pressable>
          <Pressable onPress={() => setTransferOpen(true)} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}><ArrowDownUp size={21} color={colors.textOnPrimary} /><Text style={[styles.actionText, { color: colors.textOnPrimary }]}>Transfer</Text></Pressable>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About this wallet</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <InfoRow label="Wallet type" value={typeLabel(wallet.institution_type)} colors={colors} />
          <InfoRow label="Currency" value="PHP" colors={colors} />
          {dateLabel(wallet.created_at) ? <InfoRow label="Created on" value={dateLabel(wallet.created_at)!} colors={colors} /> : null}
          {dateLabel(wallet.updated_at) ? <InfoRow label="Last updated" value={dateLabel(wallet.updated_at)!} colors={colors} /> : null}
        </View>
        <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Recent transactions</Text></View>
        {detail.transactionError ? <View style={[styles.emptyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}><Text style={[styles.muted, { color: colors.textSecondary }]}>{detail.transactionError}</Text><Pressable onPress={() => void load()}><Text style={[styles.retryLink, { color: colors.primary }]}>Retry</Text></Pressable></View> : transactions.length ? transactions.map((transaction) => <TransactionRow key={`${transaction.kind}-${transaction.id}`} transaction={transaction} colors={colors} />) : <View style={[styles.emptyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}><Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No transactions yet</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>Activity linked to this wallet will appear here.</Text></View>}
      </ScrollView>
      <RecordActionSheet visible={actionOpen} title="Wallet options" recordName={wallet.name} onClose={() => setActionOpen(false)} actions={[{ label: 'Edit', onPress: () => { setActionOpen(false); setEditing(true); } }, ...(!wallet.is_default_cash ? [{ label: 'Delete', tone: 'destructive' as const, confirm: { title: `Delete ${wallet.name}?`, message: 'Linked financial history will be preserved.' }, onPress: removeWallet }] : [])]} />
      {depositOpen ? <DepositForm wallet={wallet} onClose={() => setDepositOpen(false)} onSaved={async () => { setDepositOpen(false); await finishMutation(); }} /> : null}
      {transferOpen ? <TransferForm wallets={wallets} initialFrom={wallet.id} onClose={() => setTransferOpen(false)} onSaved={async () => { setTransferOpen(false); await finishMutation(); }} /> : null}
      {editing ? <EditWalletSheet wallet={wallet} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await finishMutation(); }} /> : null}
    </>}
  </SafeAreaView>;
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  return <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}><Text style={[styles.muted, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text></View>;
}

function TransactionRow({ transaction, colors }: { transaction: WalletTransaction; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  const incoming = transaction.amount >= 0;
  return <View style={[styles.transaction, { backgroundColor: colors.surfaceTransaction, borderColor: colors.border }]}><View style={[styles.transactionIcon, { backgroundColor: incoming ? colors.primarySoft : `${colors.danger}33` }]}>{incoming ? <ArrowDownToLine size={19} color={colors.primary} /> : <ArrowUpRight size={19} color={colors.danger} />}</View><View style={styles.transactionCopy}><Text style={[styles.transactionName, { color: colors.textPrimary }]} numberOfLines={1}>{transaction.label}</Text><Text style={[styles.muted, { color: colors.textSecondary }]}>{transaction.category ?? transaction.kind.replace('_', ' ')} · {transaction.date}</Text></View><Text style={[styles.transactionAmount, { color: incoming ? colors.primary : colors.danger }]}>{incoming ? '+' : '−'}{peso(Math.abs(transaction.amount))}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 16, gap: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }, title: { fontSize: 20, fontWeight: '900', textAlign: 'center' }, muted: { fontSize: 12, lineHeight: 18 }, retry: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 18 }, balanceCard: { minHeight: 274, padding: 20, borderRadius: 24, borderWidth: 1 }, cardIcon: { position: 'absolute', top: 22, right: 20 }, options: { position: 'absolute', top: 14, right: 52, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 }, walletName: { marginTop: 18, color: '#FFFFFF', fontSize: 24, fontWeight: '900' }, walletMeta: { marginTop: 5, color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: '600' }, cardDivider: { height: 1, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.24)' }, balanceLabel: { marginTop: 20, color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, balance: { marginTop: 6, color: '#FFFFFF', fontSize: 36, fontWeight: '900' }, actions: { flexDirection: 'row', gap: 12 }, action: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 29 }, actionText: { fontSize: 15, fontWeight: '900' }, pressed: { opacity: 0.74 }, sectionTitle: { marginTop: 4, marginBottom: -6, fontSize: 18, fontWeight: '900' }, infoCard: { paddingHorizontal: 16, borderRadius: 18, borderWidth: 1 }, infoRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth }, infoValue: { fontSize: 14, fontWeight: '800' }, sectionHeader: { marginTop: 2 }, transaction: { minHeight: 82, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, gap: 12 }, transactionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, transactionCopy: { flex: 1, minWidth: 0 }, transactionName: { fontSize: 14, fontWeight: '900' }, transactionAmount: { fontSize: 14, fontWeight: '900' }, emptyCard: { padding: 18, borderRadius: 18, borderWidth: 1 }, emptyTitle: { marginBottom: 3, fontSize: 14, fontWeight: '900' }, retryLink: { marginTop: 8, fontSize: 13, fontWeight: '900' },
});
