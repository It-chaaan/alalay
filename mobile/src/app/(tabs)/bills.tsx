import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  MoreHorizontal,
  Search as SearchIcon,
  SlidersHorizontal as FilterIcon,
  X as CloseIcon,
} from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiRequestError, authenticatedApiRequest } from '@/services/api';
import {
  dateKeyInManila,
  fetchWallets,
  notifyFinancialMutation,
  subscribeFinancialMutations,
} from '@/services/finance';
import { WalletPicker, type Wallet } from '@/components/wallet-picker';
import { FinancialOverviewCard } from '@/components/financial-overview-card';
import { SectionAddButton } from '@/components/header-add-button';
import {
  deleteFinanceItem,
  derivedStatus,
  fetchFinanceItems,
  markFinanceItemPaid,
  type FinanceItem,
} from '@/services/finance';
import {
  CategoryChipRow,
  DatePickerField,
  parseAmount,
  FinanceFormSheet,
  FrequencyChips,
  billCategories,
  type Frequency,
  FormTextInput,
} from '@/components/finance-form';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';
import { RecordActionSheet } from '@/components/record-action-sheet';
import { StatusBadge } from '@/components/status-badge';
import { BrandLogo } from '@/components/brand-logo';
import { useToast } from '@/components/toast-provider';
import { reconcileFinancialReminders } from '@/services/financial-reminders';

const palette = {
  background: '#F4F7F1',
  surface: '#FFFFFF',
  ink: '#11231C',
  muted: '#5D6C65',
  accent: '#0F8A6B',
  accentPale: '#D8EFE2',
  line: '#DCE8E0',
  danger: '#B42318',
};
type BillIconProps = { size?: number; color?: string; strokeWidth?: number };
function Search({ size, strokeWidth }: BillIconProps) {
  const { colors } = useAppTheme();
  return <SearchIcon size={size} strokeWidth={strokeWidth} color={colors.textSecondary} />;
}
function Filter({ size, color, strokeWidth }: BillIconProps) {
  const { colors } = useAppTheme();
  return (
    <FilterIcon
      size={size}
      strokeWidth={strokeWidth}
      color={color === palette.accent ? colors.primary : colors.textSecondary}
    />
  );
}
function X({ size, strokeWidth }: BillIconProps) {
  const { colors } = useAppTheme();
  return <CloseIcon size={size} strokeWidth={strokeWidth} color={colors.textPrimary} />;
}
function TextInput(props: TextInputProps) {
  const { colors, resolvedTheme } = useAppTheme();
  return (
    <NativeTextInput
      {...props}
      placeholderTextColor={colors.textSecondary}
      selectionColor={colors.primary}
      keyboardAppearance={resolvedTheme}
    />
  );
}

type EditorProps = { item: FinanceItem; onClose: () => void; onSaved: () => Promise<void> };
type BillFilter = 'All' | 'Upcoming' | 'Overdue' | 'Paid';

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

function formatBillDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const currentYear = Number(dateKeyInManila().slice(0, 4));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(year === currentYear ? {} : { year: 'numeric' }),
  }).format(date);
}

function isUpcomingStatus(status: ReturnType<typeof derivedStatus>) {
  return status === 'Upcoming' || status === 'Due soon' || status === 'Due today';
}

export default function BillsScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const themePalette = {
    ...palette,
    background: colors.background,
    surface: colors.surfaceElevated,
    ink: colors.textPrimary,
    muted: colors.textSecondary,
    accent: colors.primary,
    accentPale: colors.primarySoft,
    line: colors.border,
    danger: colors.danger,
  };
  styles = Object.assign(makeStyles(themePalette), makeFilterStyles(themePalette));
  const bottomNavClearance = useBottomNavClearance();
  const [items, setItems] = useState<FinanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FinanceItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<BillFilter>('All');
  const [query, setQuery] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [paymentBill, setPaymentBill] = useState<FinanceItem | null>(null);
  const [managing, setManaging] = useState<FinanceItem | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [financeItems, walletRows] = await Promise.all([fetchFinanceItems(), fetchWallets()]);
      setItems(financeItems);
      setWallets(walletRows as Wallet[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Bills could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeFinancialMutations(() => {
      void refresh();
    });
  }, [refresh]);

  const bills = items.filter((item) => item.source === 'bill');
  const statuses = bills.map((item) => derivedStatus(item));
  const filteredBills = bills.filter((item) => {
    const status = derivedStatus(item);
    const matchesFilter =
      filter === 'All' || (filter === 'Upcoming' ? isUpcomingStatus(status) : status === filter);
    return matchesFilter && item.name.toLowerCase().includes(query.toLowerCase());
  });
  const month = currentMonthKey();
  const monthlyBills = bills.filter((item) => item.dueDate.slice(0, 7) === month);
  const totalBillsThisMonth = monthlyBills.reduce((sum, item) => sum + item.amount, 0);
  const monthlyStatuses = monthlyBills.map((item) => derivedStatus(item));
  const dueThisWeek = monthlyBills.filter((item) => {
    const days = Math.round(
      (new Date(`${item.dueDate}T12:00:00`).getTime() - Date.now()) / 86400000,
    );
    return days >= 0 && days <= 7 && derivedStatus(item) !== 'Paid';
  }).length;
  const overdue = monthlyStatuses.filter((status) => status === 'Overdue').length;
  const unpaid = monthlyBills
    .filter((item) => derivedStatus(item) !== 'Paid')
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <FinancialScreenHeader
        title="Bills"
        onBack={() => router.back()}
        rightAction={<NotificationHeaderButton />}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
          <Text style={styles.centerCopy}>Loading bills and subscriptions…</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Could not load bills</Text>
          <Text style={styles.cardCopy}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]}
          showsVerticalScrollIndicator={false}
        >
          <FinancialOverviewCard
            title="BILLS OVERVIEW"
            context={monthName(month)}
            value={`₱${Math.round(totalBillsThisMonth).toLocaleString('en-PH')}`}
            supportingInfo={`₱${Math.round(unpaid).toLocaleString('en-PH')} unpaid · ${dueThisWeek} due this week · ${overdue} overdue`}
            supportingTone={overdue > 0 ? 'warning' : 'normal'}
            accessibilityLabel={`Bills overview. Total bills this month: ₱${Math.round(totalBillsThisMonth).toLocaleString('en-PH')}.`}
          />
          <View style={styles.listSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bills</Text>
              <SectionAddButton label="Add bill" onPress={() => setCreating(true)} />
            </View>
            <View style={styles.controls}>
              <View style={styles.search}>
                <Search size={17} color={palette.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search bills"
                  placeholderTextColor={palette.muted}
                  style={styles.searchInput}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  filter === 'All' ? 'Filter bills' : `Filter bills, ${filter} selected`
                }
                accessibilityState={{ expanded: filterSheetOpen, selected: filter !== 'All' }}
                onPress={() => setFilterSheetOpen(true)}
                style={({ pressed }) => [
                  styles.filterButton,
                  filter !== 'All' && styles.filterButtonActive,
                  pressed && styles.filterPressed,
                ]}
              >
                <Filter size={18} color={filter === 'All' ? palette.muted : palette.accent} />
                <View style={[styles.filterDot, filter === 'All' && styles.filterDotHidden]} />
              </Pressable>
            </View>
            {filteredBills.length ? (
              filteredBills.map((item) => (
                <BillCard
                  key={`${item.source}-${item.id}`}
                  item={item}
                  onManage={() => setManaging(item)}
                />
              ))
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {bills.length ? 'No matching bills' : 'No bills yet'}
                </Text>
                <Text style={styles.cardCopy}>
                  {bills.length
                    ? filter === 'All'
                      ? 'Try a different search.'
                      : `No ${filter.toLowerCase()} bills match your search.`
                    : 'Add a bill to start tracking due dates and payment status.'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
      {editing && (
        <BillEditor
          wallets={wallets}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
            await reconcileFinancialReminders();
          }}
        />
      )}
      {creating && (
        <NewBillForm
          wallets={wallets}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refresh();
            await reconcileFinancialReminders();
          }}
        />
      )}
      {paymentBill && (
        <BillPaymentSheet
          item={paymentBill}
          wallets={wallets}
          onClose={() => setPaymentBill(null)}
          onSaved={async () => {
            setPaymentBill(null);
            await refresh();
            await reconcileFinancialReminders();
          }}
        />
      )}
      <BillFilterSheet
        visible={filterSheetOpen}
        selected={filter}
        counts={{
          All: bills.length,
          Upcoming: statuses.filter(isUpcomingStatus).length,
          Overdue: statuses.filter((status) => status === 'Overdue').length,
          Paid: statuses.filter((status) => status === 'Paid').length,
        }}
        onSelect={(value) => {
          setFilter(value);
          setFilterSheetOpen(false);
        }}
        onClose={() => setFilterSheetOpen(false)}
      />
      {managing && (
        <RecordActionSheet
          visible
          title="Bill options"
          recordName={managing.name}
          onClose={() => setManaging(null)}
          actions={[
            {
              label: 'Edit',
              onPress: () => {
                setManaging(null);
                setEditing(managing);
              },
            },
            ...(derivedStatus(managing) !== 'Paid'
              ? [
                  {
                    label: 'Mark as paid',
                    tone: 'primary' as const,
                    onPress: () => {
                      setManaging(null);
                      setPaymentBill(managing);
                    },
                  },
                ]
              : []),
            {
              label: 'Delete',
              tone: 'destructive' as const,
              confirm: {
                title: `Delete ${managing.name}?`,
                message:
                  'This bill will be removed. Existing financial history will follow the established bill rules.',
              },
              onPress: async () => {
                try {
                  await deleteFinanceItem(managing);
                  notifyFinancialMutation();
                  toast.success('Bill deleted successfully');
                } catch (requestError) {
                  if (requestError instanceof ApiRequestError && requestError.status === 404) {
                    await refresh();
                    throw new Error('This bill no longer exists. The list has been refreshed.');
                  }
                  throw new Error("We couldn't delete this bill right now. Please try again.");
                }
              },
            },
          ]}
        />
      )}
    </SafeAreaView>
  );
}

function BillFilterSheet({
  visible,
  selected,
  counts,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: BillFilter;
  counts: Record<BillFilter, number>;
  onSelect: (value: BillFilter) => void;
  onClose: () => void;
}) {
  const options: BillFilter[] = ['All', 'Upcoming', 'Overdue', 'Paid'];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close bill filters"
          onPress={onClose}
          style={styles.dismiss}
        />
        <View style={styles.filterSheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetEyebrow}>STATUS</Text>
              <Text style={styles.sheetTitle}>Filter bills</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close bill filters"
              onPress={onClose}
              style={styles.sheetClose}
            >
              <X size={22} color={palette.ink} />
            </Pressable>
          </View>
          {options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: selected === option }}
              accessibilityLabel={`${option}, ${counts[option]} bills${selected === option ? ', selected' : ''}`}
              onPress={() => onSelect(option)}
              style={({ pressed }) => [styles.filterOption, pressed && styles.filterPressed]}
            >
              <View style={[styles.checkCircle, selected !== option && styles.checkCircleEmpty]}>
                {selected === option ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text
                style={[
                  styles.filterOptionLabel,
                  selected === option && styles.filterOptionLabelActive,
                ]}
              >
                {option}
              </Text>
              <Text style={styles.filterOptionCount}>{counts[option]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function BillCard({ item, onManage }: { item: FinanceItem; onManage: () => void }) {
  const { colors } = useAppTheme();
  const status = derivedStatus(item);
  const metadata = `${item.source === 'subscription' ? 'Subscription' : item.custom_category || item.category} · Due ${formatBillDate(item.dueDate)}`;
  return (
    <View
      accessibilityLabel={`${item.name}, ₱${Math.round(item.amount).toLocaleString('en-PH')}, ${metadata}, ${status}.`}
      style={styles.billCard}
    >
      <View style={styles.billTop}>
        <BrandLogo name={item.name} entity="bill" category={item.category} size={40} />
        <View style={styles.billMain}>
          <Text numberOfLines={1} style={styles.billName}>
            {item.name}
          </Text>
          <Text numberOfLines={1} style={styles.billMeta}>
            {metadata}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={styles.billAmount}
        >
          ₱{Math.round(item.amount).toLocaleString('en-PH')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${item.name}`}
          onPress={onManage}
          style={styles.more}
        >
          <MoreHorizontal size={21} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.billBottom}>
        <StatusBadge status={status} variant="compact" />
      </View>
    </View>
  );
}

function BillPaymentSheet({
  item,
  wallets,
  onClose,
  onSaved,
}: {
  item: FinanceItem;
  wallets: Wallet[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [walletId, setWalletId] = useState<string | null>(item.wallet_id ?? null);
  const [paymentDate, setPaymentDate] = useState(dateKeyInManila());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    if (!walletId) {
      setError('Select the wallet used to pay this bill.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await markFinanceItemPaid(item, { wallet_id: walletId, payment_date: paymentDate });
      await onSaved();
      toast.success('Payment recorded successfully');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to mark this bill as paid. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.paymentOverlay}>
        <Pressable
          accessibilityLabel="Close payment sheet"
          onPress={onClose}
          style={styles.dismiss}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.paymentKeyboard}
        >
          <ScrollView
            contentContainerStyle={[
              styles.paymentSheet,
              { paddingBottom: Math.max(24, insets.bottom + 16) },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.editorHeader}>
              <View>
                <Text style={styles.eyebrow}>BILL PAYMENT</Text>
                <Text style={styles.editorTitle}>Mark as paid</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={styles.paymentClose}
              >
                <X size={20} color={palette.ink} />
              </Pressable>
            </View>
            <View style={styles.paymentSummary}>
              <Text style={styles.paymentName}>{item.name}</Text>
              <Text style={styles.paymentAmount}>
                ₱{Math.round(item.amount).toLocaleString('en-PH')}
              </Text>
              <Text style={styles.paymentMeta}>
                {item.custom_category || item.category} · Due {item.dueDate}
              </Text>
            </View>
            <WalletPicker
              wallets={wallets}
              value={walletId}
              onChange={setWalletId}
              required
              label="Payment method"
            />
            <DatePickerField label="Payment date" value={paymentDate} onChange={setPaymentDate} />
            {error ? <Text style={styles.paymentError}>{error}</Text> : null}
            <View style={styles.paymentActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Confirm payment for ${item.name}`}
                disabled={saving || !walletId}
                onPress={() => void confirm()}
                style={({ pressed }) => [
                  styles.saveButton,
                  (!walletId || saving) && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Confirm payment</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={onClose}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function BillEditor({ wallets, item, onClose, onSaved }: EditorProps & { wallets: Wallet[] }) {
  const toast = useToast();
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const canonicalCategories = billCategories.map((option) => option.label);
  const initialCategory =
    item.category === 'Subscriptions'
      ? 'Other'
      : canonicalCategories.includes(item.category)
        ? item.category
        : 'Other';
  const [category, setCategory] = useState(initialCategory);
  const [customCategory, setCustomCategory] = useState(
    initialCategory === 'Other'
      ? (item.custom_category ?? (item.category === 'Other' ? '' : item.category))
      : '',
  );
  const [date, setDate] = useState(item.dueDate);
  const [frequency, setFrequency] = useState<Frequency | 'one-time'>(
    item.recurring ? (item.frequency ?? 'monthly') : 'one-time',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [walletId, setWalletId] = useState<string | null>(item.wallet_id ?? null);

  const save = async () => {
    const parsedAmount = Number(amount);
    if (!name.trim()) {
      setError('Enter a biller name.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Choose a valid due date.');
      return;
    }
    if (item.source === 'bill' && !category.trim()) {
      setError('Choose a category.');
      return;
    }
    if (item.source === 'bill' && category === 'Other' && !customCategory.trim()) {
      setError('Please specify a category.');
      return;
    }
    if (item.source === 'bill' && !walletId) {
      setError('Choose a payment method.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (item.source === 'bill')
        await authenticatedApiRequest(`/api/bills/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: name.trim(),
            amount: parsedAmount,
            category: category === 'Other' ? customCategory.trim() : category.trim(),
            due_date: date,
            recurring: frequency !== 'one-time',
            frequency: frequency === 'one-time' ? null : frequency,
            wallet_id: walletId,
          }),
        });
      else
        await authenticatedApiRequest(`/api/subscriptions/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            amount: parsedAmount,
            category: category.trim(),
            custom_category: category === 'Other' ? customCategory.trim() : null,
            renewal_date: date,
            billing_cycle: frequency === 'one-time' ? 'monthly' : frequency,
            wallet_id: walletId,
          }),
        });
      await onSaved();
      toast.success(
        item.source === 'bill' ? 'Bill updated successfully' : 'Subscription updated successfully',
      );
    } catch (saveError) {
      if (saveError instanceof ApiRequestError && saveError.status === 404)
        setError('This bill no longer exists. Refresh the Bills list and try again.');
      else setError("We couldn't update this bill right now. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinanceFormSheet
      title={item.source === 'bill' ? item.name : item.name}
      eyebrow={item.source === 'bill' ? 'EDIT BILL' : 'EDIT SUBSCRIPTION'}
      amount={amount}
      onAmountChange={setAmount}
      error={error}
      saving={saving}
      saveLabel="Save changes"
      onSave={() => void save()}
      onClose={onClose}
    >
      <FormTextInput
        label="Biller name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Maynilad"
      />
      {item.source === 'bill' ? (
        <CategoryChipRow
          label="Category *"
          value={category}
          onChange={setCategory}
          options={billCategories}
          customValue={customCategory}
          onCustomValueChange={setCustomCategory}
          customLabel="Specify category *"
        />
      ) : null}
      <FrequencyChips
        value={frequency}
        onChange={setFrequency}
        includeOneTime={item.source === 'bill'}
      />
      <DatePickerField label="Due date" value={date} onChange={setDate} />
      {item.source === 'bill' ? (
        <WalletPicker
          wallets={wallets}
          value={walletId}
          onChange={setWalletId}
          required
          label="Payment method"
        />
      ) : null}
    </FinanceFormSheet>
  );
}

function NewBillForm({
  wallets,
  onClose,
  onSaved,
}: {
  wallets: Wallet[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('Electricity');
  const [customCategory, setCustomCategory] = useState('');
  const [frequency, setFrequency] = useState<Frequency | 'one-time'>('one-time');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);

  const save = async () => {
    const value = parseAmount(amount);
    if (!name.trim() || value === null || value <= 0 || !category || !walletId) {
      setError('Enter a biller name and a valid amount.');
      return;
    }
    if (category === 'Other' && !customCategory.trim()) {
      setError('Please specify a category.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await authenticatedApiRequest('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: name.trim(),
          amount: value,
          category: category === 'Other' ? customCategory.trim() : category.trim(),
          due_date: date,
          recurring: frequency !== 'one-time',
          frequency: frequency === 'one-time' ? null : frequency,
          status: 'unpaid',
          wallet_id: walletId,
        }),
      });
      await onSaved();
      toast.success('Bill added successfully');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this bill.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinanceFormSheet
      title="Add bill"
      eyebrow="BILLS"
      amount={amount}
      onAmountChange={setAmount}
      error={error}
      saving={saving}
      saveLabel="Save bill"
      onSave={() => void save()}
      onClose={onClose}
    >
      <FormTextInput
        label="Biller name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Meralco"
      />
      <CategoryChipRow
        value={category}
        onChange={setCategory}
        options={billCategories}
        label="Category *"
        customValue={customCategory}
        onCustomValueChange={setCustomCategory}
        customLabel="Specify category *"
      />
      <WalletPicker
        wallets={wallets}
        value={walletId}
        onChange={setWalletId}
        required
        label="Payment method"
      />
      <DatePickerField label="Due date" value={date} onChange={setDate} />
      <FrequencyChips value={frequency} onChange={setFrequency} includeOneTime />
    </FinanceFormSheet>
  );
}

function makeStyles(themePalette: typeof palette) {
  const palette = themePalette;
  return StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 11,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: 10,
      borderRadius: 18,
      backgroundColor: palette.accent,
    },
    addText: { color: '#fff', fontWeight: '900' },
    stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    stat: {
      flex: 1,
      padding: 12,
      borderRadius: 15,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    statLabel: { color: palette.muted, fontSize: 10, fontWeight: '700' },
    statValue: { marginTop: 6, color: palette.ink, fontSize: 15, fontWeight: '900' },
    controls: { marginTop: 22 },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      minHeight: 46,
      marginBottom: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    searchInput: { flex: 1, color: palette.ink, fontSize: 13 },
    filters: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 3,
      borderRadius: 21,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
      overflow: 'hidden',
    },
    filter: {
      flex: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      borderRadius: 18,
    },
    filterActive: { backgroundColor: palette.accentPale },
    filterPressed: { opacity: 0.8 },
    filterText: { color: palette.muted, fontSize: 11, fontWeight: '800' },
    filterTextActive: { color: palette.ink },
    listSection: { marginTop: 24 },
    sectionTitle: { marginBottom: 11, color: palette.ink, fontSize: 16, fontWeight: '900' },
    safeArea: { flex: 1, backgroundColor: palette.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 22,
      backgroundColor: palette.surface,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
    },
    titleWrap: { flex: 1, marginLeft: 8 },
    eyebrow: { color: palette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
    title: { marginTop: 3, color: palette.ink, fontSize: 24, fontWeight: '900' },
    iconCircle: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      backgroundColor: palette.accentPale,
    },
    content: { padding: 20, paddingBottom: 36 },
    intro: { marginBottom: 16, color: palette.muted, fontSize: 14, lineHeight: 20 },
    billCard: {
      marginBottom: 12,
      padding: 15,
      borderRadius: 17,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    billTop: { flexDirection: 'row', alignItems: 'center' },
    billIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      backgroundColor: palette.accentPale,
    },
    billMain: { flex: 1, marginLeft: 11 },
    billName: { color: palette.ink, fontSize: 14, fontWeight: '900' },
    billMeta: { marginTop: 4, color: palette.muted, fontSize: 11 },
    billAmount: { color: palette.ink, fontSize: 14, fontWeight: '900' },
    billBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 13,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionButton: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
      backgroundColor: palette.background,
    },
    paidButton: {
      minHeight: 34,
      paddingHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
      backgroundColor: palette.accent,
    },
    paidText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    centerCopy: { marginTop: 10, color: palette.muted, fontSize: 13 },
    card: {
      margin: 20,
      padding: 18,
      borderRadius: 18,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
    cardCopy: { marginTop: 8, color: palette.muted, fontSize: 14, lineHeight: 21 },
    retry: {
      alignSelf: 'flex-start',
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 16,
      backgroundColor: palette.accentPale,
    },
    retryText: { color: palette.accent, fontSize: 12, fontWeight: '900' },
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end' },
    dismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,35,28,0.28)' },
    editorKeyboard: { maxHeight: '88%' },
    editor: {
      padding: 20,
      paddingBottom: 30,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      backgroundColor: palette.surface,
    },
    editorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    editorTitle: { marginTop: 4, color: palette.ink, fontSize: 20, fontWeight: '900' },
    closeText: { color: palette.ink, fontSize: 30, lineHeight: 30 },
    input: {
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
    frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 11 },
    frequencyChip: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: palette.line,
    },
    frequencyActive: { backgroundColor: palette.accentPale, borderColor: palette.accent },
    frequencyText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
    frequencyTextActive: { color: palette.accent, fontWeight: '900' },
    error: { marginBottom: 10, color: palette.danger, fontSize: 12, fontWeight: '700' },
    saveButton: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 26,
      backgroundColor: palette.accent,
    },
    saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    pressed: { opacity: 0.76 },
    paymentOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,35,28,0.28)' },
    paymentKeyboard: { maxHeight: '88%' },
    paymentSheet: {
      padding: 20,
      paddingBottom: 30,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      backgroundColor: palette.surface,
    },
    paymentClose: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 19,
      backgroundColor: palette.background,
    },
    paymentSummary: {
      marginBottom: 4,
      padding: 15,
      borderRadius: 15,
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: palette.line,
    },
    paymentName: { color: palette.ink, fontSize: 16, fontWeight: '900' },
    paymentAmount: { marginTop: 8, color: palette.ink, fontSize: 23, fontWeight: '900' },
    paymentMeta: { marginTop: 5, color: palette.muted, fontSize: 12 },
    paymentError: { marginTop: 10, color: palette.danger, fontSize: 12, fontWeight: '700' },
    paymentActions: { gap: 6, marginTop: 16 },
    disabledButton: { opacity: 0.45 },
    cancelButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
    cancelText: { color: palette.muted, fontSize: 13, fontWeight: '800' },
    more: {
      width: 42,
      height: 42,
      marginLeft: 7,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      backgroundColor: palette.background,
    },
  });
}
function makeFilterStyles(themePalette: typeof palette) {
  const p = themePalette;
  return StyleSheet.create({
    content: { width: '100%', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
    listSection: { width: '100%', marginTop: 14 },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      marginBottom: 10,
    },
    search: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      minHeight: 46,
      marginBottom: 0,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.line,
    },
    filterButton: {
      width: 48,
      height: 48,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.line,
    },
    filterButtonActive: { borderColor: p.accent, backgroundColor: p.accentPale },
    filterDot: {
      position: 'absolute',
      top: 11,
      right: 11,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: p.accent,
    },
    filterDotHidden: { display: 'none' },
    filterSheet: {
      padding: 20,
      paddingBottom: 28,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      backgroundColor: p.surface,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sheetEyebrow: { color: p.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
    sheetTitle: { marginTop: 4, color: p.ink, fontSize: 20, fontWeight: '900' },
    sheetClose: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
      backgroundColor: p.background,
    },
    filterOption: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: p.line,
    },
    checkCircle: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: p.accent,
    },
    checkCircleEmpty: { backgroundColor: 'transparent', borderWidth: 1, borderColor: p.line },
    checkMark: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    filterOptionLabel: { flex: 1, color: p.muted, fontSize: 14, fontWeight: '700' },
    filterOptionLabelActive: { color: p.ink, fontWeight: '900' },
    filterOptionCount: { color: p.muted, fontSize: 13, fontWeight: '800' },
  });
}

let styles = Object.assign(makeStyles(palette), makeFilterStyles(palette));
styles = { ...styles, more: { ...styles.more, backgroundColor: 'transparent' } };
