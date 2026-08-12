import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bot, Send, X } from 'lucide-react-native';

import { authenticatedApiRequest, chatErrorMessage } from '@/services/api';
import { notifyFinancialMutation } from '@/services/finance';
import { useAppTheme } from '@/theme/theme';
import { useBottomNavClearance } from './bottom-nav-clearance';

const CHAT_HEAD_SIZE = 54;
const DRAG_THRESHOLD = 8;

type ChatMessage = { id: string; role: 'assistant' | 'user'; content: string };
type PendingAction = { action: 'create_expense' | 'create_income' | 'create_transfer' | 'create_bill' | 'create_subscription'; fields: Record<string, unknown> };

type DashboardInsight = {
  ai_insight: {
    status: 'configured' | 'not_configured' | 'error';
    message: string;
  };
};

const initialMessages: ChatMessage[] = [
  { id: 'welcome', role: 'assistant', content: 'Hi! I’m Alalay. Ask me about your bills, spending, savings, or budget.' },
];

function newRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    const value = character === 'x' ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

export function AlalayChatHead() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Start docked near the lower right, above the floating nav and away from cards.
  const initialPosition = useRef({ x: Math.max(16, width - CHAT_HEAD_SIZE - 16), y: Math.max(insets.top + 56, height - CHAT_HEAD_SIZE - insets.bottom - 142) }).current;
  const translation = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const pan = useRef(new Animated.ValueXY()).current;
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const [headPosition, setHeadPosition] = useState(initialPosition);
  const [popupVisible, setPopupVisible] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const hidePopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const popupStyle = useMemo(() => {
    const isOnLeft = headPosition.x < width / 2;
    return {
      top: Math.max(insets.top + 18, headPosition.y - 78),
      left: isOnLeft ? Math.min(width - 272, headPosition.x + CHAT_HEAD_SIZE + 10) : Math.max(16, headPosition.x - 256),
    };
  }, [headPosition, insets.top, width]);

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
    let mounted = true;
    void authenticatedApiRequest<DashboardInsight>('/api/dashboard/summary')
      .then((summary) => {
        if (mounted && summary.ai_insight.message) {
          setInsight(summary.ai_insight.message);
        }
      })
      .catch(() => {
        // The assistant stays available even when a proactive insight cannot load.
      });
    return () => { mounted = false; };
  }, []);

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

  const openChat = useCallback(() => {
    hidePopup();
    setChatOpen(true);
  }, [hidePopup]);

  const maxTop = Math.max(insets.top + 56, height - CHAT_HEAD_SIZE - insets.bottom - 150);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      hidePopup();
      pan.stopAnimation((value) => { dragStart.current = value; });
    },
    onPanResponderMove: (_event, gesture) => {
      pan.setValue({ x: dragStart.current.x + gesture.dx, y: dragStart.current.y + gesture.dy });
    },
    onPanResponderRelease: (_event, gesture) => {
      const dragged = Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD;
      if (!dragged) {
        openChat();
        return;
      }
      const x = initialPosition.x + dragStart.current.x + gesture.dx;
      const y = initialPosition.y + dragStart.current.y + gesture.dy;
      const targetX = x + CHAT_HEAD_SIZE / 2 < width / 2 ? 16 : width - CHAT_HEAD_SIZE - 16;
      const targetY = Math.min(maxTop, Math.max(insets.top + 56, y));
      const targetTranslation = { x: targetX - initialPosition.x, y: targetY - initialPosition.y };
      setHeadPosition({ x: targetX, y: targetY });
      Animated.spring(pan, { toValue: targetTranslation, useNativeDriver: false, bounciness: 5 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(pan, { toValue: translation.current, useNativeDriver: false }).start();
    },
  }), [hidePopup, insets.top, initialPosition, maxTop, openChat, pan, width]);

  return <>
    {popupVisible && <Animated.View style={[styles.popup, popupStyle, { opacity: popupOpacity, transform: [{ scale: popupOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss Alalay insight" onPress={hidePopup} style={styles.popupClose}><X size={15} color={colors.muted} /></Pressable>
      <Text style={styles.popupTitle}>Alalay insight</Text>
      <Text numberOfLines={4} style={styles.popupCopy}>{insight}</Text>
    </Animated.View>}
    <Animated.View
      accessible
      accessibilityRole="button"
      accessibilityLabel="Open Alalay assistant"
      {...panResponder.panHandlers}
      style={[styles.chatHead, { left: initialPosition.x, top: initialPosition.y, transform: pan.getTranslateTransform() }]}>
      <Bot size={28} color={colors.textOnPrimary} strokeWidth={1.9} />
    </Animated.View>
    {chatOpen && <AlalayChat onClose={() => setChatOpen(false)} />}
  </>;
}

function AlalayChat({ onClose }: { onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottomNavClearance = useBottomNavClearance();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content };
    const history = messages.map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setSending(true);
    try {
      const response = await authenticatedApiRequest<{ message: string; financialMutation?: boolean; pendingAction?: PendingAction | null }>('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, request_id: newRequestId(), pendingAction, history }),
      });
      if (response.financialMutation) notifyFinancialMutation();
      if (response.pendingAction !== undefined) setPendingAction(response.pendingAction);
      const reply = response.message;
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', content: chatErrorMessage(error) }]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return <SafeAreaView style={styles.chatScreen} edges={[]}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatBody} keyboardVerticalOffset={0}>
    <View style={[styles.chatHeader, { paddingTop: Math.max(12, insets.top) }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close chat" onPress={onClose} style={styles.headerButton}><ArrowLeft size={22} color={colors.ink} strokeWidth={1.8} /></Pressable>
      <View style={styles.chatTitleWrap}><Text style={styles.chatTitle}>Ask Alalay</Text><Text style={styles.chatSubtitle}>Your financial companion</Text></View>
      <View style={styles.headerLogo}><Image source={require('@/assets/images/alalay.svg')} style={styles.headerLogoImage} contentFit="contain" /></View>
    </View>
    <ScrollView ref={scrollRef} style={styles.messageList} contentContainerStyle={styles.messages} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
      {messages.map((message) => <View key={message.id} style={[styles.messageBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}><Text style={[styles.messageText, message.role === 'user' ? styles.userMessageText : styles.assistantMessageText]}>{message.content}</Text></View>)}
      {sending && <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}><ActivityIndicator size="small" color={colors.accent} /><Text style={styles.typingText}>Alalay is thinking…</Text></View>}
    </ScrollView>
    <View style={styles.composer}><TextInput accessibilityLabel="Ask Alalay a question" value={draft} onChangeText={setDraft} onSubmitEditing={sendMessage} returnKeyType="send" placeholder="Ask about your money…" placeholderTextColor={colors.muted} style={styles.composerInput} multiline /><Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!draft.trim() || sending} onPress={sendMessage} style={({ pressed }) => [styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled, pressed && styles.pressed]}><Send size={19} color={colors.textOnPrimary} strokeWidth={2} /></Pressable></View>
    {!keyboardVisible && <View pointerEvents="none" style={{ height: bottomNavClearance }} />}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
  chatHead: { position: 'absolute', zIndex: 12, width: CHAT_HEAD_SIZE, height: CHAT_HEAD_SIZE, borderRadius: CHAT_HEAD_SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, shadowColor: colors.shadow, shadowOpacity: 0.24, shadowRadius: 10, elevation: 8 },
  popup: { position: 'absolute', zIndex: 11, width: 250, padding: 15, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, shadowColor: colors.shadow, shadowOpacity: 0.14, shadowRadius: 12, elevation: 6 },
  popupClose: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  popupTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  popupCopy: { marginTop: 7, paddingRight: 14, color: colors.muted, fontSize: 12, lineHeight: 18 },
  chatScreen: { ...StyleSheet.absoluteFillObject, zIndex: 30, backgroundColor: colors.background },
  chatBody: { flex: 1 },
  chatHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  chatTitleWrap: { flex: 1, marginLeft: 7 },
  chatTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  chatSubtitle: { marginTop: 2, color: colors.muted, fontSize: 11 },
  headerLogo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPale },
  headerLogoImage: { width: 29, height: 29 },
  messageList: { flex: 1 },
  messages: { flexGrow: 1, padding: 20, paddingBottom: 12, gap: 10 },
  messageBubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17 },
  assistantBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.line },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4, backgroundColor: colors.accent },
  messageText: { fontSize: 14, lineHeight: 20 },
  assistantMessageText: { color: colors.ink },
  userMessageText: { color: colors.textOnPrimary },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  composerInput: { flex: 1, minHeight: 46, maxHeight: 108, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, backgroundColor: colors.surfaceInput, color: colors.ink, fontSize: 14 },
  sendButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  sendDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.76 },
  });
}
