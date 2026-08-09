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
  Banknote,
  BedDouble,
  Bolt,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Droplets,
  Film,
  Home,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  ShoppingBag,
  Smartphone,
  Trash2,
  Utensils,
  Wifi,
  type LucideIcon,
} from 'lucide-react-native';

export const formPalette = {
  background: '#F4F7F1',
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
  { label: 'Mobile', icon: Smartphone },
  { label: 'Other', icon: MoreHorizontal },
];

export const expenseCategories: CategoryOption[] = [
  { label: 'Food', icon: Utensils },
  { label: 'Groceries', icon: ShoppingBag },
  { label: 'Transport', icon: Receipt },
  { label: 'Bills', icon: Bolt },
  { label: 'Entertainment', icon: Film },
  { label: 'Home', icon: BedDouble },
  { label: 'Other', icon: MoreHorizontal },
];

export const budgetCategories: CategoryOption[] = [
  { label: 'Food', icon: Utensils },
  { label: 'Transport', icon: Receipt },
  { label: 'Rent', icon: Home },
  { label: 'Electricity', icon: Bolt },
  { label: 'Internet', icon: Wifi },
  { label: 'Water', icon: Droplets },
  { label: 'Subscriptions', icon: Repeat },
  { label: 'Other', icon: MoreHorizontal },
];

export const savingsBudgetOption: CategoryOption = { label: 'Savings budget', icon: PiggyBank };

export const paymentMethods = [
  { label: 'Cash', value: 'cash', icon: Banknote },
  { label: 'Card', value: 'card', icon: CreditCard },
  { label: 'GCash', value: 'gcash', icon: Smartphone },
] as const;

export function evaluateAmountExpression(expression: string): number | null {
  const cleaned = expression.replace(/\s/g, '');
  if (!cleaned || !/^\d*\.?\d+(?:[+-]\d*\.?\d+)*$/.test(cleaned)) return null;
  const tokens = cleaned.match(/[+-]?\d*\.?\d+/g);
  if (!tokens?.length) return null;
  let total = Number(tokens[0]);
  if (!Number.isFinite(total)) return null;
  for (const token of tokens.slice(1)) {
    const operator = token[0];
    const number = Number(token.slice(1));
    if (!Number.isFinite(number)) return null;
    total = operator === '-' ? total - number : total + number;
  }
  return Number.isFinite(total) ? total : null;
}

function normaliseAmount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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
const MINUS_KEY = '\u2212';

export function NumericKeypad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const press = (key: string) => {
    if (key === 'clear') {
      onChange('');
      return;
    }
    if (key === BACKSPACE_KEY) {
      onChange(value.slice(0, -1));
      return;
    }
    if (/\d/.test(key)) {
      onChange(value === '0' ? key : value + key);
      return;
    }
    if (key === '.') {
      const currentSegment = value.split(/[+-]/).at(-1) ?? '';
      if (!currentSegment.includes('.')) onChange(value + (currentSegment ? '.' : '0.'));
      return;
    }
    if (key === '=') {
      const result = evaluateAmountExpression(value);
      if (result !== null) onChange(normaliseAmount(result));
      return;
    }
    const operator = key === MINUS_KEY ? '-' : key;
    if ((operator === '+' || operator === '-') && value && !/[+-]$/.test(value)) onChange(value + operator);
  };

  const keys = ['1', '2', '3', '+', '4', '5', '6', MINUS_KEY, '7', '8', '9', BACKSPACE_KEY, '.', '0', '=', 'clear'];
  return <View style={keypadStyles.wrap}>
    <View style={keypadStyles.row}>
      <Text style={keypadStyles.hint}>Tap = to calculate</Text>
      <Text style={keypadStyles.expression}>{formatAmountForDisplay(value)}</Text>
    </View>
    <View style={keypadStyles.grid}>
      {keys.map((key) => {
        const isBackspace = key === BACKSPACE_KEY;
        const isClear = key === 'clear';
        const action = key === '+' || key === MINUS_KEY || key === '=' || isBackspace || isClear;
        return <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={isBackspace ? 'Backspace' : isClear ? 'Clear amount' : key}
          onPress={() => press(key)}
          style={({ pressed }) => [keypadStyles.key, action && keypadStyles.actionKey, key === '=' && keypadStyles.equalsKey, isClear && keypadStyles.clearKey, pressed && keypadStyles.pressed]}
        >
          {isBackspace ? <Text style={[keypadStyles.keyText, keypadStyles.actionText]}>{BACKSPACE_KEY}</Text> : isClear ? <Trash2 size={20} color={formPalette.danger} /> : <Text style={[keypadStyles.keyText, action && keypadStyles.actionText, key === '=' && keypadStyles.equalsText]}>{key}</Text>}
        </Pressable>;
      })}
    </View>
  </View>;
}

export function CategoryChipRow({ value, onChange, options, label = 'Category (optional)' }: { value: string; onChange: (value: string) => void; options: CategoryOption[]; label?: string }) {
  return <View style={chipStyles.section}>
    <Text style={chipStyles.label}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chipStyles.row}>
      {options.map(({ label: optionLabel, icon: Icon }) => <Pressable
        key={optionLabel}
        accessibilityRole="button"
        accessibilityState={{ selected: value === optionLabel }}
        onPress={() => onChange(optionLabel)}
        style={({ pressed }) => [chipStyles.chip, value === optionLabel && chipStyles.active, pressed && chipStyles.pressed]}
      >
        <Icon size={17} color={value === optionLabel ? formPalette.accent : formPalette.muted} strokeWidth={1.9} />
        <Text style={[chipStyles.text, value === optionLabel && chipStyles.activeText]}>{optionLabel}</Text>
      </Pressable>)}
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

export function DatePickerField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
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

  return <>
    <Pressable accessibilityRole="button" onPress={() => { setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1)); setOpen(true); }} style={({ pressed }) => [dateStyles.field, pressed && dateStyles.pressed]}>
      <CalendarDays size={19} color={formPalette.accent} />
      <View style={dateStyles.copy}><Text style={dateStyles.label}>{label}</Text><Text style={dateStyles.value}>{value}</Text></View>
      <ChevronDown size={18} color={formPalette.muted} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={dateStyles.backdrop}><View style={dateStyles.modal}>
        <View style={dateStyles.modalHeader}><Text style={dateStyles.modalTitle}>{label}</Text><Pressable accessibilityLabel="Close date picker" onPress={() => setOpen(false)}><Text style={dateStyles.close}>×</Text></Pressable></View>
        <View style={dateStyles.monthHeader}><Pressable accessibilityLabel="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={dateStyles.arrow}><ArrowLeft size={17} color={formPalette.ink} /></Pressable><Text style={dateStyles.month}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text><Pressable accessibilityLabel="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={dateStyles.arrow}><ArrowRight size={17} color={formPalette.ink} /></Pressable></View>
        <View style={dateStyles.weekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={dateStyles.weekDay}>{day}</Text>)}</View>
        <View style={dateStyles.calendar}>{cells.map((day, index) => day === null ? <View key={`empty-${index}`} style={dateStyles.day} /> : <Pressable key={day} onPress={() => choose(day)} style={[dateStyles.day, selected.getFullYear() === month.getFullYear() && selected.getMonth() === month.getMonth() && selected.getDate() === day && dateStyles.selected]}><Text style={[dateStyles.dayText, selected.getFullYear() === month.getFullYear() && selected.getMonth() === month.getMonth() && selected.getDate() === day && dateStyles.selectedText]}>{day}</Text></Pressable>)}</View>
        <Pressable onPress={() => { onChange(dateString(new Date())); setOpen(false); }} style={dateStyles.today}><Text style={dateStyles.todayText}>Use today</Text></Pressable>
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

export function PaymentMethodChips({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <View style={chipStyles.section}><Text style={chipStyles.label}>Payment method</Text><View style={chipStyles.wrap}>{paymentMethods.map(({ label, value: method, icon: Icon }) => <Pressable key={method} onPress={() => onChange(method)} style={({ pressed }) => [chipStyles.frequency, value === method && chipStyles.active, pressed && chipStyles.pressed]}><Icon size={16} color={value === method ? formPalette.accent : formPalette.muted} /><Text style={[chipStyles.text, value === method && chipStyles.activeText]}>{label}</Text></Pressable>)}</View></View>;
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
  const keyboardVisible = useKeyboardVisible();
  return <View style={sheetStyles.overlay}><Pressable accessibilityLabel="Close add form" onPress={onClose} style={sheetStyles.dismiss} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0} style={sheetStyles.keyboard}>
    <View style={sheetStyles.sheet}>
      <View style={sheetStyles.header}><View><Text style={sheetStyles.eyebrow}>{eyebrow}</Text><Text style={sheetStyles.title}>{title}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={sheetStyles.closeButton}><Text style={sheetStyles.closeText}>×</Text></Pressable></View>
      <ScrollView contentContainerStyle={sheetStyles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={sheetStyles.amountBlock}><Text style={sheetStyles.amountPrefix}>₱</Text><Text style={sheetStyles.amount}>{formatAmountForDisplay(amount)}</Text></View>
        {children}
        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={saving} onPress={onSave} style={({ pressed }) => [sheetStyles.save, saving && sheetStyles.saveDisabled, pressed && sheetStyles.pressed]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <><Plus size={19} color="#FFFFFF" strokeWidth={2.4} /><Text style={sheetStyles.saveText}>{saveLabel}</Text></>}</Pressable>
      </ScrollView>
      {!keyboardVisible && <NumericKeypad value={amount} onChange={onAmountChange} />}
    </View>
  </KeyboardAvoidingView></View>;
}

export const formInputStyle = { minHeight: 54, paddingHorizontal: 16, borderRadius: 17, backgroundColor: formPalette.background, color: formPalette.ink, fontSize: 15 };

export function FormTextInput({ label, placeholder, value, onChangeText, multiline = false }: { label?: string; placeholder: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  return <View style={inputStyles.wrap}>{label ? <Text style={inputStyles.label}>{label}</Text> : null}<TextInput accessibilityLabel={label ?? placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={formPalette.muted} style={[formInputStyle, multiline && inputStyles.multiline]} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} /></View>;
}

const keypadStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, backgroundColor: formPalette.surface }, row: { alignItems: 'flex-end', minHeight: 28, marginBottom: 7 }, hint: { alignSelf: 'flex-start', color: formPalette.muted, fontSize: 11, fontWeight: '700' }, expression: { color: formPalette.ink, fontSize: 13, fontWeight: '800' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, key: { width: '22.2%', minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: formPalette.background }, actionKey: { backgroundColor: formPalette.accentPale }, equalsKey: { backgroundColor: formPalette.accent }, clearKey: { backgroundColor: '#FCE8E6' }, keyText: { color: formPalette.ink, fontSize: 18, fontWeight: '800' }, actionText: { color: formPalette.accentDark }, equalsText: { color: '#FFFFFF', fontSize: 21 }, pressed: { opacity: 0.68 },
});

const chipStyles = StyleSheet.create({ section: { marginTop: 15 }, label: { marginBottom: 9, color: formPalette.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }, row: { gap: 8, paddingRight: 16 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 46, paddingHorizontal: 13, borderRadius: 16, backgroundColor: formPalette.background }, frequency: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 42, paddingHorizontal: 13, borderRadius: 15, backgroundColor: formPalette.background }, active: { backgroundColor: formPalette.accentPale, borderWidth: 1, borderColor: formPalette.accent }, text: { color: formPalette.muted, fontSize: 12, fontWeight: '800' }, activeText: { color: formPalette.accentDark }, pressed: { opacity: 0.7 },
});

const dateStyles = StyleSheet.create({ field: { flexDirection: 'row', alignItems: 'center', minHeight: 58, marginTop: 15, paddingHorizontal: 16, borderRadius: 17, backgroundColor: formPalette.background }, copy: { flex: 1, marginLeft: 11 }, label: { color: formPalette.muted, fontSize: 11, fontWeight: '800' }, value: { marginTop: 4, color: formPalette.ink, fontSize: 15, fontWeight: '800' }, pressed: { opacity: 0.72 }, backdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(17,35,28,0.34)' }, modal: { padding: 19, borderRadius: 24, backgroundColor: formPalette.surface }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { color: formPalette.ink, fontSize: 19, fontWeight: '900' }, close: { color: formPalette.ink, fontSize: 28, lineHeight: 28 }, monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }, arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: formPalette.background }, month: { color: formPalette.ink, fontSize: 15, fontWeight: '900' }, weekRow: { flexDirection: 'row', marginTop: 14 }, weekDay: { width: '14.28%', color: formPalette.muted, textAlign: 'center', fontSize: 11, fontWeight: '900' }, calendar: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 }, day: { width: '14.28%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, dayText: { color: formPalette.ink, fontSize: 13, fontWeight: '700' }, selected: { backgroundColor: formPalette.accent }, selectedText: { color: '#FFFFFF', fontWeight: '900' }, today: { alignItems: 'center', marginTop: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: formPalette.accentPale }, todayText: { color: formPalette.accentDark, fontWeight: '900' },
});

const sheetStyles = StyleSheet.create({ overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end' }, dismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,35,28,0.30)' }, keyboard: { maxHeight: '96%' }, sheet: { maxHeight: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', backgroundColor: formPalette.surface }, header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }, eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { marginTop: 4, color: formPalette.ink, fontSize: 23, fontWeight: '900' }, closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: formPalette.background }, closeText: { color: formPalette.ink, fontSize: 28, lineHeight: 29 }, scrollContent: { paddingHorizontal: 20, paddingBottom: 10 }, amountBlock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 76, marginBottom: 5 }, amountPrefix: { marginRight: 5, color: formPalette.accent, fontSize: 28, fontWeight: '900' }, amount: { maxWidth: '90%', color: formPalette.ink, fontSize: 42, fontWeight: '900', letterSpacing: -1.5 }, error: { marginTop: 12, color: formPalette.danger, fontSize: 12, fontWeight: '700' }, save: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 56, marginTop: 18, borderRadius: 28, backgroundColor: formPalette.accent }, saveDisabled: { opacity: 0.6 }, saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, pressed: { opacity: 0.72 },
});

const inputStyles = StyleSheet.create({ wrap: { marginTop: 12 }, label: { marginBottom: 7, color: formPalette.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }, multiline: { minHeight: 84, paddingTop: 15 }, });
