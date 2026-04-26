import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthSession } from '@/core/auth/session-context';
import {
  buildAssistantProposal,
  confirmAssistantProposal,
  type AssistantProposal,
} from '@/core/domain/usecases/assistant-flow';
import { AssistantRepository } from '@/core/repositories/assistant-repository';
import { FinanceRepository } from '@/core/repositories/finance-repository';
import { TaskRepository } from '@/core/repositories/task-repository';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';
import { AppCard } from '@/core/ui/components/AppCard';
import { AssistantActionCard } from '@/core/ui/components/AssistantActionCard';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
};

const SUGGESTED_PROMPTS = [
  'How much did I spend today?',
  "What's my biggest expense this month?",
  'Show my spending by category',
  'How many tasks are pending?',
  'What events do I have this week?',
  'Am I spending more than last week?',
];

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: 'Hey! I am your BELTECH assistant. Ask me about spending, tasks, or schedule.',
  timestamp: Date.now(),
};

export default function AssistantScreen() {
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const floatingOffset = 16;
  const bottomOffset = tabBarHeight + floatingOffset + insets.bottom;
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [proposal, setProposal] = useState<AssistantProposal | null>(null);
  const [proposalSourceInput, setProposalSourceInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, isSending]);

  const handleClearChat = useCallback(() => {
    Alert.alert('Clear conversation?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => setMessages([WELCOME_MESSAGE]),
      },
    ]);
  }, []);

  const sendPrompt = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = { role: 'user', content: trimmed, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const nextProposal = buildAssistantProposal(trimmed);
      const assistant = await AssistantRepository.prompt({ prompt: trimmed });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: assistant.reply, timestamp: Date.now() },
        { role: 'system', content: `Assistant proposed ${nextProposal.action}`, timestamp: Date.now() },
      ]);
      setProposal(nextProposal);
      setProposalSourceInput(trimmed);
    } finally {
      setIsSending(false);
    }
  }, [isSending]);

  const showTyping = isSending && messages[messages.length - 1]?.role === 'user';
  const showSuggestions = messages.length <= 2;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={bottomOffset}
      style={[{ flex: 1 }, { backgroundColor: colors.background }]}
    >
      <SafeAreaView style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }} edges={['left', 'right']}>
        <View style={styles.container}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomOffset + 12 }]}
          >
            <AppCard mode="elevated" style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroEyebrow, { color: colors.primary }]}>AI workspace</Text>
                  <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>BELTECH Assistant</Text>
                  <Text style={[styles.heroBody, { color: colors.textSecondary }]}>
                    Ask about tasks, calendar, or finance and get instant help.
                  </Text>
                </View>
                <View style={styles.heroIcons}>
                  <View style={[styles.heroIconBubble, { backgroundColor: `${colors.primary}25` }]}>
                    <MaterialIcons name="smart-toy" size={20} color={colors.primary} />
                  </View>
                  <Pressable onPress={handleClearChat}>
                    <MaterialIcons name="history" size={20} color={colors.textTertiary} />
                  </Pressable>
                </View>
              </View>
            </AppCard>

            <View style={styles.messagesContainer}>
              {messages.map((msg, index) => (
                <View
                  key={`${msg.timestamp}-${index}`}
                  style={[
                    styles.messageRow,
                    msg.role === 'user' && styles.userRow,
                    msg.role === 'assistant' && styles.assistantRow,
                    msg.role === 'system' && styles.systemRow,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      msg.role === 'user' && { backgroundColor: colors.primary },
                      msg.role === 'assistant' && {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                      msg.role === 'system' && styles.systemBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        msg.role === 'user' && { color: '#fff' },
                        msg.role === 'assistant' && { color: colors.textPrimary },
                        msg.role === 'system' && { color: colors.textTertiary, fontStyle: 'italic' },
                      ]}
                    >
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}

              {showTyping ? (
                <View style={[styles.messageRow, styles.assistantRow]}>
                  <View
                    style={[
                      styles.messageBubble,
                      styles.assistantBubble,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.messageText, { color: colors.textTertiary }]}>BELTECH is typing…</Text>
                  </View>
                </View>
              ) : null}
            </View>

            {proposal ? (
              <AssistantActionCard
                action={proposal.action}
                title={proposal.title}
                details={proposal.details}
                onApprove={async () => {
                  const userId = state.userId;
                  if (!userId) return;
                  const result = await confirmAssistantProposal({
                    action: proposal.action,
                    sourceInput: proposalSourceInput,
                    deps: {
                      createTask: (taskInput) => TaskRepository.create(userId, taskInput),
                      createExpense: (expenseInput) => FinanceRepository.createExpense(userId, expenseInput),
                      enqueueSyncPush: () =>
                        SyncCoordinator.enqueueDefault(userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']),
                      runSync: async () => {
                        await SyncCoordinator.runPending(userId);
                      },
                      now: () => Date.now(),
                    },
                  });

                  setMessages((prev) => [
                    ...prev,
                    { role: 'system', content: `Confirmed: ${proposal.action}`, timestamp: Date.now() },
                    { role: 'system', content: result.message, timestamp: Date.now() },
                  ]);
                  setProposal(null);
                  setProposalSourceInput('');
                }}
                onReject={() => {
                  setMessages((prev) => [
                    ...prev,
                    { role: 'system', content: `Cancelled: ${proposal.action}`, timestamp: Date.now() },
                  ]);
                  setProposal(null);
                  setProposalSourceInput('');
                }}
              />
            ) : null}

            {showSuggestions ? (
              <View style={styles.trySection}>
                <Text style={[styles.tryTitle, { color: colors.textPrimary }]}>Try asking:</Text>
                <View style={styles.promptGrid}>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <Pressable
                      key={prompt}
                      onPress={() => void sendPrompt(prompt)}
                      style={[
                        styles.promptChip,
                        { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                      ]}
                    >
                      <Text style={[styles.promptText, { color: colors.textSecondary }]}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.composer,
              { borderColor: colors.border, backgroundColor: colors.surfaceElevated, marginBottom: bottomOffset },
            ]}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message BELTECH..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.textPrimary }]}
              onSubmitEditing={() => void sendPrompt(input)}
              returnKeyType="send"
            />
            <Pressable
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
                isSending && styles.sendDisabled,
              ]}
              onPress={() => void sendPrompt(input)}
              accessibilityRole="button"
              accessibilityLabel="Send assistant message"
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="send" size={20} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 10 },
  scroll: { flex: 1 },
  scrollContent: { gap: 12, paddingBottom: 100, paddingHorizontal: 16 },
  heroCard: { paddingTop: 14, paddingBottom: 14 },
  heroHeader: { flexDirection: 'row', gap: 12 },
  heroEyebrow: { ...LifeOSTypography.titleMedium },
  heroTitle: { ...LifeOSTypography.headlineLarge },
  heroBody: { ...LifeOSTypography.bodyLarge },
  heroIcons: { alignItems: 'center', gap: 12, paddingTop: 4 },
  heroIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: { gap: 4 },
  messageRow: { flexDirection: 'row', marginVertical: 2 },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  systemRow: { justifyContent: 'center' },
  messageBubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  assistantBubble: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  systemBubble: { backgroundColor: 'transparent', paddingVertical: 6 },
  messageText: { ...LifeOSTypography.bodyLarge },
  trySection: { gap: 8 },
  tryTitle: { ...LifeOSTypography.headlineMedium },
  promptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  promptChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexBasis: '47%',
    flexGrow: 1,
  },
  promptText: { ...LifeOSTypography.bodyLarge },
  composer: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    ...LifeOSTypography.bodyLarge,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.75 },
});
