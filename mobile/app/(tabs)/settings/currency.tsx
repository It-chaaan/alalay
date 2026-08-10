import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Check, CircleDollarSign } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsHeader, settingsPalette as p, settingsStyles as s } from '@/components/settings-ui';
export default function CurrencyScreen() { return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}><SettingsHeader title="Currency" onBack={() => router.back()} /><ScrollView contentContainerStyle={s.content}><View style={s.card}><CircleDollarSign size={24} color={p.accent} /><Text style={[s.profileName, { marginTop: 12 }]}>PHP · Philippine Peso</Text><Text style={[s.copy, { marginTop: 6 }]}>PHP is the supported transaction currency for the current finance experience.</Text></View><View style={[s.group, { marginTop: 18 }]}><Pressable style={[s.option, s.optionSelected]}><Text style={s.optionText}>PHP — Philippine Peso (₱)</Text><Check size={18} color={p.accent} /></Pressable></View></ScrollView></SafeAreaView>; }
