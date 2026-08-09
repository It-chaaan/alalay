import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DatePickerField, evaluateAmountExpression, FinanceFormSheet, FormTextInput, formPalette } from '@/components/finance-form';
import { authenticatedApiRequest } from '@/services/api';

type Goal = { id: string; title: string; emoji?: string; target_amount: number | string; current_amount: number | string; deadline: string; completed_at?: string | null };
type Dashboard = { overview: { totalSavings: number; goalSavings: number; activeGoals: number; monthlyContribution: number }; goals: Goal[] };

const goalIcons = ['🎯', '✈️', '🏠', '🚗', '💻', '🎓', '💍', '🛍️', '🩺', '🐾', '🌴', '💰'];
const peso = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;

export default function Savings() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await authenticatedApiRequest<Dashboard>('/api/savings-goals/summary'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Savings could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const contribute = async (goal: Goal) => {
    const current = Number(goal.current_amount);
    Alert.prompt?.('Add money', `How much would you like to add to ${goal.title}?`, async (value) => {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) return;
      try {
        await authenticatedApiRequest(`/api/savings-goals/${goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_amount: Math.min(Number(goal.target_amount), current + amount) }) });
        await refresh();
      } catch (e) {
        Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again.');
      }
    });
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><Pressable accessibilityLabel="Back to dashboard" onPress={() => router.back()} style={styles.back}><ArrowLeft size={21} color={formPalette.ink} /></Pressable><View style={styles.titleWrap}><Text style={styles.eyebrow}>BUILD YOUR PLAN</Text><Text style={styles.title}>Savings</Text></View><Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={({ pressed }) => [styles.add, pressed && styles.pressed]}><Plus size={18} color="#fff" /><Text style={styles.addText}>Create goal</Text></Pressable></View>
    {loading ? <View style={styles.center}><ActivityIndicator color={formPalette.accent} /><Text style={styles.muted}>Loading savings…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Savings unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.stats}>{[['Total savings', peso(data?.overview.totalSavings ?? 0)], ['Goal savings', peso(data?.overview.goalSavings ?? 0)], ['Active goals', String(data?.overview.activeGoals ?? 0)], ['Monthly contribution', peso(data?.overview.monthlyContribution ?? 0)]].map(([label, value]) => <View key={label} style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>)}</View>
      {data?.goals?.length ? data.goals.map((goal) => { const percent = Math.min(100, Math.round(Number(goal.current_amount) / Math.max(1, Number(goal.target_amount)) * 100)); return <View key={goal.id} style={styles.goal}><View style={styles.goalHead}><Text style={styles.emoji}>{goal.emoji || '🎯'}</Text><View style={styles.main}><Text style={styles.goalName}>{goal.title}</Text><Text style={styles.muted}>Due {goal.deadline}</Text></View><Text style={styles.percent}>{percent}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View><View style={styles.goalBottom}><Text style={styles.muted}>{peso(Number(goal.current_amount))} / {peso(Number(goal.target_amount))}</Text><Pressable onPress={() => void contribute(goal)} style={styles.money}><Text style={styles.moneyText}>Add money</Text></Pressable></View></View>; }) : <View style={styles.card}><Text style={styles.cardTitle}>No savings goals yet</Text><Text style={styles.muted}>Create a goal to start building your plan.</Text></View>}
    </ScrollView>}
    {open && <GoalForm onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refresh(); }} />}
  </SafeAreaView>;
}

function GoalEmojiPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <View style={styles.picker}><Text style={styles.pickerLabel}>Choose an icon</Text><View style={styles.iconGrid}>{goalIcons.map((icon) => <Pressable key={icon} accessibilityRole="button" accessibilityState={{ selected: value === icon }} onPress={() => onChange(icon)} style={({ pressed }) => [styles.iconChoice, value === icon && styles.iconChoiceActive, pressed && styles.pressed]}><Text style={styles.iconChoiceText}>{icon}</Text></Pressable>)}</View></View>;
}

function GoalForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [emoji, setEmoji] = useState('🎯');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const value = evaluateAmountExpression(target);
    if (!title.trim() || value === null || value <= 0) {
      setError('Enter a goal name and a valid target.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await authenticatedApiRequest('/api/savings-goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), emoji, target_amount: value, current_amount: 0, deadline: date }) });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this goal.');
    } finally {
      setSaving(false);
    }
  };

  return <FinanceFormSheet title="Create goal" eyebrow="SAVINGS PLAN" amount={target} onAmountChange={setTarget} error={error} saving={saving} saveLabel="Save goal" onSave={() => void save()} onClose={onClose}>
    <View style={styles.goalNameRow}><View style={styles.selectedIcon}><Text style={styles.selectedIconText}>{emoji}</Text></View><View style={styles.goalNameInput}><FormTextInput label="Goal name" value={title} onChangeText={setTitle} placeholder="e.g. Baguio weekend" /></View></View>
    <GoalEmojiPicker value={emoji} onChange={setEmoji} />
    <DatePickerField label="Due date" value={date} onChange={setDate} />
  </FinanceFormSheet>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: formPalette.background }, header: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line }, back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, titleWrap: { flex: 1, marginLeft: 8 }, eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { marginTop: 3, color: formPalette.ink, fontSize: 23, fontWeight: '900' }, add: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 10, borderRadius: 18, backgroundColor: formPalette.accent }, addText: { color: '#fff', fontWeight: '900' }, content: { padding: 20, paddingBottom: 40 }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 }, stat: { width: '48%', padding: 13, borderRadius: 15, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, statLabel: { color: formPalette.muted, fontSize: 10 }, statValue: { marginTop: 6, color: formPalette.ink, fontSize: 15, fontWeight: '900' }, goal: { marginBottom: 12, padding: 16, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, goalHead: { flexDirection: 'row', alignItems: 'center' }, emoji: { fontSize: 26 }, main: { flex: 1, marginLeft: 10 }, goalName: { color: formPalette.ink, fontSize: 15, fontWeight: '900' }, percent: { color: formPalette.accent, fontWeight: '900' }, track: { height: 8, marginTop: 14, overflow: 'hidden', borderRadius: 4, backgroundColor: formPalette.accentPale }, fill: { height: '100%', borderRadius: 4, backgroundColor: formPalette.accent }, goalBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }, money: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, backgroundColor: formPalette.accentPale }, moneyText: { color: formPalette.accent, fontSize: 11, fontWeight: '900' }, muted: { marginTop: 5, color: formPalette.muted, fontSize: 12, lineHeight: 18 }, card: { margin: 20, padding: 18, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, cardTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, retry: { alignSelf: 'flex-start', marginTop: 14, padding: 10, borderRadius: 15, backgroundColor: formPalette.accentPale }, retryText: { color: formPalette.accent, fontWeight: '900' }, picker: { marginTop: 15 }, pickerLabel: { marginBottom: 9, color: formPalette.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }, iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, iconChoice: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: formPalette.background }, iconChoiceActive: { backgroundColor: formPalette.accentPale, borderWidth: 1, borderColor: formPalette.accent }, iconChoiceText: { fontSize: 24 }, goalNameRow: { flexDirection: 'row', alignItems: 'flex-start' }, selectedIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', marginTop: 23, borderRadius: 18, backgroundColor: formPalette.accentPale }, selectedIconText: { fontSize: 31 }, goalNameInput: { flex: 1, marginLeft: 11 }, pressed: { opacity: 0.72 },
});
