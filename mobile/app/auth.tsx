import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AuthPlaceholderScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isDark = useColorScheme() === 'dark';
  const background = isDark ? '#092018' : '#F4F7F1';
  const ink = isDark ? '#F4FAF6' : '#11231C';
  const muted = isDark ? '#B8CAC0' : '#5D6C65';

  const isCreate = mode === 'create';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.content}>
        <Text style={[styles.eyebrow, { color: '#0F8A6B' }]}>ALALAY</Text>
        <Text style={[styles.title, { color: ink }]}>{isCreate ? 'Create your account' : 'Welcome back'}</Text>
        <Text style={[styles.description, { color: muted }]}>The mobile account flow is the next step to connect here. This landing-page action is ready for that route.</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}>
        <Text style={[styles.backLabel, { color: ink }]}>Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, padding: 28 },
  content: { flex: 1, justifyContent: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { marginTop: 12, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8 },
  description: { marginTop: 14, maxWidth: 330, fontSize: 16, lineHeight: 23 },
  backButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#0F8A6B' },
  backLabel: { fontSize: 15, fontWeight: '700' },
  backPressed: { opacity: 0.72 },
});
