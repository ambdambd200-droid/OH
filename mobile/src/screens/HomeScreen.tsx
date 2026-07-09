import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useStore } from "../store";

const { width } = Dimensions.get("window");
const CARD_GAP = 12;

interface StatCard {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface QuickAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}

export default function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const t = useStore((s) => s.t);
  const settings = useStore((s) => s.settings);
  const [refreshing, setRefreshing] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const stats: StatCard[] = [
    { label: t("systemHealth"), value: "98%", icon: "heart-circle", color: theme.colors.success },
    { label: t("activeAgents"), value: "3", icon: "robot", color: theme.colors.primary },
    { label: t("memoryUsage"), value: "1.2 GB", icon: "cube", color: theme.colors.accent },
    { label: t("uptime"), value: "12h 34m", icon: "time", color: theme.colors.warning },
  ];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const showTerminal = () => {
    setTerminalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 9,
    }).start();
  };

  const hideTerminal = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setTerminalVisible(false));
  };

  const actions: QuickAction[] = [
    { label: t("createAgent"), icon: "add-circle", color: theme.colors.primary, onPress: () => navigation?.navigate("DrawerAgents") },
    { label: t("chat"), icon: "chatbubbles", color: theme.colors.accent, onPress: () => navigation?.navigate("DrawerChat") },
    { label: t("viewMemory"), icon: "cube", color: theme.colors.success, onPress: () => navigation?.navigate("DrawerMemory") },
    { label: t("deploy"), icon: "rocket", color: theme.colors.warning, onPress: () => showTerminal() },
  ];

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceDark }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>
            {settings.language === "ar" ? "مرحبًا بك في" : "Welcome to"}
          </Text>
          <Text style={styles.title}>OH</Text>
          <Text style={styles.subtitle}>
            {settings.language === "ar" ? "فكّرها. ابنِها. انشرها." : "Think It. Build It. Deploy It."}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          {settings.language === "ar" ? "نظرة عامة" : "Overview"}
        </Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View
              key={i}
              style={[
                styles.statCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  ...theme.shadows.sm,
                },
              ]}
            >
              <Ionicons name={stat.icon} size={28} color={stat.color} />
              <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          {settings.language === "ar" ? "إجراءات سريعة" : "Quick Actions"}
        </Text>
        <View style={styles.actionsRow}>
          {actions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.actionButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  ...theme.shadows.md,
                },
              ]}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: action.color + "20" }]}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={[styles.actionLabel, { color: theme.colors.textPrimary }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={terminalVisible} transparent animationType="none">
        <TouchableOpacity style={styles.terminalOverlay} activeOpacity={1} onPress={hideTerminal}>
          <Animated.View
            style={[
              styles.terminalSheet,
              {
                backgroundColor: theme.colors.surfaceDark,
                borderColor: theme.colors.border,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.terminalHandle} />
            <Text style={[styles.terminalTitle, { color: theme.colors.textPrimary }]}>
              {t("terminal")}
            </Text>
            <View style={[styles.terminalBody, { backgroundColor: "#0B1120" }]}>
              <Text style={styles.terminalText}>
                {"$ oh deploy --env production\n"}
                {"Building agents...\n"}
                {"Deploying to production...\n"}
                {"✓ All systems operational\n"}
                {"✓ Agents active: 3\n"}
                {"✓ Memory sync complete\n"}
                {"\n"}
                {"Ready.\n"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.terminalClose, { backgroundColor: theme.colors.primary }]}
              onPress={hideTerminal}
            >
              <Text style={styles.terminalCloseText}>{t("cancel")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    alignItems: "center",
  },
  greeting: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "400",
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 4,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 8,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
    marginBottom: 8,
  },
  statCard: {
    width: (width - 44) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 13,
    textAlign: "center",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
  },
  actionButton: {
    width: (width - 44) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  terminalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  terminalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    minHeight: 350,
  },
  terminalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  terminalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  terminalBody: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    minHeight: 180,
  },
  terminalText: {
    fontFamily: "System",
    fontSize: 13,
    color: "#10B981",
    lineHeight: 20,
  },
  terminalClose: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  terminalCloseText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
