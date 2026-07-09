import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useTheme, themes } from "../theme";
import { useStore } from "../store";

const THEME_LIST = [
  { key: "deep-space", label: "Deep Space", icon: "moon" },
  { key: "light", label: "Light", icon: "sunny" },
  { key: "ocean", label: "Ocean", icon: "water" },
  { key: "sunset", label: "Sunset", icon: "sunset" },
  { key: "forest", label: "Forest", icon: "leaf" },
] as const;

const LANGUAGES = [
  { key: "en" as const, label: "English", native: "English" },
  { key: "ar" as const, label: "Arabic", native: "العربية" },
];

export default function SettingsScreen() {
  const { theme } = useTheme();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const themeName = useStore((s) => s.themeName);
  const setThemeName = useStore((s) => s.setThemeName);
  const setLanguage = useStore((s) => s.setLanguage);
  const t = useStore((s) => s.t);
  const messages = useStore((s) => s.messages);
  const agents = useStore((s) => s.agents);
  const memories = useStore((s) => s.memories);

  const handleExport = () => {
    const data = {
      messages,
      agents,
      memories,
      settings,
      theme: themeName,
      exportedAt: new Date().toISOString(),
    };
    Alert.alert(t("exportData"), JSON.stringify(data, null, 2));
  };

  const handleImport = () => {
    Alert.alert(t("importData"), t("confirmDelete"));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceDark }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.headerBg, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          {t("settings")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
          {t("theme")}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.themeGrid}>
            {THEME_LIST.map((th) => {
              const isActive = themeName === th.key;
              const thColors = themes[th.key].colors;
              return (
                <TouchableOpacity
                  key={th.key}
                  style={[
                    styles.themeItem,
                    isActive && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + "15" },
                  ]}
                  onPress={() => setThemeName(th.key)}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: thColors.primary }]}>
                    <Ionicons name={th.icon as any} size={20} color={thColors.textPrimary} />
                  </View>
                  <Text
                    style={[
                      styles.themeLabel,
                      { color: isActive ? theme.colors.primary : theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {th.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
          {t("language")}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {LANGUAGES.map((lang) => {
            const isActive = settings.language === lang.key;
            return (
              <TouchableOpacity
                key={lang.key}
                style={[
                  styles.langRow,
                  { borderBottomColor: theme.colors.border },
                  LANGUAGES.indexOf(lang) === LANGUAGES.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => setLanguage(lang.key)}
              >
                <View
                  style={[
                    styles.radio,
                    { borderColor: isActive ? theme.colors.primary : theme.colors.textMuted },
                  ]}
                >
                  {isActive && <View style={[styles.radioFill, { backgroundColor: theme.colors.primary }]} />}
                </View>
                <View style={styles.langInfo}>
                  <Text style={[styles.langLabel, { color: theme.colors.textPrimary }]}>
                    {lang.label}
                  </Text>
                  <Text style={[styles.langNative, { color: theme.colors.textMuted }]}>
                    {lang.native}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
          {t("fontSize")}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.sliderRow}>
            <Ionicons name="text" size={18} color={theme.colors.textMuted} />
            <View style={styles.sliderWrap}>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={12}
                maximumValue={24}
                step={1}
                value={settings.fontSize}
                onValueChange={(val) => updateSettings({ fontSize: Math.round(val) })}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.border}
                thumbTintColor={theme.colors.primary}
              />
            </View>
            <Text style={[styles.sliderValue, { color: theme.colors.textPrimary }]}>
              {settings.fontSize}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
          {t("notifications")}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.colors.textPrimary }]}>
              {t("notifications")}
            </Text>
            <Switch
              value={settings.notifications}
              onValueChange={(val) => updateSettings({ notifications: val })}
              trackColor={{ false: theme.colors.textMuted + "40", true: theme.colors.primary + "60" }}
              thumbColor={settings.notifications ? theme.colors.primary : theme.colors.textMuted}
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
          {t("model")}
        </Text>
        <TouchableOpacity
          style={[styles.card, styles.simpleRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <Ionicons name="hardware-chip-outline" size={20} color={theme.colors.accent} />
          <Text style={[styles.simpleRowText, { color: theme.colors.textPrimary }]}>
            {settings.model}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
          {t("exportData")}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.actionRow, { borderBottomColor: theme.colors.border }]}
            onPress={handleExport}
          >
            <Ionicons name="download-outline" size={20} color={theme.colors.success} />
            <Text style={[styles.actionLabel, { color: theme.colors.textPrimary }]}>
              {t("exportData")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={handleImport}>
            <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.warning} />
            <Text style={[styles.actionLabel, { color: theme.colors.textPrimary }]}>
              {t("importData")}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
          {t("about")}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: theme.colors.textSecondary }]}>
              {t("version")}
            </Text>
            <Text style={[styles.aboutValue, { color: theme.colors.textPrimary }]}>
              2.0.0
            </Text>
          </View>
          <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.aboutLabel, { color: theme.colors.textSecondary }]}>
              OH Mobile
            </Text>
            <Text style={[styles.aboutValue, { color: theme.colors.primary, fontWeight: "600" }]}>
              {t("about")}
            </Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
    gap: 4,
  },
  themeItem: {
    width: "18%",
    minWidth: 60,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    gap: 6,
  },
  themeSwatch: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  themeLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioFill: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  langInfo: {
    flex: 1,
  },
  langLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  langNative: {
    fontSize: 13,
    marginTop: 2,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  sliderWrap: {
    flex: 1,
  },
  sliderValue: {
    fontSize: 15,
    fontWeight: "600",
    width: 30,
    textAlign: "center",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  simpleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  simpleRowText: {
    flex: 1,
    fontSize: 15,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  aboutLabel: {
    fontSize: 14,
  },
  aboutValue: {
    fontSize: 14,
  },
});
