import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { ArrowUpRight, BarChart3, Camera, Droplets, FileText, Home, PiggyBank, Receipt, Repeat, ScanLine, ShoppingBag, Utensils, UserCircle, WalletCards, X } from 'lucide-react-native';

import { AlalayChatHead } from '@/components/alalay-chat-head';
import { authenticatedApiRequest } from '@/services/api';
import { derivedStatus, fetchFinanceItems, type FinanceItem } from '@/services/finance';
import { getSupabaseClient } from '@/services/supabase';
import { getUnreadNotificationCount } from '@/services/notifications';

const palette = {
  background: '#F4F7F1',
  surface: '#FFFFFF',
  ink: '#11231C',
  muted: '#5D6C65',
  accent: '#0F8A6B',
  accentDark: '#08654E',
  accentSoft: '#93CFB6',
  accentPale: '#D8EFE2',
  line: '#DCE8E0',
  danger: '#B42318',
  warning: '#B7791F',
};

const goals = [
  { key: 'emergency', name: 'Emergency Fund', saved: '₱67,500', target: '₱100,000', percent: 68, color: palette.accent },
  { key: 'travel', name: 'Baguio Weekend', saved: '₱12,000', target: '₱20,000', percent: 60, color: '#5E9BC5' },
];

const recentExpenses = [
  { name: 'Lunch at Salcedo', category: 'Food & dining · Today', amount: '−₱380', icon: Utensils },
  { name: 'Grocery run', category: 'Essentials · Aug 7', amount: '−₱2,145', icon: ShoppingBag },
  { name: 'Grab ride', category: 'Transport · Aug 6', amount: '−₱240', icon: ArrowUpRight },
];

type Icon = typeof Home;
type SummarySlide = { key: string; eyebrow: string; title: string; amount: string; detailLabel: string; detail: string; secondaryLabel: string; secondary: string; icon: Icon };
type QuickAddAction = 'bill' | 'subscription' | 'expense' | 'ocr' | 'savings';

function formatPeso(value: number) {
  return `₱${Math.round(value).toLocaleString('en-PH')}`;
}

function buildSummarySlides(items: FinanceItem[], monthlyExpenses: number): SummarySlide[] {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const unpaid = items.filter((item) => !item.paid);
  const monthItems = unpaid.filter((item) => item.dueDate.slice(0, 7) === currentMonth);
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const dueThisWeek = unpaid.filter((item) => {
    const date = new Date(`${item.dueDate}T12:00:00`);
    return date >= today && date <= weekEnd;
  }).length;
  const totalBills = monthItems.reduce((sum, item) => sum + item.amount, 0);
  return [
    { key: 'bills', eyebrow: 'MONTHLY OVERVIEW', title: 'Total bills this month', amount: formatPeso(totalBills), detailLabel: 'Due this week', detail: `${dueThisWeek} ${dueThisWeek === 1 ? 'bill' : 'bills'}`, secondaryLabel: 'Monthly expenses', secondary: formatPeso(monthlyExpenses), icon: FileText },
    { key: 'spending', eyebrow: 'INCOME & SPENDING', title: 'Current commitments', amount: formatPeso(totalBills), detailLabel: 'Open bills', detail: `${unpaid.length}`, secondaryLabel: 'Monthly expenses', secondary: formatPeso(monthlyExpenses), icon: WalletCards },
    { key: 'savings', eyebrow: 'SAVINGS SNAPSHOT', title: 'Keep your plan moving', amount: formatPeso(totalBills), detailLabel: 'Due this month', detail: `${monthItems.length}`, secondaryLabel: 'Bills and subscriptions', secondary: formatPeso(totalBills), icon: PiggyBank },
  ];
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [summaryIndex, setSummaryIndex] = useState(0);
  const [financeItems, setFinanceItems] = useState<FinanceItem[]>([]);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState('');
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [firstName, setFirstName] = useState('there');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(() => getUnreadNotificationCount());
  const cardWidth = Math.max(260, width - 48);
  const summarySlides = buildSummarySlides(financeItems, monthlyExpenses);

  const refreshFinance = useCallback(async () => {
    setFinanceLoading(true);
    setFinanceError('');
    try {
      const [items, dashboard] = await Promise.all([
        fetchFinanceItems(),
        authenticatedApiRequest<{ monthly_expenses: number }>('/api/dashboard/summary'),
      ]);
      setFinanceItems(items);
      setMonthlyExpenses(Number(dashboard.monthly_expenses) || 0);
    } catch (error) {
      setFinanceError(error instanceof Error ? error.message : 'Bills could not load.');
    } finally {
      setFinanceLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted || !data.user) return;
      const metadata = data.user.user_metadata ?? {};
      const candidate = [metadata.first_name, metadata.given_name, metadata.full_name, metadata.name].find((value) => typeof value === 'string' && value.trim());
      const fallback = data.user.email?.split('@')[0];
      void authenticatedApiRequest<{ name?: string | null; avatar_url?: string | null }>('/api/users/me').then((profile) => {
        const profileName = profile.name?.trim();
        setProfileAvatar(profile.avatar_url ?? null);
        setFirstName((profileName || (typeof candidate === 'string' ? candidate : '') || fallback || 'there').split(' ')[0]);
      }).catch(() => setFirstName(((typeof candidate === 'string' ? candidate : '') || fallback || 'there').split(' ')[0]));
    });
    return () => { mounted = false; };
  }, []);

  useFocusEffect(useCallback(() => { void refreshFinance(); }, [refreshFinance]));
  useFocusEffect(useCallback(() => { setUnreadNotifications(getUnreadNotificationCount()); }, []));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 132 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.date}>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</Text>
            <Text accessibilityRole="header" style={styles.greeting}><Text style={styles.greetingPrefix}>{getGreeting()} </Text><Text style={styles.greetingName}>{firstName}!</Text></Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open profile" style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/profile')}>{profileAvatar ? <Image source={profileAvatar} style={styles.profileImage} contentFit="cover" /> : <UserCircle size={27} color={palette.ink} strokeWidth={1.7} />}{unreadNotifications > 0 && <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadNotifications}</Text></View>}</Pressable>
            {/* legacy notification/settings controls removed; profile owns both destinations */}
          </View>
          {/*
            <Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={() => Alert.alert('Notifications', 'You’re all caught up.') }>
              <Bell size={21} color={palette.ink} strokeWidth={1.8} />
              <View style={styles.notificationDot} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/settings')}>
              <Settings size={21} color={palette.ink} strokeWidth={1.8} />
            </Pressable>
          */}
        </View>

        <View style={styles.summaryHintRow}><Text style={styles.sectionHint}>Swipe to explore</Text></View>
        <FlatList
          data={summarySlides}
          horizontal
          pagingEnabled
          snapToInterval={cardWidth}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          getItemLayout={(_, index) => ({ length: cardWidth, offset: cardWidth * index, index })}
          renderItem={({ item }) => <SummaryCard slide={item} width={cardWidth} />}
          onMomentumScrollEnd={(event) => setSummaryIndex(Math.round(event.nativeEvent.contentOffset.x / cardWidth))}
        />
        <Pagination count={summarySlides.length} activeIndex={summaryIndex} />
        <View style={styles.shortcutRow}><Shortcut icon={Receipt} label="Bills" onPress={() => router.push('/(tabs)/bills')} /><Shortcut icon={Repeat} label="Subscription" onPress={() => router.push('/(tabs)/subscriptions')} /><Shortcut icon={PiggyBank} label="Savings" onPress={() => router.push('/(tabs)/savings')} /></View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Savings goals</Text><Text style={styles.sectionHint}>2 goals</Text></View>
        <FlatList
          data={goals}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.goalList}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => <SavingsGoalCard goal={item} />}
        />

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Upcoming</Text><Text style={styles.sectionHint}>{financeItems.length} items</Text></View>
        <View style={styles.listCard}>{financeLoading ? <View style={styles.inlineState}><ActivityIndicator color={palette.accent} /><Text style={styles.stateText}>Loading bills…</Text></View> : financeError ? <View style={styles.inlineState}><Text style={styles.errorText}>{financeError}</Text></View> : financeItems.length ? financeItems.slice(0, 5).map((item) => <FinanceRow key={`${item.source}-${item.id}`} item={item} />) : <View style={styles.inlineState}><Text style={styles.stateTitle}>No bills yet</Text><Text style={styles.stateText}>Use Add to create your first bill or subscription.</Text></View>}</View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent expenses</Text><Pressable accessibilityRole="button" onPress={() => Alert.alert('Expenses', 'Expense history is coming next.')}><Text style={styles.link}>See all</Text></Pressable></View>
        <View style={styles.listCard}>{recentExpenses.map((expense) => <ExpenseRow key={expense.name} expense={expense} />)}</View>

      </ScrollView>

      <BottomNav bottom={12 + insets.bottom} />
      <AlalayChatHead />
    </SafeAreaView>
  );
}

function SummaryCard({ slide, width }: { slide: SummarySlide; width: number }) {
  const SlideIcon = slide.icon;
  return <View style={[styles.summaryCard, { width }]}>
    <View style={styles.summaryOrb} /><View style={styles.summaryOrbSmall} />
    <View style={styles.summaryTop}><Text style={styles.summaryEyebrow}>{slide.eyebrow}</Text><SlideIcon size={20} color="#D8EFE2" strokeWidth={1.8} /></View>
    <Text style={styles.summaryTitle}>{slide.title}</Text><Text style={styles.summaryAmount}>{slide.amount}</Text>
    <View style={styles.summaryStats}><View><Text style={styles.summaryStatLabel}>{slide.detailLabel}</Text><Text style={styles.summaryStatValue}>{slide.detail}</Text></View><View style={styles.summaryDivider} /><View><Text style={styles.summaryStatLabel}>{slide.secondaryLabel}</Text><Text style={styles.summaryStatValue}>{slide.secondary}</Text></View></View>
  </View>;
}

function Pagination({ count, activeIndex }: { count: number; activeIndex: number }) {
  return <View style={styles.pagination} accessibilityRole="tablist">{Array.from({ length: count }, (_, index) => <View key={index} style={[styles.paginationDot, index === activeIndex ? styles.paginationActive : styles.paginationInactive]} />)}</View>;
}

function SavingsGoalCard({ goal }: { goal: typeof goals[number] }) {
  return <View style={styles.goalCard}>
    <View style={styles.goalTop}><View style={styles.goalIcon}><PiggyBank size={20} color={goal.color} strokeWidth={1.8} /></View><View style={styles.goalHeading}><Text style={styles.goalName}>{goal.name}</Text><Text style={styles.goalAmount}>{goal.saved} <Text style={styles.goalTarget}>of {goal.target}</Text></Text></View><ProgressRing percent={goal.percent} color={goal.color} /></View>
    <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${goal.percent}%`, backgroundColor: goal.color }]} /></View>
    <View style={styles.goalFooter}><Text style={styles.goalMomentum}>You’re {goal.percent}% there — keep going</Text><ArrowUpRight size={15} color={goal.color} strokeWidth={2} /></View>
  </View>;
}

function ProgressRing({ percent, color }: { percent: number; color: string }) {
  const radius = 21; const circumference = 2 * Math.PI * radius;
  return <View style={styles.ring}><Svg width={56} height={56} viewBox="0 0 56 56"><Circle cx="28" cy="28" r={radius} fill="none" stroke={palette.accentPale} strokeWidth="6" /><Circle cx="28" cy="28" r={radius} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - percent / 100)} rotation="-90" origin="28, 28" /></Svg><Text style={[styles.ringText, { color }]}>{percent}%</Text></View>;
}

function FinanceRow({ item }: { item: FinanceItem }) {
  const status = derivedStatus(item);
  const icon = item.source === 'subscription' ? Repeat : item.category.toLowerCase().includes('water') ? Droplets : FileText;
  const FinanceIcon = icon;
  return <View style={styles.row}><View style={styles.rowIcon}><FinanceIcon size={18} color={status === 'Overdue' ? palette.danger : palette.accent} strokeWidth={1.8} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{item.source === 'subscription' ? 'Subscription' : item.category} · Due {item.dueDate}</Text></View><View style={styles.rowRight}><Text style={styles.rowAmount}>{formatPeso(item.amount)}</Text><Text style={[styles.status, status === 'Overdue' ? styles.statusDanger : status === 'Paid' ? styles.statusPaid : styles.statusUpcoming]}>{status}</Text></View></View>;
}

function ExpenseRow({ expense }: { expense: typeof recentExpenses[number] }) {
  const ExpenseIcon = expense.icon;
  return <View style={styles.row}><View style={styles.rowIcon}><ExpenseIcon size={18} color={palette.accent} strokeWidth={1.8} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{expense.name}</Text><Text style={styles.rowMeta}>{expense.category}</Text></View><Text style={styles.expenseAmount}>{expense.amount}</Text></View>;
}

const quickAddItems: { action: QuickAddAction; icon: Icon; label: string }[] = [
  { action: 'bill', icon: FileText, label: 'Add bill' },
  { action: 'subscription', icon: Repeat, label: 'Add subscription' },
  { action: 'expense', icon: WalletCards, label: 'Add expense' },
  { action: 'ocr', icon: ScanLine, label: 'Scan receipt (OCR)' },
  { action: 'savings', icon: PiggyBank, label: 'Add savings' },
];

function AddMenu({ bottom, screenWidth, onSelect }: { bottom: number; screenWidth: number; onSelect: (action: QuickAddAction) => void }) {
  const menuWidth = Math.min(272, screenWidth - 24);
  const cellWidth = Math.floor((menuWidth - 36) / 2);
  return <View style={[styles.addMenu, { bottom }]}>
    <Text style={styles.addMenuTitle}>What would you like to add?</Text>
    <View style={[styles.addGrid, { width: menuWidth - 28 }]}>{quickAddItems.map((item) => <AddMenuItem key={item.action} cellWidth={cellWidth} icon={item.icon} label={item.label} onPress={() => onSelect(item.action)} />)}</View>
  </View>;
}

function AddMenuItem({ cellWidth, icon: IconComponent, label, onPress }: { cellWidth: number; icon: Icon; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.addMenuItem, { width: cellWidth }, pressed && styles.pressed]}><IconComponent size={20} color={palette.accent} strokeWidth={1.8} /><Text style={styles.addMenuLabel}>{label}</Text></Pressable>;
}

const quickAddTitles: Record<Exclude<QuickAddAction, 'ocr'>, string> = {
  bill: 'Add bill',
  subscription: 'Add subscription',
  expense: 'Add expense',
  savings: 'Add savings goal',
};

function QuickAddForm({ action, onClose, onSaved }: { action: Exclude<QuickAddAction, 'ocr'>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(action === 'expense' ? 'General' : 'Utilities');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [currentAmount, setCurrentAmount] = useState('');
  const [cycle, setCycle] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const parsedAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a name and a valid amount.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (action === 'bill') {
        await authenticatedApiRequest('/api/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), amount: parsedAmount, category: category.trim() || 'General', due_date: date, recurring: false, status: 'unpaid' }) });
      } else if (action === 'subscription') {
        await authenticatedApiRequest('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: title.trim(), amount: parsedAmount, renewal_date: date, billing_cycle: cycle, auto_renew: true }) });
      } else if (action === 'expense') {
        await authenticatedApiRequest('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchant: title.trim(), amount: parsedAmount, category: category.trim() || 'General', date, payment_method: 'cash' }) });
      } else {
        const current = currentAmount ? Number(currentAmount) : 0;
        if (!Number.isFinite(current) || current < 0 || current > parsedAmount) {
          setError('Current amount must be between ₱0 and the target.');
          return;
        }
        await authenticatedApiRequest('/api/savings-goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), target_amount: parsedAmount, current_amount: current, deadline: date }) });
      }
      Alert.alert('Saved', `${quickAddTitles[action]} added successfully.`);
      await onSaved();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save this yet.');
    } finally {
      setSaving(false);
    }
  };

  return <View style={styles.formOverlay}>
    <Pressable accessibilityLabel="Close add form" onPress={onClose} style={styles.formDismiss} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formKeyboard}>
      <ScrollView contentContainerStyle={styles.formCard} keyboardShouldPersistTaps="handled">
        <View style={styles.formHeader}><View><Text style={styles.formEyebrow}>QUICK ADD</Text><Text style={styles.formTitle}>{quickAddTitles[action]}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.formClose}><X size={20} color={palette.ink} /></Pressable></View>
        <TextInput accessibilityLabel={action === 'expense' ? 'Merchant' : 'Name'} value={title} onChangeText={setTitle} placeholder={action === 'expense' ? 'Merchant' : action === 'subscription' ? 'Subscription name' : action === 'savings' ? 'Goal name' : 'Bill name'} placeholderTextColor={palette.muted} style={styles.formInput} />
        <TextInput accessibilityLabel={action === 'savings' ? 'Target amount' : 'Amount'} value={amount} onChangeText={setAmount} placeholder={action === 'savings' ? 'Target amount (₱)' : 'Amount (₱)'} placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={styles.formInput} />
        {(action === 'bill' || action === 'expense') && <TextInput accessibilityLabel="Category" value={category} onChangeText={setCategory} placeholder="Category" placeholderTextColor={palette.muted} style={styles.formInput} />}
        {action === 'subscription' && <View style={styles.cycleRow}>{(['monthly', 'weekly', 'quarterly', 'yearly'] as const).map((value) => <Pressable key={value} accessibilityRole="button" onPress={() => setCycle(value)} style={[styles.cycleChip, cycle === value && styles.cycleChipActive]}><Text style={[styles.cycleText, cycle === value && styles.cycleTextActive]}>{value}</Text></Pressable>)}</View>}
        {action === 'savings' && <TextInput accessibilityLabel="Current amount" value={currentAmount} onChangeText={setCurrentAmount} placeholder="Current amount (optional)" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={styles.formInput} />}
        <TextInput accessibilityLabel={action === 'subscription' ? 'Renewal date' : action === 'savings' ? 'Goal deadline' : action === 'bill' ? 'Due date' : 'Expense date'} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={styles.formInput} />
        {Boolean(error) && <Text style={styles.formError}>{error}</Text>}
        <Pressable accessibilityRole="button" disabled={saving} onPress={submit} style={({ pressed }) => [styles.formSubmit, saving && styles.formSubmitDisabled, pressed && styles.pressed]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.formSubmitText}>Save</Text>}</Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

function BottomNav({ bottom }: { bottom: number }) {
  return <View style={[styles.bottomNav, { bottom }]}><NavItem icon={Home} label="Home" active onPress={() => router.replace('/(tabs)')} /><NavItem icon={ArrowUpRight} label="Income" onPress={() => router.push('/(tabs)/income')} /><Pressable accessibilityRole="button" accessibilityLabel="Open OCR scanner" onPress={() => router.push('/(tabs)/ocr')} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Camera size={25} color="#FFFFFF" strokeWidth={2} /></Pressable><NavItem icon={WalletCards} label="Budget" onPress={() => router.push('/(tabs)/budget')} /><NavItem icon={BarChart3} label="Reports" onPress={() => Alert.alert('Reports', 'Reports are coming next.')} /></View>;
}

function NavItem({ icon: IconComponent, label, active = false, onPress }: { icon: Icon; label: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><IconComponent size={20} color={active ? palette.accent : palette.muted} strokeWidth={active ? 2.1 : 1.7} /><Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>{active && <View style={styles.navDot} />}</Pressable>;
}

function getGreeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(new Date()));
  return hour >= 5 && hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';
}

function Shortcut({ icon: IconComponent, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}><View style={styles.shortcutIcon}><IconComponent size={20} color={palette.accent} strokeWidth={1.8} /></View><Text style={styles.shortcutLabel}>{label}</Text></Pressable>;
}

function ProfilePanel({ onClose, onNotifications }: { onClose: () => void; onNotifications: () => void }) {
  return <View style={styles.panelOverlay}><Pressable accessibilityLabel="Close profile menu" onPress={onClose} style={styles.panelDismiss} /><View style={styles.profilePanel}><Text style={styles.panelEyebrow}>ACCOUNT</Text><Text style={styles.panelTitle}>Your Alalay account</Text><Pressable style={styles.panelRow} onPress={() => { onClose(); router.push('/(tabs)/profile'); }}><UserCircle size={21} color={palette.accent} /><Text style={styles.panelRowText}>Profile</Text></Pressable><Pressable style={styles.panelRow} onPress={() => { onNotifications(); onClose(); router.push('/(tabs)/notifications'); }}><Text style={styles.panelBadge}>1</Text><Text style={styles.panelRowText}>Notifications</Text></Pressable><Pressable style={styles.panelRow} onPress={() => { onClose(); router.push('/(tabs)/settings'); }}><Text style={styles.panelGear}>⚙</Text><Text style={styles.panelRowText}>Settings</Text></Pressable></View></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: 24, paddingTop: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetingBlock: { width: '72%' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  date: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  greeting: { marginTop: 8, color: palette.ink, lineHeight: 34, letterSpacing: -0.7 },
  greetingPrefix: { fontSize: 22, fontWeight: '600' },
  greetingName: { fontSize: 29, fontWeight: '900' },
  profileButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  profileImage: { width: 44, height: 44, borderRadius: 22 },
  notificationBadge: { position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D92D20' },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: palette.accent },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  summaryHintRow: { alignItems: 'flex-end', marginTop: 12, marginBottom: 6 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionHint: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  link: { color: palette.accent, fontSize: 13, fontWeight: '800' },
  summaryCard: { height: 190, overflow: 'hidden', padding: 19, borderRadius: 22, backgroundColor: palette.accent, position: 'relative' },
  summaryOrb: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -55, top: -60, backgroundColor: 'rgba(255,255,255,0.09)' },
  summaryOrbSmall: { position: 'absolute', width: 80, height: 80, borderRadius: 40, right: 36, bottom: -35, backgroundColor: 'rgba(255,255,255,0.08)' },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryEyebrow: { color: '#D8EFE2', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  summaryTitle: { marginTop: 15, color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  summaryAmount: { marginTop: 2, color: '#FFFFFF', fontSize: 31, fontWeight: '900', letterSpacing: -1 },
  summaryStats: { flexDirection: 'row', alignItems: 'center', marginTop: 17 },
  summaryStatLabel: { color: '#BFE3D0', fontSize: 10, fontWeight: '600' },
  summaryStatValue: { marginTop: 3, color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  summaryDivider: { width: 1, height: 30, marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.28)' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 22 },
  paginationDot: { height: 6, borderRadius: 3 },
  paginationActive: { width: 24, backgroundColor: palette.accent },
  paginationInactive: { width: 6, backgroundColor: '#B8C8BF' },
  shortcutRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  shortcut: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 15, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  shortcutIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accentPale },
  shortcutLabel: { marginTop: 6, color: palette.ink, fontSize: 11, fontWeight: '800' },
  goalList: { gap: 12 },
  goalCard: { width: 306, padding: 17, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, shadowColor: '#063224', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  goalTop: { flexDirection: 'row', alignItems: 'center' },
  goalIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accentPale },
  goalHeading: { flex: 1, marginLeft: 11 },
  goalName: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  goalAmount: { marginTop: 4, color: palette.ink, fontSize: 14, fontWeight: '800' },
  goalTarget: { color: palette.muted, fontWeight: '500' },
  ring: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', fontSize: 11, fontWeight: '900' },
  goalTrack: { height: 8, marginTop: 17, overflow: 'hidden', borderRadius: 4, backgroundColor: palette.accentPale },
  goalFill: { height: '100%', borderRadius: 4 },
  goalFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  goalMomentum: { flex: 1, color: palette.muted, fontSize: 12, fontWeight: '600' },
  insightPreview: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 18, backgroundColor: palette.accentPale },
  insightIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface },
  insightCopy: { flex: 1, marginHorizontal: 11 },
  insightTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  insightText: { marginTop: 3, color: palette.muted, fontSize: 12, lineHeight: 17 },
  listCard: { paddingHorizontal: 15, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  inlineState: { alignItems: 'center', justifyContent: 'center', minHeight: 92, paddingVertical: 16 },
  stateTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  stateText: { marginTop: 5, color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorText: { color: palette.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72, borderBottomWidth: 1, borderBottomColor: palette.line },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accentPale },
  rowIconDanger: { backgroundColor: '#FCE8E6' },
  rowMain: { flex: 1, marginLeft: 11 },
  rowTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  rowMeta: { marginTop: 4, color: palette.muted, fontSize: 11 },
  rowRight: { alignItems: 'flex-end' },
  rowAmount: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  status: { marginTop: 5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, fontSize: 9, fontWeight: '800', overflow: 'hidden' },
  statusDanger: { color: palette.danger, backgroundColor: '#FCE8E6' },
  statusUpcoming: { color: palette.accent, backgroundColor: palette.accentPale },
  statusPaid: { color: palette.muted, backgroundColor: '#EEF2EF' },
  expenseAmount: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  quickAdd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 54, marginTop: 16, borderRadius: 17, borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.accentSoft },
  quickAddText: { marginLeft: 8, color: palette.accent, fontSize: 13, fontWeight: '800' },
  dismissLayer: { ...StyleSheet.absoluteFillObject, zIndex: 4 },
  chatHead: { position: 'absolute', right: 20, bottom: 112, zIndex: 6, width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent, shadowColor: '#063224', shadowOpacity: 0.2, shadowRadius: 9, elevation: 5 },
  insightBubble: { position: 'absolute', right: 20, bottom: 176, zIndex: 7, width: 265, padding: 15, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, shadowColor: '#063224', shadowOpacity: 0.16, shadowRadius: 14, elevation: 6 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bubbleTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  bubbleText: { marginTop: 9, color: palette.muted, fontSize: 13, lineHeight: 19 },
  bubbleLink: { marginTop: 10, color: palette.accent, fontSize: 12, fontWeight: '900' },
  addMenu: { position: 'absolute', right: 12, zIndex: 8, maxWidth: 272, padding: 14, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, shadowColor: '#063224', shadowOpacity: 0.18, shadowRadius: 14, elevation: 7 },
  addMenuTitle: { marginBottom: 10, color: palette.muted, fontSize: 11, fontWeight: '800' },
  addGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addMenuItem: { minHeight: 70, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 8, borderRadius: 13, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.line, gap: 5 },
  addMenuLabel: { color: palette.ink, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  formOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end' },
  formDismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,35,28,0.28)' },
  formKeyboard: { maxHeight: '88%' },
  formCard: { padding: 20, paddingBottom: 30, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: palette.surface, shadowColor: '#063224', shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  formHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  formEyebrow: { color: palette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  formTitle: { marginTop: 4, color: palette.ink, fontSize: 22, fontWeight: '900' },
  formClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  formInput: { minHeight: 50, marginBottom: 11, paddingHorizontal: 15, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.background, color: palette.ink, fontSize: 14 },
  cycleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 11 },
  cycleChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.line },
  cycleChipActive: { backgroundColor: palette.accentPale, borderColor: palette.accent },
  cycleText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  cycleTextActive: { color: palette.accent, fontWeight: '900' },
  formError: { marginBottom: 10, color: palette.danger, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  formSubmit: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: palette.accent },
  formSubmitDisabled: { opacity: 0.6 },
  formSubmitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  bottomNav: { position: 'absolute', left: 16, right: 16, bottom: 12, height: 68, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 28, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, shadowColor: '#063224', shadowOpacity: 0.14, shadowRadius: 13, elevation: 7, zIndex: 5 },
  navItem: { width: 50, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  navLabelActive: { color: palette.accent, fontWeight: '900' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.accent },
  addButton: { width: 58, height: 58, marginTop: -26, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: palette.accent, shadowColor: '#063224', shadowOpacity: 0.25, shadowRadius: 9, elevation: 8 },
  panelOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 25, justifyContent: 'flex-end' },
  panelDismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,35,28,0.28)' },
  profilePanel: { padding: 22, paddingBottom: 32, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: palette.surface },
  panelEyebrow: { color: palette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  panelTitle: { marginTop: 5, marginBottom: 12, color: palette.ink, fontSize: 20, fontWeight: '900' },
  panelRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: palette.line },
  panelRowText: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  panelBadge: { width: 21, height: 21, borderRadius: 11, color: '#FFFFFF', backgroundColor: '#D92D20', textAlign: 'center', fontSize: 12, fontWeight: '900', overflow: 'hidden', paddingTop: 2 },
  panelGear: { width: 21, textAlign: 'center', color: palette.accent, fontSize: 20 },
  pressed: { opacity: 0.78 },
});
