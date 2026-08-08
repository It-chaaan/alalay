import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CircleAlert, Lock, Mail, ShieldCheck, User } from 'lucide-react-native';

import { BrandLockup } from '@/components/brand-lockup';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { getSupabaseClient } from '@/services/supabase';

type AuthMode = 'signin' | 'create';
type Palette = { background: string; surface: string; ink: string; muted: string; accent: string; accentSoft: string; line: string; danger: string };
type FieldIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

const lightPalette: Palette = {
  background: '#F4F7F1', surface: '#FFFFFF', ink: '#11231C', muted: '#5D6C65', accent: '#0F8A6B', accentSoft: '#D8EFE2', line: '#DCE8E0', danger: '#B42318',
};

function getAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (lower.includes('user already registered') || lower.includes('already been registered')) return 'An account with this email already exists. Try signing in.';
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connect')) return 'We could not connect right now. Check your internet connection and try again.';
  return message;
}

function AuthInput({ palette, icon: Icon, label, value, onChangeText, secureTextEntry, autoCapitalize = 'none', keyboardType = 'default' }: { palette: Palette; icon: FieldIcon; label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; keyboardType?: 'default' | 'email-address' }) {
  return (
    <View style={styles.field}>
      <Icon size={20} strokeWidth={1.75} color={palette.muted} />
      <View style={styles.fieldBody}>
        <Text style={[styles.fieldLabel, { color: palette.muted }]}>{label}</Text>
        <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} autoCapitalize={autoCapitalize} autoCorrect={false} keyboardType={keyboardType} placeholderTextColor={palette.muted} style={[styles.input, { color: palette.ink }]} />
      </View>
    </View>
  );
}

function AuthHeader({ palette, title, description, onBack }: { palette: Palette; title: string; description: string; onBack: () => void }) {
  return (
    <View style={[styles.header, { backgroundColor: palette.accent }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to landing page" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><ArrowLeft size={22} strokeWidth={1.75} color="#FFFFFF" /></Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.headerDescription}>{description}</Text>
    </View>
  );
}

export default function AuthScreen() {
  const { mode, provider } = useLocalSearchParams<{ mode?: string; provider?: string }>();
  const initialMode: AuthMode = mode === 'create' ? 'create' : 'signin';
  const [screen, setScreen] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleFlowStarted = useRef(false);
  const palette = lightPalette;
  const isCreate = screen === 'create';
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const subtitle = useMemo(() => isCreate ? 'Create an account and make every peso count.' : 'Your calmer way to stay on top of money.', [isCreate]);
  const goToApp = useCallback(() => router.replace('/(tabs)'), []);

  const handleGoogle = useCallback(async () => {
    setError('');
    const supabase = getSupabaseClient();
    if (!supabase) { setError('Supabase is not configured for this build.'); return; }
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('Google sign-in could not start.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        if (result.type === 'cancel') setError('Google sign-in was cancelled.');
        return;
      }
      const parsed = Linking.parse(result.url);
      const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
      if (!code) throw new Error('Google sign-in did not return a valid session.');
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      goToApp();
    } catch (oauthError) {
      setError(getAuthError(oauthError instanceof Error ? oauthError.message : 'Google sign-in failed.'));
    } finally {
      setLoading(false);
    }
  }, [goToApp]);

  useEffect(() => {
    if (provider !== 'google' || googleFlowStarted.current) return;
    googleFlowStarted.current = true;
    void handleGoogle();
  }, [handleGoogle, provider]);

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password) { setError('Enter your email and password to continue.'); return; }
    if (!emailIsValid) { setError('Enter a valid email address.'); return; }
    if (isCreate && !fullName.trim()) { setError('Enter your full name.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    if (isCreate && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    const supabase = getSupabaseClient();
    if (!supabase) { setError('Supabase is not configured for this build.'); return; }
    setLoading(true);
    try {
      if (isCreate) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } });
        if (signUpError) throw signUpError;
        if (data.session) goToApp();
        else Alert.alert('Check your email', 'Your account was created. Confirm your email before signing in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        goToApp();
      }
    } catch (authError) {
      setError(getAuthError(authError instanceof Error ? authError.message : 'Authentication failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <StatusBar style="light" />
      <AuthHeader palette={palette} title={isCreate ? 'Create your account' : 'Welcome back'} description={subtitle} onBack={() => router.replace('/')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formFlex}>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <BrandLockup color={palette.ink} logoSize={30} textSize={22} />
          <Text style={[styles.formTitle, { color: palette.ink }]}>{isCreate ? 'Let’s get started' : 'Sign in to Alalay'}</Text>
          <Text style={[styles.formDescription, { color: palette.muted }]}>{isCreate ? 'Set up your account in a few steps.' : 'Pick up where you left off.'}</Text>
          <View style={styles.fields}>
            {isCreate && <AuthInput palette={palette} icon={User} label="Full Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />}
            <AuthInput palette={palette} icon={Mail} label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <AuthInput palette={palette} icon={Lock} label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            {isCreate && <AuthInput palette={palette} icon={ShieldCheck} label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />}
          </View>
          <View style={styles.actionSlot}>
            {!isCreate && <Pressable accessibilityRole="button" onPress={() => Alert.alert('Password reset', 'Password reset is not available in the mobile app yet.')} style={styles.forgotButton}><Text style={[styles.linkText, { color: palette.accent }]}>Forgot password?</Text></Pressable>}
          </View>
          {Boolean(error) && <View accessible accessibilityRole="alert" style={[styles.errorBox, { backgroundColor: palette.accentSoft }]}><CircleAlert size={20} strokeWidth={1.75} color={palette.danger} /><Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text></View>}
          <Pressable accessibilityRole="button" disabled={loading} onPress={handleSubmit} style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.accent }, pressed && styles.pressed, loading && styles.disabled]}><Text style={styles.primaryText}>{loading ? 'Please wait...' : isCreate ? 'Create Account' : 'Sign In'}</Text></Pressable>
          <View style={styles.orRow}><View style={[styles.orLine, { backgroundColor: palette.line }]} /><Text style={[styles.orText, { color: palette.muted }]}>or</Text><View style={[styles.orLine, { backgroundColor: palette.line }]} /></View>
          <GoogleSignInButton colors={palette} onPress={handleGoogle} loading={loading} variant="auth" />
          <Pressable accessibilityRole="button" onPress={() => setScreen(isCreate ? 'signin' : 'create')} style={styles.switchButton}><Text style={[styles.switchText, { color: palette.muted }]}>{isCreate ? 'Already have an account? ' : 'New to Alalay? '}<Text style={{ color: palette.accent, fontWeight: '800' }}>{isCreate ? 'Sign In' : 'Sign Up'}</Text></Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  primaryButton: { minHeight: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 12, fontWeight: '600' },
  header: { minHeight: 214, paddingHorizontal: 28, paddingTop: 12, paddingBottom: 34, borderBottomLeftRadius: 52, borderBottomRightRadius: 52 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  headerTitle: { color: '#FFFFFF', fontSize: 29, fontWeight: '800', letterSpacing: -0.8 },
  headerDescription: { maxWidth: 310, marginTop: 8, color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20 },
  formFlex: { flex: 1 },
  formContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 25, paddingBottom: 30 },
  formTitle: { marginTop: 28, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  formDescription: { marginTop: 7, fontSize: 14, lineHeight: 20 },
  fields: { marginTop: 26, gap: 18 },
  field: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#8BA79A' },
  fieldBody: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  input: { minHeight: 31, paddingVertical: 0, fontSize: 15 },
  actionSlot: { minHeight: 44, justifyContent: 'center' },
  forgotButton: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 13, fontWeight: '800' },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: 12, borderRadius: 12 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  switchButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  switchText: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
});
