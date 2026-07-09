import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useStore, Agent } from "../store";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 44) / 2;

export default function AgentsScreen() {
  const { theme } = useTheme();
  const agents = useStore((s) => s.agents);
  const createAgent = useStore((s) => s.createAgent);
  const deleteAgent = useStore((s) => s.deleteAgent);
  const updateAgentStatus = useStore((s) => s.updateAgentStatus);
  const t = useStore((s) => s.t);
  const settings = useStore((s) => s.settings);

  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newModel, setNewModel] = useState(settings.model);
  const [newDescription, setNewDescription] = useState("");

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    createAgent({
      name: newName.trim(),
      model: newModel || settings.model,
      description: newDescription.trim() || "No description",
    });
    setNewName("");
    setNewModel(settings.model);
    setNewDescription("");
    setModalVisible(false);
  };

  const statusColor = (status: Agent["status"]) => {
    switch (status) {
      case "running": return theme.colors.success;
      case "error": return theme.colors.error;
      default: return theme.colors.textMuted;
    }
  };

  const renderAgent = ({ item }: { item: Agent }) => (
    <View
      style={[
        styles.agentCard,
        {
          backgroundColor: theme.colors.surface + "CC",
          borderColor: theme.colors.border,
          ...theme.shadows.md,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
        <Ionicons name="robot" size={28} color={theme.colors.primary} />
      </View>
      <Text style={[styles.agentName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[styles.agentModel, { color: theme.colors.textMuted }]} numberOfLines={1}>
        {item.model}
      </Text>
      <Text style={[styles.agentDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.cardBtn, { backgroundColor: theme.colors.success + "20" }]}
          onPress={() => updateAgentStatus(item.id, "running")}
        >
          <Ionicons name="play" size={16} color={theme.colors.success} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cardBtn, { backgroundColor: theme.colors.accent + "20" }]}
        >
          <Ionicons name="settings" size={16} color={theme.colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cardBtn, { backgroundColor: theme.colors.error + "20" }]}
          onPress={() => deleteAgent(item.id)}
        >
          <Ionicons name="trash" size={16} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceDark }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.headerBg, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          {t("agents")}
        </Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.textPrimary }]}
          placeholder={t("search") + "..."}
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filtered}
        renderItem={renderAgent}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="robot-outline" size={64} color={theme.colors.textMuted} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              {t("noAgents")}
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.emptyButtonText}>+ {t("createAgent")}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              {t("createAgent")}
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.colors.inputBg, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder={t("agentName")}
              placeholderTextColor={theme.colors.textMuted}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.colors.inputBg, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder={t("agentModel")}
              placeholderTextColor={theme.colors.textMuted}
              value={newModel}
              onChangeText={setNewModel}
            />
            <TextInput
              style={[styles.modalInput, styles.modalInputMultiline, { backgroundColor: theme.colors.inputBg, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder={t("agentDescription")}
              placeholderTextColor={theme.colors.textMuted}
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.colors.textMuted + "30" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.textPrimary }]}>
                  {t("cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleCreate}
              >
                <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                  {t("save")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  columnWrapper: {
    gap: 8,
    marginBottom: 8,
  },
  agentCard: {
    width: CARD_WIDTH,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  agentName: {
    fontSize: 15,
    fontWeight: "600",
  },
  agentModel: {
    fontSize: 12,
  },
  agentDesc: {
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  cardBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  modalInputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
