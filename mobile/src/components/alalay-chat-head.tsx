import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send } from 'lucide-react-native';

import { authenticatedApiRequest, chatErrorMessage } from '@/services/api';
import { notifyFinancialMutation } from '@/services/finance';
import { useAppTheme } from '@/theme/theme';
import { useModalVisibility } from './modal-visibility';
import { useDashboardInsight } from '@/context/dashboard-insight';
import { LegacyChatHeadAnimatedBridge } from './legacy-chat-head-animated-bridge';

type ChatMessage = { id: string; role: 'assistant' | 'user'; content: string };
type RetryMessage = ChatMessage & { retryPrompt?: string };
type PendingAction = {
  action:
    'create_expense' | 'create_income' | 'create_transfer' | 'create_bill' | 'create_subscription';
  fields: Record<string, unknown>;
};

const CHAT_HEAD_SIZE = 54;

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Hi! I’m Alalay. Ask me about your bills, spending, savings, or budget.',
  },
];

const faqPrompts = [
  'How much did I spend this week?',
  'What bills are due soon?',
  'How am I doing against my budget?',
  'How are my savings goals going?',
  'Show my spending by category this month.',
  'What subscriptions do I have?',
  'How much did I spend last month?',
  'What is my total wallet balance?',
];

function newRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function AlalayChatHead() {
  const { colors } = useAppTheme();
  const { insight } = useDashboardInsight();
  const [chatOpen, setChatOpen] = useState(false);
  const { setModalVisible } = useModalVisibility();

  useEffect(() => {
    if (!chatOpen) return;
    setModalVisible(chatOpen);
    return () => setModalVisible(false);
  }, [chatOpen, setModalVisible]);

  return (
    <>
      <LegacyChatHeadAnimatedBridge colors={colors} insight={insight} onOpenChat={() => setChatOpen(true)} />
      {chatOpen && <AlalayChat onClose={() => setChatOpen(false)} />}
    </>
  );
}

export function AlalayChat({ onClose, tabScreen = false }: { onClose?: () => void; tabScreen?: boolean }) {
  const { colors } = useAppTheme();
  const { insight, state: insightState, refresh: refreshInsight } = useDashboardInsight();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<RetryMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showFaqs, setShowFaqs] = useState(true);
  const [showMoreFaqs, setShowMoreFaqs] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = async (prompt = draft.trim(), retryErrorId?: string) => {
    const content = prompt.trim();
    if (!content || sending) return;
    const baseMessages = retryErrorId
      ? messages.filter((message) => message.id !== retryErrorId)
      : messages;
    const userMessage: RetryMessage = { id: `user-${Date.now()}`, role: 'user', content };
    const history = baseMessages.map(({ role, content: messageContent }) => ({
      role,
      content: messageContent,
    }));
    setMessages(retryErrorId ? baseMessages : [...baseMessages, userMessage]);
    setDraft('');
    setShowFaqs(false);
    setSending(true);
    try {
      const response = await authenticatedApiRequest<{
        message: string;
        financialMutation?: boolean;
        pendingAction?: PendingAction | null;
      }>('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          request_id: newRequestId(),
          pendingAction,
          history,
        }),
      });
      if (response.financialMutation) notifyFinancialMutation();
      if (response.pendingAction !== undefined) setPendingAction(response.pendingAction);
      const reply = response.message;
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: reply },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: chatErrorMessage(error),
          retryPrompt: content,
        },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return (
    <SafeAreaView style={tabScreen ? [styles.chatBody, { backgroundColor: colors.background }] : styles.chatScreen} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatBody}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.chatHeader, { paddingTop: Math.max(12, insets.top) }]}>
          {onClose ? <Pressable accessibilityRole="button" accessibilityLabel="Close chat" onPress={onClose} style={styles.headerButton}>
            <ArrowLeft size={22} color={colors.ink} strokeWidth={1.8} />
          </Pressable> : <View style={styles.headerButton} />}
          <View style={styles.chatTitleWrap}>
            <Text style={styles.chatTitle}>Ask Alalay</Text>
            <Text style={styles.chatSubtitle}>Your financial companion</Text>
          </View>
          <View style={styles.headerLogo}>
            <Image
              source={require('@/assets/images/alalay-logo-symbol.png')}
              style={styles.headerLogoImage}
              contentFit="contain"
            />
          </View>
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          <LatestInsightCard
            insight={insight}
            state={insightState}
            onRetry={() => void refreshInsight()}
          />
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
                ]}
              >
                {message.content}
              </Text>
              {message.retryPrompt && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry Alalay request"
                  onPress={() => void sendMessage(message.retryPrompt, message.id)}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              )}
            </View>
          ))}
          {showFaqs && messages.length === 1 && (
            <View style={styles.faqSection}>
              <Text style={styles.faqTitle}>Frequently asked</Text>
              <View style={styles.faqList}>
                {faqPrompts.slice(0, showMoreFaqs ? faqPrompts.length : 4).map((prompt) => (
                  <Pressable
                    key={prompt}
                    accessibilityRole="button"
                    accessibilityLabel={`Ask: ${prompt}`}
                    onPress={() => void sendMessage(prompt)}
                    style={({ pressed }) => [styles.faqChip, pressed && styles.pressed]}
                  >
                    <Text style={styles.faqChipText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showMoreFaqs
                    ? 'Show fewer frequently asked questions'
                    : 'See more frequently asked questions'
                }
                onPress={() => setShowMoreFaqs((current) => !current)}
                style={styles.seeMore}
              >
                <Text style={styles.seeMoreText}>{showMoreFaqs ? 'Show less' : 'See more'}</Text>
              </Pressable>
            </View>
          )}
          {sending && (
            <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.typingText}>Alalay is thinking…</Text>
            </View>
          )}
        </ScrollView>
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Ask Alalay a question"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void sendMessage()}
            returnKeyType="send"
            placeholder="Ask about your money…"
            placeholderTextColor={colors.muted}
            style={styles.composerInput}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={!draft.trim() || sending}
            onPress={() => void sendMessage()}
            style={({ pressed }) => [
              styles.sendButton,
              (!draft.trim() || sending) && styles.sendDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Send size={19} color={colors.textOnPrimary} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LatestInsightCard({
  insight,
  state,
  onRetry,
}: {
  insight: string | null;
  state: 'loading' | 'ready' | 'empty' | 'error';
  onRetry: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Your latest Alalay insight"
      style={styles.latestInsightCard}
    >
      <Text style={styles.latestInsightTitle}>Your latest insight</Text>
      {state === 'loading' ? (
        <View style={styles.insightLoading}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.latestInsightCopy}>Loading your personalized insight…</Text>
        </View>
      ) : state === 'error' ? (
        <>
          <Text style={styles.latestInsightCopy}>Your insight could not load right now.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading your latest insight"
            onPress={onRetry}
            style={styles.insightRetry}
          >
            <Text style={styles.insightRetryText}>Try again</Text>
          </Pressable>
        </>
      ) : insight ? (
        <Text style={styles.latestInsightCopy}>{insight}</Text>
      ) : (
        <Text style={styles.latestInsightCopy}>
          Your personalized insight will appear here once enough financial activity is available.
        </Text>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    chatHead: {
      position: 'absolute',
      zIndex: 12,
      width: CHAT_HEAD_SIZE,
      height: CHAT_HEAD_SIZE,
      borderRadius: CHAT_HEAD_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      shadowColor: colors.shadow,
      shadowOpacity: 0.24,
      shadowRadius: 10,
      elevation: 8,
    },
    popup: {
      position: 'absolute',
      zIndex: 11,
      width: 250,
      padding: 15,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      shadowColor: colors.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 6,
    },
    popupClose: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    popupTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
    popupScroll: { marginTop: 7, paddingRight: 5, flexGrow: 0, flexShrink: 1 },
    popupScrollContent: { paddingRight: 9 },
    popupCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
    chatScreen: {
      ...StyleSheet.absoluteFill,
      zIndex: 30,
      backgroundColor: colors.background,
    },
    chatBody: { flex: 1 },
    chatHeader: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingBottom: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    headerButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
    },
    chatTitleWrap: { flex: 1, marginLeft: 7 },
    chatTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
    chatSubtitle: { marginTop: 2, color: colors.muted, fontSize: 11 },
    headerLogo: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentPale,
    },
    headerLogoImage: { width: 29, height: 29 },
    messageList: { flex: 1 },
    messages: { flexGrow: 1, padding: 20, paddingBottom: 12, gap: 10 },
    latestInsightCard: {
      padding: 15,
      borderRadius: 17,
      backgroundColor: colors.accentPale,
      borderWidth: 1,
      borderColor: colors.line,
    },
    latestInsightTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
    latestInsightCopy: { marginTop: 7, color: colors.ink, fontSize: 14, lineHeight: 21 },
    insightLoading: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9 },
    insightRetry: {
      alignSelf: 'flex-start',
      minHeight: 40,
      justifyContent: 'center',
      marginTop: 5,
      paddingHorizontal: 4,
    },
    insightRetryText: { color: colors.accent, fontSize: 13, fontWeight: '900' },
    messageBubble: {
      maxWidth: '84%',
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 17,
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.line,
    },
    userBubble: {
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
      backgroundColor: colors.accent,
    },
    messageText: { fontSize: 14, lineHeight: 20 },
    assistantMessageText: { color: colors.ink },
    userMessageText: { color: colors.textOnPrimary },
    typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typingText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    retryButton: {
      alignSelf: 'flex-start',
      minHeight: 36,
      justifyContent: 'center',
      marginTop: 6,
      paddingHorizontal: 4,
    },
    retryText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
    faqSection: {
      marginTop: 4,
      padding: 14,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    faqTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
    faqList: { marginTop: 10, gap: 8 },
    faqChip: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.line,
    },
    faqChipText: { color: colors.ink, fontSize: 13, lineHeight: 18 },
    seeMore: {
      alignSelf: 'flex-start',
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    seeMoreText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 16,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    composerInput: {
      flex: 1,
      minHeight: 46,
      maxHeight: 108,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 18,
      backgroundColor: colors.surfaceInput,
      color: colors.ink,
      fontSize: 14,
    },
    sendButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    sendDisabled: { opacity: 0.45 },
    pressed: { opacity: 0.76 },
  });
}
