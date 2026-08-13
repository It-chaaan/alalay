import { MoreHorizontal } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/theme';
import { BrandLogo } from '@/components/brand-logo';
import type { Wallet } from './wallet-picker';

type WalletCardProps = { wallet: Wallet; onPress: () => void; onManage: () => void; formatBalance: (value: number | string) => string; typeLabel: (type: string) => string };

export function WalletCard({ wallet, onPress, onManage, formatBalance, typeLabel }: WalletCardProps) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${wallet.name}, ${typeLabel(wallet.institution_type)}, balance ${formatBalance(wallet.balance)}`} onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: wallet.color, borderColor: `${wallet.color}CC` }, pressed && styles.pressed]}>
    <View style={styles.topRow}><BrandLogo name={wallet.name} entity="wallet" institutionKey={wallet.institution_key} category={wallet.institution_type} size={40} /><Pressable accessibilityRole="button" accessibilityLabel={`More options for ${wallet.name}`} hitSlop={8} onPress={(event) => { event.stopPropagation(); onManage(); }} style={styles.more}><MoreHorizontal size={22} color="rgba(255,255,255,0.94)" /></Pressable></View>
    <View style={styles.identity}><Text numberOfLines={2} style={styles.name}>{wallet.name}</Text><Text style={styles.meta}>{typeLabel(wallet.institution_type)} · PHP</Text></View>
    <View><Text style={styles.balanceLabel}>BALANCE</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.balance}>{formatBalance(wallet.balance)}</Text></View>
    <Text pointerEvents="none" style={styles.watermark}>◆</Text>
    <View pointerEvents="none" style={[styles.highlight, { backgroundColor: colors.textOnPrimary }]} />
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { width: '47.8%', minHeight: 202, justifyContent: 'space-between', overflow: 'hidden', padding: 15, borderRadius: 22, borderWidth: 1, shadowColor: '#063224', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  mark: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)' },
  markText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  more: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, justifyContent: 'center', marginVertical: 12 },
  name: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  meta: { marginTop: 5, color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '700' },
  balanceLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  balance: { marginTop: 4, color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  watermark: { position: 'absolute', right: -5, bottom: -18, color: 'rgba(255,255,255,0.12)', fontSize: 104, fontWeight: '900' },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, opacity: 0.2 },
  pressed: { opacity: 0.82 },
});
