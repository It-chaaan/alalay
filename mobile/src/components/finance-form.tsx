import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Bolt,
  CarFront,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Droplets,
  Film,
  Gift,
  GraduationCap,
  Grid2X2,
  HeartPulse,
  Home,
  House,
  PawPrint,
  Plane,
  ShieldCheck,
  Sparkles,
  Dumbbell,
  Users,
  HandCoins,
  Laptop,
  BriefcaseBusiness,
  Code2,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  ShoppingBag,
  Smartphone,
  Utensils,
  Wifi,
  type LucideIcon,
} from 'lucide-react-native';

import { useModalVisibility } from './modal-visibility';
import { useAppTheme } from '@/theme/theme';
import { getCategoryMeta } from '@/constants/categories';

export const formPalette = {
  background: '#F4F7F1',
  balance: '#0F8A6B',
  progressTrack: '#D8EFE2',
  progressFill: '#0F8A6B',
  secondarySurface: '#E8F5EE',
  secondaryText: '#08654E',
  surface: '#FFFFFF',
  ink: '#11231C',
  muted: '#5D6C65',
  accent: '#0F8A6B',
  accentDark: '#08654E',
  accentPale: '#D8EFE2',
  line: '#DCE8E0',
  danger: '#B42318',
};

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type CategoryOption = { label: string; icon: LucideIcon };

export const billCategories: CategoryOption[] = [
  { label: 'Electricity', icon: Bolt },
  { label: 'Water', icon: Droplets },
  { label: 'Internet', icon: Wifi },
  { label: 'Rent', icon: Home },
  { label: 'Mobile / Phone', icon: Smartphone },
  { label: 'Mortgage', icon: Home }, { label: 'Gas', icon: Bolt }, { label: 'Cable / TV', icon: Film },
  { label: 'Credit Card', icon: CreditCard }, { label: 'Loan', icon: HandCoins }, { label: 'Insurance', icon: ShieldCheck }, { label: 'Taxes', icon: Receipt },
  { label: 'HOA / Association', icon: Home }, { label: 'Tuition / School', icon: GraduationCap }, { label: 'Maintenance', icon: Bolt },
  { label: 'Other', icon: MoreHorizontal },
];

export const subscriptionCategories: CategoryOption[] = [
  { label: 'Streaming', icon: Film }, { label: 'Music', icon: Smartphone }, { label: 'Gaming', icon: Grid2X2 }, { label: 'News / Media', icon: Receipt },
  { label: 'Software', icon: Laptop }, { label: 'AI Tools', icon: Sparkles }, { label: 'Cloud Storage', icon: Wifi }, { label: 'Productivity', icon: BriefcaseBusiness },
  { label: 'Developer Tools', icon: Code2 }, { label: 'Fitness', icon: Dumbbell }, { label: 'Membership', icon: Users }, { label: 'Education', icon: GraduationCap },
  { label: 'Delivery / Shopping', icon: ShoppingBag }, { label: 'Other', icon: MoreHorizontal },
];

export const expenseCategories: CategoryOption[] = [
  { label: 'Essentials', icon: ShoppingBag }, { label: 'Food', icon: Utensils }, { label: 'Groceries', icon: ShoppingBag },
  { label: 'Transport', icon: CarFront }, { label: 'Housing / Rent', icon: House }, { label: 'Utilities', icon: Bolt }, { label: 'Bills', icon: Receipt },
  { label: 'Healthcare', icon: HeartPulse }, { label: 'Education', icon: GraduationCap }, { label: 'Lifestyle', icon: Sparkles }, { label: 'Shopping', icon: ShoppingBag },
  { label: 'Dining Out', icon: Utensils }, { label: 'Entertainment', icon: Film }, { label: 'Travel', icon: Plane }, { label: 'Personal Care', icon: Sparkles },
  { label: 'Fitness', icon: Dumbbell }, { label: 'Financial / Other', icon: HandCoins }, { label: 'Subscriptions', icon: Repeat }, { label: 'Insurance', icon: ShieldCheck },
  { label: 'Debt / Loan', icon: CreditCard }, { label: 'Gifts / Donations', icon: Gift }, { label: 'Family', icon: Users }, { label: 'Pets', icon: PawPrint }, { label: 'Other', icon: Grid2X2 },
];

export const budgetCategories: CategoryOption[] = [
  { label: 'Food', icon: Utensils },
  { label: 'Transport', icon: CarFront },
  { label: 'Subscriptions', icon: Repeat },
  { label: 'Rent', icon: Home },
  { label: 'Water', icon: Droplets },
  { label: 'Electricity', icon: Bolt },
  { label: 'Internet', icon: Wifi },
  { label: 'Groceries', icon: ShoppingBag },
  { label: 'Healthcare', icon: HeartPulse },
  { label: 'Education', icon: GraduationCap },
  { label: 'Entertainment', icon: Film },
  { label: 'Dining Out', icon: Utensils },
  { label: 'Shopping', icon: ShoppingBag },
  { label: 'Travel', icon: Plane },
  { label: 'Insurance', icon: ShieldCheck },
  { label: 'Debt / Loan', icon: CreditCard },
  { label: 'Personal Care', icon: Sparkles },
  { label: 'Gifts / Donations', icon: Gift },
  { label: 'Family', icon: Users },
  { label: 'Pets', icon: PawPrint },
];

export const savingsBudgetOption: CategoryOption = { label: 'Savings budget', icon: PiggyBank };

export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned || !/^\d+(?:\.\d{0,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

export function formatAmountForDisplay(value: string) {
  if (!value || value === '0') return '0';
  return value.replace(/\d+(?:\.\d*)?/g, (token) => {
    const [whole, decimal] = token.split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decimal === undefined ? grouped : grouped + '.' + decimal;
  });
}

const BACKSPACE_KEY = '\u232B';
export function NumericKeypad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { colors } = useAppTheme();
  const press = (key: string) => {
    if (key === 'clear') {
      onChange('');
      return;
    }
    if (key === BACKSPACE_KEY) {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '00') {
      onChange(value === '0' ? '0' : value + '00');
      return;
    }
    if (/\d/.test(key)) {
      onChange(value === '0' ? key : value + key);
      return;
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', BACKSPACE_KEY];
  return <View style={[keypadStyles.wrap, { backgroundColor: colors.surface }]}>
    <View style={keypadStyles.row}>
      <Text style={[keypadStyles.expression, { color: colors.textPrimary }]}>{formatAmountForDisplay(value)}</Text>
    </View>
    <View style={keypadStyles.grid}>
      {keys.map((key) => {
        const isBackspace = key === BACKSPACE_KEY;
        const action = isBackspace || key === '00';
        return <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={isBackspace ? 'Backspace' : key}
          onPress={() => press(key)}
          style={({ pressed }) => [keypadStyles.key, { backgroundColor: action ? colors.accentPale : colors.surfaceSecondary }, pressed && keypadStyles.pressed]}
        >
          <Text style={[keypadStyles.keyText, { color: action ? colors.accent : colors.textPrimary }]}>{isBackspace ? BACKSPACE_KEY : key}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

export function CategoryChipRow({ value, onChange, options, label = 'Category (optional)', customValue, onCustomValueChange, customLabel = 'Specify category *', showAllOptions = false, onAdd }: { value: string; onChange: (value: string) => void; options: CategoryOption[]; label?: string; customValue?: string; onCustomValueChange?: (value: string) => void; customLabel?: string; showAllOptions?: boolean; onAdd?: () => void }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const visibleOptions = showAllOptions || options.length <= 6 ? options : options.slice(0, 4);
  return <View style={chipStyles.section}>
    <Text style={chipStyles.label}>{label}</Text>
    <View style={chipStyles.wrap}>
      {visibleOptions.map(({ label: optionLabel }) => { const meta = getCategoryMeta(optionLabel); const Icon = meta.icon; return <Pressable
        key={optionLabel}
        accessibilityRole="button"
        accessibilityState={{ selected: value === optionLabel }}
        onPress={() => onChange(optionLabel)}
        style={({ pressed }) => [chipStyles.chip, { backgroundColor: colors.surfaceInput, borderColor: colors.border, borderWidth: 1 }, value === optionLabel && { backgroundColor: colors.primarySoft, borderColor: colors.primary }, pressed && chipStyles.pressed]}
      >
        <Icon size={17} color={value === optionLabel ? meta.color : colors.textSecondary} strokeWidth={1.9} />
        <Text style={[chipStyles.text, { color: value === optionLabel ? meta.color : colors.textSecondary }, value === optionLabel && chipStyles.activeText]}>{optionLabel}</Text>
      </Pressable>; })}
      {onAdd ? <Pressable accessibilityRole="button" accessibilityLabel="Add budget category" onPress={onAdd} style={({ pressed }) => [chipStyles.chip, { backgroundColor: colors.surfaceInput, borderColor: colors.border, borderWidth: 1 }, pressed && chipStyles.pressed]}><Plus size={17} color={colors.primary} /><Text style={[chipStyles.text, { color: colors.primary }]}>+ Add</Text></Pressable> : options.length > 6 ? <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={({ pressed }) => [chipStyles.chip, pressed && chipStyles.pressed]}><Grid2X2 size={17} color={formPalette.muted} /><Text style={chipStyles.text}>More</Text></Pressable> : null}
    </View>
    {value === 'Other' && onCustomValueChange ? <FormTextInput label={customLabel} placeholder="Specify what this means" value={customValue ?? ''} onChangeText={onCustomValueChange} /> : null}
    {options.length > 6 && !showAllOptions && !onAdd ? <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><Pressable style={pickerStyles.backdrop} onPress={() => setOpen(false)}><Pressable style={pickerStyles.sheet} onPress={(event) => event.stopPropagation()}><View style={pickerStyles.header}><Text style={pickerStyles.title}>{label.replace(' *', '')}</Text><Pressable accessibilityRole="button" onPress={() => setOpen(false)}><Text style={pickerStyles.close}>×</Text></Pressable></View><ScrollView contentContainerStyle={pickerStyles.list}>{options.map(({ label: optionLabel, icon: Icon }) => <CategoryButton key={optionLabel} label={optionLabel} Icon={Icon} selected={value === optionLabel} onPress={() => { onChange(optionLabel); setOpen(false); }} />)}</ScrollView></Pressable></Pressable></Modal> : null}
  </View>;
}

export function ExpenseCategoryPicker({ value, onChange, customCategory, onCustomCategoryChange }: { value: string; onChange: (value: string) => void; customCategory?: string; onCustomCategoryChange?: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const quick = expenseCategories.filter((option) => ['Food', 'Groceries', 'Transport', 'Bills'].includes(option.label));
  return <View style={chipStyles.section}><Text style={chipStyles.label}>Category</Text><View style={chipStyles.wrap}>{quick.map(({ label: optionLabel, icon: Icon }) => <CategoryButton key={optionLabel} label={optionLabel} Icon={Icon} selected={value === optionLabel} onPress={() => onChange(optionLabel)} />)}<Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={({ pressed }) => [chipStyles.chip, pressed && chipStyles.pressed]}><Grid2X2 size={17} color={formPalette.muted} /><Text style={chipStyles.text}>More categories</Text></Pressable></View>{value === 'Other' && onCustomCategoryChange ? <FormTextInput label="Specify category" placeholder="e.g. Motorcycle repair" value={customCategory ?? ''} onChangeText={onCustomCategoryChange} /> : null}<Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><Pressable style={pickerStyles.backdrop} onPress={() => setOpen(false)}><Pressable style={pickerStyles.sheet} onPress={(event) => event.stopPropagation()}><View style={pickerStyles.header}><Text style={pickerStyles.title}>Choose category</Text><Pressable accessibilityRole="button" accessibilityLabel="Close category picker" onPress={() => setOpen(false)}><Text style={pickerStyles.close}>×</Text></Pressable></View><ScrollView contentContainerStyle={pickerStyles.list}>{expenseCategories.map(({ label: optionLabel, icon: Icon }) => <CategoryButton key={optionLabel} label={optionLabel} Icon={Icon} selected={value === optionLabel} onPress={() => { onChange(optionLabel); setOpen(false); }} />)}</ScrollView></Pressable></Pressable></Modal></View>;
}

function CategoryButton({ label, Icon, selected, onPress }: { label: string; Icon: LucideIcon; selected: boolean; onPress: () => void }) {
  const meta = getCategoryMeta(label);
  const CategoryIcon = meta.icon;
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [chipStyles.chip, selected && chipStyles.active, pressed && chipStyles.pressed]}><CategoryIcon size={17} color={selected ? meta.color : formPalette.muted} strokeWidth={1.9} /><Text style={[chipStyles.text, selected && { color: meta.color, fontWeight: '900' }]}>{label}</Text></Pressable>;
}

export function MultiCategoryChipRow({ value, onChange, options, label = 'Category' }: { value: string[]; onChange: (value: string[]) => void; options: CategoryOption[]; label?: string }) {
  const toggle = (category: string) => onChange(value.includes(category) ? value.filter((item) => item !== category) : [...value, category]);
  return <View style={chipStyles.section}>
    <View style={chipStyles.labelRow}><Text style={chipStyles.label}>{label}</Text>{value.length > 1 ? <Text style={chipStyles.selectionCount}>{value.length} selected</Text> : null}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chipStyles.row}>
      {options.map(({ label: optionLabel, icon: Icon }) => {
        const selected = value.includes(optionLabel);
        return <Pressable key={optionLabel} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => toggle(optionLabel)} style={({ pressed }) => [chipStyles.chip, selected && chipStyles.active, pressed && chipStyles.pressed]}>
          <Icon size={17} color={selected ? formPalette.accent : formPalette.muted} strokeWidth={1.9} />
          <Text style={[chipStyles.text, selected && chipStyles.activeText]}>{optionLabel}</Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

function toDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function DatePickerField({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const initial = toDate(value);
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const selected = toDate(value);
  const cells = useMemo(() => Array.from({ length: firstDay + daysInMonth }, (_, index) => index < firstDay ? null : index - firstDay + 1), [daysInMonth, firstDay]);

  const choose = (day: number) => {
    onChange(dateString(new Date(month.getFullYear(), month.getMonth(), day)));
    setOpen(false);
  };

  const today = dateString(new Date());
  const displayValue = value === today ? 'Today' : selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rowSurface = { backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.border };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${displayValue}`} onPress={() => { setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1)); setOpen(true); }} style={({ pressed }) => [compact ? dateStyles.rowField : dateStyles.field, rowSurface, compact && dateStyles.compactSurface, pressed && dateStyles.pressed]}>
      <CalendarDays size={19} color={colors.primary} />
      <Text style={[dateStyles.label, compact && dateStyles.rowLabel, { color: compact ? colors.textPrimary : colors.textSecondary }]}>{label}</Text>
      <View style={dateStyles.spacer} />
      <Text style={[dateStyles.value, { color: colors.textPrimary }]}>{displayValue}</Text>
      {compact ? <ChevronRight size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={dateStyles.backdrop}><View style={[dateStyles.modal, { backgroundColor: colors.surface }] }>
        <View style={dateStyles.modalHeader}><Text style={[dateStyles.modalTitle, { color: colors.textPrimary }]}>{label}</Text><Pressable accessibilityLabel="Close date picker" onPress={() => setOpen(false)}><Text style={[dateStyles.close, { color: colors.textPrimary }]}>×</Text></Pressable></View>
        <View style={dateStyles.monthHeader}><Pressable accessibilityLabel="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={[dateStyles.arrow, { backgroundColor: colors.surfaceInput }]}><ArrowLeft size={17} color={colors.textPrimary} /></Pressable><Text style={[dateStyles.month, { color: colors.textPrimary }]}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text><Pressable accessibilityLabel="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={[dateStyles.arrow, { backgroundColor: colors.surfaceInput }]}><ArrowRight size={17} color={colors.textPrimary} /></Pressable></View>
        <View style={dateStyles.weekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={[dateStyles.weekDay, { color: colors.textSecondary }]}>{day}</Text>)}</View>
        <View style={dateStyles.calendar}>{cells.map((day, index) => day === null ? <View key={`empty-${index}`} style={dateStyles.day} /> : <Pressable key={day} onPress={() => choose(day)} style={[dateStyles.day, selected.getFullYear() === month.getFullYear() && selected.getMonth() === month.getMonth() && selected.getDate() === day && { backgroundColor: colors.primary }]}><Text style={[dateStyles.dayText, { color: colors.textPrimary }, selected.getFullYear() === month.getFullYear() && selected.getMonth() === month.getMonth() && selected.getDate() === day && { color: colors.textOnPrimary, fontWeight: '900' }]}>{day}</Text></Pressable>)}</View>
        <Pressable onPress={() => { onChange(dateString(new Date())); setOpen(false); }} style={[dateStyles.today, { backgroundColor: colors.primarySoft }]}><Text style={[dateStyles.todayText, { color: colors.primary } ]}>Use today</Text></Pressable>
      </View></View>
    </Modal>
  </>;
}

export function FrequencyChips({ value, onChange, includeOneTime = false }: { value: Frequency | 'one-time'; onChange: (value: Frequency | 'one-time') => void; includeOneTime?: boolean }) {
  const values: (Frequency | 'one-time')[] = includeOneTime ? ['one-time', 'weekly', 'monthly', 'quarterly', 'yearly'] : ['weekly', 'monthly', 'quarterly', 'yearly'];
  return <View style={chipStyles.section}><Text style={chipStyles.label}>Frequency</Text><View style={chipStyles.wrap}>{values.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={({ pressed }) => [chipStyles.frequency, value === item && chipStyles.active, pressed && chipStyles.pressed]}><Text style={[chipStyles.text, value === item && chipStyles.activeText]}>{item === 'one-time' ? 'One-time' : item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View></View>;
}

export type IncomeFrequency = 'weekly' | 'monthly' | 'biweekly' | 'yearly';

export function IncomeFrequencyChips({ value, onChange }: { value: IncomeFrequency; onChange: (value: IncomeFrequency) => void }) {
  return <View style={chipStyles.section}><Text style={chipStyles.label}>Frequency</Text><View style={chipStyles.wrap}>{(['weekly', 'monthly', 'biweekly', 'yearly'] as const).map((item) => <Pressable key={item} onPress={() => onChange(item)} style={({ pressed }) => [chipStyles.frequency, value === item && chipStyles.active, pressed && chipStyles.pressed]}><Text style={[chipStyles.text, value === item && chipStyles.activeText]}>{item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View></View>;
}


export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}

type FinanceFormSheetProps = { title: string; eyebrow: string; amount: string; onAmountChange: (value: string) => void; children: ReactNode; error?: string; saving?: boolean; saveLabel: string; onSave: () => void; onClose: () => void };

export function FinanceFormSheet({ title, eyebrow, amount, onAmountChange, children, error, saving = false, saveLabel, onSave, onClose }: FinanceFormSheetProps) {
  const { colors } = useAppTheme();
  const keyboardVisible = useKeyboardVisible();
  const { setModalVisible } = useModalVisibility();
  useEffect(() => { setModalVisible(true); return () => setModalVisible(false); }, [setModalVisible]);
  return <View style={sheetStyles.overlay}><Pressable accessibilityLabel="Close add form" onPress={onClose} style={[sheetStyles.dismiss, { backgroundColor: colors.overlay }]} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0} style={sheetStyles.keyboard}>
    <View
      style={[sheetStyles.sheet, { backgroundColor: colors.surface }]}
    >
      <View style={sheetStyles.header}><View><Text style={[sheetStyles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text><Text style={[sheetStyles.title, { color: colors.ink }]}>{title}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={[sheetStyles.closeButton, { backgroundColor: colors.surfaceSecondary }]}><Text style={[sheetStyles.closeText, { color: colors.ink }]}>×</Text></Pressable></View>
      <ScrollView contentContainerStyle={sheetStyles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={sheetStyles.amountBlock}><Text style={[sheetStyles.amountPrefix, { color: colors.accent }]}>₱</Text><Text style={[sheetStyles.amount, { color: colors.ink }]}>{formatAmountForDisplay(amount)}</Text></View>
        {children}
        {error ? <Text style={[sheetStyles.error, { color: colors.danger }]}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={saving} onPress={onSave} style={({ pressed }) => [sheetStyles.save, { backgroundColor: colors.accent }, saving && sheetStyles.saveDisabled, pressed && sheetStyles.pressed]}>{saving ? <ActivityIndicator color={colors.inverse} /> : <><Plus size={19} color={colors.inverse} strokeWidth={2.4} /><Text style={[sheetStyles.saveText, { color: colors.inverse }]}>{saveLabel}</Text></>}</Pressable>
      </ScrollView>
      {!keyboardVisible && <NumericKeypad value={amount} onChange={onAmountChange} />}
    </View>
  </KeyboardAvoidingView></View>;
}

export const formInputStyle = { minHeight: 54, paddingHorizontal: 16, borderRadius: 17, backgroundColor: formPalette.background, color: formPalette.ink, fontSize: 15 };

export function FormTextInput({ label, placeholder, value, onChangeText, multiline = false }: { label?: string; placeholder: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  const { colors } = useAppTheme();
  return <View style={inputStyles.wrap}>{label ? <Text style={[inputStyles.label, { color: colors.muted }]}>{label}</Text> : null}<TextInput accessibilityLabel={label ?? placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.subtle} style={[formInputStyle, { backgroundColor: colors.input, color: colors.ink }, multiline && inputStyles.multiline]} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} /></View>;
}

const keypadStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, backgroundColor: formPalette.surface }, row: { alignItems: 'flex-end', minHeight: 28, marginBottom: 7 }, expression: { color: formPalette.ink, fontSize: 13, fontWeight: '800' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, key: { width: '31.5%', minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: formPalette.background }, actionKey: { backgroundColor: formPalette.accentPale }, keyText: { color: formPalette.ink, fontSize: 18, fontWeight: '800' }, actionText: { color: formPalette.accentDark }, pressed: { opacity: 0.68 },
});

const chipStyles = StyleSheet.create({ section: { marginTop: 15 }, labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, label: { marginBottom: 9, color: formPalette.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }, selectionCount: { marginLeft: 8, marginBottom: 9, color: formPalette.accent, fontSize: 11, fontWeight: '800' }, row: { gap: 8, paddingRight: 16 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 46, paddingHorizontal: 13, borderRadius: 16, backgroundColor: formPalette.background }, frequency: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 42, paddingHorizontal: 13, borderRadius: 15, backgroundColor: formPalette.background }, active: { backgroundColor: formPalette.accentPale, borderWidth: 1, borderColor: formPalette.accent }, text: { color: formPalette.muted, fontSize: 12, fontWeight: '800' }, activeText: { color: formPalette.accentDark }, pressed: { opacity: 0.7 },
});

const pickerStyles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,35,28,0.34)' }, sheet: { maxHeight: '78%', padding: 20, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: formPalette.surface }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: formPalette.ink, fontSize: 20, fontWeight: '900' }, close: { color: formPalette.ink, fontSize: 28 }, list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 18, paddingBottom: 20 } });

const dateStyles = StyleSheet.create({ field: { flexDirection: 'row', alignItems: 'center', minHeight: 58, marginTop: 15, paddingHorizontal: 16, borderRadius: 17, backgroundColor: formPalette.background }, rowField: { flexDirection: 'row', alignItems: 'center', minHeight: 54, marginTop: 15, paddingHorizontal: 14, borderRadius: 14 }, compactSurface: { minHeight: 52 }, copy: { flex: 1, marginLeft: 11 }, spacer: { flex: 1 }, label: { color: formPalette.muted, fontSize: 11, fontWeight: '800' }, rowLabel: { marginLeft: 11, color: formPalette.ink, fontSize: 14, fontWeight: '800' }, value: { marginRight: 8, color: formPalette.ink, fontSize: 14, fontWeight: '800' }, pressed: { opacity: 0.72 }, backdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(17,35,28,0.34)' }, modal: { padding: 19, borderRadius: 24, backgroundColor: formPalette.surface }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { color: formPalette.ink, fontSize: 19, fontWeight: '900' }, close: { color: formPalette.ink, fontSize: 28, lineHeight: 28 }, monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }, arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: formPalette.background }, month: { color: formPalette.ink, fontSize: 15, fontWeight: '900' }, weekRow: { flexDirection: 'row', marginTop: 14 }, weekDay: { width: '14.28%', color: formPalette.muted, textAlign: 'center', fontSize: 11, fontWeight: '900' }, calendar: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 }, day: { width: '14.28%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, dayText: { color: formPalette.ink, fontSize: 13, fontWeight: '700' }, selected: { backgroundColor: formPalette.accent }, selectedText: { color: '#FFFFFF', fontWeight: '900' }, today: { alignItems: 'center', marginTop: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: formPalette.accentPale }, todayText: { color: formPalette.accentDark, fontWeight: '900' },
});

const sheetStyles = StyleSheet.create({ overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end' }, dismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,35,28,0.30)' }, keyboard: { maxHeight: '96%' }, sheet: { maxHeight: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', backgroundColor: formPalette.surface }, header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }, eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { marginTop: 4, color: formPalette.ink, fontSize: 23, fontWeight: '900' }, closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: formPalette.background }, closeText: { color: formPalette.ink, fontSize: 28, lineHeight: 29 }, scrollContent: { paddingHorizontal: 20, paddingBottom: 10 }, amountBlock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 76, marginBottom: 5 }, amountPrefix: { marginRight: 5, color: formPalette.accent, fontSize: 28, fontWeight: '900' }, amount: { maxWidth: '90%', color: formPalette.ink, fontSize: 42, fontWeight: '900', letterSpacing: -1.5 }, error: { marginTop: 12, color: formPalette.danger, fontSize: 12, fontWeight: '700' }, save: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 56, marginTop: 18, borderRadius: 28, backgroundColor: formPalette.accent }, saveDisabled: { opacity: 0.6 }, saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, pressed: { opacity: 0.72 },
});

const inputStyles = StyleSheet.create({ wrap: { marginTop: 12 }, label: { marginBottom: 7, color: formPalette.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }, multiline: { minHeight: 84, paddingTop: 15 }, });
