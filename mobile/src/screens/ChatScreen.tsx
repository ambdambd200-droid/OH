import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useStore, Message } from "../store";

export default function ChatScreen() {
  const { theme } = useTheme();
  const messages = useStore((s) => s.messages);
  const sendMessage = useStore((s) => s.sendMessage);
  const settings = useStore((s) => s.settings);
  const t = useStore((s) => s.t);
  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState("");
  const [contextVisible, setContextVisible] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isTyping]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    sendMessage(text, "user");
    setInputText("");
    setIsTyping(true);
    setTimeout(() => {
      sendMessage(
        `I received your message: "${text}". This is a simulated response.`,
        "assistant"
      );
      setIsTyping(false);
    }, 1500);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const isSystem = item.role === "system";
    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userRow : styles.assistantRow,
        ]}
      >
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary + "30" }]}>
            <Ionicons name={isSystem ? "information-circle" : "robot"} size={16} color={theme.colors.primary} />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.userBubble, { backgroundColor: theme.colors.primary }]
              : isSystem
              ? [styles.systemBubble, { backgroundColor: theme.colors.warning + "20", borderColor: theme.colors.warning + "40" }]
              : [styles.assistantBubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }],
          ]}
        >
          {isSystem && (
            <Text style={[styles.systemLabel, { color: theme.colors.warning }]}>
              {t("systemPrompt")}
            </Text>
          )}
          <Text
            style={[
              styles.messageText,
              { color: isUser ? "#FFFFFF" : theme.colors.textPrimary },
              isSystem && { fontSize: 12 },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.timestamp,
              { color: isUser ? "rgba(255,255,255,0.6)" : theme.colors.textMuted },
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.surfaceDark }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={[styles.header, { backgroundColor: theme.colors.headerBg, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          {t("chat")}
        </Text>
        <TouchableOpacity onPress={() => setContextVisible(true)}>
          <Ionicons name="options-outline" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textMuted} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              {t("noMessages")}
            </Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isTyping && (
        <View style={[styles.typingIndicator, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.typingAvatar, { backgroundColor: theme.colors.primary + "30" }]}>
            <Ionicons name="robot" size={14} color={theme.colors.primary} />
          </View>
          <Animated.View style={[styles.typingDots, { opacity: pulseAnim }]}>
            <Text style={[styles.typingText]}>
              {t("processing")}
            </Text>
          </Animated.View>
        </View>
      )}

      <View style={[styles.inputBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.voiceButton}>
          <Ionicons name="mic" size={22} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <View style={[styles.inputWrap, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.primary + "40" }]}>
          <TextInput
            style={[styles.input, { color: theme.colors.textPrimary }]}
            placeholder={t("typeMessage")}
            placeholderTextColor={theme.colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
        </View>
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: inputText.trim() ? theme.colors.primary : theme.colors.textMuted + "50" }]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Modal visible={contextVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setContextVisible(false)}>
          <View style={[styles.contextPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.contextHandle} />
            <Text style={[styles.contextTitle, { color: theme.colors.textPrimary }]}>
              {t("context")}
            </Text>
            <View style={[styles.contextItem, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.contextLabel, { color: theme.colors.textSecondary }]}>
                {t("systemPrompt")}
              </Text>
              <Text style={[styles.contextValue, { color: theme.colors.textPrimary }]}>
                You are OH, a helpful AI assistant.
              </Text>
            </View>
            <View style={[styles.contextItem, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.contextLabel, { color: theme.colors.textSecondary }]}>
                {t("model")}
              </Text>
              <Text style={[styles.contextValue, { color: theme.colors.textPrimary }]}>
                {settings.model}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  assistantRow: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  systemBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  systemLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 12,
  },
  typingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  typingDots: {},
  typingText: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  input: {
    fontSize: 15,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  contextPanel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    minHeight: 250,
  },
  contextHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 20,
  },
  contextTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  contextItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  contextValue: {
    fontSize: 14,
    lineHeight: 20,
  },
});
