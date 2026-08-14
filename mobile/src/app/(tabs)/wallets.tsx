import { Children, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowDownToLine, ArrowDownUp, Eye, EyeOff, MoreHorizontal as MoreHorizontalIcon, X as CloseIcon } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView as NativeSafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';

import { DatePickerField, parseAmount, FinanceFormSheet, FormTextInput, formPalette } from '@/components/finance-form';
import { FinancialOverviewCard } from '@/components/financial-overview-card';
import { WalletPicker, WalletPickerModal, type Wallet } from '@/components/wallet-picker';
import { type WalletPreset } from '@/constants/wallets';
import { authenticatedApiRequest } from '@/services/api';
import { fetchWallets, notifyFinancialMutation, subscribeFinancialMutations, totalWalletBalance } from '@/services/finance';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { SectionAddButton } from '@/components/header-add-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { BOTTOM_NAV_CLEARANCE } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';
import { RecordActionSheet } from '@/components/record-action-sheet';
import { WalletCard } from '@/components/wallet-card';
import { BrandLogo } from '@/components/brand-logo';
import { useToast } from '@/components/toast-provider';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';

type WalletTransaction = { id: string; kind: 'income' | 'expense' | 'bill' | 'deposit' | 'opening_balance' | 'transfer_out' | 'transfer_in'; label: string; date: string; amount: number };
type WalletDetail = { wallet: Wallet; transactions?: WalletTransaction[]; transactionError?: string };
const X = CloseIcon;

function todayIso() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

function peso(value: number | string) { return `₱${Math.round(Number(value)).toLocaleString('en-PH')}`; }
function typeLabel(type: string) { return type === 'e_wallet' ? 'E-wallet' : type === 'digital_bank' ? 'Digital bank' : type === 'bank' ? 'Bank' : type === 'cash' ? 'Cash' : 'Other'; }

function SafeAreaView(props: SafeAreaViewProps) { const { colors } = useAppTheme(); const children = Children.toArray(props.children).filter((child) => typeof child !== 'string' && typeof child !== 'number'); return <NativeSafeAreaView {...props} style={[props.style, { backgroundColor: colors.background }]}>{children}</NativeSafeAreaView>; }

export default function WalletsScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  styles = makeStyles({ ...formPalette, background: colors.background, surface: colors.surfaceElevated, ink: colors.textPrimary, muted: colors.textSecondary, accent: colors.primary, accentDark: colors.primary, accentPale: colors.primarySoft, balance: colors.balance, line: colors.border });
  const { walletId } = useLocalSearchParams<{ walletId?: string }>();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selected, setSelected] = useState<WalletDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftPreset, setDraftPreset] = useState<WalletPreset | null>(null);
  const [managedWallet, setManagedWallet] = useState<Wallet | null>(null);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const { visible, toggle: toggleBalanceVisibility } = useBalanceVisibility();
  const amountsVisible = visible === true;
  const maskedBalance = '••••••';

  const refresh = useCallback(async () => { setLoading(true); setListError(''); try { setWallets((await fetchWallets()) as Wallet[]); } catch (e) { setListError(e instanceof Error ? e.message : 'Wallets could not load.'); } finally { setLoading(false); } }, []);
  const loadWalletDetail = useCallback(async (id: string) => { setDetailLoading(true); setDetailError(''); try { setSelected(await authenticatedApiRequest<WalletDetail>(`/api/wallets/${id}`)); } catch (e) { setDetailError(e instanceof Error ? e.message : 'Wallet details could not load.'); } finally { setDetailLoading(false); } }, []);
  useEffect(() => { void refresh(); return subscribeFinancialMutations(() => { void refresh(); if (selected) void loadWalletDetail(selected.wallet.id); }); }, [loadWalletDetail, refresh, selected]);

  const openWallet = (wallet: Wallet) => { router.push({ pathname: '/wallet-details', params: { walletId: wallet.id } }); };
  useEffect(() => {
    if (!walletId || loading) return;
    const wallet = wallets.find((row) => row.id === walletId);
    if (wallet) void loadWalletDetail(wallet.id);
    else setDetailError('This wallet could not be found.');
  }, [walletId, loading, wallets, loadWalletDetail]);
  const refreshWalletDetail = async (id: string) => { notifyFinancialMutation(); await refresh(); await loadWalletDetail(id); };
  const removeWallet = async (wallet: Wallet) => { try { await authenticatedApiRequest(`/api/wallets/${wallet.id}`, { method: 'DELETE' }); setSelected(null); await refresh(); toast.success('Wallet deleted successfully'); } catch { throw new Error("Couldn't delete wallet. Please try again."); } };
  const totalBalance = totalWalletBalance(wallets);

  return <SafeAreaView style={styles.safe}>  <FinancialScreenHeader title="Wallets" onBack={() => router.back()} rightAction={<NotificationHeaderButton />} />{loading ? <View style={styles.center}><ActivityIndicator color={formPalette.accent} /><Text style={styles.muted}>Loading wallets…</Text></View> : listError ? <View style={styles.card}><Text style={styles.cardTitle}>Wallets unavailable</Text><Text style={styles.muted}>{listError}</Text><Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content}><FinancialOverviewCard title="WALLET OVERVIEW" icon={<View style={styles.overviewActions}><Pressable accessibilityRole="button" accessibilityLabel={amountsVisible ? 'Hide balances' : 'Show balances'} accessibilityState={{ checked: amountsVisible }} hitSlop={8} onPress={toggleBalanceVisibility} style={styles.visibilityButton}>{amountsVisible ? <Eye size={21} color={colors.textOnPrimaryMuted} strokeWidth={1.9} /> : <EyeOff size={21} color={colors.textOnPrimaryMuted} strokeWidth={1.9} />}</Pressable></View>} value={amountsVisible ? peso(totalBalance) : maskedBalance} supportingInfo={`Across ${wallets.length} wallet${wallets.length === 1 ? '' : 's'}`} accessibilityLabel={`Wallet overview. Total wallet balance ${amountsVisible ? peso(totalBalance) : 'hidden'} across ${wallets.length} wallet${wallets.length === 1 ? '' : 's'}.`} /><Pressable accessibilityRole="button" accessibilityLabel="Open loans and debt" onPress={() => router.push('/loans')} style={styles.card}><Text style={styles.cardTitle}>Loans & debt</Text><Text style={styles.muted}>Track money owed to you and money you owe without treating principal as spending.</Text></Pressable><View style={styles.listSection}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}><Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Your wallets</Text><SectionAddButton label="Add wallet" onPress={() => setAdding(true)} /></View><View style={styles.grid}>{wallets.map((wallet) => <WalletCard key={wallet.id} wallet={wallet} formatBalance={peso} typeLabel={typeLabel} onPress={() => void openWallet(wallet)} onManage={() => setManagedWallet(wallet)} />)}</View></View><Text style={styles.helper}>Balances update automatically from income deposited and linked spending.</Text></ScrollView>}{detailLoading && !selected && <View style={styles.detailLoading}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading wallet details…</Text></View>}{detailError && !selected && <View style={styles.detailError}><Text style={styles.cardTitle}>Wallet details unavailable</Text><Text style={styles.muted}>{detailError}</Text><Pressable onPress={() => walletId ? void loadWalletDetail(walletId) : undefined} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>}{selected && <WalletDetailSheet detail={selected} wallets={wallets} onClose={() => setSelected(null)} onDelete={() => removeWallet(selected.wallet)} onEdit={() => { setSelected(null); setEditingWallet(selected.wallet); }} onRetry={() => void loadWalletDetail(selected.wallet.id)} onDeposited={() => refreshWalletDetail(selected.wallet.id)} />}{managedWallet && <RecordActionSheet visible title="Wallet options" recordName={managedWallet.name} onClose={() => setManagedWallet(null)} actions={[{ label: 'Edit', onPress: () => { setManagedWallet(null); setEditingWallet(managedWallet); } }, ...(!managedWallet.is_default_cash ? [{ label: 'Delete', tone: 'destructive' as const, confirm: { title: `Delete ${managedWallet.name}?`, message: `${managedWallet.name} will be removed. Linked financial history will be preserved.` }, onPress: async () => { await removeWallet(managedWallet); } }] : [])]} />}{adding && <WalletPickerModal visible wallets={wallets} showPresets allowUnset={false} onClose={() => setAdding(false)} onChange={(id) => { const wallet = wallets.find((row) => row.id === id); if (wallet) { setAdding(false); void openWallet(wallet); } }} onPreset={(preset) => { setAdding(false); setDraftPreset(preset); }} />}{editingWallet && <EditWalletSheet wallet={editingWallet} onClose={() => setEditingWallet(null)} onSaved={async () => { setEditingWallet(null); await refresh(); }} />}{draftPreset && <AddWalletSheet preset={draftPreset} onClose={() => setDraftPreset(null)} onSaved={async () => { setDraftPreset(null); await refresh(); }} />}</SafeAreaView>;
}

function WalletDetailSheet({ detail, wallets = [], onClose, onDelete, onEdit, onRetry, onDeposited }: { detail: WalletDetail; wallets?: Wallet[]; onClose: () => void; onDelete: () => Promise<void>; onEdit: () => void; onRetry: () => void; onDeposited: () => Promise<void> }) {
  const { colors } = useAppTheme();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [interestOpen, setInterestOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferWallets, setTransferWallets] = useState<Wallet[]>(wallets);
  const wallet = detail.wallet;
  const transactions = detail.transactions ?? [];
  useEffect(() => { if (wallets.length) setTransferWallets(wallets); }, [wallets]);
  useEffect(() => { if (transferOpen && !transferWallets.length) void fetchWallets().then((rows) => setTransferWallets(rows as Wallet[])); }, [transferOpen, transferWallets.length]);
  return <Modal visible animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.detailOverlay}><View style={styles.detailSheet}>
      <View style={styles.detailHeader}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><BrandLogo name={wallet.name} entity="wallet" institutionKey={wallet.institution_key} category={wallet.institution_type} size={42} /><View><Text style={styles.eyebrow}>WALLET DETAIL</Text><Text style={styles.detailTitle}>{wallet.name}</Text></View></View><View style={styles.detailActions}><Pressable accessibilityLabel={`More options for ${wallet.name}`} onPress={() => setOptionsOpen(true)} style={styles.close}><MoreHorizontalIcon size={20} color={colors.textPrimary} /></Pressable><Pressable accessibilityLabel="Close wallet details" onPress={onClose} style={styles.close}><CloseIcon size={20} color={colors.textPrimary} /></Pressable></View></View>
      <View style={[styles.detailBalance, { backgroundColor: wallet.color }]}><Text style={styles.detailLabel}>CURRENT BALANCE</Text><Text style={styles.detailAmount}>{peso(wallet.balance)}</Text></View>
      <View style={walletDetailStyles.actions}><Pressable accessibilityRole="button" accessibilityLabel={`Deposit to ${wallet.name}`} onPress={() => setDepositOpen(true)} style={({ pressed }) => [walletDetailStyles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}><ArrowDownToLine size={18} color={colors.textOnPrimary} /><Text style={[styles.depositText, { color: colors.textOnPrimary }]}>Deposit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Transfer funds from ${wallet.name}`} onPress={() => setTransferOpen(true)} style={({ pressed }) => [walletDetailStyles.action, walletDetailStyles.transfer, { borderColor: colors.primary, backgroundColor: colors.primarySoft }, pressed && styles.pressed]}><ArrowDownUp size={17} color={colors.primary} /><Text style={[styles.transferDetailText, { color: colors.primary }]}>Transfer</Text></Pressable></View>
      <Text style={styles.historyTitle}>Linked transactions</Text>
      {detail.transactionError ? <View><Text style={styles.muted}>{detail.transactionError}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View> : <ScrollView>{transactions.length ? transactions.map((transaction) => <View key={`${transaction.kind}-${transaction.id}`} style={styles.transaction}><View style={[styles.transactionIcon, { backgroundColor: transaction.amount >= 0 ? formPalette.accentPale : '#FCE8E6' }]}><Text style={{ color: transaction.amount >= 0 ? formPalette.accent : formPalette.danger }}>{transaction.amount >= 0 ? '+' : '−'}</Text></View><View style={styles.transactionCopy}><Text style={styles.transactionLabel}>{transaction.label}</Text><Text style={styles.muted}>{transaction.kind} · {transaction.date}</Text></View><Text style={[styles.transactionAmount, { color: transaction.amount >= 0 ? formPalette.accent : formPalette.ink }]}>{transaction.amount >= 0 ? '+' : '−'}{peso(Math.abs(transaction.amount))}</Text></View>) : <Text style={styles.muted}>No linked transactions yet.</Text>}</ScrollView>}
    </View>
      {optionsOpen && <RecordActionSheet visible title="Wallet options" recordName={wallet.name} onClose={() => setOptionsOpen(false)} actions={[{ label: 'Record interest', onPress: () => { setOptionsOpen(false); setInterestOpen(true); } }, { label: 'Edit', onPress: onEdit }, ...(!wallet.is_default_cash ? [{ label: 'Delete', tone: 'destructive' as const, confirm: { title: `Delete ${wallet.name}?`, message: `${wallet.name} will be removed. Income records linked to it will be moved to Cash. Other linked transactions will keep their financial history.` }, onPress: onDelete }] : [])]} />}
      {depositOpen && <DepositForm wallet={wallet} onClose={() => setDepositOpen(false)} onSaved={async () => { setDepositOpen(false); await onDeposited(); }} />}
      {interestOpen && <InterestForm wallet={wallet} onClose={() => setInterestOpen(false)} onSaved={async () => { setInterestOpen(false); await onDeposited(); }} />}
      {transferOpen && <TransferForm wallets={transferWallets} initialFrom={wallet.id} onClose={() => setTransferOpen(false)} onSaved={async () => { setTransferOpen(false); await onDeposited(); }} />}
    </View>
  </Modal>;
}

export function EditWalletSheet({ wallet, onClose, onSaved }: { wallet: Wallet; onClose: () => void; onSaved: () => Promise<void> }) {
  const { colors } = useAppTheme();
  const [name, setName] = useState(wallet.name);
  const [defaultFee, setDefaultFee] = useState(wallet.default_outgoing_transfer_fee == null ? '' : String(wallet.default_outgoing_transfer_fee));
  const [interestRate, setInterestRate] = useState(wallet.interest_rate == null ? '' : String(wallet.interest_rate));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const fee = defaultFee.trim() ? Number(defaultFee) : null;
    const rate = interestRate.trim() ? Number(interestRate) : null;
    if (!name.trim()) { setError('Enter a wallet name.'); return; }
    if ((fee !== null && (!Number.isFinite(fee) || fee < 0)) || (rate !== null && (!Number.isFinite(rate) || rate < 0))) { setError('Enter valid non-negative financial settings.'); return; }
    setSaving(true); setError('');
    try { await authenticatedApiRequest(`/api/wallets/${wallet.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), default_outgoing_transfer_fee: fee, interest_rate: rate }) }); notifyFinancialMutation(); await onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Wallet could not be updated.'); }
    finally { setSaving(false); }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={editStyles.overlay}><Pressable accessibilityLabel="Close edit wallet" onPress={onClose} style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay }]} /><View style={[editStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={editStyles.header}><View><Text style={[editStyles.eyebrow, { color: colors.primary }]}>WALLET</Text><Text style={[editStyles.title, { color: colors.textPrimary }]}>Edit wallet</Text></View><Pressable accessibilityRole="button" onPress={onClose} style={[editStyles.close, { backgroundColor: colors.surfaceSecondary }]}><Text style={[editStyles.closeText, { color: colors.textPrimary }]}>×</Text></Pressable></View><Text style={[editStyles.label, { color: colors.textSecondary }]}>Wallet name</Text><TextInput accessibilityLabel="Wallet name" value={name} onChangeText={setName} placeholder="e.g. Payroll account" placeholderTextColor={colors.textMuted} style={[editStyles.input, { backgroundColor: colors.surfaceInput, borderColor: colors.border, color: colors.textPrimary }]} /><Text style={[editStyles.label, { color: colors.textSecondary }]}>Suggested outgoing transfer fee (optional)</Text><TextInput accessibilityLabel="Suggested outgoing transfer fee" value={defaultFee} onChangeText={setDefaultFee} placeholder="0" keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} style={[editStyles.input, { backgroundColor: colors.surfaceInput, borderColor: colors.border, color: colors.textPrimary }]} /><Text style={[editStyles.label, { color: colors.textSecondary }]}>Annual interest rate % (optional)</Text><TextInput accessibilityLabel="Annual interest rate" value={interestRate} onChangeText={setInterestRate} placeholder="e.g. 3.5" keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} style={[editStyles.input, { backgroundColor: colors.surfaceInput, borderColor: colors.border, color: colors.textPrimary }]} />{error ? <Text style={[editStyles.error, { color: colors.danger }]}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={({ pressed }) => [editStyles.save, { backgroundColor: colors.primary }, pressed && editStyles.pressed, saving && editStyles.disabled]}><Text style={[editStyles.saveText, { color: colors.textOnPrimary }]}>{saving ? 'Saving…' : 'Save changes'}</Text></Pressable></View></View></Modal>;
}

export function TransferForm({ wallets, initialFrom, onClose, onSaved }: { wallets: Wallet[]; initialFrom?: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('0');
  const [fromId, setFromId] = useState<string | null>(initialFrom ?? wallets[0]?.id ?? null);
  const [toId, setToId] = useState<string | null>(wallets.find((wallet) => wallet.id !== (initialFrom ?? wallets[0]?.id))?.id ?? null);
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const requestKey = useRef(`mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const source = wallets.find((wallet) => wallet.id === fromId);
  const destination = wallets.find((wallet) => wallet.id === toId);
  const suggestedFee = source?.default_outgoing_transfer_fee;
  const transferAmount = parseAmount(amount) ?? 0;
  const transferFee = parseAmount(fee) ?? 0;
  useEffect(() => { setFee(suggestedFee == null ? '0' : String(suggestedFee)); }, [source?.id, suggestedFee]);
  const save = async () => {
    const value = parseAmount(amount);
    const feeValue = parseAmount(fee);
    if (value === null || value <= 0) { setError('Enter a transfer amount greater than zero.'); return; }
    if (feeValue === null || feeValue < 0) { setError('Enter a valid transfer fee.'); return; }
    if (!fromId) { setError('Choose a source wallet.'); return; }
    if (!toId) { setError('Choose a destination wallet.'); return; }
    if (fromId === toId) { setError('Choose a different destination wallet.'); return; }
    if (source && value + feeValue > Number(source.balance)) { setError(`${source.name} doesn't have enough available funds to cover the transfer and fee.`); return; }
    setSaving(true); setError('');
    try { await authenticatedApiRequest('/api/wallets/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from_wallet_id: fromId, to_wallet_id: toId, amount: value, fee: feeValue, date, note: note.trim() || null, idempotency_key: requestKey.current }) }); notifyFinancialMutation(); await onSaved(); toast.success('Transfer completed'); }
    catch { setError("Couldn't complete the transfer. Please try again."); }
    finally { setSaving(false); }
  };
  return <FinanceFormSheet title="Transfer funds" eyebrow="WALLET TRANSFER" amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel="Transfer funds" onSave={() => void save()} onClose={onClose}>
    <WalletPicker wallets={wallets} value={fromId} onChange={setFromId} required label="From wallet" />
    {source ? <Text style={styles.muted}>{peso(source.balance)} available</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Swap source and destination wallets" onPress={() => { const next = fromId; setFromId(toId); setToId(next); }} style={{ alignSelf: 'center', padding: 10 }}><ArrowDownUp size={20} color={formPalette.accent} /></Pressable>
    <WalletPicker wallets={wallets.filter((wallet) => wallet.id !== fromId)} value={toId} onChange={setToId} required label="To wallet" />
    {destination ? <Text style={styles.muted}>{peso(destination.balance)} available</Text> : null}
    <FormTextInput label="Transfer fee" value={fee} onChangeText={setFee} placeholder="0" />
    <View style={[styles.destination, { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }]}><View style={{ flex: 1 }}><Text style={styles.destinationLabel}>Total from {source?.name ?? 'source wallet'}</Text><Text style={styles.destinationValue}>{peso(transferAmount + transferFee)}</Text></View><View style={{ flex: 1 }}><Text style={styles.destinationLabel}>{destination?.name ?? 'Destination'} receives</Text><Text style={styles.destinationValue}>{peso(transferAmount)}</Text></View></View>
    <DatePickerField label="Transfer date" value={date} onChange={setDate} />
    <FormTextInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Move spending money" />
  </FinanceFormSheet>;
}

export function DepositForm({ wallet, onClose, onSaved }: { wallet: Wallet; onClose: () => void; onSaved: () => Promise<void> }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => { const value = parseAmount(amount); if (value === null || value <= 0) { setError('Enter a deposit amount greater than zero.'); return; } setSaving(true); setError(''); try { await authenticatedApiRequest(`/api/wallets/${wallet.id}/deposits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: value, date, note: note.trim() || null }) }); await onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this deposit.'); } finally { setSaving(false); } };
  return <FinanceFormSheet title="Deposit money" eyebrow={wallet.name.toUpperCase()} amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel="Deposit money" onSave={() => void save()} onClose={onClose}><View style={styles.destination}><Text style={styles.destinationLabel}>Deposit to</Text><Text style={styles.destinationValue}>{wallet.name}</Text></View><DatePickerField label="Date" value={date} onChange={setDate} /><FormTextInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Opening balance" /></FinanceFormSheet>;
}

function AddWalletSheet({ preset, onClose, onSaved }: { preset: WalletPreset; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(preset.key === 'custom' ? '' : preset.name);
  const [amount, setAmount] = useState('0');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const save = async () => {
    const openingBalance = parseAmount(amount);
    if (!name.trim()) { setError('Enter a wallet name.'); return; }
    if (openingBalance === null || openingBalance < 0) { setError('Enter a valid opening balance.'); return; }
    setError(''); setSubmitting(true);
    try {
      await authenticatedApiRequest('/api/wallets/with-opening-balance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), institution_type: preset.type, institution_key: preset.key, color: preset.color, opening_balance: openingBalance }) });
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create wallet. Please try again.'); } finally { setSubmitting(false); }
  };
  return <FinanceFormSheet title="Add wallet" eyebrow={preset.key === 'custom' ? 'CUSTOM WALLET' : preset.name.toUpperCase()} amount={amount} onAmountChange={setAmount} error={error} saving={submitting} saveLabel="Save wallet" onSave={() => void save()} onClose={onClose}><View style={styles.destination}><Text style={styles.destinationLabel}>Institution</Text><Text style={styles.destinationValue}>{preset.name}</Text><Text style={styles.muted}>{typeLabel(preset.type)} · PHP</Text></View><FormTextInput label="Wallet name" value={name} onChangeText={setName} placeholder="e.g. Payroll account" /><Text style={styles.destinationLabel}>Opening balance</Text><Text style={styles.muted}>Enter the amount currently held in this account. ₱0 is valid.</Text></FinanceFormSheet>;
}

function InterestForm({ wallet, onClose, onSaved }: { wallet: Wallet; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => { const value = parseAmount(amount); if (value === null || value <= 0) { setError('Enter an interest amount greater than zero.'); return; } setSaving(true); setError(''); try { await authenticatedApiRequest(`/api/wallets/${wallet.id}/interest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: value, date, note: note.trim() || null }) }); notifyFinancialMutation(); await onSaved(); toast.success('Interest recorded'); } catch { setError("Couldn't record interest. Please try again."); } finally { setSaving(false); } };
  return <FinanceFormSheet title="Record interest" eyebrow={wallet.name.toUpperCase()} amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel="Record interest" onSave={() => void save()} onClose={onClose}><Text style={styles.muted}>Record actual interest credited by your financial institution. The advertised rate never creates income automatically.</Text><DatePickerField label="Interest date" value={date} onChange={setDate} /><FormTextInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. August savings interest" /></FinanceFormSheet>;
}

function CustomWalletSheet({ name, saving, onChange, onClose, onSave }: { name: string; saving: boolean; onChange: (value: string) => void; onClose: () => void; onSave: () => void }) { const { colors } = useAppTheme(); return <Modal visible animationType="slide" transparent onRequestClose={onClose}><View style={styles.detailOverlay}><View style={styles.customSheet}><View style={styles.detailHeader}><View><Text style={styles.eyebrow}>CUSTOM WALLET</Text><Text style={styles.detailTitle}>Name your wallet</Text></View><Pressable onPress={onClose} style={styles.close}><X size={20} color={colors.textPrimary} /></Pressable></View><TextInput autoFocus value={name} onChangeText={onChange} placeholder="e.g. Payroll account" placeholderTextColor={formPalette.muted} style={styles.customInput} /><Pressable disabled={saving || !name.trim()} onPress={onSave} style={[styles.save, (!name.trim() || saving) && styles.disabled]}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Create wallet'}</Text></Pressable></View></View></Modal>; }

void CustomWalletSheet;

const editStyles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, padding: 20, borderRadius: 24, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 4, fontSize: 22, fontWeight: '900' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  closeText: { fontSize: 27, lineHeight: 29 },
  label: { marginTop: 24, marginBottom: 7, fontSize: 11, fontWeight: '900' },
  input: { minHeight: 54, paddingHorizontal: 15, borderRadius: 16, borderWidth: 1, fontSize: 15 },
  error: { marginTop: 10, fontSize: 12, fontWeight: '800' },
  save: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 18, borderRadius: 26 },
  saveText: { fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.74 },
  disabled: { opacity: 0.55 },
});

const walletDetailStyles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  action: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 28 },
  transfer: { borderWidth: 1 },
});

function makeStyles(themePalette: typeof formPalette) { const formPalette = themePalette; return StyleSheet.create({ detailLoading: { position: 'absolute', left: 20, right: 20, bottom: 30, alignItems: 'center', padding: 18, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, detailError: { position: 'absolute', left: 20, right: 20, bottom: 30, padding: 18, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line },
  overviewActions: { minWidth: 42, minHeight: 42, alignItems: 'flex-end', justifyContent: 'center' }, visibilityButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.10)' },
  safe: { flex: 1, backgroundColor: formPalette.background }, header: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line }, back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, titleWrap: { flex: 1, marginLeft: 8 }, eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { marginTop: 3, color: formPalette.ink, fontSize: 24, fontWeight: '900' }, content: { padding: 20, paddingBottom: BOTTOM_NAV_CLEARANCE }, listSection: { marginTop: 24 }, sectionTitle: { marginBottom: 12, color: formPalette.ink, fontSize: 16, fontWeight: '900' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, walletCard: { width: '47.8%', minHeight: 164, justifyContent: 'space-between', padding: 15, borderRadius: 20, shadowColor: '#063224', shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 }, cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, initialBox: { width: 38, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)' }, initialText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' }, walletName: { marginTop: 14, color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, walletMeta: { marginTop: 3, color: 'rgba(255,255,255,0.78)', fontSize: 10, fontWeight: '700' }, balance: { marginTop: 18, color: '#FFFFFF', fontSize: 19, fontWeight: '900' }, helper: { marginTop: 16, color: formPalette.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, muted: { marginTop: 4, color: formPalette.muted, fontSize: 12, lineHeight: 18 }, card: { marginTop: 0, padding: 18, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, cardTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' }, retry: { alignSelf: 'flex-start', marginTop: 14, padding: 10, borderRadius: 15, backgroundColor: formPalette.accentPale }, retryText: { color: formPalette.accent, fontWeight: '900' }, detailOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,35,28,0.28)' }, detailSheet: { maxHeight: '86%', padding: 20, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: formPalette.surface }, detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, detailActions: { flexDirection: 'row', gap: 8 }, detailTitle: { marginTop: 4, color: formPalette.ink, fontSize: 22, fontWeight: '900' }, close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: formPalette.background }, detailBalance: { marginTop: 18, padding: 18, borderRadius: 18 }, detailLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, detailAmount: { marginTop: 5, color: '#FFFFFF', fontSize: 28, fontWeight: '900' }, depositButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, borderRadius: 24, backgroundColor: formPalette.accent }, depositText: { color: '#FFFFFF', fontWeight: '900' }, historyTitle: { marginTop: 20, marginBottom: 8, color: formPalette.ink, fontSize: 15, fontWeight: '900' }, transaction: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: formPalette.line }, transactionIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, transactionCopy: { flex: 1, marginLeft: 10 }, transactionLabel: { color: formPalette.ink, fontSize: 13, fontWeight: '800' }, transactionAmount: { fontSize: 13, fontWeight: '900' }, destination: { marginTop: 15, padding: 15, borderRadius: 16, backgroundColor: formPalette.background }, destinationLabel: { color: formPalette.muted, fontSize: 11, fontWeight: '900' }, destinationValue: { marginTop: 5, color: formPalette.ink, fontSize: 15, fontWeight: '900' }, customSheet: { padding: 20, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: formPalette.surface }, customInput: { minHeight: 52, marginTop: 20, paddingHorizontal: 14, borderRadius: 14, backgroundColor: formPalette.background, borderWidth: 1, borderColor: formPalette.line, color: formPalette.ink, fontSize: 14 }, save: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderRadius: 26, backgroundColor: formPalette.accent }, saveText: { color: '#FFFFFF', fontWeight: '900' }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.78 },
}); }
let styles: any = makeStyles(formPalette);
