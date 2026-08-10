import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Sun } from 'lucide-react-native';
import { SettingsHeader, settingsPalette as p, settingsStyles as s } from '@/components/settings-ui';
export default function AppearanceScreen() { return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}><SettingsHeader title="Appearance" onBack={() => router.back()} /><ScrollView contentContainerStyle={s.content}><View style={s.card}><Sun size={24} color={p.accent} /><Text style={[s.profileName, { marginTop: 12 }]}>Light appearance</Text><Text style={[s.copy, { marginTop: 6 }]}>Alalay currently uses a light-only theme across the mobile experience.</Text></View><View style={[s.group, { marginTop: 18 }]}><Pressable style={[s.option, s.optionSelected]}><Text style={s.optionText}>Light</Text><Check size={18} color={p.accent} /></Pressable><View style={s.option}><Text style={[s.optionText, { color: p.muted }]}>System and Dark</Text><Text style={s.muted}>Not available yet</Text></View></View></ScrollView></SafeAreaView>; }
