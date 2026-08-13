import { MoreHorizontal } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useAppTheme } from '@/theme/theme';
import type { Wallet } from './wallet-picker';

type WalletCardProps = {
  wallet: Wallet;
  onPress: () => void;
  onManage: () => void;
  formatBalance: (value: number | string) => string;
  typeLabel: (type: string) => string;
};

/** Compact grid card: header identity and balance are deliberately separate regions. */
export function WalletCard({ wallet, onPress, onManage, formatBalance, typeLabel }: WalletCardProps) {
  const { colors } = useAppTheme();
  const { visible } = useBalanceVisibility();
  const amountsVisible = visible === true;
  const balance = amountsVisible ? formatBalance(wallet.balance) : '••••••';
  // institution_type is the persisted wallet classification. The current data
  // model has no account/debit/credit field, so it must not be guessed here.
  const metadata = `${typeLabel(wallet.institution_type)} · PHP`;

  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${wallet.name}, ${metadata}, balance ${amountsVisible ? balance : 'hidden'}`}
    onPress={onPress}
    style={({ pressed }) => [styles.card, { backgroundColor: wallet.color, borderColor: `${wallet.color}CC` }, pressed && styles.pressed]}
  >
    <Text pointerEvents="none" style={styles.watermark}>◇</Text>
    <View pointerEvents="none" style={[styles.highlight, { backgroundColor: colors.textOnPrimary }]} />
    <View style={styles.content}>
      <View style={styles.header}>
        <BrandLogo name={wallet.name} entity="wallet" institutionKey={wallet.institution_key} category={wallet.institution_type} size={40} />
        <View style={styles.identity}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>{wallet.name}</Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.meta}>{metadata}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${wallet.name}`} hitSlop={8} onPress={(event) => { event.stopPropagation(); onManage(); }} style={styles.more}>
          <MoreHorizontal size={22} color="rgba(255,255,255,0.94)" />
        </Pressable>
      </View>
      <View style={styles.balanceArea}>
        <Text style={styles.balanceLabel}>BALANCE</Text>
        <Text accessibilityElementsHidden={!amountsVisible} importantForAccessibility={amountsVisible ? 'yes' : 'no'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.balance}>{balance}</Text>
      </View>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  // Width is supplied by the two-column parent; this stays compact and equal-height.
  card: { width: '48%', minHeight: 124, aspectRatio: 1.3, overflow: 'hidden', padding: 12, borderRadius: 22, borderWidth: 1, shadowColor: '#063224', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  content: { flex: 1, zIndex: 2 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  identity: { flex: 1, minWidth: 0, marginLeft: 9, justifyContent: 'center' },
  name: { color: '#FFFFFF', fontSize: 15, lineHeight: 18, fontWeight: '900' },
  meta: { marginTop: 2, color: 'rgba(255,255,255,0.80)', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  more: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: 4, zIndex: 3 },
  balanceArea: { marginTop: 'auto', paddingTop: 10 },
  balanceLabel: { color: 'rgba(255,255,255,0.74)', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 1 },
  balance: { marginTop: 3, color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  watermark: { position: 'absolute', right: -5, bottom: -24, zIndex: 0, color: 'rgba(255,255,255,0.10)', fontSize: 88, fontWeight: '900' },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, height: 1, opacity: 0.2 },
  pressed: { opacity: 0.82 },
});
