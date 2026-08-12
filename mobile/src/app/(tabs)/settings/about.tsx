import { ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Info, Shield } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsHeader, SettingsSection, SettingsRow, useSettingsStyles } from '@/components/settings-ui';

export default function AboutScreen() {
  const s = useSettingsStyles();
  const version = Constants.expoConfig?.version || '1.0.0';
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}><SettingsHeader title="About" onBack={() => router.back()} /><ScrollView contentContainerStyle={s.content}><SettingsSection title="About"><SettingsRow icon={Shield} label="Privacy" value="Your data stays scoped to your account" onPress={() => router.push('/(tabs)/settings/privacy')} /><SettingsRow icon={Info} label="Version" value={version} last /></SettingsSection><View style={[s.card, { marginTop: 22 }]}><Text style={s.copy}>Alalay keeps financial records tied to your authenticated account.</Text></View></ScrollView></SafeAreaView>;
}
