import {
  Banknote,
  Droplets,
  HandCoins,
  House,
  Landmark,
  Phone,
  Receipt,
  Repeat,
  Shield,
  Tv,
  Wifi,
  Zap,
} from 'lucide-react-native';
import { createElement, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { initialForName, resolveBrand, type BrandEntity } from '@/constants/brand-resolver';
import { useAppTheme } from '@/theme/theme';
import { resolveBillIcon, type BillIconName } from '@/utils/bill-icon';

export function BrandLogo({
  name,
  entity,
  institutionKey,
  category,
  customCategory,
  icon,
  size = 42,
}: {
  name: string;
  entity: BrandEntity;
  institutionKey?: string | null;
  category?: string | null;
  customCategory?: string | null;
  icon?: string | null;
  size?: number;
}) {
  const { colors } = useAppTheme();
  const brand = resolveBrand(name, entity, institutionKey);
  const billResolution =
    entity === 'bill'
      ? resolveBillIcon({ name, category, customCategory, icon, providerKey: brand?.key })
      : null;
  const billIcons: Record<
    BillIconName,
    ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  > = {
    electricity: Zap,
    water: Droplets,
    internet: Wifi,
    cable: Tv,
    rent: House,
    subscription: Repeat,
    phone: Phone,
    insurance: Shield,
    loan: HandCoins,
  };
  const FallbackIcon =
    entity === 'wallet'
      ? institutionKey === 'cash' || category === 'cash'
        ? Banknote
        : Landmark
      : entity === 'bill'
        ? Receipt
        : Repeat;
  const mark = brand?.mark ?? initialForName(name);
  const CategoryIcon = billResolution?.kind === 'icon' ? billIcons[billResolution.name] : null;
  const showInitial = !brand && entity === 'wallet' && institutionKey === 'custom';
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.29,
          backgroundColor: brand ? 'rgba(255,255,255,0.92)' : colors.primarySoft,
          borderColor: brand ? 'rgba(255,255,255,0.45)' : colors.border,
        },
      ]}
    >
      {CategoryIcon ? (
        createElement(CategoryIcon, { size: size * 0.48, color: colors.primary, strokeWidth: 1.9 })
      ) : billResolution?.kind === 'initial' ? (
        <Text style={[styles.mark, { color: colors.primary, fontSize: size * 0.38 }]}>
          {billResolution.name}
        </Text>
      ) : brand ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.mark,
            { color: brand.color, fontSize: mark.length > 3 ? size * 0.23 : size * 0.38 },
          ]}
        >
          {mark}
        </Text>
      ) : showInitial ? (
        <Text
          style={[
            styles.mark,
            { color: colors.primary, fontSize: mark.length > 3 ? size * 0.23 : size * 0.38 },
          ]}
        >
          {mark}
        </Text>
      ) : (
        <FallbackIcon size={size * 0.48} color={colors.primary} strokeWidth={1.9} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  mark: { fontWeight: '900', textAlign: 'center' },
});
