import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/theme';
import { useModalVisibility } from '@/components/modal-visibility';

export type RecordActionTone = 'default' | 'primary' | 'warning' | 'destructive';

export type RecordAction = {
  label: string;
  tone?: RecordActionTone;
  onPress: () => void | Promise<void>;
  confirm?: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    loadingLabel?: string;
    tone?: RecordActionTone;
    icon?: ReactNode;
  };
  disabled?: boolean;
  icon?: ReactNode;
};

type RecordActionSheetProps = {
  visible: boolean;
  title: string;
  recordName: string;
  actions: RecordAction[];
  onClose: () => void;
};

export function RecordActionSheet({ visible, title, recordName, actions, onClose }: RecordActionSheetProps) {
  const { colors, resolvedTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { setModalVisible } = useModalVisibility();
  const [confirmation, setConfirmation] = useState<RecordAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setModalVisible(visible);
    return () => setModalVisible(false);
  }, [setModalVisible, visible]);

  const close = useCallback(() => {
    setConfirmation(null);
    setBusy(false);
    setError('');
    onClose();
  }, [onClose]);

  const run = async (action: RecordAction) => {
    setBusy(true);
    setError('');
    try {
      await action.onPress();
      setConfirmation(null);
      close();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not complete this action.');
    } finally {
      setBusy(false);
    }
  };

  const select = (action: RecordAction) => {
    if (action.disabled || busy) return;
    if (action.confirm) {
      setConfirmation(action);
      setError('');
      return;
    }
    void run(action);
  };

  const confirmTone = confirmation?.confirm?.tone ?? confirmation?.tone ?? 'destructive';
  const confirmColor = confirmTone === 'primary'
    ? colors.primary
    : confirmTone === 'warning'
      ? colors.warning
      : confirmTone === 'destructive'
        ? colors.danger
        : colors.textPrimary;

  return <Modal visible={visible} animationType="fade" transparent onRequestClose={close} statusBarTranslucent>
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Close action sheet" style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={close} />
      <View style={[styles.sheetWrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.sheetClip, { borderColor: colors.border }]}>
          <BlurView intensity={42} tint={resolvedTheme} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceTranslucent }]} />
          <View style={styles.sheet}>
            <Text numberOfLines={2} style={[styles.title, { color: colors.textPrimary }]}>{confirmation?.confirm?.title ?? title}</Text>
            {!confirmation ? <Text numberOfLines={2} style={[styles.recordName, { color: colors.textSecondary }]}>{recordName}</Text> : null}
            {confirmation ? <>
              <Text style={[styles.confirmCopy, { color: colors.textSecondary }]}>{confirmation.confirm?.message}</Text>
              {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              <View style={styles.confirmRow}>
                <Pressable disabled={busy} accessibilityRole="button" onPress={() => setConfirmation(null)} style={[styles.action, styles.confirmAction, { backgroundColor: colors.surfaceInput }, busy && styles.disabled]}><Text style={[styles.actionText, { color: colors.textSecondary }]}>{confirmation.confirm?.cancelLabel ?? 'Cancel'}</Text></Pressable>
                <Pressable disabled={busy} accessibilityRole="button" onPress={() => void run(confirmation)} style={[styles.action, styles.confirmAction, { backgroundColor: confirmTone === 'warning' ? `${colors.warning}18` : colors.surfaceInput }, busy && styles.disabled]}>{busy ? <><ActivityIndicator color={confirmColor} /><Text style={[styles.actionText, { color: confirmColor }]}>{confirmation.confirm?.loadingLabel ?? 'Working…'}</Text></> : <>{confirmation.confirm?.icon}{<Text style={[styles.actionText, { color: confirmColor }]}>{confirmation.confirm?.confirmLabel ?? confirmation.label}</Text>}</>}</Pressable>
              </View>
            </> : <>
              {actions.map((action) => <Pressable key={action.label} accessibilityRole="button" accessibilityState={{ disabled: action.disabled || busy }} disabled={action.disabled || busy} onPress={() => select(action)} style={({ pressed }) => [styles.action, { backgroundColor: colors.surfaceInput }, pressed && styles.pressed, (action.disabled || busy) && styles.disabled]}>{action.icon}{busy ? null : <Text style={[styles.actionText, { color: action.tone === 'primary' ? colors.primary : action.tone === 'warning' ? colors.warning : action.tone === 'destructive' ? colors.danger : colors.textPrimary }]}>{action.label}</Text>}</Pressable>)}
              <Pressable accessibilityRole="button" onPress={close} disabled={busy} style={[styles.action, styles.cancel, { backgroundColor: colors.surfaceInput }, busy && styles.disabled]}><Text style={[styles.actionText, { color: colors.textSecondary }]}>Cancel</Text></Pressable>
            </>}
          </View>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheetWrap: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24 },
  sheetClip: { overflow: 'hidden', borderRadius: 30, borderWidth: StyleSheet.hairlineWidth },
  sheet: { padding: 22, gap: 10 },
  title: { fontSize: 21, fontWeight: '900' },
  recordName: { marginBottom: 4, fontSize: 16, fontWeight: '600' },
  action: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 17, paddingHorizontal: 16 },
  actionText: { fontSize: 15, fontWeight: '800' },
  cancel: { marginTop: 2 },
  pressed: { opacity: 0.74 },
  disabled: { opacity: 0.5 },
  confirmCopy: { marginBottom: 4, fontSize: 13, lineHeight: 19 },
  error: { fontSize: 12, fontWeight: '800' },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 3 },
  confirmAction: { flex: 1, minWidth: 0 },
});
