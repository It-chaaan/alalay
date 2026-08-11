import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Moon, Sun } from 'lucide-react-native';
import { SettingsHeader } from '@/components/settings-ui';
import { useAppTheme, type AppearancePreference } from '@/theme/theme';

const options: { value: AppearancePreference; label: string; description: string }[] = [
  { value: 'system', label: 'System', description: 'Follow your device appearance' },
  { value: 'light', label: 'Light', description: 'Use the light Alalay theme' },
  { value: 'dark', label: 'Dark', description: 'Use the dark Alalay theme' },
];

export default function AppearanceScreen() {
  const { preference, resolvedTheme, colors, setPreference } = useAppTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}><SettingsHeader title="Appearance" onBack={() => router.back()} /><ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}><View style={{ padding: 18, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accentPale }}>{resolvedTheme === 'dark' ? <Moon size={21} color={colors.accent} /> : <Sun size={21} color={colors.accent} />}</View><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900' }}>Appearance</Text><Text style={{ marginTop: 4, color: colors.muted, fontSize: 12 }}>Choose how Alalay looks across the app.</Text></View></View></View><View style={{ marginTop: 18, overflow: 'hidden', borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>{options.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected: preference === option.value }} onPress={() => void setPreference(option.value)} style={({ pressed }) => [{ minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: option.value === 'dark' ? 0 : 1, borderBottomColor: colors.line }, pressed && { opacity: 0.72 }]}><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>{option.label}</Text><Text style={{ marginTop: 3, color: colors.muted, fontSize: 11 }}>{option.description}</Text></View>{preference === option.value ? <Check size={18} color={colors.accent} /> : null}</Pressable>)}</View></ScrollView></SafeAreaView>;
}
