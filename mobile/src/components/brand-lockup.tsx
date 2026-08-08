import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

type BrandLockupProps = {
  color: string;
  logoSize?: number;
  textSize?: number;
};

export function BrandLockup({ color, logoSize = 30, textSize = 22 }: BrandLockupProps) {
  return (
    <View accessibilityRole="image" accessibilityLabel="Alalay" style={styles.brand}>
      <Image source={require('@/assets/images/alalay.svg')} style={{ width: logoSize, height: logoSize }} contentFit="contain" />
      <Text style={[styles.name, { color, fontSize: textSize }]}>{'Alalay'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { fontWeight: '700', letterSpacing: -0.7 },
});
