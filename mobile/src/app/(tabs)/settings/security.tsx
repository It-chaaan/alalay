import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsHeader, SettingsRow, useSettingsStyles } from '@/components/settings-ui';
import { getMfaState } from '@/services/mfa';
import { useAppTheme } from '@/theme/theme';

export default function SecurityScreen() {
  const { colors } = useAppTheme();
  const s = useSettingsStyles();
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'error'>('loading');
  useEffect(() => { void getMfaState().then(({ factor }) => setStatus(factor ? 'enabled' : 'disabled')).catch(() => setStatus('error')); }, []);
  const authenticatorValue = status === 'loading' ? 'Loading…' : status === 'enabled' ? 'Enabled' : status === 'error' ? 'Unable to load status' : 'Not enabled';
  return <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}><SettingsHeader title="Security" onBack={() => router.back()} /><ScrollView contentContainerStyle={s.content}><Text style={[s.backNote, { color: colors.textSecondary }]}>Manage how you protect your Alalay account.</Text><View style={[s.section, { marginTop: 22 }]}><Text style={[s.sectionLabel, { color: colors.textSecondary }]}>ACCOUNT SECURITY</Text><View style={[s.group, { backgroundColor: colors.surfaceTranslucent, borderColor: colors.border }]}><SettingsRow icon={KeyRound} label="Change password" value="Update your sign-in password" onPress={() => router.push('/(tabs)/settings/change-password')} /><SettingsRow icon={ShieldCheck} label="Authenticator" value={authenticatorValue} onPress={() => router.push('/(tabs)/settings/authenticator')} last /></View></View>{status === 'error' ? <Text style={[s.error, { color: colors.danger }]}>Unable to load authenticator status.</Text> : null}</ScrollView></SafeAreaView>;
}
