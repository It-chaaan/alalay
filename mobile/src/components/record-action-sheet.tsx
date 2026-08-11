import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/theme';
import { useModalVisibility } from '@/components/modal-visibility';

export type RecordActionTone = 'default' | 'primary' | 'destructive';

export type RecordAction = {
  label: string;
  tone?: RecordActionTone;
  onPress: () => void | Promise<void>;
  confirm?: { title: string; message: string };
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

  useEffect(() => {
    if (!visible) {
      setConfirmation(null);
      setBusy(false);
      setError('');
    }
  }, [visible]);

  const run = async (action: RecordAction) => {
    setBusy(true);
    setError('');
    try {
      await action.onPress();
      setConfirmation(null);
      onClose();
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

  return <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Close action sheet" style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={[styles.sheetClip, { borderColor: colors.border }]}>
          <BlurView intensity={42} tint={resolvedTheme} style={StyleSheet.absoluteFillObject} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceTranslucent }]} />
          <View style={styles.sheet}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>RECORD OPTIONS</Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <Text numberOfLines={2} style={[styles.recordName, { color: colors.textSecondary }]}>{recordName}</Text>
            {confirmation ? <>
              <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>{confirmation.confirm?.title}</Text>
              <Text style={[styles.confirmCopy, { color: colors.textSecondary }]}>{confirmation.confirm?.message}</Text>
              {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              <View style={styles.confirmRow}>
                <Pressable disabled={busy} accessibilityRole="button" onPress={() => setConfirmation(null)} style={[styles.action, { backgroundColor: colors.surfaceInput }, busy && styles.disabled]}><Text style={[styles.actionText, { color: colors.textSecondary }]}>Cancel</Text></Pressable>
                <Pressable disabled={busy} accessibilityRole="button" onPress={() => void run(confirmation)} style={[styles.action, { backgroundColor: colors.surfaceInput }, busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.danger} /> : <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>}</Pressable>
              </View>
            </> : <>
              {actions.map((action) => <Pressable key={action.label} accessibilityRole="button" accessibilityState={{ disabled: action.disabled || busy }} disabled={action.disabled || busy} onPress={() => select(action)} style={({ pressed }) => [styles.action, { backgroundColor: colors.surfaceInput }, action.tone === 'primary' && { backgroundColor: colors.primary }, pressed && styles.pressed, (action.disabled || busy) && styles.disabled]}>{action.icon}{busy ? null : <Text style={[styles.actionText, { color: action.tone === 'primary' ? colors.textOnPrimary : action.tone === 'destructive' ? colors.danger : colors.textPrimary }]}>{action.label}</Text>}</Pressable>)}
              <Pressable accessibilityRole="button" onPress={onClose} disabled={busy} style={[styles.action, styles.cancel, { backgroundColor: colors.surfaceInput }, busy && styles.disabled]}><Text style={[styles.actionText, { color: colors.textSecondary }]}>Cancel</Text></Pressable>
            </>}
          </View>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheetWrap: { width: '100%' },
  sheetClip: { overflow: 'hidden', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: StyleSheet.hairlineWidth },
  sheet: { padding: 22, gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: -3, fontSize: 21, fontWeight: '900' },
  recordName: { marginBottom: 8, fontSize: 14, fontWeight: '700' },
  action: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 17, paddingHorizontal: 16 },
  actionText: { fontSize: 15, fontWeight: '800' },
  cancel: { marginTop: 2 },
  pressed: { opacity: 0.74 },
  disabled: { opacity: 0.5 },
  confirmTitle: { marginTop: 4, fontSize: 17, fontWeight: '900' },
  confirmCopy: { marginBottom: 4, fontSize: 13, lineHeight: 19 },
  error: { fontSize: 12, fontWeight: '800' },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 3 },
});
