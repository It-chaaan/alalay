import { Linking, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ExternalLink, Shield } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsHeader, useSettingsStyles } from '@/components/settings-ui';
import { useAppTheme } from '@/theme/theme';

export default function PrivacyScreen() {
  const { colors } = useAppTheme();
  const s = useSettingsStyles();
  const policyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}><SettingsHeader title="Privacy" onBack={() => router.back()} /><ScrollView contentContainerStyle={s.content}><View style={s.card}><Shield size={26} color={colors.primary} /><Text style={[s.formLabel, { marginTop: 14 }]}>Your financial data</Text><Text style={[s.copy, { marginTop: 6 }]}>Your profile and financial records are accessed through your authenticated account. Account-scoped data is protected by server authentication and database ownership policies.</Text>{policyUrl ? <Text onPress={() => void Linking.openURL(policyUrl)} style={[s.success, { marginTop: 16 }]}>{'Open full privacy policy '}<ExternalLink size={14} color={colors.primary} /></Text> : <Text style={s.backNote}>A full privacy policy URL is not configured in this mobile build.</Text>}</View></ScrollView></SafeAreaView>;
}
