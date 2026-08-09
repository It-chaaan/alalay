import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Plus, Repeat } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChipRow, DatePickerField, evaluateAmountExpression, FinanceFormSheet, FrequencyChips, billCategories, formPalette, FormTextInput, type Frequency } from '@/components/finance-form';
import { authenticatedApiRequest } from '@/services/api';

type Sub = { id: string; name: string; amount: number | string; renewal_date: string; billing_cycle: Frequency; auto_renew: boolean; logo_url?: string | null };
type Income = { amount: number | string; is_recurring: boolean; frequency?: string };

function monthly(sub: Sub) {
  const amount = Number(sub.amount);
  return sub.billing_cycle === 'weekly' ? amount * 52 / 12 : sub.billing_cycle === 'quarterly' ? amount / 3 : sub.billing_cycle === 'yearly' ? amount / 12 : amount;
}

export default function Subscriptions() {
  const [rows, setRows] = useState<Sub[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [subs, entries] = await Promise.all([authenticatedApiRequest<Sub[]>('/api/subscriptions'), authenticatedApiRequest<Income[]>('/api/income')]);
      setRows(subs);
      setIncome(entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Subscriptions could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const monthlyTotal = rows.reduce((sum, row) => sum + monthly(row), 0);
  const yearly = monthlyTotal * 12;
  const monthlyIncome = income.filter((row) => row.is_recurring).reduce((sum, row) => sum + Number(row.amount), 0);
  const percent = monthlyIncome > 0 ? monthlyTotal / monthlyIncome * 100 : null;

  const toggle = async (row: Sub) => {
    try {
      await authenticatedApiRequest(`/api/subscriptions/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auto_renew: !row.auto_renew }) });
      await refresh();
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><Pressable accessibilityLabel="Back to dashboard" onPress={() => router.back()} style={styles.back}><ArrowLeft size={21} color={formPalette.ink} /></Pressable><View style={styles.titleWrap}><Text style={styles.eyebrow}>RECURRING PAYMENTS</Text><Text style={styles.title}>Subscriptions</Text></View><View style={styles.badge}><Text style={styles.badgeText}>₱{Math.round(monthlyTotal).toLocaleString('en-PH')}/mo</Text></View></View>
    {loading ? <View style={styles.center}><ActivityIndicator color={formPalette.accent} /><Text style={styles.muted}>Loading subscriptions…</Text></View> : error ? <View style={styles.card}><Text style={styles.cardTitle}>Subscriptions unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.stats}>{[['Monthly total', `₱${Math.round(monthlyTotal).toLocaleString('en-PH')}`], ['Yearly cost', `₱${Math.round(yearly).toLocaleString('en-PH')}`], ['% of income', percent === null ? '—' : `${percent.toFixed(1)}%`]].map(([label, value]) => <View key={label} style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>)}</View>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={({ pressed }) => [styles.add, pressed && styles.pressed]}><Plus size={18} color="#fff" /><Text style={styles.addText}>Add subscription</Text></Pressable>
      {rows.length ? rows.map((row) => <View key={row.id} style={styles.subCard}><View style={styles.subTop}><View style={styles.icon}><Repeat size={20} color={formPalette.accent} /></View><View style={styles.main}><Text style={styles.name}>{row.name}</Text><Text style={styles.muted}>₱{Math.round(Number(row.amount)).toLocaleString('en-PH')}/{row.billing_cycle === 'yearly' ? 'yr' : row.billing_cycle === 'quarterly' ? 'qtr' : row.billing_cycle === 'weekly' ? 'wk' : 'mo'}</Text><Text style={styles.muted}>Renews {row.renewal_date}</Text></View><Pressable accessibilityRole="switch" accessibilityState={{ checked: row.auto_renew }} onPress={() => void toggle(row)} style={[styles.toggle, row.auto_renew && styles.toggleOn]}><View style={[styles.knob, row.auto_renew && styles.knobOn]} /></Pressable></View></View>) : <View style={styles.card}><Text style={styles.cardTitle}>No subscriptions yet</Text><Text style={styles.muted}>Add a recurring service to track renewals.</Text></View>}
    </ScrollView>}
    {open && <SubscriptionForm onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refresh(); }} />}
  </SafeAreaView>;
}

function SubscriptionForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cycle, setCycle] = useState<Frequency>('monthly');
  const [category, setCategory] = useState('Entertainment');
  const [reminder, setReminder] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const value = evaluateAmountExpression(amount);
    if (!name.trim() || value === null || value <= 0) {
      setError('Enter a service name and a valid amount.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Subscriptions currently do not have a category column in the shared schema;
      // the chips keep service selection consistent without changing that contract.
      void category;
      await authenticatedApiRequest('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), amount: value, renewal_date: date, billing_cycle: cycle, auto_renew: reminder }) });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this subscription.');
    } finally {
      setSaving(false);
    }
  };

  return <FinanceFormSheet title="Add subscription" eyebrow="SUBSCRIPTIONS" amount={amount} onAmountChange={setAmount} error={error} saving={saving} saveLabel="Save subscription" onSave={() => void save()} onClose={onClose}>
    <FormTextInput label="Service name" value={name} onChangeText={setName} placeholder="e.g. Netflix" />
    <CategoryChipRow label="Service type (optional)" value={category} onChange={setCategory} options={billCategories} />
    <DatePickerField label="Renewal date" value={date} onChange={setDate} />
    <FrequencyChips value={cycle} onChange={(value) => { if (value !== 'one-time') setCycle(value); }} />
    <View style={styles.reminder}><View style={styles.reminderCopy}><Text style={styles.reminderTitle}>Renewal reminder</Text><Text style={styles.muted}>Keep this service in your upcoming payments.</Text></View><Switch value={reminder} onValueChange={setReminder} trackColor={{ false: '#D7E1DC', true: formPalette.accent }} thumbColor="#FFFFFF" /></View>
  </FinanceFormSheet>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: formPalette.background }, header: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: formPalette.surface, borderBottomWidth: 1, borderBottomColor: formPalette.line }, back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, titleWrap: { flex: 1, marginLeft: 8 }, eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { marginTop: 3, color: formPalette.ink, fontSize: 22, fontWeight: '900' }, badge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, backgroundColor: formPalette.accentPale }, badgeText: { color: formPalette.accent, fontSize: 11, fontWeight: '900' }, content: { padding: 20, paddingBottom: 40 }, stats: { flexDirection: 'row', gap: 8, marginBottom: 14 }, stat: { flex: 1, padding: 12, borderRadius: 15, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, statLabel: { color: formPalette.muted, fontSize: 10 }, statValue: { marginTop: 6, color: formPalette.ink, fontSize: 14, fontWeight: '900' }, add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 50, marginBottom: 14, borderRadius: 25, backgroundColor: formPalette.accent }, addText: { color: '#fff', fontWeight: '900' }, subCard: { marginBottom: 11, padding: 15, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, subTop: { flexDirection: 'row', alignItems: 'center' }, icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: formPalette.accentPale }, main: { flex: 1, marginLeft: 11 }, name: { color: formPalette.ink, fontSize: 15, fontWeight: '900' }, muted: { marginTop: 4, color: formPalette.muted, fontSize: 12, lineHeight: 18 }, toggle: { width: 44, height: 26, padding: 3, justifyContent: 'center', borderRadius: 14, backgroundColor: '#D7E1DC' }, toggleOn: { backgroundColor: formPalette.accent }, knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }, knobOn: { alignSelf: 'flex-end' }, card: { margin: 20, padding: 18, borderRadius: 18, backgroundColor: formPalette.surface, borderWidth: 1, borderColor: formPalette.line }, cardTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, retry: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: formPalette.accentPale }, retryText: { color: formPalette.accent, fontSize: 12, fontWeight: '900' }, reminder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: 15, borderRadius: 17, backgroundColor: formPalette.background }, reminderCopy: { flex: 1, paddingRight: 10 }, reminderTitle: { color: formPalette.ink, fontSize: 14, fontWeight: '900' }, pressed: { opacity: 0.72 },
});
