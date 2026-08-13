import { Banknote, Landmark, Receipt, Repeat } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { initialForName, resolveBrand, type BrandEntity } from '@/constants/brand-resolver';
import { useAppTheme } from '@/theme/theme';

export function BrandLogo({ name, entity, institutionKey, category, size = 42 }: { name: string; entity: BrandEntity; institutionKey?: string | null; category?: string | null; size?: number }) {
  const { colors } = useAppTheme();
  const brand = resolveBrand(name, entity, institutionKey);
  const FallbackIcon = entity === 'wallet' ? (institutionKey === 'cash' || category === 'cash' ? Banknote : Landmark) : entity === 'bill' ? Receipt : Repeat;
  const mark = brand?.mark ?? initialForName(name);
  const showInitial = !brand && entity === 'wallet' && institutionKey === 'custom';
  return <View accessible={false} pointerEvents="none" style={[styles.tile, { width: size, height: size, borderRadius: size * 0.29, backgroundColor: brand ? `${brand.color}18` : colors.primarySoft, borderColor: brand ? `${brand.color}45` : colors.border }]}>
    {brand ? <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.mark, { color: brand.color, fontSize: mark.length > 2 ? size * 0.23 : size * 0.43 }]}>{mark}</Text> : showInitial ? <Text style={[styles.mark, { color: colors.primary, fontSize: mark.length > 2 ? size * 0.23 : size * 0.43 }]}>{mark}</Text> : <FallbackIcon size={size * 0.48} color={colors.primary} strokeWidth={1.9} />}
  </View>;
}

const styles = StyleSheet.create({ tile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, mark: { fontWeight: '900', textAlign: 'center' } });
