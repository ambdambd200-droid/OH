import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useStore, MemoryEntry } from "../store";

export default function MemoryScreen() {
  const { theme } = useTheme();
  const memories = useStore((s) => s.memories);
  const searchMemory = useStore((s) => s.searchMemory);
  const deleteMemory = useStore((s) => s.deleteMemory);
  const addMemory = useStore((s) => s.addMemory);
  const t = useStore((s) => s.t);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGraph, setShowGraph] = useState(false);

  const results = searchMemory(searchQuery);
  const items = searchQuery ? results : memories;

  const handleDelete = (id: string) => {
    Alert.alert(t("confirmDelete"), "", [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => deleteMemory(id) },
    ]);
  };

  const renderMemory = ({ item }: { item: MemoryEntry }) => (
    <TouchableOpacity
      style={[
        styles.memoryItem,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          ...theme.shadows.sm,
        },
      ]}
      onLongPress={() => handleDelete(item.id)}
    >
      <View style={styles.memoryContent}>
        <Text style={[styles.memoryKey, { color: theme.colors.primary }]} numberOfLines={1}>
          {item.key}
        </Text>
        <Text style={[styles.memoryValue, { color: theme.colors.textPrimary }]} numberOfLines={2}>
          {item.value}
        </Text>
        <Text style={[styles.memoryTime, { color: theme.colors.textMuted }]}>
          {new Date(item.timestamp).toLocaleDateString()} {" "}
          {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.deleteBtn, { backgroundColor: theme.colors.error + "20" }]}
        onPress={() => handleDelete(item.id)}
      >
        <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (showGraph) {
    const sorted = [...memories].sort((a, b) => b.timestamp - a.timestamp);
    const nodes = sorted.slice(0, 8);
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surfaceDark }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.headerBg, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => setShowGraph(false)}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Knowledge Graph
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.graphContainer}>
          {nodes.map((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const radius = 100;
            const left = 160 + radius * Math.cos(angle) - 40;
            const top = 220 + radius * Math.sin(angle) - 40;
            return (
              <View
                key={node.id}
                style={[
                  styles.graphNode,
                  {
                    left,
                    top,
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.primary + "60",
                    ...theme.shadows.glow,
                  },
                ]}
              >
                <Text style={[styles.graphNodeText, { color: theme.colors.primary }]} numberOfLines={1}>
                  {node.key}
                </Text>
              </View>
            );
          })}
          <View style={[styles.graphCenter, { backgroundColor: theme.colors.primary, ...theme.shadows.glow }]}>
            <Ionicons name="cube" size={28} color="#FFFFFF" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceDark }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.headerBg, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          {t("memory")}
        </Text>
        <TouchableOpacity onPress={() => setShowGraph(true)}>
          <Ionicons name="git-network-outline" size={24} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
          <Ionicons name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
            placeholder={t("search") + "..."}
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={items}
        renderItem={renderMemory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color={theme.colors.textMuted} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              {searchQuery ? t("noResults") : t("noMemories")}
            </Text>
          </View>
        }
      />
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
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
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
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 8,
  },
  memoryItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  memoryContent: {
    flex: 1,
    gap: 4,
  },
  memoryKey: {
    fontSize: 14,
    fontWeight: "700",
  },
  memoryValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  memoryTime: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
  },
  graphContainer: {
    flex: 1,
    position: "relative",
  },
  graphNode: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  graphNodeText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  graphCenter: {
    position: "absolute",
    left: 150,
    top: 210,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});
