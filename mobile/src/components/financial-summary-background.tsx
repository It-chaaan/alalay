import type { ReactNode } from 'react';
import { Circle, Path, Svg } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

type SummaryMotif = 'income' | 'expense' | 'subscriptions' | 'bills' | 'budget';

export function FinancialSummaryBackground({ motif, icon }: { motif: SummaryMotif; icon?: ReactNode }) {
  const path = motif === 'income'
    ? 'M-10 114 C42 94 57 124 100 91 S172 44 238 72 S299 61 340 18'
    : motif === 'expense'
      ? 'M-12 22 C42 47 60 18 108 50 S183 112 232 80 S293 73 340 112'
      : motif === 'subscriptions'
        ? 'M224 86 A58 58 0 1 1 282 28 A58 58 0 0 1 224 86'
        : motif === 'bills'
          ? 'M-12 105 C42 78 77 122 123 91 S208 43 252 70 S307 92 344 53'
          : 'M-12 92 C45 69 80 112 128 79 S216 35 260 62 S311 77 344 32';

  return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}><Svg width="100%" height="100%" viewBox="0 0 340 160" preserveAspectRatio="none"><Circle cx="296" cy="-5" r="82" fill="#B7E8D0" opacity={0.08} /><Circle cx="36" cy="157" r="64" fill="#083C2D" opacity={0.12} /><Path d={path} fill="none" stroke="#C9F3DD" strokeWidth={2} opacity={0.16} /><Path d={path} fill="none" stroke="#C9F3DD" strokeWidth={1} opacity={0.09} transform="translate(0 9)" />{motif === 'budget' ? <Path d="M255 28 A34 34 0 0 1 315 72" fill="none" stroke="#C9F3DD" strokeWidth={7} opacity={0.1} strokeLinecap="round" /> : null}</Svg>{icon ? <View style={styles.icon}>{icon}</View> : null}</View>;
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', top: 12, right: 14, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: 'rgba(5, 64, 46, 0.25)' },
});
