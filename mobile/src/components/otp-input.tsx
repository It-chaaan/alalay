import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '@/theme/theme';

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
};

export function OtpInput({ value, onChange, error = false, autoFocus = false, disabled = false }: OtpInputProps) {
  const { colors } = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const activeIndex = Math.min(value.length, 5);
  const focusInput = () => { if (!disabled) inputRef.current?.focus(); };
  return <Pressable accessibilityRole="none" accessibilityLabel="Six-digit verification code" onPress={focusInput} style={styles.wrap}><View style={styles.cells}>{digits.map((digit, index) => { const active = focused && index === activeIndex && value.length < 6; return <View key={index} style={[styles.cell, { backgroundColor: colors.surfaceInput, borderColor: error ? colors.danger : active ? colors.primary : colors.border }, active && { backgroundColor: colors.primarySoft }]}><Text style={[styles.digit, { color: colors.textPrimary }]}>{digit.trim()}</Text></View>; })}</View><TextInput ref={inputRef} value={value} onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, 6))} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} keyboardType="number-pad" inputMode="numeric" autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'} textContentType="oneTimeCode" maxLength={6} editable={!disabled} autoFocus={autoFocus} accessibilityLabel="Enter six-digit verification code" style={styles.hiddenInput} /></Pressable>;
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  cells: { flexDirection: 'row', justifyContent: 'space-between', gap: 7 },
  cell: { flex: 1, aspectRatio: 0.86, maxWidth: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14 },
  digit: { fontSize: 22, fontWeight: '800' },
  hiddenInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
});
