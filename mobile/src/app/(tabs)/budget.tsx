import type { ReactNode } from 'react';
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  BookOpen,
  Car,
  Dumbbell,
  Gift,
  Heart,
  Home,
  PawPrint,
  Pencil,
  Plane,
  Plus,
  Search,
  ShoppingBag,
  WalletCards,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FinancialSummaryBackground } from '@/components/financial-summary-background';

import {
  CategoryChipRow,
  CurrencyInput,
  parseAmount,
  FinanceFormSheet,
  budgetCategories,
  formPalette,
} from '@/components/finance-form';
import { authenticatedApiRequest } from '@/services/api';
import { NotificationHeaderButton } from '@/components/notification-header-button';
import { FinancialScreenHeader } from '@/components/financial-screen-header';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { recommendedBudgetTemplate, type BudgetTemplate } from '@shared/budget-templates';
import { useAppTheme } from '@/theme/theme';
import { formatCurrency } from '@/utils/currency';
import { getCategoryMeta } from '@/constants/categories';
import { budgetProgressPercent, budgetUsagePercent } from '@/utils/budget-summary';
import {
  canApplyBudgetSetup,
  canStartBudgetSave,
  copiedBudgetEntries,
  previousBudgetMonth,
  recommendedBudgetEntries,
} from '@/utils/budget-setup';

type Category = {
  id: string;
  name: string;
  budget: number;
  spent: number;
  percent: number;
  color?: string;
  icon?: string;
  goal?: boolean;
  committed_amount?: number;
  upcoming_amount?: number;
};
type GoalAlloc = { goal_id: string; title: string; amount: number; progress_percent: number };
type Summary = {
  month: string;
  monthly_income: number;
  budget_amount: number;
  spent_amount: number;
  saved_amount: number;
  remaining_budget: number;
  categories: Category[];
  monthly_savings_budget: number;
  goal_allocation_total: number;
  general_savings: number;
  unallocated_savings: number;
  unallocated_income: number;
  savings_auto_distribute: boolean;
  remaining_savings_behavior: 'auto_general' | 'leave_unallocated' | 'ask_monthly';
  goal_allocations: GoalAlloc[];
};
type BudgetEntry = { id: string; name: string; budget: number; icon?: string; persisted: boolean };
type Shortfall = {
  id: string;
  name: string;
  budget: number;
  spent: number;
  shortfall: number;
  recommended: number;
  reason: string;
};

function getShortfalls(categories: Category[]): Shortfall[] {
  return categories
    .filter(
      (category) =>
        !category.goal &&
        category.spent + (category.committed_amount ?? category.upcoming_amount ?? 0) >
          category.budget,
    )
    .map((category) => ({
      id: category.id,
      name: category.name,
      budget: category.budget,
      spent: category.spent,
      shortfall: Math.max(
        0,
        category.spent +
          (category.committed_amount ?? category.upcoming_amount ?? 0) -
          category.budget,
      ),
      recommended: category.spent + (category.committed_amount ?? category.upcoming_amount ?? 0),
      reason:
        category.committed_amount || category.upcoming_amount
          ? `${peso(category.spent)} spent plus ${peso(category.committed_amount ?? category.upcoming_amount ?? 0)} in confirmed commitments`
          : `Spent ${peso(category.spent)} of a ${peso(category.budget)} budget`,
    }));
}

const customCategoryIcons: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'heart', label: 'Health', icon: Heart },
  { key: 'book', label: 'Learning', icon: BookOpen },
  { key: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { key: 'plane', label: 'Travel', icon: Plane },
  { key: 'gift', label: 'Gifts', icon: Gift },
  { key: 'paw', label: 'Pets', icon: PawPrint },
  { key: 'wrench', label: 'Repairs', icon: Wrench },
  { key: 'dumbbell', label: 'Fitness', icon: Dumbbell },
  { key: 'home', label: 'Home', icon: Home },
  { key: 'car', label: 'Car', icon: Car },
];

const starterCategories = [
  ['food', 'Food'],
  ['transportation', 'Transport'],
  ['rent_housing', 'Rent'],
  ['electricity', 'Electricity'],
  ['water', 'Water'],
  ['internet', 'Internet'],
  ['healthcare', 'Healthcare'],
  ['savings', 'Savings'],
  ['personal', 'Personal Care'],
  ['miscellaneous', 'Miscellaneous'],
] as const;

function commonCategoryEntries(): BudgetEntry[] {
  return starterCategories.map(([id, label]) => ({
    id: `budget-${id}`,
    name: label,
    budget: 0,
    persisted: false,
  }));
}

const peso = (value: number) => formatCurrency(Math.round(value));

function currentManilaMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year =
    parts.find((part) => part.type === 'year')?.value ?? String(new Date().getFullYear());
  const month =
    parts.find((part) => part.type === 'month')?.value ??
    String(new Date().getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function categoryIcon(name: string, iconKey?: string) {
  if (iconKey) {
    const custom = customCategoryIcons.find((option) => option.key === iconKey);
    if (custom) return custom.icon;
  }
  return getCategoryMeta(name).icon;
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(`${month}-01T12:00:00`),
  );
}

function useBudgetStyles() {
  const { colors } = useAppTheme();
  return useMemo(
    () =>
      createStyles({
        ...formPalette,
        background: colors.background,
        surface: colors.surfaceElevated,
        ink: colors.textPrimary,
        muted: colors.textSecondary,
        accent: colors.primary,
        accentDark: colors.primary,
        accentPale: colors.primarySoft,
        balance: colors.balance,
        line: colors.border,
      }),
    [colors],
  );
}

export default function Budget() {
  const { colors } = useAppTheme();
  const styles = useBudgetStyles();
  const bottomNavClearance = useBottomNavClearance();
  const [month] = useState(currentManilaMonth);
  const [data, setData] = useState<Summary | null>(null);
  const [previousData, setPreviousData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [startEmpty, setStartEmpty] = useState(false);
  const [copyLastMonthSetup, setCopyLastMonthSetup] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<BudgetTemplate | null>(null);
  const [contextCategoryId, setContextCategoryId] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await authenticatedApiRequest<Summary | null>(`/api/budget/summary?month=${month}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Budget could not load.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    let active = true;
    const capturedMonth = month;
    const load = async () => {
      try {
        const summary = await authenticatedApiRequest<Summary | null>(
          `/api/budget/summary?month=${capturedMonth}`,
        );
        if (!canApplyBudgetSetup({ capturedMonth, activeMonth: month, dialogOpen: active })) return;
        setData(summary);
        setError('');
      } catch (cause) {
        if (!canApplyBudgetSetup({ capturedMonth, activeMonth: month, dialogOpen: active })) return;
        setError(cause instanceof Error ? cause.message : 'Budget could not load.');
      } finally {
        if (canApplyBudgetSetup({ capturedMonth, activeMonth: month, dialogOpen: active })) {
          setLoading(false);
        }
      }
    };
    const loadPrevious = async () => {
      try {
        const previousSummary = await authenticatedApiRequest<Summary | null>(
          `/api/budget/summary?month=${previousBudgetMonth(capturedMonth)}`,
        );
        if (canApplyBudgetSetup({ capturedMonth, activeMonth: month, dialogOpen: active })) {
          setPreviousData(previousSummary);
        }
      } catch {
        if (canApplyBudgetSetup({ capturedMonth, activeMonth: month, dialogOpen: active })) {
          setPreviousData(null);
        }
      }
    };
    void load();
    void loadPrevious();
    return () => {
      active = false;
    };
  }, [month]);

  const label = monthLabel(month);
  const budgeted = data?.budget_amount ?? 0;
  const spent = data?.spent_amount ?? 0;
  const shortfalls = useMemo(() => getShortfalls(data?.categories ?? []), [data?.categories]);
  const totalShortfall = shortfalls.reduce((sum, item) => sum + item.shortfall, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <FinancialScreenHeader
        title="Budget"
        onBack={() => router.back()}
        rightAction={<NotificationHeaderButton />}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={formPalette.accent} />
          <Text style={styles.muted}>Loading budget…</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Budget unavailable</Text>
          <Text style={styles.muted}>
            We couldn&apos;t load your budget right now. Please try again.
          </Text>
          <Pressable onPress={() => void refresh()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : !data ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <WalletCards size={24} color={formPalette.accent} />
            </View>
            <Text style={styles.emptyTitle}>No budget set for {label} yet</Text>
            <Text style={styles.emptyCopy}>
              Set category limits and a monthly savings budget to give this month a clear plan.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(true)}
              style={styles.emptyAction}
            >
              <Text style={styles.emptyActionText}>Create Budget</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomNavClearance }]}
          showsVerticalScrollIndicator={false}
        >
          <BudgetSummary
            month={label}
            budgeted={budgeted}
            spent={spent}
            remaining={data.remaining_budget}
          />
          {data.unallocated_income !== 0 ? (
            <View style={[styles.tip, data.unallocated_income < 0 && styles.tipWarning]}>
              <WalletCards
                size={20}
                color={data.unallocated_income < 0 ? formPalette.danger : '#fff'}
              />
              <Text style={[styles.tipText, data.unallocated_income < 0 && styles.tipWarningText]}>
                {data.unallocated_income > 0
                  ? `${peso(data.unallocated_income)} of income is unallocated this month.`
                  : `Budget is ${peso(Math.abs(data.unallocated_income))} above income.`}
              </Text>
            </View>
          ) : null}
          <Section
            title="Category budgets"
            action={
              <View style={styles.sectionActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit budget"
                  onPress={() => {
                    setStartEmpty(false);
                    setPendingTemplate(null);
                    setOpen(true);
                  }}
                  style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}
                >
                  <Pencil size={14} color={formPalette.accent} />
                  <Text style={styles.sectionActionText}>Edit Budget</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change budget setup"
                  onPress={() => setSetupOpen(true)}
                  style={({ pressed }) => [styles.setupAction, pressed && styles.pressed]}
                >
                  <Text style={styles.setupActionText}>Change setup</Text>
                </Pressable>
              </View>
            }
          >
            {shortfalls.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${shortfalls.length} categories need adjustment, ${peso(totalShortfall)} total shortfall`}
                onPress={() => {
                  setContextCategoryId(shortfalls.length === 1 ? shortfalls[0].id : undefined);
                  setOpen(true);
                }}
                style={({ pressed }) => [styles.shortfallNotice, pressed && styles.pressed]}
              >
                <Text style={styles.shortfallNoticeTitle}>
                  {shortfalls.length} categor{shortfalls.length === 1 ? 'y needs' : 'ies need'}{' '}
                  adjustment
                </Text>
                <Text style={styles.shortfallNoticeText}>
                  {peso(totalShortfall)} total shortfall · Open Edit Budget for recommendations
                </Text>
              </Pressable>
            ) : null}
            {data.categories?.some((category) => !category.goal) ? (
              <View style={styles.categoryList}>
                {data.categories
                  ?.filter((category) => !category.goal)
                  .map((category) => (
                    <BudgetCategoryRow
                      key={category.id}
                      category={category}
                    />
                  ))}
              </View>
            ) : (
              <View style={styles.noLimitsCard} accessibilityRole="summary">
                <Text style={styles.noLimitsTitle}>No category limits yet</Text>
                <Text style={styles.noLimitsCopy}>
                  Your monthly budget is saved, but no spending categories have limits. Choose a
                  setup to get a plan, or add categories one at a time.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSetupOpen(true)}
                  style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}
                >
                  <Text style={styles.emptyActionText}>Choose a budget setup</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setStartEmpty(true);
                    setPendingTemplate(null);
                    setOpen(true);
                  }}
                  style={({ pressed }) => [styles.manualAction, pressed && styles.pressed]}
                >
                  <Text style={styles.manualActionText}>Add category manually</Text>
                </Pressable>
              </View>
            )}
          </Section>
          <GoalAllocationRows summary={data} />
        </ScrollView>
      )}
      {open && (
        <BudgetForm
          month={month}
          summary={data}
          previousSummary={previousData}
          startEmpty={startEmpty}
          copyLastMonthSetup={copyLastMonthSetup}
          pendingTemplate={pendingTemplate}
          shortfalls={shortfalls}
          initialCategoryId={contextCategoryId}
          onClose={() => {
            setOpen(false);
            setPendingTemplate(null);
            setCopyLastMonthSetup(false);
          }}
          onSaved={async () => {
            setOpen(false);
            setContextCategoryId(undefined);
            setPendingTemplate(null);
            setCopyLastMonthSetup(false);
            await refresh();
          }}
        />
      )}
      {setupOpen ? (
        <TemplatePicker
          month={month}
          visible
          previousSummary={previousData}
          onClose={() => setSetupOpen(false)}
          onSelect={(template) => {
            setSetupOpen(false);
            setStartEmpty(false);
            setCopyLastMonthSetup(false);
            setOpen(true);
            setPendingTemplate(template);
          }}
          onCopyLastMonth={() => {
            setSetupOpen(false);
            setStartEmpty(false);
            setCopyLastMonthSetup(true);
            setPendingTemplate(null);
            setOpen(true);
          }}
          onCustom={() => {
            setSetupOpen(false);
            setStartEmpty(true);
            setCopyLastMonthSetup(false);
            setPendingTemplate(null);
            setOpen(true);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function BudgetSummary({
  month,
  budgeted,
  spent,
  remaining,
}: {
  month: string;
  budgeted: number;
  spent: number;
  remaining: number;
}) {
  const styles = useBudgetStyles();
  const percent = budgetUsagePercent(spent, budgeted);
  const progress = budgetProgressPercent(spent, budgeted);
  const over = remaining < 0;
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${percent} percent of budget used. Total budget ${peso(budgeted)}. Used ${peso(spent)}. Remaining ${peso(remaining)}.`}
      style={[styles.summaryCard, { backgroundColor: formPalette.balance }]}
    >
      <FinancialSummaryBackground motif="budget" />
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryEyebrow}>BUDGET SUMMARY</Text>
        <Text style={styles.summaryMonth}>{month.toUpperCase()}</Text>
      </View>
      <View style={styles.summaryBody}>
        <View style={styles.percentBlock}>
          <Text style={[styles.percentValue, { color: over ? '#FFD3D0' : '#FFFFFF' }]}>
            {percent}%
          </Text>
          <Text style={styles.percentLabel}>USED</Text>
        </View>
        <View style={styles.summaryMetrics}>
          <Metric label="Total" value={peso(budgeted)} />
          <Metric label="Used" value={peso(spent)} />
          <Metric
            label="Remaining"
            value={
              over ? `-${peso(Math.abs(remaining))}` : peso(remaining)
            }
            tone={over ? 'danger' : 'positive'}
          />
        </View>
      </View>
      <View accessible={false} style={styles.summaryTrack}>
        <View
          style={[
            styles.summaryFill,
            {
              width: `${progress}%`,
              backgroundColor: over ? '#FFD3D0' : '#B7E8D0',
            },
          ]}
        />
      </View>
    </View>
  );
}

function Metric({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'positive' | 'danger';
}) {
  const styles = useBudgetStyles();
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        minimumFontScale={0.72}
        style={[
          styles.metricValue,
          tone === 'positive' && styles.metricPositive,
          tone === 'danger' && styles.metricDanger,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function BudgetCategoryRow({
  category,
}: {
  category: Category;
}) {
  const over = category.spent > category.budget;
  const color = getCategoryMeta(category.name).color;
  const tone = over ? formPalette.danger : color;
  const remaining = category.budget - category.spent;
  return (
    <BudgetProgressRow
      icon={createElement(categoryIcon(category.name, category.icon), { size: 19, color: tone })}
      backgroundIcon={createElement(categoryIcon(category.name, category.icon), {
        size: 76,
        color,
        opacity: 0.045,
      })}
      title={category.name}
      detail={`${peso(category.spent)} / ${peso(category.budget)}`}
      percent={category.percent}
      color={tone}
      remaining={over ? `${peso(Math.abs(remaining))} over budget` : `${peso(remaining)} remaining`}
    />
  );
}

function GoalAllocationRows({ summary }: { summary: Summary }) {
  const styles = useBudgetStyles();
  const allocations = summary.goal_allocations ?? [];
  const total =
    summary.goal_allocation_total ?? allocations.reduce((sum, item) => sum + item.amount, 0);
  if (!allocations.length) return null;
  return (
    <View style={styles.goalAllocationSection}>
      <Text style={styles.goalAllocationsTitle}>Goal allocations</Text>
      <Text style={styles.formHint}>
        Monthly Goal allocations are planned amounts only; they do not reduce income, wallet
        balances, or expenses.
      </Text>
      {allocations.map((allocation) => (
        <View key={allocation.goal_id} style={styles.goalAllocationRow}>
          <Text numberOfLines={1} style={styles.goalAllocationName}>
            {allocation.title}
          </Text>
          <Text style={styles.goalAllocationAmount}>{peso(allocation.amount)}/month</Text>
        </View>
      ))}
      <View style={styles.goalAllocationTotal}>
        <Text style={styles.goalAllocationTotalLabel}>Total goal allocations</Text>
        <Text style={styles.goalAllocationTotalValue}>{peso(total)}</Text>
      </View>
    </View>
  );
}

function BudgetProgressRow({
  icon,
  backgroundIcon,
  title,
  detail,
  percent,
  color,
  remaining,
}: {
  icon: ReactNode;
  backgroundIcon?: ReactNode;
  title: string;
  detail: string;
  percent: number;
  color: string;
  remaining: string;
}) {
  const styles = useBudgetStyles();
  const safePercent = Math.min(100, Math.max(0, percent));
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${title}, ${detail}, ${percent}% used, ${remaining}.`}
      style={styles.categoryCard}
    >
      {backgroundIcon ? (
        <View pointerEvents="none" style={styles.categoryBackdrop}>
          {backgroundIcon}
        </View>
      ) : null}
      <View style={styles.categoryHeader}>
        <View style={[styles.categoryIcon, { backgroundColor: `${color}22` }]}>{icon}</View>
        <View style={styles.categoryMain}>
          <Text numberOfLines={1} style={styles.categoryName}>
            {title}
          </Text>
          <Text style={[styles.categoryAmounts, percent > 100 && styles.over]}>{detail}</Text>
        </View>
        <Text style={[styles.categoryPercent, { color }]}>{percent}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${safePercent}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.remaining, percent > 100 && styles.over]}>{remaining}</Text>
    </View>
  );
}

function BudgetForm({
  month,
  summary,
  previousSummary,
  shortfalls,
  initialCategoryId,
  startEmpty = false,
  copyLastMonthSetup = false,
  pendingTemplate,
  onClose,
  onSaved,
}: {
  month: string;
  summary: Summary | null;
  previousSummary: Summary | null;
  shortfalls: Shortfall[];
  initialCategoryId?: string;
  startEmpty?: boolean;
  copyLastMonthSetup?: boolean;
  pendingTemplate?: BudgetTemplate | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const styles = useBudgetStyles();
  const initialEntries = useMemo(() => {
    if (pendingTemplate) {
      return recommendedBudgetEntries({
        categories: summary?.categories ?? [],
        template: pendingTemplate,
        monthlyBudget: summary?.budget_amount ?? 0,
      });
    }
    if (copyLastMonthSetup && previousSummary?.categories.length) {
      return previousSummary.categories
        .filter((category) => !category.goal)
        .map(({ name, budget, icon }) => ({
          id: `budget-copy-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name,
          budget,
          icon,
          persisted: false,
        }));
    }
    if (startEmpty) return [];
    const current = summary?.categories.filter((category) => !category.goal) ?? [];
    if (current.length)
      return [...current]
        .sort(
          (a, b) =>
            (shortfalls.some((item) => item.id === a.id) ? 0 : 1) -
            (shortfalls.some((item) => item.id === b.id) ? 0 : 1),
        )
        .map(({ id, name, budget, icon }) => ({
          id,
          name,
          budget,
          icon,
          persisted: true,
        }));
    return commonCategoryEntries();
  }, [copyLastMonthSetup, pendingTemplate, previousSummary, startEmpty, summary, shortfalls]);
  const [entries, setEntries] = useState<BudgetEntry[]>(initialEntries);
  const [monthlyBudget, setMonthlyBudget] = useState(() => String(summary?.budget_amount ?? (copyLastMonthSetup ? previousSummary?.budget_amount ?? '' : '')));
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialEntries.map((entry) => [entry.id, entry.budget ? String(entry.budget) : '']),
    ),
  );
  const [selectedId, setSelectedId] = useState(initialCategoryId ?? initialEntries[0]?.id ?? '');
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [customCategoryOpen, setCustomCategoryOpen] = useState(false);
  const [customCategoryError, setCustomCategoryError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const selectedEntry = entries.find((entry) => entry.id === selectedId);
  const amount = drafts[selectedId] ?? '';
  const options = useMemo(
    () =>
      entries.map((entry) => ({ label: entry.name, icon: categoryIcon(entry.name, entry.icon) })),
    [entries],
  );
  const availableCategories = useMemo(
    () =>
      budgetCategories.filter(
        (category) =>
          !entries.some((entry) => entry.name.toLowerCase() === category.label.toLowerCase()),
      ),
    [entries],
  );
  const selectedLabel = selectedEntry?.name ?? 'Category';
  const confirmedBudget = parseAmount(monthlyBudget) ?? 0;
  const replaceDraftEntries = (nextEntries: BudgetEntry[]) => {
    setEntries(nextEntries);
    setDrafts(
      Object.fromEntries(
        nextEntries.map((entry) => [entry.id, entry.budget ? String(entry.budget) : '']),
      ),
    );
    setSelectedId(nextEntries[0]?.id ?? '');
  };
  const copyLastMonth = () => {
    if (!previousSummary?.categories.length) return;
    const copied = copiedBudgetEntries(previousSummary.categories);
    setMonthlyBudget(
      String(previousSummary.budget_amount || copied.reduce((sum, entry) => sum + entry.budget, 0)),
    );
    replaceDraftEntries(copied);
  };
  const liveShortfalls = useMemo(() => {
    const source = summary?.categories ?? [];
    return entries.flatMap((entry) => {
      const category = source.find((item) => item.id === entry.id);
      if (!category || category.goal) return [];
      const budget = parseAmount(drafts[entry.id] ?? '') ?? 0;
      const committed = category.committed_amount ?? category.upcoming_amount ?? 0;
      const projected = category.spent + committed;
      if (projected <= budget) return [];
      return [
        {
          id: entry.id,
          name: entry.name,
          budget,
          spent: category.spent,
          shortfall: projected - budget,
          recommended: projected,
          reason: committed
            ? `${peso(category.spent)} spent plus ${peso(committed)} in confirmed commitments`
            : `Spent ${peso(category.spent)} of a ${peso(budget)} budget`,
        },
      ];
    });
  }, [drafts, entries, summary]);
  const selectedShortfall = liveShortfalls.find((item) => item.id === selectedId);
  const availableIncome = summary?.unallocated_income ?? 0;
  const requiredShortfall = liveShortfalls.reduce((sum, item) => sum + item.shortfall, 0);
  const currentAllocation = entries.reduce(
    (sum, entry) => sum + (parseAmount(drafts[entry.id] ?? '') ?? 0),
    0,
  );
  const allocationRemaining = confirmedBudget - currentAllocation;
  const originalAllocation = entries.reduce((sum, entry) => sum + entry.budget, 0);
  const allocationDelta = currentAllocation - originalAllocation;
  const remainingUnallocated = availableIncome - allocationDelta;

  const changeAmount = (value: string) => {
    setDrafts((current) => ({ ...current, [selectedId]: value }));
  };

  const useRecommended = () => {
    if (!selectedShortfall) return;
    setDrafts((current) => ({
      ...current,
      [selectedId]: String(Math.ceil(selectedShortfall.recommended)),
    }));
  };

  const applyAllRecommendations = () => {
    setDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, value]) => {
          const recommendation = liveShortfalls.find((item) => item.id === id);
          return [id, recommendation ? String(Math.ceil(recommendation.recommended)) : value];
        }),
      ),
    );
  };

  const addCategory = (label: string, icon?: string) => {
    const id = `budget-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    setEntries((current) => [...current, { id, name: label, budget: 0, icon, persisted: false }]);
    setDrafts((current) => ({ ...current, [id]: '' }));
    setSelectedId(id);
    setAddCategoryOpen(false);
  };

  const addCustomCategory = (name: string, icon: string) => {
    const label = name.trim();
    if (!label) {
      setCustomCategoryError('Enter a category name.');
      return;
    }
    if (entries.some((entry) => entry.name.trim().toLowerCase() === label.toLowerCase())) {
      setCustomCategoryError('That category is already in this budget.');
      return;
    }
    setCustomCategoryError('');
    addCategory(label, icon);
    setCustomCategoryOpen(false);
  };

  const save = async () => {
    if (!canStartBudgetSave(savingRef.current)) return;
    if (confirmedBudget <= 0) {
      setError('Enter a valid monthly budget.');
      return;
    }
    if (allocationRemaining < 0) {
      setError(
        `${peso(Math.abs(allocationRemaining))} is overallocated. Reduce a category before saving.`,
      );
      return;
    }
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
      setError('Each budget category must be unique.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const categories = entries
        .filter((entry) => entry.persisted || (parseAmount(drafts[entry.id] ?? '') ?? 0) > 0)
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          budget: parseAmount(drafts[entry.id] ?? '') ?? 0,
          ...(entry.icon ? { icon: entry.icon } : {}),
        }));
      await authenticatedApiRequest('/api/budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          categories,
          auto_distribute_savings: false,
          remaining_savings_behavior: 'leave_unallocated',
        }),
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this budget.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <FinanceFormSheet
      title={summary ? 'Edit budget' : 'Create budget'}
      eyebrow={monthLabel(month).toUpperCase()}
      amount={amount}
      onAmountChange={changeAmount}
      error={error}
      saving={saving}
      saveLabel={summary ? 'Save budget' : 'Create budget'}
      onSave={() => void save()}
      onClose={onClose}
    >
      <CurrencyInput
        label="Monthly budget"
        value={monthlyBudget}
        onChangeText={setMonthlyBudget}
        placeholder="e.g. 20,000"
      />
      <View style={styles.templateSummary} accessibilityRole="summary">
        <Text style={styles.templateSummaryText}>
          {false
            ? 'editable draft'
            : summary
              ? 'Edit your category limits'
              : 'Review your starting categories'}
        </Text>
        <Text style={styles.templateSummaryText}>
          Allocated {peso(currentAllocation)} ·{' '}
          {allocationRemaining >= 0
            ? `${peso(allocationRemaining)} remaining`
            : `${peso(Math.abs(allocationRemaining))} overallocated`}
        </Text>
      </View>
      <View style={styles.templateActions}>
        {!summary && previousSummary?.categories.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={copyLastMonth}
            style={styles.templatePrimary}
          >
            <Text style={styles.templatePrimaryText}>Copy last month</Text>
          </Pressable>
        ) : null}
        {!summary && (
          <Pressable
            accessibilityRole="button"
            onPress={() => replaceDraftEntries(initialEntries)}
            style={styles.templateSecondary}
          >
            <Text style={styles.templateSecondaryText}>Start with common categories</Text>
          </Pressable>
        )}
        {!summary && (
          <Pressable
            accessibilityRole="button"
            onPress={() => replaceDraftEntries([])}
            style={styles.templateSecondary}
          >
            <Text style={styles.templateSecondaryText}>Start empty</Text>
          </Pressable>
        )}
      </View>
      {!summary && (
        <Text style={styles.formHint}>
          We added common categories to help you get started. You can edit or remove any of them.
        </Text>
      )}
      {liveShortfalls.length ? (
        <View style={styles.editSummary} accessibilityRole="summary">
          <Text style={styles.editSummaryTitle}>
            {summary ? `Adjust ${monthLabel(month)}` : 'Set your budget'}
          </Text>
          <Text style={styles.editSummaryText}>
            {liveShortfalls.length} categor{liveShortfalls.length === 1 ? 'y needs' : 'ies need'}{' '}
            {peso(requiredShortfall)} more.
          </Text>
          <Text style={styles.editSummaryLine}>
            Available to allocate:{' '}
            <Text style={styles.editSummaryValue}>{peso(availableIncome)}</Text>
          </Text>
          <Text style={styles.editSummaryLine}>
            Required adjustment:{' '}
            <Text style={styles.editSummaryValue}>{peso(requiredShortfall)}</Text>
          </Text>
          <Text style={[styles.editSummaryLine, remainingUnallocated < 0 && styles.over]}>
            After changes:{' '}
            <Text style={styles.editSummaryValue}>
              {remainingUnallocated >= 0
                ? peso(remainingUnallocated)
                : `${peso(Math.abs(remainingUnallocated))} overallocated`}
            </Text>
          </Text>
          {availableIncome >= requiredShortfall ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apply all recommended budget adjustments"
              onPress={applyAllRecommendations}
              style={({ pressed }) => [styles.recommendButton, pressed && styles.pressed]}
            >
              <Text style={styles.recommendButtonText}>Apply all recommendations</Text>
            </Pressable>
          ) : (
            <Text style={styles.shortfallWarning}>
              You have {peso(availableIncome)} available, but categories need{' '}
              {peso(requiredShortfall)}. Review adjustments before saving.
            </Text>
          )}
        </View>
      ) : null}
      <CategoryChipRow
        label="Budget category"
        value={selectedLabel}
        onChange={(label) =>
          setSelectedId(entries.find((entry) => entry.name === label)?.id ?? selectedId)
        }
        options={options}
        showAllOptions
        warningByLabel={Object.fromEntries(
          liveShortfalls.map((item) => [item.name, peso(item.shortfall)]),
        )}
        onAdd={() => setAddCategoryOpen(true)}
      />
      {selectedShortfall ? (
        <View
          style={styles.shortfallCard}
          accessibilityRole="summary"
          accessibilityLabel={`${selectedShortfall.name} short by ${Math.round(selectedShortfall.shortfall)} pesos`}
        >
          <Text style={styles.shortfallCardTitle}>{selectedShortfall.name} needs attention</Text>
          <Text style={styles.formHint}>{selectedShortfall.reason}</Text>
          <Text style={styles.shortfallDetail}>
            Current budget: {peso(selectedShortfall.budget)}
          </Text>
          <Text style={styles.shortfallDetail}>
            Additional amount needed: {peso(selectedShortfall.shortfall)}
          </Text>
          <Text style={styles.shortfallDetail}>
            Recommended new budget: {peso(selectedShortfall.recommended)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${Math.round(selectedShortfall.shortfall)} pesos to ${selectedShortfall.name} budget`}
            onPress={useRecommended}
            style={({ pressed }) => [styles.recommendButton, pressed && styles.pressed]}
          >
            <Text style={styles.recommendButtonText}>Add {peso(selectedShortfall.shortfall)}</Text>
          </Pressable>
        </View>
      ) : null}
      {addCategoryOpen ? (
        <BudgetCategoryPicker
          visible
          options={availableCategories}
          onClose={() => setAddCategoryOpen(false)}
          onSelect={(label) => addCategory(label)}
          onCustom={() => {
            setAddCategoryOpen(false);
            setCustomCategoryOpen(true);
          }}
        />
      ) : null}
      {customCategoryOpen ? (
        <CustomCategorySheet
          visible
          error={customCategoryError}
          onClose={() => {
            setCustomCategoryOpen(false);
            setCustomCategoryError('');
          }}
          onAdd={addCustomCategory}
        />
      ) : null}
      <View style={styles.limitPreview}>
        <Text style={styles.limitLabel}>{selectedLabel}</Text>
        <Text style={[styles.limitLabel, { fontSize: 13 }]}>
          {amount ? `₱${amount}` : 'No limit set'}
        </Text>
      </View>
    </FinanceFormSheet>
  );
}

function TemplatePicker({
  month,
  visible,
  previousSummary,
  onClose,
  onSelect,
  onCopyLastMonth,
  onCustom,
}: {
  month: string;
  visible: boolean;
  previousSummary: Summary | null;
  onClose: () => void;
  onSelect: (template: BudgetTemplate) => void;
  onCopyLastMonth: () => void;
  onCustom: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useBudgetStyles();
  const [selectedTemplate, setSelectedTemplate] = useState<BudgetTemplate | null>(null);
  const close = () => {
    setSelectedTemplate(null);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.addCategoryBackdrop} onPress={close}>
        <Pressable
          style={[styles.addCategorySheet, { backgroundColor: colors.surface }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.addCategoryHeader}>
            <View>
              <Text style={[styles.addCategoryTitle, { color: colors.textPrimary }]}>
                Choose a starting setup
              </Text>
              <Text style={[styles.muted, { color: colors.textSecondary }]}>
                Start with an editable plan for {monthLabel(month)}.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close template picker"
              onPress={close}
              style={styles.iconClose}
            >
              <X size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.templateList}
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy last month's budget"
              disabled={!previousSummary?.categories.some((category) => !category.goal)}
              onPress={onCopyLastMonth}
              style={({ pressed }) => [
                styles.templateCard,
                { backgroundColor: colors.surfaceInput, borderColor: colors.border },
                !previousSummary?.categories.some((category) => !category.goal) && { opacity: 0.55 },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.templateName, { color: colors.textPrimary }]}>Copy last month</Text>
              <Text style={[styles.templateDescription, { color: colors.textSecondary }]}>Reuse your most recent budget categories and limits.</Text>
              <Text style={[styles.templatePreview, { color: colors.primary }]}>
                {previousSummary?.categories.some((category) => !category.goal)
                  ? `${monthLabel(previousSummary.month)} · ${previousSummary.categories.filter((category) => !category.goal).length} categories · ${peso(previousSummary.budget_amount)}`
                  : 'No previous budget is available to copy.'}
              </Text>
            </Pressable>
            {[recommendedBudgetTemplate].map((template) => (
              <Pressable
                key={template.id}
                accessibilityRole="button"
                accessibilityLabel={`Use ${template.name} template`}
                onPress={() => setSelectedTemplate(template)}
                style={({ pressed }) => [
                  styles.templateCard,
                  { backgroundColor: colors.surfaceInput, borderColor: colors.border },
                  selectedTemplate?.id === template.id && {
                    borderColor: colors.primary,
                    backgroundColor: colors.primarySoft,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.templateName, { color: colors.textPrimary }]}>
                  {template.name}
                </Text>
                <Text style={[styles.templateDescription, { color: colors.textSecondary }]}>
                  {template.description}
                </Text>
                <Text style={[styles.templatePreview, { color: colors.primary }]}>
                  {template.preview}
                </Text>
              </Pressable>
            ))}
            {selectedTemplate ? (
              <View style={[styles.templateConfirm, { backgroundColor: colors.surfaceInput }]}>
                <Text style={[styles.templateConfirmTitle, { color: colors.textPrimary }]}>
                  Preview: {selectedTemplate.name}
                </Text>
                <Text style={[styles.templateDescription, { color: colors.textSecondary }]}>
                  Saving replaces only this month&apos;s category limits. Expenses and transactions
                  remain unchanged.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Apply ${selectedTemplate.name} setup`}
                  onPress={() => {
                    setSelectedTemplate(null);
                    onSelect(selectedTemplate);
                  }}
                  style={({ pressed }) => [styles.templatePrimary, pressed && styles.pressed]}
                >
                  <Text style={styles.templatePrimaryText}>Apply setup</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onCustom}
              style={[
                styles.templateCard,
                styles.templateCustom,
                { borderColor: colors.primary, backgroundColor: colors.primarySoft },
              ]}
            >
              <Text style={[styles.templateName, { color: colors.primary }]}>Custom</Text>
              <Text style={[styles.templateDescription, { color: colors.textSecondary }]}>
                Start with no template allocations and build your own plan.
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BudgetCategoryPicker({
  visible,
  options,
  onClose,
  onSelect,
  onCustom,
}: {
  visible: boolean;
  options: { label: string; icon: LucideIcon }[];
  onClose: () => void;
  onSelect: (label: string) => void;
  onCustom: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useBudgetStyles();
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.addCategoryBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.addCategorySheet, { backgroundColor: colors.surface }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.addCategoryHeader}>
            <View>
              <Text style={[styles.addCategoryTitle, { color: colors.textPrimary }]}>
                Add budget category
              </Text>
              <Text style={[styles.muted, { color: colors.textSecondary }]}>
                Choose a category to add to this budget.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close add category"
              onPress={onClose}
              style={styles.iconClose}
            >
              <X size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          <View
            style={[
              styles.categorySearch,
              { backgroundColor: colors.surfaceInput, borderColor: colors.border },
            ]}
          >
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search categories"
              placeholderTextColor={colors.textSecondary}
              style={[styles.categorySearchInput, { color: colors.textPrimary }]}
              autoCapitalize="words"
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.addCategoryList}
            keyboardShouldPersistTaps="handled"
          >
            {filtered.map(({ label, icon: Icon }) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                onPress={() => onSelect(label)}
                style={({ pressed }) => [
                  styles.addCategoryOption,
                  { backgroundColor: colors.surfaceInput, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Icon size={18} color={getCategoryMeta(label).color} />
                <Text style={[styles.addCategoryText, { color: colors.textPrimary }]}>{label}</Text>
                <Plus size={16} color={colors.primary} />
              </Pressable>
            ))}
            {!filtered.length ? (
              <Text style={[styles.muted, { color: colors.textSecondary }]}>
                No categories match your search.
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onCustom}
              style={({ pressed }) => [
                styles.addCategoryOption,
                styles.customCategoryOption,
                { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <Plus size={18} color={colors.primary} />
              <Text style={[styles.addCategoryText, { color: colors.primary }]}>
                Other / Custom
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CustomCategorySheet({
  visible,
  error,
  onClose,
  onAdd,
}: {
  visible: boolean;
  error: string;
  onClose: () => void;
  onAdd: (name: string, icon: string) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useBudgetStyles();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(customCategoryIcons[0].key);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.addCategoryBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.addCategorySheet, { backgroundColor: colors.surface }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.addCategoryHeader}>
            <Text style={[styles.addCategoryTitle, { color: colors.textPrimary }]}>
              Custom category
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close custom category"
              onPress={onClose}
              style={styles.iconClose}
            >
              <X size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          <Text style={[styles.customFieldLabel, { color: colors.textSecondary }]}>
            Category name *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Pet care"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.customNameInput,
              {
                backgroundColor: colors.surfaceInput,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            autoCapitalize="words"
          />
          <Text style={[styles.customFieldLabel, { color: colors.textSecondary }]}>
            Choose icon
          </Text>
          <View style={styles.customIconGrid}>
            {customCategoryIcons.map(({ key, label, icon: Icon }) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: icon === key }}
                onPress={() => setIcon(key)}
                style={[
                  styles.customIconOption,
                  {
                    backgroundColor: colors.surfaceInput,
                    borderColor: icon === key ? colors.primary : colors.border,
                  },
                  icon === key && { backgroundColor: colors.primarySoft },
                ]}
              >
                <Icon size={19} color={icon === key ? colors.primary : colors.textSecondary} />
              </Pressable>
            ))}
          </View>
          {error ? (
            <Text style={[styles.customCategoryError, { color: colors.danger }]}>{error}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => onAdd(name, icon)}
            style={({ pressed }) => [
              styles.customCategorySave,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.customCategorySaveText}>Add category</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

function Section({ title, action, children }: SectionProps) {
  const styles = useBudgetStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function createStyles(palette: typeof formPalette) {
  return StyleSheet.create({
    // Goal allocations
    goalAllocationSection: {
      marginTop: 18,
      padding: 16,
      borderRadius: 18,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    goalAllocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 10,
    },
    goalAllocationName: { flex: 1, color: palette.ink, fontSize: 12, fontWeight: '800' },
    goalAllocationAmount: { color: palette.accent, fontSize: 11, fontWeight: '900' },
    goalAllocationTotal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: palette.line,
    },
    goalAllocationTotalLabel: { color: palette.muted, fontSize: 11, fontWeight: '800' },
    goalAllocationTotalValue: { color: palette.ink, fontSize: 16, fontWeight: '900' },
    savingsNudge: {
      minHeight: 28,
      justifyContent: 'center',
      marginTop: -2,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: '#FFF4D6',
    },
    savingsNudgeText: { color: '#9A6700', fontSize: 11, fontWeight: '800' },
    remaining: { marginTop: 8, color: palette.muted, fontSize: 11, fontWeight: '800' },
    // Budget summary
    tipWarning: { backgroundColor: palette.danger + '18' },
    tipWarningText: { color: palette.danger },
    summaryCard: {
      marginBottom: 14,
      overflow: 'hidden',
      padding: 16,
      borderRadius: 20,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    summaryEyebrow: {
      color: '#D8EFE2',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
    },
    summaryMonth: { color: '#BFE3D0', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
    summaryBody: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
    percentBlock: {
      width: 68,
      height: 68,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 34,
      backgroundColor: 'rgba(5, 64, 46, 0.38)',
      borderWidth: 1,
      borderColor: 'rgba(216, 239, 226, 0.18)',
    },
    percentValue: { fontSize: 18, fontWeight: '900' },
    percentLabel: {
      marginTop: 1,
      color: '#BFE3D0',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    summaryMetrics: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    metric: { flex: 1, minWidth: 0 },
    metricLabel: { color: '#BFE3D0', fontSize: 10, fontWeight: '800' },
    metricValue: { marginTop: 5, color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    metricPositive: { color: '#A9F0C9' },
    metricDanger: { color: '#FFD3D0' },
    summaryTrack: {
      height: 6,
      marginTop: 16,
      overflow: 'hidden',
      borderRadius: 3,
      backgroundColor: 'rgba(216, 239, 226, 0.22)',
    },
    summaryFill: { height: '100%', borderRadius: 3 },
    // Screen layout and category budget cards
    safe: { flex: 1, backgroundColor: palette.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      backgroundColor: palette.surface,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
    titleWrap: { flex: 1, marginLeft: 12 },
    eyebrow: { color: palette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
    title: { marginTop: 3, color: palette.ink, fontSize: 23, fontWeight: '900' },
    content: { padding: 20, paddingTop: 16, paddingBottom: 44 },
    tip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 16,
      backgroundColor: palette.accent,
    },
    tipText: { flex: 1, color: '#fff', fontSize: 12, lineHeight: 18, fontWeight: '700' },
    ringSummary: { alignItems: 'center', marginBottom: 16, paddingVertical: 10 },
    ringEyebrow: {
      marginBottom: 14,
      color: palette.accent,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
    },
    ringCenter: { width: 135, alignItems: 'center' },
    ringLabel: { color: palette.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
    ringValue: {
      width: 130,
      marginTop: 5,
      color: palette.ink,
      fontSize: 25,
      fontWeight: '900',
      textAlign: 'center',
    },
    ringSupporting: {
      marginTop: 14,
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    ringLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 7,
      marginTop: 14,
    },
    legendChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 30,
      paddingHorizontal: 10,
      borderRadius: 15,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    legendDot: { width: 7, height: 7, borderRadius: 4 },
    legendText: { color: palette.muted, fontSize: 10, fontWeight: '800' },
    section: {
      marginTop: 22,
      padding: 16,
      borderRadius: 18,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    sectionHeading: {
      minHeight: 42,
      marginBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    sectionTitle: { flex: 1, color: palette.ink, fontSize: 16, fontWeight: '900' },
    sectionActions: { alignItems: 'flex-end', gap: 5 },
    sectionAction: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      borderRadius: 21,
      backgroundColor: palette.accentPale,
    },
    sectionActionText: { color: palette.accentDark, fontSize: 11, fontWeight: '900' },
    setupAction: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 8 },
    setupActionText: { color: palette.accent, fontSize: 10, fontWeight: '900' },
    shortfallNotice: {
      marginBottom: 12,
      padding: 13,
      borderRadius: 15,
      backgroundColor: '#9A670018',
      borderWidth: 1,
      borderColor: '#B7791F66',
    },
    shortfallNoticeTitle: { color: '#B7791F', fontSize: 12, fontWeight: '900' },
    shortfallNoticeText: {
      marginTop: 4,
      color: palette.muted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '700',
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    track: {
      height: 8,
      marginTop: 8,
      overflow: 'hidden',
      borderRadius: 4,
      backgroundColor: palette.accentPale,
    },
    fill: { height: '100%', borderRadius: 4, backgroundColor: palette.accent },
    categoryList: { gap: 10 },
    categoryCard: {
      position: 'relative',
      overflow: 'hidden',
      padding: 14,
      borderRadius: 17,
      backgroundColor: palette.background,
    },
    categoryBackdrop: { position: 'absolute', right: -12, bottom: -22 },
    categoryIcon: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
    },
    categoryMain: { flex: 1, marginLeft: 10 },
    categoryName: { color: palette.ink, fontSize: 14, fontWeight: '900' },
    categoryAmounts: { marginTop: 4, color: palette.muted, fontSize: 11, fontWeight: '700' },
    categoryPercent: { color: palette.accent, fontSize: 13, fontWeight: '900' },
    over: { color: palette.danger },
    warning: { marginTop: 8, color: palette.danger, fontSize: 11, fontWeight: '800' },
    allocationContext: {
      marginTop: -8,
      marginBottom: 16,
      color: palette.muted,
      fontSize: 11,
      lineHeight: 17,
      fontWeight: '600',
    },
    allocationTotal: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    allocationTotalLabel: { color: palette.muted, fontSize: 11, fontWeight: '800' },
    allocationTotalValue: { color: palette.ink, fontSize: 22, fontWeight: '900' },
    allocationLegend: { gap: 9, marginTop: 13 },
    allocationLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    allocationDot: { width: 9, height: 9, borderRadius: 5 },
    unallocatedDot: { backgroundColor: '#AAB5AF' },
    allocationLegendLabel: { flex: 1, color: palette.muted, fontSize: 11, fontWeight: '700' },
    allocationLegendAmount: { color: palette.ink, fontSize: 11, fontWeight: '900' },
    allocationPrompt: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: palette.accentPale,
    },
    allocationPromptCopy: { flex: 1 },
    allocationPromptTitle: { color: palette.accentDark, fontSize: 12, fontWeight: '900' },
    allocationPromptText: {
      marginTop: 3,
      color: palette.muted,
      fontSize: 10,
      fontWeight: '700',
    },
    goalAllocations: { gap: 10, marginTop: 18 },
    goalAllocationsTitle: { color: palette.ink, fontSize: 12, fontWeight: '900' },
    noGoalAllocation: {
      marginTop: 18,
      padding: 14,
      borderRadius: 15,
      backgroundColor: palette.background,
      color: palette.muted,
      fontSize: 11,
      lineHeight: 17,
      textAlign: 'center',
    },
    muted: { marginTop: 4, color: palette.muted, fontSize: 12, lineHeight: 18 },
    card: {
      margin: 20,
      padding: 18,
      borderRadius: 18,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
    retry: {
      alignSelf: 'flex-start',
      marginTop: 14,
      padding: 10,
      borderRadius: 15,
      backgroundColor: palette.accentPale,
    },
    retryText: { color: palette.accent, fontWeight: '900' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyCard: {
      alignItems: 'center',
      margin: 20,
      padding: 24,
      borderRadius: 22,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.line,
    },
    emptyIcon: {
      width: 58,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 29,
      backgroundColor: palette.accentPale,
    },
    emptyTitle: {
      marginTop: 15,
      color: palette.ink,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyCopy: {
      marginTop: 8,
      color: palette.muted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
    },
    emptyAction: {
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
      paddingHorizontal: 24,
      borderRadius: 25,
      backgroundColor: palette.accent,
    },
    emptyActionText: { color: '#fff', fontWeight: '900' },
    noLimitsCard: {
      padding: 14,
      borderRadius: 16,
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: palette.line,
    },
    noLimitsTitle: { color: palette.ink, fontSize: 15, fontWeight: '900' },
    noLimitsCopy: { marginTop: 6, color: palette.muted, fontSize: 12, lineHeight: 18 },
    manualAction: {
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.surface,
    },
    manualActionText: { color: palette.accent, fontSize: 12, fontWeight: '900' },
    pressed: { opacity: 0.72 },
    formHint: { color: palette.muted, fontSize: 12, lineHeight: 18 },
    templateSummary: {
      marginTop: 12,
      padding: 12,
      borderRadius: 15,
      backgroundColor: palette.background,
    },
    templateSummaryText: { color: palette.muted, fontSize: 11, lineHeight: 17, fontWeight: '700' },
    templateActions: { gap: 8, marginTop: 12 },
    templatePrimary: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor: palette.accent,
    },
    templatePrimaryText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    templateSecondary: {
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.surface,
    },
    templateSecondaryText: { color: palette.accent, fontSize: 12, fontWeight: '900' },
    templateList: { gap: 10, paddingTop: 18, paddingBottom: 20 },
    templateCard: { padding: 15, borderRadius: 17, borderWidth: 1 },
    templateCustom: { borderStyle: 'dashed' },
    templateName: { fontSize: 14, fontWeight: '900' },
    templateDescription: { marginTop: 5, fontSize: 11, lineHeight: 17 },
    templatePreview: { marginTop: 8, fontSize: 11, fontWeight: '900' },
    templateConfirm: { marginTop: 2, padding: 14, borderRadius: 17 },
    templateConfirmTitle: { fontSize: 14, fontWeight: '900' },
    limitPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      padding: 14,
      borderRadius: 16,
      backgroundColor: palette.accentPale,
    },
    limitLabel: { color: palette.accentDark, fontSize: 12, fontWeight: '900' },
    editSummary: {
      marginTop: 14,
      padding: 14,
      borderRadius: 16,
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: palette.line,
    },
    editSummaryTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
    editSummaryText: { marginTop: 4, color: palette.muted, fontSize: 12, fontWeight: '800' },
    editSummaryLine: { marginTop: 8, color: palette.muted, fontSize: 11, fontWeight: '700' },
    editSummaryValue: { color: palette.ink, fontWeight: '900' },
    recommendButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 11,
      paddingHorizontal: 14,
      borderRadius: 22,
      backgroundColor: palette.accentPale,
    },
    recommendButtonText: { color: palette.accentDark, fontSize: 11, fontWeight: '900' },
    shortfallWarning: {
      marginTop: 10,
      color: '#B7791F',
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '800',
    },
    shortfallCard: {
      marginTop: 14,
      padding: 14,
      borderRadius: 16,
      backgroundColor: '#9A670018',
      borderWidth: 1,
      borderColor: '#B7791F66',
    },
    shortfallCardTitle: { color: '#B7791F', fontSize: 13, fontWeight: '900' },
    shortfallDetail: { marginTop: 7, color: palette.ink, fontSize: 11, fontWeight: '800' },
    recurring: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      padding: 15,
      borderRadius: 17,
      backgroundColor: palette.background,
    },
    recurringCopy: { flex: 1, paddingRight: 10 },
    recurringTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
    preference: { marginTop: 16 },
    preferenceLabel: { marginBottom: 8, color: palette.muted, fontSize: 11, fontWeight: '900' },
    preferenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    preferenceChip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 15,
      backgroundColor: palette.background,
    },
    preferenceActive: {
      backgroundColor: palette.accentPale,
      borderWidth: 1,
      borderColor: palette.accent,
    },
    preferenceText: { color: palette.muted, fontSize: 11, fontWeight: '800' },
    preferenceTextActive: { color: palette.accentDark },
    // Custom-category sheet
    addCategoryBackdrop: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(17,35,28,0.35)',
    },
    addCategorySheet: {
      padding: 20,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      backgroundColor: palette.surface,
    },
    addCategoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    addCategoryTitle: { color: palette.ink, fontSize: 18, fontWeight: '900' },
    addCategoryList: { gap: 8 },
    addCategoryOption: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: palette.background,
    },
    addCategoryText: { flex: 1, color: palette.ink, fontSize: 13, fontWeight: '800' },
    iconClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    categorySearch: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginBottom: 12,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
    },
    categorySearchInput: { flex: 1, minHeight: 46, paddingVertical: 0, fontSize: 14 },
    customCategoryOption: { marginTop: 4 },
    customFieldLabel: { marginTop: 12, marginBottom: 7, fontSize: 11, fontWeight: '900' },
    customNameInput: {
      minHeight: 48,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
      fontSize: 14,
    },
    customIconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    customIconOption: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
    },
    customCategoryError: { marginTop: 10, fontSize: 12, fontWeight: '700' },
    customCategorySave: {
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
      borderRadius: 25,
    },
    customCategorySaveText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  });
}
