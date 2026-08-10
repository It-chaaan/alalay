import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsHeader, SettingsRow, settingsStyles as s } from '@/components/settings-ui';

export default function SecurityScreen() {
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}><SettingsHeader title="Security" onBack={() => router.back()} /><ScrollView contentContainerStyle={s.content}><Text style={s.backNote}>Manage how you protect your Alalay account.</Text><View style={s.section}><View style={s.group}><SettingsRow icon={KeyRound} label="Change password" value="Update your sign-in password" onPress={() => router.push('/(tabs)/settings/change-password')} /><SettingsRow icon={ShieldCheck} label="Authenticator / two-factor authentication" value="Not available in this mobile build" onPress={() => router.push('/(tabs)/settings/authenticator')} last /></View></View></ScrollView></SafeAreaView>;
}
