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
import { OtpInput } from '@/components/otp-input';
import { getSupabaseClient } from '@/services/supabase';
import { useAppTheme } from '@/theme/theme';
import { getMfaState, rememberTrustedDevice } from '@/services/mfa';

type AuthMode = 'signin' | 'create' | 'mfa';
type Palette = { background: string; surface: string; ink: string; muted: string; accent: string; accentSoft: string; line: string; danger: string };
type FieldIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

function getAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('securestore') || lower.includes('getvaluewithkeyasync') || lower.includes('deletevaluewithkeyasync') || lower.includes('setvaluewithkeyasync')) {
    return 'This app build has an outdated SecureStore native module. Update Expo Go or rebuild the development client, then try signing in again.';
  }
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
  const initialMode: AuthMode = mode === 'create' ? 'create' : mode === 'mfa' ? 'mfa' : 'signin';
  const [screen, setScreen] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleFlowStarted = useRef(false);
  const { colors } = useAppTheme();
  const palette: Palette = { ...colors, accentSoft: colors.accentPale };
  const isCreate = screen === 'create';
  const isMfa = screen === 'mfa';
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const subtitle = useMemo(() => isCreate ? 'Create an account and make every peso count.' : 'Your calmer way to stay on top of money.', [isCreate]);

  const handleGoogle = useCallback(async () => {
    setError('');
    const supabase = getSupabaseClient();
    if (!supabase) { setError('Supabase is not configured for this build.'); return; }
    setLoading(true);
    try {
      // Keep the callback on the native app scheme. If this URI is not present
      // in Supabase's redirect allow-list, Auth falls back to the Site URL.
      const redirectTo = 'mobile://auth/callback';
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
    } catch (oauthError) {
      setError(getAuthError(oauthError instanceof Error ? oauthError.message : 'Google sign-in failed.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (provider !== 'google' || googleFlowStarted.current) return;
    googleFlowStarted.current = true;
    void handleGoogle();
  }, [handleGoogle, provider]);

  if (isMfa) return <MfaVerification />;

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
        const { error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } });
        if (signUpError) throw signUpError;
        else Alert.alert('Check your email', 'Your account was created. Confirm your email before signing in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
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

function MfaVerification() {
  const { colors } = useAppTheme();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    void getMfaState().then((state) => {
      setFactorId(state.factor?.id ?? null);
      if (!state.factor) setError('No verified authenticator was found for this account.');
    }).catch(() => setError('Unable to start verification. Please sign in again.')).finally(() => setLoading(false));
  }, []);

  const verify = async () => {
    if (!factorId || !/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    const client = getSupabaseClient();
    if (!client) { setError('Authentication is unavailable right now.'); return; }
    setVerifying(true); setError(''); setExpired(false);
    try {
      const result = await client.auth.mfa.challengeAndVerify({ factorId, code });
      if (result.error) throw result.error;
      try { await rememberTrustedDevice(); } catch { /* backend trust is best effort; the AAL2 session remains valid */ }
      // SessionGate owns the post-auth redirect. challengeAndVerify updates
      // the session assurance level, and navigating here would race the root
      // stack while it is being refreshed.
    } catch (verificationError) {
      const message = verificationError instanceof Error ? verificationError.message.toLowerCase() : '';
      const challengeExpired = message.includes('expired') || message.includes('jwt') || message.includes('challenge');
      setExpired(challengeExpired);
      setError(challengeExpired ? 'This verification request expired. Please sign in again.' : 'That code isn\'t valid. Try again.');
      setCode('');
    } finally { setVerifying(false); }
  };

  const backToSignIn = async () => { await getSupabaseClient()?.auth.signOut(); router.replace({ pathname: '/auth', params: { mode: 'signin' } }); };
  const canVerify = !loading && !verifying && !expired && code.length === 6;
  return <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}><StatusBar style={colors.background === '#17191C' ? 'light' : 'dark'} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0} style={styles.mfaFlex}><ScrollView contentContainerStyle={styles.mfaContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><Pressable accessibilityRole="button" accessibilityLabel="Back to sign in" onPress={() => void backToSignIn()} style={styles.mfaBack}><ArrowLeft size={22} color={colors.textPrimary} /></Pressable><Text style={[styles.mfaStep, { color: colors.textSecondary }]}>STEP 2 OF 2</Text><View style={[styles.mfaIcon, { backgroundColor: colors.primarySoft }]}><ShieldCheck size={34} color={colors.primary} /></View><Text style={[styles.mfaTitle, { color: colors.textPrimary }]}>Verify it&apos;s you</Text><Text style={[styles.mfaDescription, { color: colors.textSecondary }]}>Enter the 6-digit code from your authenticator app.</Text><View style={styles.mfaOtp}><OtpInput value={code} onChange={(next) => { setCode(next); if (error) { setError(''); setExpired(false); } }} error={Boolean(error)} autoFocus={!loading} disabled={loading || verifying || expired} /></View>{error ? <Text accessibilityRole="alert" style={[styles.mfaError, { color: colors.danger }]}>{error}</Text> : null}{expired ? <Pressable accessibilityRole="button" onPress={() => void backToSignIn()}><Text style={[styles.mfaSecondaryAction, { color: colors.primary }]}>Back to sign in</Text></Pressable> : null}<Pressable accessibilityRole="button" disabled={!canVerify} onPress={() => void verify()} style={[styles.mfaVerifyButton, { backgroundColor: canVerify ? colors.primary : colors.surfaceSecondary }, !canVerify && styles.disabled]}><Text style={[styles.mfaVerifyText, { color: canVerify ? colors.textOnPrimary : colors.textSecondary }]}>{loading ? 'Loading...' : verifying ? 'Verifying...' : 'Verify'}</Text></Pressable><View style={[styles.trustNote, { backgroundColor: colors.primarySoft }]}><ShieldCheck size={17} color={colors.primary} /><Text style={[styles.trustText, { color: colors.textSecondary }]}>You won&apos;t need a code every time you open the app on this verified device.</Text></View><Pressable accessibilityRole="button" onPress={() => Alert.alert('Having trouble?', 'Open your authenticator app and make sure your device time is set automatically. Codes refresh periodically.')} style={styles.helpButton}><Text style={[styles.helpText, { color: colors.primary }]}>Having trouble?</Text></Pressable></ScrollView></KeyboardAvoidingView></SafeAreaView>;
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
  mfaContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 18, paddingBottom: 32 },
  mfaFlex: { flex: 1 },
  mfaBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  mfaStep: { marginTop: 12, textAlign: 'center', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  mfaIcon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 36, marginTop: 70, alignSelf: 'center' },
  mfaTitle: { marginTop: 24, textAlign: 'center', fontSize: 28, fontWeight: '900' },
  mfaDescription: { marginTop: 10, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  mfaOtp: { marginTop: 28 },
  mfaInput: { minHeight: 58, marginTop: 28, borderWidth: 1, borderRadius: 15, textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: '800' },
  mfaError: { marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  mfaSecondaryAction: { marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: '800' },
  mfaVerifyButton: { minHeight: 56, marginTop: 28, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
  mfaVerifyText: { fontSize: 15, fontWeight: '800' },
  trustNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, padding: 12, borderRadius: 16 },
  trustText: { flex: 1, fontSize: 12, lineHeight: 18 },
  helpButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  helpText: { fontSize: 13, fontWeight: '800' },
});
