import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GoogleLogo } from '@/components/google-logo';

type GoogleButtonColors = {
  surface: string;
  line: string;
  ink: string;
};

type GoogleSignInButtonProps = {
  colors: GoogleButtonColors;
  onPress: () => void;
  loading?: boolean;
  variant: 'auth' | 'landing';
};

export function GoogleSignInButton({ colors, onPress, loading = false, variant }: GoogleSignInButtonProps) {
  const isAuthButton = variant === 'auth';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isAuthButton ? styles.authButton : styles.landingButton,
        { backgroundColor: colors.surface, borderColor: colors.line },
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}>
      {isAuthButton ? (
        <View style={[styles.authLogo, { borderColor: colors.line }]}><GoogleLogo size={16} /></View>
      ) : (
        <View style={styles.landingLogo}><GoogleLogo size={18} /></View>
      )}
      <Text style={[styles.label, { color: colors.ink }]}>{loading ? 'Connecting...' : 'Continue with Google'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 27, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  authButton: { flexDirection: 'row', gap: 10, paddingHorizontal: 18 },
  landingButton: { paddingHorizontal: 52 },
  authLogo: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  landingLogo: { position: 'absolute', left: 22 },
  label: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
});
