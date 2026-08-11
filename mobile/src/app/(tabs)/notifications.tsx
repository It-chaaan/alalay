import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { markNotificationsRead } from '@/services/notifications';
import { useAppTheme } from '@/theme/theme';

export default function Notifications() {
  const { colors } = useAppTheme();
  markNotificationsRead();

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
    <FinancialScreenHeader title="Notifications" onBack={() => router.back()} />
    <GlassSurface style={styles.card} padding={22}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}><Bell size={30} color={colors.primary} strokeWidth={1.9} /></View>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>You’re all caught up</Text>
      <Text style={[styles.copy, { color: colors.textSecondary }]}>New bill reminders and account updates will appear here.</Text>
    </GlassSurface>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  card: { margin: 20, alignItems: 'center', borderRadius: 24 },
  iconCircle: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 31 },
  cardTitle: { marginTop: 14, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  copy: { maxWidth: 280, marginTop: 8, textAlign: 'center', fontSize: 13, lineHeight: 20 },
});
