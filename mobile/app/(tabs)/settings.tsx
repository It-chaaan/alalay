import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const palette = { background: '#F4F7F1', surface: '#FFFFFF', ink: '#11231C', muted: '#5D6C65', accent: '#0F8A6B', line: '#DCE8E0' };

export default function SettingsScreen() {
  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><ArrowLeft size={21} color={palette.ink} /></Pressable>
      <View style={styles.titleWrap}><Text style={styles.eyebrow}>ALALAY</Text><Text style={styles.title}>Settings</Text></View>
      <View style={styles.iconCircle}><SettingsIcon size={21} color={palette.accent} /></View>
    </View>
    <View style={styles.body}><Text style={styles.bodyTitle}>Your preferences</Text><Text style={styles.bodyCopy}>Profile, notifications, security, and app preferences will live here.</Text></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.line },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  titleWrap: { flex: 1, marginLeft: 8 },
  eyebrow: { color: palette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 3, color: palette.ink, fontSize: 24, fontWeight: '900' },
  iconCircle: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#D8EFE2' },
  body: { margin: 20, padding: 18, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  bodyTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  bodyCopy: { marginTop: 8, color: palette.muted, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.76 },
});
