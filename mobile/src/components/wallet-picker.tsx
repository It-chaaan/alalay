import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Search, WalletCards, X } from 'lucide-react-native';
import { formPalette } from './finance-form';
import { walletPresets, type WalletPreset } from '@/constants/wallets';
import { BrandLogo } from '@/components/brand-logo';
import { sortCategoriesByLabel } from '@/utils/category-sorting';

export type Wallet = {
  id: string;
  name: string;
  institution_type: string;
  institution_key: string;
  currency?: string;
  last_four?: string | null;
  account_type?: 'debit' | 'credit' | null;
  account_purpose?: 'everyday' | 'savings' | null;
  earns_interest?: boolean;
  annual_interest_rate?: number | string | null;
  interest_credit_frequency?: string | null;
  credit_limit?: number | string | null;
  balance: number | string;
  color: string;
  is_default_cash: boolean;
  default_outgoing_transfer_fee?: number | string | null;
  interest_rate?: number | string | null;
  interest_crediting_frequency?: string | null;
  payment_due_date?: string | null;
  payment_due_day?: number | null;
  payment_wallet_id?: string | null;
  auto_record_payment?: boolean;
  payment_rule?: 'full_outstanding' | 'fixed_amount' | 'minimum_due' | null;
  fixed_payment_amount?: number | string | null;
  is_active?: boolean;
};

export function WalletPicker({
  wallets,
  value,
  onChange,
  required = false,
  label = 'Wallet',
  onAddWallet,
  excludeCredit = false,
  activeOnly = false,
}: {
  wallets: Wallet[];
  value: string | null;
  onChange: (walletId: string | null) => void;
  required?: boolean;
  label?: string;
  onAddWallet?: () => void;
  excludeCredit?: boolean;
  activeOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = wallets.find((wallet) => wallet.id === value);
  const displayLabel = label === 'Paid from' ? 'Payment method' : label;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {displayLabel}
        {required ? '' : ' (optional)'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose ${displayLabel.toLowerCase()}${selected ? `, ${selected.name}` : ''}`}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        {selected ? (
          <BrandLogo
            name={selected.name}
            entity="wallet"
            institutionKey={selected.institution_key}
            category={selected.institution_type}
            size={30}
          />
        ) : (
          <View style={[styles.triggerIcon, { backgroundColor: formPalette.accent + '22' }]}>
            <WalletCards size={17} color={formPalette.accent} />
          </View>
        )}
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected ? walletDisplayName(selected) : `Select ${displayLabel.toLowerCase()}`}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <WalletPickerModal
        visible={open}
        wallets={wallets}
        excludeCredit={excludeCredit}
        activeOnly={activeOnly}
        value={value}
        onClose={() => setOpen(false)}
        onChange={(id) => {
          onChange(id);
          setOpen(false);
        }}
        allowUnset={!required}
        onAddWallet={onAddWallet}
      />
    </View>
  );
}

export function WalletPickerModal({
  visible,
  wallets,
  value = null,
  onClose,
  onChange,
  allowUnset,
  showPresets = false,
  onPreset,
  onAddWallet,
  excludeCredit = false,
  activeOnly = false,
}: {
  visible: boolean;
  wallets: Wallet[];
  value?: string | null;
  onClose: () => void;
  onChange: (walletId: string | null) => void;
  allowUnset: boolean;
  showPresets?: boolean;
  onPreset?: (preset: WalletPreset) => void;
  onAddWallet?: () => void;
  excludeCredit?: boolean;
  activeOnly?: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () =>
      walletPresets.filter((preset) => preset.name.toLowerCase().includes(search.toLowerCase())),
    [search],
  );
  const choosePreset = (preset: WalletPreset) => {
    if (onPreset) onPreset(preset);
    else onChange(wallets.find((wallet) => wallet.institution_key === preset.key)?.id ?? null);
  };
  const matchingWallets = wallets.filter(
    (wallet) =>
      (!excludeCredit || wallet.account_type !== 'credit') &&
      (!activeOnly || wallet.is_active !== false) &&
      `${wallet.name} ${wallet.institution_key} ${wallet.last_four ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>MONEY LOCATION</Text>
              <Text style={styles.title}>Choose wallet</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close wallet picker"
              onPress={onClose}
              style={styles.close}
            >
              <X size={20} color={formPalette.ink} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <Search size={16} color={formPalette.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search banks and e-wallets"
              placeholderTextColor={formPalette.muted}
              style={styles.input}
            />
          </View>
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {!showPresets &&
              (matchingWallets.length ? (
                matchingWallets.map((wallet, index) => (
                  <WalletChoice
                    key={wallet.id}
                    label={walletDisplayName(wallet)}
                    detail={walletBalanceLabel(wallet)}
                    selected={wallet.id === value}
                    showDivider={index < matchingWallets.length - 1}
                    onPress={() => onChange(wallet.id)}
                  />
                ))
              ) : (
                <Text style={styles.empty}>No wallets found.</Text>
              ))}
            {showPresets &&
              ['E-wallets', 'Digital banks', 'Traditional banks', 'Cash'].map((group) => (
                <View key={group}>
                  <Text style={styles.group}>{group}</Text>
                  {sortCategoriesByLabel(filtered.filter((preset) => preset.group === group), { getLabel: (preset) => preset.name })
                    .map((preset) => (
                      <WalletChoice
                        key={preset.key}
                        label={preset.name}
                        status={
                          wallets.filter((wallet) => wallet.institution_key === preset.key).length
                            ? `${wallets.filter((wallet) => wallet.institution_key === preset.key).length} added`
                            : undefined
                        }
                        onPress={() => choosePreset(preset)}
                      />
                    ))}
                </View>
              ))}
            {showPresets && (
              <>
                <Text style={styles.group}>Other</Text>
                <WalletChoice
                  label="Other / Custom"
                  onPress={() =>
                    onPreset?.({
                      key: 'custom',
                      name: 'Other / Custom',
                      type: 'other',
                      color: '#667085',
                      group: 'Other',
                    })
                  }
                />
              </>
            )}
            {allowUnset && (
              <Pressable onPress={() => onChange(null)} style={styles.unset}>
                <Text style={styles.unsetText}>Leave unset</Text>
              </Pressable>
            )}
          </ScrollView>
          {onAddWallet ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a new wallet and return to this form"
              onPress={onAddWallet}
              style={({ pressed }) => [styles.addWallet, pressed && styles.pressed]}
            >
              <Text style={styles.addWalletText}>＋ Add new wallet</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function WalletChoice({
  label,
  detail,
  selected = false,
  status,
  showDivider = false,
  onPress,
}: {
  label: string;
  detail?: string;
  selected?: boolean;
  status?: string;
  showDivider?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} wallet${selected ? ', selected' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        showDivider && styles.choiceDivider,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <BrandLogo
        name={label}
        entity="wallet"
        institutionKey={label === 'Other / Custom' ? 'custom' : undefined}
        size={34}
      />
      <View style={styles.choiceCopy}>
        <Text numberOfLines={1} style={styles.choiceText}>{label}</Text>
        {detail ? <Text numberOfLines={1} style={styles.choiceDetail}>{detail}</Text> : null}
      </View>
      {status ? (
        <Text style={styles.status}>{status}</Text>
      ) : selected ? (
        <Check size={17} color={formPalette.accent} strokeWidth={2.8} />
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Pressable>
  );
}

export function walletTypeLabel(wallet: Pick<Wallet, 'account_type' | 'account_purpose' | 'is_default_cash'>) {
  if (wallet.account_type === 'credit') return 'Credit';
  if (wallet.account_purpose === 'savings') return 'Savings';
  if (wallet.is_default_cash) return 'Cash';
  return 'Debit';
}

function walletDisplayName(wallet: Wallet) {
  const suffix = wallet.last_four ? ` •••• ${wallet.last_four}` : '';
  return `${wallet.name} — ${walletTypeLabel(wallet)}${suffix}`;
}

function walletBalanceLabel(wallet: Wallet) {
  const balance = Number(wallet.balance) || 0;
  const value = `₱${balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (wallet.account_type === 'credit') {
    const available = Math.max(0, Number(wallet.credit_limit ?? 0) - balance);
    return `Available credit: ₱${available.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${wallet.account_purpose === 'savings' ? 'Savings balance' : 'Available balance'}: ${value}`;
}

const styles = StyleSheet.create({
  field: { marginTop: 15 },
  label: {
    marginBottom: 8,
    color: formPalette.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  trigger: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: formPalette.background,
    borderWidth: 1,
    borderColor: formPalette.line,
  },
  triggerIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  triggerText: { flex: 1, marginLeft: 9, color: formPalette.ink, fontSize: 13, fontWeight: '800' },
  placeholder: { color: formPalette.muted, fontWeight: '600' },
  chevron: { color: formPalette.muted, fontSize: 24, lineHeight: 24 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,35,28,0.28)' },
  sheet: {
    maxHeight: '88%',
    padding: 20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: formPalette.surface,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 4, color: formPalette.ink, fontSize: 22, fontWeight: '900' },
  close: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: formPalette.background,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 46,
    marginTop: 16,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: formPalette.background,
    borderWidth: 1,
    borderColor: formPalette.line,
  },
  input: { flex: 1, color: formPalette.ink, fontSize: 13 },
  list: { paddingTop: 12, paddingBottom: 24 },
  group: {
    marginTop: 14,
    marginBottom: 7,
    color: formPalette.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  empty: {
    paddingVertical: 28,
    color: formPalette.muted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  choice: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9 },
  choiceDivider: { borderBottomWidth: 1, borderBottomColor: formPalette.line },
  choiceSelected: { backgroundColor: formPalette.accentPale, borderRadius: 12 },
  choiceIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  initials: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  choiceText: { color: formPalette.ink, fontSize: 13, fontWeight: '800' },
  choiceCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  choiceDetail: { marginTop: 3, color: formPalette.muted, fontSize: 11, fontWeight: '700' },
  status: { marginRight: 8, color: formPalette.accent, fontSize: 11, fontWeight: '800' },
  unset: { alignItems: 'center', padding: 13 },
  unsetText: { color: formPalette.muted, fontSize: 12, fontWeight: '800' },
  addWallet: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: formPalette.accent, backgroundColor: formPalette.accentPale },
  addWalletText: { color: formPalette.accent, fontSize: 13, fontWeight: '900' },
  pressed: { backgroundColor: formPalette.background, opacity: 0.9 },
});
