import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  MoreHorizontal,
  PiggyBank,
  Plus,
  Shield,
  TrendingUp,
  Home,
  Car,
  Laptop,
  Plane,
  PartyPopper,
  GraduationCap,
  HeartPulse,
  PawPrint,
  Gift,
  Dumbbell,
  Target,
  CalendarDays,
} from 'lucide-react-native';
import {
  SafeAreaView as NativeSafeAreaView,
  type SafeAreaViewProps,
} from 'react-native-safe-area-context';

import {
  DatePickerField,
  CurrencyInput,
  parseAmount,
  FinanceFormSheet,
  FormTextInput,
  formPalette,
} from '@/components/finance-form';
import { SectionAddButton } from '@/components/header-add-button';
import { ItemManagementSheet } from '@/components/item-management-sheet';
import { WalletPicker, type Wallet } from '@/components/wallet-picker';
import { authenticatedApiRequest } from '@/services/api';
import {
  fetchWallets,
  dateKeyInManila,
  notifyFinancialMutation,
  subscribeFinancialMutations,
} from '@/services/finance';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { BOTTOM_NAV_CLEARANCE, useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';
import { formatCurrency } from '@/utils/currency';
import { useToast } from '@/components/toast-provider';

type Goal = {
  id: string;
  title: string;
  emoji?: string;
  target_amount: number | string;
  current_amount: number | string;
  deadline: string;
  completed_at?: string | null;
  funding_method?: 'manual' | 'monthly' | null;
  monthly_contribution?: number | string | null;
  monthly_target?: number | string | null;
};
type Dashboard = {
  overview: {
    totalSavings: number;
    goalSavings: number;
    activeGoals: number;
    monthlyContribution: number;
  };
  goals: Goal[];
};

const goalIcons = [
  'emergency',
  'savings',
  'investment',
  'home',
  'car',
  'motorcycle',
  'technology',
  'travel',
  'celebration',
  'education',
  'healthcare',
  'pet',
  'gift',
  'fitness',
  'general',
];
// Keep legacy `motorcycle` values renderable, but do not expose a second
// picker option for the same Car glyph.
const goalIconOptions = goalIcons.filter((icon) => icon !== 'motorcycle');
const goalIconMap = {
  emergency: Shield,
  savings: PiggyBank,
  investment: TrendingUp,
  home: Home,
  car: Car,
  motorcycle: Car,
  technology: Laptop,
  travel: Plane,
  celebration: PartyPopper,
  education: GraduationCap,
  healthcare: HeartPulse,
  pet: PawPrint,
  gift: Gift,
  fitness: Dumbbell,
  general: Target,
} as const;
function GoalIcon({ name }: { name: string }) {
  const Icon = goalIconMap[name as keyof typeof goalIconMap] ?? Target;
  return <Icon size={21} color={formPalette.accent} strokeWidth={2} />;
}
const peso = (value: number) => formatCurrency(Math.round(value));

function goalProgress(goal: Goal) {
  const saved = Number(goal.current_amount) || 0;
  const target = Number(goal.target_amount) || 0;
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((saved / target) * 100)));
}

function formatGoalDate(value: string | null | undefined) {
  if (!value) return 'No target date';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'No target date';
  return `Due ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)}`;
}

function suggestedMonthlyAmount(target: number, current: number, deadline: string) {
  const today = new Date();
  const due = new Date(`${deadline}T12:00:00`);
  const months = Math.max(
    1,
    (due.getFullYear() - today.getFullYear()) * 12 + due.getMonth() - today.getMonth(),
  );
  return Math.max(0, Math.ceil(Math.max(0, target - current) / months));
}

const SavingsStylesContext = createContext<ReturnType<typeof makeStyles> | null>(null);
function useSavingsStyles() {
  const styles = useContext(SavingsStylesContext);
  if (!styles) throw new Error('Savings styles are unavailable.');
  return styles;
}

function SafeAreaView(props: SafeAreaViewProps) {
  const { colors } = useAppTheme();
  const children = Children.toArray(props.children).filter(
    (child) => typeof child !== 'string' && typeof child !== 'number',
  );
  return (
    <NativeSafeAreaView {...props} style={[props.style, { backgroundColor: colors.background }]}>
      {children}
    </NativeSafeAreaView>
  );
}

export default function Goals() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const bottomNavClearance = useBottomNavClearance();
  const styles = useMemo(() => makeStyles({
    ...formPalette,
    background: colors.background,
    surface: colors.surfaceElevated,
    ink: colors.textPrimary,
    muted: colors.textSecondary,
    accent: colors.balance,
    accentDark: colors.balance,
    accentPale: colors.primarySoft,
    balance: colors.balance,
    progressTrack: colors.primarySoft,
    progressFill: colors.primary,
    secondarySurface: colors.accentMuted,
    secondaryText: colors.primary,
    line: colors.border,
  }), [colors]);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [managing, setManaging] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [contributionGoal, setContributionGoal] = useState<Goal | null>(null);
  const [goalTab, setGoalTab] = useState<'active' | 'completed'>('active');
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await authenticatedApiRequest<Dashboard>('/api/savings-goals/summary'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Goals could not load.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return subscribeFinancialMutations(() => {
      void refresh();
    });
  }, [refresh]);
  const activeGoals = useMemo(() => data?.goals.filter((goal) => !goal.completed_at) ?? [], [data]);
  const completedGoals = useMemo(
    () => data?.goals.filter((goal) => Boolean(goal.completed_at)) ?? [],
    [data],
  );
  const goals = goalTab === 'active' ? activeGoals : completedGoals;
  const totalSaved = goals.reduce((sum, goal) => sum + (Number(goal.current_amount) || 0), 0);
  const totalTarget = goals.reduce((sum, goal) => sum + (Number(goal.target_amount) || 0), 0);
  const overallProgress =
    totalTarget > 0 ? Math.min(100, Math.max(0, Math.round((totalSaved / totalTarget) * 100))) : 0;
  const remove = async (goal: Goal) => {
    setDeleting(true);
    setDeleteError('');
    try {
      await authenticatedApiRequest(`/api/savings-goals/${goal.id}`, { method: 'DELETE' });
      notifyFinancialMutation();
      setManaging(null);
      await refresh();
      toast.success('Goal deleted successfully');
    } catch (e) {
      setDeleteError("Couldn't delete goal. Please try again.");
      throw e;
    } finally {
      setDeleting(false);
    }
  };
  return (
    <SavingsStylesContext.Provider value={styles}>
      <SafeAreaView style={styles.safe}>
      <FinancialScreenHeader
        title="Goals"
        onBack={() => router.back()}
        rightAction={<NotificationHeaderButton />}
      />
      {loading ? (
        <GoalsLoadingState />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Goals unavailable</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable onPress={() => void refresh()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <GoalsSummaryCard
            totalSaved={totalSaved}
            activeGoals={activeGoals.length}
            overallProgress={overallProgress}
          />
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionTitle}>
                {goalTab === 'active' ? 'Your goals' : 'Completed goals'}
              </Text>
              <Text style={styles.sectionHint}>
                {goals.length} {goalTab} goal{goals.length === 1 ? '' : 's'}
              </Text>
            </View>
            <SectionAddButton label="Create goal" onPress={() => setOpen(true)} />
          </View>
          <View style={styles.goalTabs}>
            {(['active', 'completed'] as const).map((tab) => (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: goalTab === tab }}
                onPress={() => setGoalTab(tab)}
                style={[styles.goalTab, goalTab === tab && styles.goalTabSelected]}
              >
                <Text style={[styles.goalTabText, goalTab === tab && styles.goalTabTextSelected]}>
                  {tab === 'active'
                    ? `Active (${activeGoals.length})`
                    : `Completed (${completedGoals.length})`}
                </Text>
              </Pressable>
            ))}
          </View>
          {goals.length ? (
            <View style={styles.goalsGrid}>
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onAdd={goalTab === 'active' ? () => setContributionGoal(goal) : undefined}
                  onManage={() => {
                    setDeleteError('');
                    setManaging(goal);
                  }}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.cardTitle}>
                {goalTab === 'completed'
                  ? 'No completed goals'
                  : data?.goals.length
                    ? 'No active goals'
                    : 'No goals yet'}
              </Text>
              <Text style={styles.muted}>
                Create a goal, set a target, and track your progress over time.
              </Text>
              <SectionAddButton label="Create goal" onPress={() => setOpen(true)} />
            </View>
          )}
        </ScrollView>
      )}
      {open && (
        <GoalForm
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await refresh();
          }}
        />
      )}
      {editing && (
        <GoalForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
      {contributionGoal && (
        <WalletContributionForm
          goal={contributionGoal}
          onClose={() => setContributionGoal(null)}
          onSaved={async () => {
            setContributionGoal(null);
            await refresh();
          }}
        />
      )}
      {managing && (
        <ItemManagementSheet
          visible
          title="Goal"
          itemName={managing.title}
          deleteDescription="This goal will be removed. Its progress will be released without changing wallet balances."
          onClose={() => setManaging(null)}
          onEdit={() => setEditing(managing)}
          onDelete={() => remove(managing)}
          deleting={deleting}
          error={deleteError}
        />
      )}
      </SafeAreaView>
    </SavingsStylesContext.Provider>
  );
}


function GoalsLoadingState() {
  const styles = useSavingsStyles();
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.summarySkeleton}>
        <ActivityIndicator color={formPalette.accent} />
        <Text style={styles.muted}>Loading your goals…</Text>
      </View>
      <View style={styles.sectionHeader}>
        <View style={styles.skeletonLineWide} />
        <View style={styles.skeletonButton} />
      </View>
      <View style={styles.goalsGrid}>
        <View style={styles.goalSkeleton} />
        <View style={styles.goalSkeleton} />
      </View>
    </ScrollView>
  );
}

function GoalsSummaryCard({
  totalSaved,
  activeGoals,
  overallProgress,
}: {
  totalSaved: number;
  activeGoals: number;
  overallProgress: number;
}) {
  const styles = useSavingsStyles();
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Goals summary. ${peso(totalSaved)} saved across ${activeGoals} active goals. Overall progress ${overallProgress} percent.`}
      style={styles.summaryCard}
    >
      <View pointerEvents="none" style={styles.summaryCurveLarge} />
      <View pointerEvents="none" style={styles.summaryCurveSmall} />
      <Text style={styles.summaryEyebrow}>GOALS SUMMARY</Text>
      <View style={styles.summaryBody}>
        <View style={styles.summarySaved}>
          <Text style={styles.summaryValue}>{peso(totalSaved)}</Text>
          <Text style={styles.summaryLabel}>Total saved</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryMetric}>
          <View style={styles.summaryIcon}>
            <Target size={20} color={formPalette.accent} strokeWidth={2.2} />
          </View>
          <Text style={styles.summaryMetricValue}>{activeGoals}</Text>
          <Text style={styles.summaryLabel}>Active goals</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryMetric}>
          <View style={styles.summaryIcon}>
            <TrendingUp size={20} color={formPalette.accent} strokeWidth={2.2} />
          </View>
          <Text style={styles.summaryMetricValue}>{overallProgress}%</Text>
          <Text style={styles.summaryLabel}>Overall progress</Text>
        </View>
      </View>
    </View>
  );
}

function GoalCard({
  goal,
  onAdd,
  onManage,
}: {
  goal: Goal;
  onAdd?: () => void;
  onManage: () => void;
}) {
  const styles = useSavingsStyles();
  const saved = Number(goal.current_amount);
  const target = Number(goal.target_amount);
  const percent = goalProgress(goal);
  const fundingMethod =
    goal.funding_method ?? (Number(goal.monthly_target ?? 0) > 0 ? 'monthly' : 'manual');
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${goal.title}, ${percent}% saved, ${peso(saved)} of ${peso(target)}, ${formatGoalDate(goal.deadline)}`}
      style={styles.goalCard}
    >
      <View style={styles.goalHead}>
        <View style={styles.goalIcon}>
          <GoalIcon name={goal.emoji ?? 'general'} />
        </View>
        <View style={styles.goalHeadRight}>
          <Text style={styles.percent}>{percent}%</Text>
          <Pressable
            accessibilityLabel={`Options for ${goal.title}`}
            onPress={onManage}
            style={styles.more}
          >
            <MoreHorizontal size={18} color={formPalette.muted} />
          </Pressable>
        </View>
      </View>
      <View style={styles.goalNameRegion}>
        <Text style={styles.goalName} numberOfLines={2} ellipsizeMode="tail">
          {goal.title}
        </Text>
      </View>
      <View style={styles.goalDueRow}>
        <CalendarDays size={14} color={formPalette.muted} strokeWidth={1.8} />
        <Text style={styles.goalDue} numberOfLines={1}>
          {formatGoalDate(goal.deadline)}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: formPalette.progressTrack, height: 8 }]}>
        <View
          style={[styles.fill, { width: `${percent}%`, backgroundColor: formPalette.progressFill }]}
        />
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.goalAmount}>
        {peso(saved)} <Text style={styles.goalTarget}>/ {peso(target)}</Text>
      </Text>
      <View style={styles.fundingRegion}>
        <Text numberOfLines={2} ellipsizeMode="tail" style={styles.fundingHint}>
          {fundingMethod === 'monthly' && Number(goal.monthly_contribution ?? goal.monthly_target ?? 0) > 0
            ? `${peso(Number(goal.monthly_contribution ?? goal.monthly_target ?? 0))}/month planned`
            : 'Manual funding'}
        </Text>
      </View>
      <View style={styles.goalActionRegion}>
        {saved >= target || !onAdd ? (
          <Text style={styles.reached}>{saved >= target ? 'Goal reached' : 'Completed'}</Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add money to ${goal.title}`}
            onPress={onAdd}
            style={({ pressed }) => [
              styles.money,
              {
                backgroundColor: formPalette.secondarySurface,
                borderColor: formPalette.progressFill,
              },
              pressed && styles.pressed,
            ]}
          >
            <Plus size={13} color={formPalette.secondaryText} />
            <Text style={[styles.moneyText, { color: formPalette.secondaryText }]}>Add money</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function GoalEmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const styles = useSavingsStyles();
  return (
    <View style={styles.picker}>
      <Text style={styles.pickerLabel}>Choose an icon</Text>
      <View style={styles.iconGrid}>
        {goalIconOptions.map((icon) => (
          <Pressable
            key={icon}
            accessibilityRole="button"
            accessibilityLabel={`${icon} goal icon`}
            accessibilityState={{ selected: value === icon }}
            onPress={() => onChange(icon)}
            style={({ pressed }) => [
              styles.iconChoice,
              value === icon && styles.iconChoiceActive,
              pressed && styles.pressed,
            ]}
          >
            <GoalIcon name={icon} />
            {value === icon && <Text style={styles.iconCheck}>✓</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function GoalForm({
  onClose,
  onSaved,
  initial,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
  initial?: Goal;
}) {
  const styles = useSavingsStyles();
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [target, setTarget] = useState(initial ? String(initial.target_amount) : '');
  const [date, setDate] = useState(initial?.deadline ?? new Date().toISOString().slice(0, 10));
  const [emoji, setEmoji] = useState(initial?.emoji ?? 'general');
  const [fundingMethod, setFundingMethod] = useState<'manual' | 'monthly'>(
    initial?.funding_method ?? (Number(initial?.monthly_target ?? 0) > 0 ? 'monthly' : 'manual'),
  );
  const [monthlyAmount, setMonthlyAmount] = useState(
    initial?.monthly_contribution
      ? String(initial.monthly_contribution)
      : initial?.monthly_target
        ? String(initial.monthly_target)
        : '',
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const value = parseAmount(target);
    const monthly = parseAmount(monthlyAmount);
    if (!title.trim() || value === null || value <= 0) {
      setError('Enter a goal name and a valid target.');
      return;
    }
    if (fundingMethod === 'monthly' && (monthly === null || monthly <= 0)) {
      setError('Enter a valid monthly amount.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const path = initial ? `/api/savings-goals/${initial.id}` : '/api/savings-goals';
      await authenticatedApiRequest(path, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          emoji,
          target_amount: value,
          ...(initial ? {} : { current_amount: 0 }),
          deadline: date,
          funding_method: fundingMethod,
          monthly_contribution: fundingMethod === 'monthly' ? monthly : 0,
          monthly_target: fundingMethod === 'monthly' ? monthly : 0,
        }),
      });
      notifyFinancialMutation();
      await onSaved();
      toast.success(initial ? 'Goal updated successfully' : 'Goal created successfully');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this goal.');
    } finally {
      setSaving(false);
    }
  };
  const suggested = suggestedMonthlyAmount(
    parseAmount(target) ?? 0,
    Number(initial?.current_amount ?? 0),
    date,
  );
  return (
    <FinanceFormSheet
      title={initial ? 'Edit goal' : 'Create goal'}
      eyebrow="GOAL PLAN"
      amount={target}
      onAmountChange={setTarget}
      error={error}
      saving={saving}
      saveLabel={initial ? 'Save changes' : 'Save goal'}
      onSave={() => void save()}
      onClose={onClose}
    >
      <FormTextInput
        label="Goal name"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Baguio weekend"
      />
      <GoalEmojiPicker value={emoji} onChange={setEmoji} />
      <DatePickerField label="Due date" value={date} onChange={setDate} />
      <Text style={styles.fundingLabel}>How do you want to fund this goal?</Text>
      <View style={styles.fundingOptions}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: fundingMethod === 'monthly' }}
          onPress={() => setFundingMethod('monthly')}
          style={[styles.fundingOption, fundingMethod === 'monthly' && styles.fundingOptionActive]}
        >
          <Text
            style={[styles.fundingTitle, fundingMethod === 'monthly' && styles.fundingTitleActive]}
          >
            Save monthly
          </Text>
          <Text style={styles.fundingCopy}>
            Set aside an amount in your monthly budget toward this goal.
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: fundingMethod === 'manual' }}
          onPress={() => setFundingMethod('manual')}
          style={[styles.fundingOption, fundingMethod === 'manual' && styles.fundingOptionActive]}
        >
          <Text
            style={[styles.fundingTitle, fundingMethod === 'manual' && styles.fundingTitleActive]}
          >
            Add manually
          </Text>
          <Text style={styles.fundingCopy}>Add money whenever you have extra available.</Text>
        </Pressable>
      </View>
      {fundingMethod === 'monthly' && (
        <>
          <Text style={styles.suggested}>Suggested monthly amount: {peso(suggested)}/month</Text>
          <CurrencyInput
            label="Monthly amount"
            value={monthlyAmount}
            onChangeText={setMonthlyAmount}
            placeholder={String(suggested)}
          />
        </>
      )}
    </FinanceFormSheet>
  );
}

function WalletContributionForm({
  goal,
  onClose,
  onSaved,
}: {
  goal: Goal;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const styles = useSavingsStyles();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [contributionDate, setContributionDate] = useState(dateKeyInManila());
  const [note, setNote] = useState('');
  const idempotencyKey = useRef<string | null>(null);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void fetchWallets()
      .then((rows) => setWallets(rows as Wallet[]))
      .catch(() => setError('Wallets could not load.'));
  }, []);
  const save = async () => {
    if (savingRef.current) return;
    const value = parseAmount(amount);
    if (value === null || value <= 0) {
      setError('Enter a valid amount to add.');
      return;
    }
    if (!walletId) {
      setError('Choose the wallet where this money is held.');
      return;
    }
    savingRef.current = true;
    if (!idempotencyKey.current) idempotencyKey.current = `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSaving(true);
    setError('');
    try {
      await authenticatedApiRequest(`/api/savings-goals/${goal.id}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_id: walletId, amount: value, contribution_date: contributionDate, note: note || undefined, idempotency_key: idempotencyKey.current }),
      });
      notifyFinancialMutation();
      await onSaved();
      toast.success('Goal contribution added successfully');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add money to this goal.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <FinanceFormSheet
      title={`Reserve money for ${goal.title}`}
      eyebrow="GOAL RESERVATION"
      amount={amount}
      onAmountChange={setAmount}
      error={error}
      saving={saving}
      saveLabel={amount ? `Reserve ${peso(Number(parseAmount(amount) ?? 0))}` : 'Reserve money'}
      onSave={() => void save()}
      onClose={onClose}
    >
      <Text style={styles.contributionHint}>
        {peso(Number(goal.current_amount))} saved of {peso(Number(goal.target_amount))}
      </Text>
      <WalletPicker
        wallets={wallets}
        value={walletId}
        onChange={setWalletId}
        required
        label="From wallet"
      />
      {walletId ? (() => {
        const selected = wallets.find((wallet) => wallet.id === walletId);
        return selected ? <Text style={styles.muted}>{peso(Number(selected.available_balance ?? selected.balance))} available to spend in {selected.name}. Reserved money remains in this wallet.</Text> : null;
      })() : null}
      <DatePickerField label="Funding date" value={contributionDate} onChange={setContributionDate} compact />
      <FormTextInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="What is this allocation for?" />
    </FinanceFormSheet>
  );
}

function makeStyles(themePalette: typeof formPalette) {
  const formPalette = themePalette;
  return StyleSheet.create({
    sectionHeaderCopy: { flex: 1 },
    fundingLabel: { marginTop: 18, color: formPalette.ink, fontSize: 12, fontWeight: '900' },
    fundingOptions: { gap: 9, marginTop: 10 },
    fundingOption: {
      padding: 13,
      borderRadius: 16,
      backgroundColor: formPalette.background,
      borderWidth: 1,
      borderColor: formPalette.line,
    },
    fundingOptionActive: {
      backgroundColor: formPalette.accentPale,
      borderColor: formPalette.accent,
    },
    fundingTitle: { color: formPalette.muted, fontSize: 13, fontWeight: '900' },
    fundingTitleActive: { color: formPalette.accentDark },
    fundingCopy: { marginTop: 4, color: formPalette.muted, fontSize: 11, lineHeight: 16 },
    suggested: { marginTop: 12, color: formPalette.accent, fontSize: 11, fontWeight: '800' },
    fundingHint: { marginTop: 6, color: formPalette.muted, fontSize: 11, fontWeight: '700' },
    safe: { flex: 1, backgroundColor: formPalette.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      backgroundColor: formPalette.surface,
      borderBottomWidth: 1,
      borderBottomColor: formPalette.line,
    },
    back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
    titleWrap: { flex: 1, marginLeft: 8 },
    eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
    title: { marginTop: 3, color: formPalette.ink, fontSize: 23, fontWeight: '900' },
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: 10,
      borderRadius: 18,
      backgroundColor: formPalette.accent,
    },
    addText: { color: '#fff', fontWeight: '900' },
    content: { padding: 20, paddingBottom: BOTTOM_NAV_CLEARANCE + 24 },
    summaryCard: {
      minHeight: 190,
      overflow: 'hidden',
      padding: 18,
      borderRadius: 24,
      backgroundColor: formPalette.accentDark,
      borderWidth: 1,
      borderColor: formPalette.accent,
      position: 'relative',
    },
    summaryCurveLarge: {
      position: 'absolute',
      width: 260,
      height: 90,
      right: -30,
      bottom: -44,
      borderRadius: 130,
      borderWidth: 2,
      borderColor: 'rgba(24, 196, 137, 0.25)',
      transform: [{ rotate: '-12deg' }],
    },
    summaryCurveSmall: {
      position: 'absolute',
      width: 190,
      height: 64,
      right: 40,
      bottom: -26,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: 'rgba(24, 196, 137, 0.18)',
      transform: [{ rotate: '-12deg' }],
    },
    summaryEyebrow: { color: '#D8EFE2', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
    summaryBody: { flex: 1, flexDirection: 'row', alignItems: 'center', marginTop: 18 },
    summarySaved: { flex: 1.35, minWidth: 0 },
    summaryMetric: { flex: 1, minWidth: 0, alignItems: 'center' },
    summaryDivider: {
      width: 1,
      height: 92,
      marginHorizontal: 9,
      backgroundColor: 'rgba(216,239,226,0.2)',
    },
    summaryIcon: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      backgroundColor: 'rgba(0, 40, 32, 0.42)',
    },
    summaryValue: { marginTop: 7, color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
    summaryMetricValue: { marginTop: 7, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
    summaryLabel: { marginTop: 3, color: '#C6DFD3', fontSize: 11, fontWeight: '700' },
    summarySkeleton: {
      height: 190,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
      backgroundColor: formPalette.surface,
      borderWidth: 1,
      borderColor: formPalette.line,
    },
    skeletonLineWide: {
      width: 130,
      height: 20,
      borderRadius: 10,
      backgroundColor: formPalette.surface,
    },
    skeletonButton: {
      width: 116,
      height: 42,
      borderRadius: 21,
      backgroundColor: formPalette.surface,
    },
    goalSkeleton: {
      width: '48.5%',
      height: 286,
      marginBottom: 12,
      borderRadius: 20,
      backgroundColor: formPalette.surface,
      borderWidth: 1,
      borderColor: formPalette.line,
    },
    hero: {
      height: 196,
      overflow: 'hidden',
      padding: 19,
      borderRadius: 22,
      backgroundColor: formPalette.accent,
      position: 'relative',
    },
    heroOrb: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      right: -55,
      top: -60,
      backgroundColor: 'rgba(255,255,255,0.09)',
    },
    heroOrbSmall: {
      position: 'absolute',
      width: 80,
      height: 80,
      borderRadius: 40,
      right: 36,
      bottom: -35,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroEyebrow: { color: '#D8EFE2', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
    heroLabel: { marginTop: 15, color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    heroAmount: {
      marginTop: 2,
      color: '#FFFFFF',
      fontSize: 31,
      fontWeight: '900',
      letterSpacing: -1,
    },
    heroDivider: { height: 1, marginTop: 15, backgroundColor: 'rgba(255,255,255,0.28)' },
    heroSecondary: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    heroSecondaryLabel: { color: '#BFE3D0', fontSize: 10, fontWeight: '600' },
    heroSecondaryValue: { marginTop: 3, color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    heroGoalHint: { color: '#BFE3D0', fontSize: 11, fontWeight: '700' },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 22,
      marginBottom: 10,
    },
    sectionTitle: { color: formPalette.ink, fontSize: 18, fontWeight: '900' },
    sectionHint: { marginTop: 3, color: formPalette.muted, fontSize: 11, fontWeight: '700' },
    goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'space-between' },
    goalTabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    goalTab: {
      flex: 1,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      backgroundColor: formPalette.background,
      borderWidth: 1,
      borderColor: formPalette.line,
    },
    goalTabSelected: { backgroundColor: formPalette.accentPale, borderColor: formPalette.accent },
    goalTabText: { color: formPalette.muted, fontSize: 12, fontWeight: '800' },
    goalTabTextSelected: { color: formPalette.accent },
    goalCard: {
      width: '48.5%',
      minHeight: 320,
      marginBottom: 12,
      padding: 14,
      borderRadius: 20,
      alignSelf: 'stretch',
      backgroundColor: formPalette.surface,
      borderWidth: 1,
      borderColor: formPalette.line,
      flexDirection: 'column',
    },
    goalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    goalHeadRight: { alignItems: 'flex-end', gap: 4 },
    goalIcon: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: formPalette.accentPale,
    },
    emoji: { fontSize: 21 },
    goalNameRegion: { minHeight: 44, marginTop: 14, justifyContent: 'flex-start' },
    goalName: {
      color: formPalette.ink,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '900',
    },
    goalDueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
    goalDue: { color: formPalette.muted, fontSize: 11 },
    percent: { color: formPalette.accent, fontSize: 15, fontWeight: '900' },
    more: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
      backgroundColor: 'transparent',
    },
    track: {
      height: 7,
      marginTop: 12,
      overflow: 'hidden',
      borderRadius: 4,
      backgroundColor: formPalette.accentPale,
    },
    fill: { height: '100%', borderRadius: 4, backgroundColor: formPalette.accent },
    goalAmount: { marginTop: 10, color: formPalette.ink, fontSize: 13, fontWeight: '900' },
    goalTarget: { color: formPalette.muted, fontWeight: '600' },
    fundingRegion: { minHeight: 32, marginTop: 6, justifyContent: 'flex-start' },
    goalActionRegion: { minHeight: 44, marginTop: 'auto', justifyContent: 'flex-end' },
    reached: {
      minHeight: 44,
      color: formPalette.accent,
      fontSize: 10,
      fontWeight: '900',
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    money: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: formPalette.accentPale,
    },
    moneyText: { color: formPalette.accent, fontSize: 12, fontWeight: '900' },
    contributionHint: { color: formPalette.muted, fontSize: 12, lineHeight: 18 },
    muted: { marginTop: 5, color: formPalette.muted, fontSize: 12, lineHeight: 18 },
    card: {
      margin: 20,
      padding: 18,
      borderRadius: 18,
      backgroundColor: formPalette.surface,
      borderWidth: 1,
      borderColor: formPalette.line,
    },
    emptyCard: {
      padding: 18,
      borderRadius: 18,
      backgroundColor: formPalette.surface,
      borderWidth: 1,
      borderColor: formPalette.line,
    },
    cardTitle: { color: formPalette.ink, fontSize: 16, fontWeight: '900' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    retry: {
      alignSelf: 'flex-start',
      marginTop: 14,
      padding: 10,
      borderRadius: 15,
      backgroundColor: formPalette.accentPale,
    },
    retryText: { color: formPalette.accent, fontWeight: '900' },
    picker: { marginTop: 15 },
    pickerLabel: {
      marginBottom: 9,
      color: formPalette.muted,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconChoice: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 15,
      backgroundColor: formPalette.background,
    },
    iconChoiceActive: {
      backgroundColor: formPalette.accentPale,
      borderWidth: 1,
      borderColor: formPalette.accent,
    },
    iconChoiceText: { fontSize: 24 },
    iconCheck: {
      position: 'absolute',
      right: 4,
      bottom: 2,
      color: formPalette.accent,
      fontSize: 12,
      fontWeight: '900',
    },
    goalNameRow: { flexDirection: 'row', alignItems: 'flex-start' },
    selectedIcon: {
      width: 58,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 23,
      borderRadius: 18,
      backgroundColor: formPalette.accentPale,
    },
    selectedIconText: { fontSize: 31 },
    pressed: { opacity: 0.72 },
  });
}
