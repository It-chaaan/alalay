import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot, X } from 'lucide-react-native';
import { initialChatHeadPosition, snappedChatHeadPosition } from './chat-head-geometry';

const CHAT_HEAD_SIZE = 54;
const DRAG_THRESHOLD = 8;

type Colors = {
  accent: string;
  textOnPrimary: string;
  muted: string;
  ink: string;
  surface: string;
  line: string;
  shadow: string;
};

// This is the small compatibility boundary for RN's imperative Animated and
// PanResponder APIs. Layout values are recomputed from the current viewport.
export function LegacyChatHeadAnimatedBridge({
  colors,
  insight,
  onOpenChat,
}: {
  colors: Colors;
  insight: string | null;
  onOpenChat: () => void;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const initialPosition = useMemo(() => initialChatHeadPosition({
    width, height, insetTop: insets.top, insetBottom: insets.bottom, size: CHAT_HEAD_SIZE,
  }), [height, insets.bottom, insets.top, width]);
  const translation = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const pan = useRef(new Animated.ValueXY()).current;
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const [headPosition, setHeadPosition] = useState(initialPosition);
  const [popupVisible, setPopupVisible] = useState(false);
  const hidePopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupStyle = useMemo(() => {
    const isOnLeft = headPosition.x < width / 2;
    const top = Math.max(insets.top + 18, headPosition.y - 78);
    return {
      top,
      left: isOnLeft ? Math.min(width - 272, headPosition.x + CHAT_HEAD_SIZE + 10) : Math.max(16, headPosition.x - 256),
      maxHeight: Math.max(160, height - top - insets.bottom - 96),
    };
  }, [headPosition, height, insets.bottom, insets.top, width]);
  const hidePopup = useCallback(() => {
    if (hidePopupTimer.current) clearTimeout(hidePopupTimer.current);
    Animated.timing(popupOpacity, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setPopupVisible(false));
  }, [popupOpacity]);
  const showPopup = useCallback(() => {
    if (!insight) return;
    if (hidePopupTimer.current) clearTimeout(hidePopupTimer.current);
    setPopupVisible(true);
    Animated.timing(popupOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    hidePopupTimer.current = setTimeout(hidePopup, 5200);
  }, [hidePopup, insight, popupOpacity]);
  useEffect(() => {
    if (!insight) return;
    const timer = setTimeout(showPopup, 900);
    return () => {
      clearTimeout(timer);
      if (hidePopupTimer.current) clearTimeout(hidePopupTimer.current);
    };
  }, [insight, showPopup]);
  useEffect(() => {
    const listener = pan.addListener((value) => { translation.current = value; });
    return () => pan.removeListener(listener);
  }, [pan]);
  const openChat = useCallback(() => { hidePopup(); onOpenChat(); }, [hidePopup, onOpenChat]);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      hidePopup();
      pan.stopAnimation((value) => { dragStart.current = value; });
    },
    onPanResponderMove: (_event, gesture) => pan.setValue({ x: dragStart.current.x + gesture.dx, y: dragStart.current.y + gesture.dy }),
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) <= DRAG_THRESHOLD && Math.abs(gesture.dy) <= DRAG_THRESHOLD) { openChat(); return; }
      const x = initialPosition.x + dragStart.current.x + gesture.dx;
      const y = initialPosition.y + dragStart.current.y + gesture.dy;
      const target = snappedChatHeadPosition({ x, y, width, height, insetTop: insets.top, insetBottom: insets.bottom, size: CHAT_HEAD_SIZE });
      const targetTranslation = { x: target.x - initialPosition.x, y: target.y - initialPosition.y };
      setHeadPosition(target);
      Animated.spring(pan, { toValue: targetTranslation, useNativeDriver: false, bounciness: 5 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(pan, { toValue: translation.current, useNativeDriver: false }).start(),
  }), [height, hidePopup, insets.bottom, insets.top, initialPosition, openChat, pan, width]);
  return <>
    {popupVisible && <Animated.View style={[styles.popup, popupStyle, { opacity: popupOpacity, transform: [{ translateY: popupOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss Alalay insight" onPress={hidePopup} style={styles.popupClose}><X size={15} color={colors.muted} /></Pressable>
      <Text style={styles.popupTitle}>Alalay insight</Text>
      <ScrollView style={styles.popupScroll} contentContainerStyle={styles.popupScrollContent} showsVerticalScrollIndicator nestedScrollEnabled><Text style={styles.popupCopy}>{insight}</Text></ScrollView>
    </Animated.View>}
    <Animated.View accessible accessibilityRole="button" accessibilityLabel="Open Alalay assistant" {...panResponder.panHandlers} style={[styles.chatHead, { left: initialPosition.x, top: initialPosition.y, transform: pan.getTranslateTransform() }]}>
      <Bot size={28} color={colors.textOnPrimary} strokeWidth={1.9} />
    </Animated.View>
  </>;
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    chatHead: { position: 'absolute', zIndex: 12, width: CHAT_HEAD_SIZE, height: CHAT_HEAD_SIZE, borderRadius: CHAT_HEAD_SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, shadowColor: colors.shadow, shadowOpacity: 0.24, shadowRadius: 10, elevation: 8 },
    popup: { position: 'absolute', zIndex: 11, width: 250, padding: 15, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, shadowColor: colors.shadow, shadowOpacity: 0.14, shadowRadius: 12, elevation: 6 },
    popupClose: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    popupTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
    popupScroll: { marginTop: 7, paddingRight: 5, flexGrow: 0, flexShrink: 1 },
    popupScrollContent: { paddingRight: 9 },
    popupCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  });
}
