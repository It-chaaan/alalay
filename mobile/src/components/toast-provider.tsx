import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/theme';

type ToastKind = 'success' | 'error' | 'info';
type ToastOptions = { duration?: number };
type ToastApi = { success: (message: string, options?: ToastOptions) => void; error: (message: string, options?: ToastOptions) => void; info: (message: string, options?: ToastOptions) => void; dismiss: () => void };
type ToastState = { id: number; kind: ToastKind; message: string; duration: number } | null;

const ToastContext = createContext<ToastApi | null>(null);

/** A single-message queue keeps fast consecutive mutations readable without stacked cards. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const nextId = useRef(0);
  const show = useCallback((kind: ToastKind, message: string, options?: ToastOptions) => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;
    setToast({ id: ++nextId.current, kind, message: cleanMessage, duration: options?.duration ?? (kind === 'error' ? 5000 : 3200) });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  const api = useMemo<ToastApi>(() => ({ success: (message, options) => show('success', message, options), error: (message, options) => show('error', message, options), info: (message, options) => show('info', message, options), dismiss }), [dismiss, show]);
  return <ToastContext.Provider value={api}>{children}<ToastPresenter toast={toast} onDismiss={dismiss} /></ToastContext.Provider>;
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used inside ToastProvider');
  return toast;
}

function ToastPresenter({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0); translateY.setValue(-12);
    Animated.parallel([Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }), Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' })]).start();
    const timer = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [onDismiss, opacity, toast, translateY]);

  if (!toast) return null;
  const icon = toast.kind === 'success' ? <CheckCircle2 size={20} color={colors.success} /> : toast.kind === 'error' ? <XCircle size={20} color={colors.danger} /> : <Info size={20} color={colors.info} />;
  const accent = toast.kind === 'success' ? colors.success : toast.kind === 'error' ? colors.danger : colors.info;
  return <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 10 }]}>
    <Animated.View accessibilityLiveRegion="polite" accessible accessibilityRole={toast.kind === 'error' ? 'alert' : 'text'} accessibilityLabel={toast.message} style={[styles.toast, { opacity, transform: [{ translateY }], backgroundColor: colors.surfaceElevated, borderColor: colors.border, shadowColor: colors.shadow, borderLeftColor: accent }]}>
      {icon}<Text maxFontSizeMultiplier={1.35} style={[styles.message, { color: colors.textPrimary }]}>{toast.message}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" hitSlop={8} onPress={onDismiss} style={styles.dismiss}><X size={18} color={colors.textSecondary} /></Pressable>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({ host: { position: 'absolute', zIndex: 10000, elevation: 10000, left: 16, right: 16, alignItems: 'center' }, toast: { width: '100%', maxWidth: 520, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4, borderRadius: 16, paddingVertical: 12, paddingLeft: 12, paddingRight: 8, shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 12 }, message: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700' }, dismiss: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' } });
