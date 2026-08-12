import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { fetchNotifications, markNotificationsRead, type InAppNotification } from '@/services/notifications';
import { useAppTheme } from '@/theme/theme';

export default function Notifications() {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<InAppNotification[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const rows = await fetchNotifications(); setItems(rows); if (rows.some((row) => !row.read_at)) { await markNotificationsRead(); setItems(rows.map((row) => ({ ...row, read_at: row.read_at ?? new Date().toISOString() }))); } } catch (e) { setError(e instanceof Error ? e.message : 'Notifications could not load.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}><FinancialScreenHeader title="Notifications" onBack={() => router.back()} /><ScrollView contentContainerStyle={styles.content}>{loading ? <GlassSurface style={styles.card} padding={22}><ActivityIndicator color={colors.primary} /><Text style={[styles.copy, { color: colors.textSecondary }]}>Loading notifications…</Text></GlassSurface> : error ? <GlassSurface style={styles.card} padding={22}><Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Notifications unavailable</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={[styles.retry, { color: colors.primary }]}>Try again</Text></Pressable></GlassSurface> : items.length ? items.map((item) => <GlassSurface key={item.id} style={[styles.item, { borderColor: colors.border }]} padding={16}><View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}><Bell size={20} color={colors.primary} strokeWidth={1.9} /></View><View style={styles.itemCopy}><Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>{item.body}</Text><Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(item.created_at)}</Text></View></GlassSurface>) : <GlassSurface style={styles.card} padding={22}><View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}><Bell size={30} color={colors.primary} strokeWidth={1.9} /></View><Text style={[styles.cardTitle, { color: colors.textPrimary }]}>You’re all caught up</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>New bill reminders and account updates will appear here.</Text></GlassSurface>}</ScrollView></SafeAreaView>;
}

function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value.slice(0, 10) : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date); }
const styles = StyleSheet.create({ safe: { flex: 1 }, content: { padding: 20, paddingBottom: 40 }, card: { marginBottom: 16, alignItems: 'center', borderRadius: 24 }, item: { flexDirection: 'row', marginBottom: 10, borderRadius: 20, borderWidth: 1 }, itemCopy: { flex: 1, marginLeft: 12 }, iconCircle: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26 }, cardTitle: { marginTop: 14, fontSize: 18, fontWeight: '900', textAlign: 'center' }, itemTitle: { fontSize: 15, fontWeight: '900' }, copy: { maxWidth: 280, marginTop: 8, fontSize: 13, lineHeight: 20 }, date: { marginTop: 8, fontSize: 11, fontWeight: '700' }, retry: { marginTop: 16, fontSize: 13, fontWeight: '900' } });
