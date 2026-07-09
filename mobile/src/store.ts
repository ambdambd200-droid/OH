import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface Agent {
  id: string;
  name: string;
  model: string;
  status: "idle" | "running" | "error";
  description: string;
  createdAt: number;
}

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  timestamp: number;
}

export interface AppSettings {
  language: "en" | "ar";
  fontSize: number;
  notifications: boolean;
  model: string;
}

export const translations: Record<string, Record<string, string>> = {
  en: {
    home: "Home",
    chat: "Chat",
    agents: "Agents",
    memory: "Memory",
    settings: "Settings",
    systemHealth: "System Health",
    activeAgents: "Active Agents",
    memoryUsage: "Memory Usage",
    uptime: "Uptime",
    createAgent: "Create Agent",
    viewMemory: "View Memory",
    deploy: "Deploy",
    search: "Search",
    noResults: "No results found",
    noMemories: "No memories stored yet",
    noAgents: "No agents created yet",
    noMessages: "Start a conversation",
    typeMessage: "Type a message...",
    systemPrompt: "System Prompt",
    voiceInput: "Voice Input",
    send: "Send",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    theme: "Theme",
    language: "Language",
    fontSize: "Font Size",
    notifications: "Notifications",
    model: "Model",
    exportData: "Export Data",
    importData: "Import Data",
    about: "About",
    version: "Version",
    agentName: "Agent Name",
    agentModel: "Agent Model",
    agentDescription: "Description",
    run: "Run",
    config: "Config",
    confirmDelete: "Are you sure?",
    terminal: "Terminal Output",
    refresh: "Refresh",
    context: "Context",
    processing: "Processing...",
  },
  ar: {
    home: "الرئيسية",
    chat: "المحادثة",
    agents: "الوكلاء",
    memory: "الذاكرة",
    settings: "الإعدادات",
    systemHealth: "صحة النظام",
    activeAgents: "الوكلاء النشطون",
    memoryUsage: "استخدام الذاكرة",
    uptime: "وقت التشغيل",
    createAgent: "إنشاء وكيل",
    viewMemory: "عرض الذاكرة",
    deploy: "نشر",
    search: "بحث",
    noResults: "لا توجد نتائج",
    noMemories: "لا توجد ذكريات مخزنة بعد",
    noAgents: "لم يتم إنشاء وكلاء بعد",
    noMessages: "ابدأ محادثة",
    typeMessage: "اكتب رسالة...",
    systemPrompt: "مطالبة النظام",
    voiceInput: "إدخال صوتي",
    send: "إرسال",
    cancel: "إلغاء",
    save: "حفظ",
    delete: "حذف",
    edit: "تعديل",
    theme: "السمة",
    language: "اللغة",
    fontSize: "حجم الخط",
    notifications: "الإشعارات",
    model: "النموذج",
    exportData: "تصدير البيانات",
    importData: "استيراد البيانات",
    about: "حول",
    version: "الإصدار",
    agentName: "اسم الوكيل",
    agentModel: "نموذج الوكيل",
    agentDescription: "الوصف",
    run: "تشغيل",
    config: "إعدادات",
    confirmDelete: "هل أنت متأكد؟",
    terminal: "مخرجات الطرفية",
    refresh: "تحديث",
    context: "السياق",
    processing: "جارٍ المعالجة...",
  },
};

export interface AppState {
  messages: Message[];
  agents: Agent[];
  memories: MemoryEntry[];
  settings: AppSettings;
  themeName: string;
  isRTL: boolean;

  sendMessage: (content: string, role?: Message["role"]) => void;
  createAgent: (agent: Omit<Agent, "id" | "createdAt" | "status">) => void;
  deleteAgent: (id: string) => void;
  updateAgentStatus: (id: string, status: Agent["status"]) => void;
  searchMemory: (query: string) => MemoryEntry[];
  addMemory: (key: string, value: string) => void;
  deleteMemory: (id: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setThemeName: (name: string) => void;
  setLanguage: (lang: "en" | "ar") => void;
  t: (key: string) => string;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      messages: [],
      agents: [],
      memories: [],
      settings: {
        language: "en",
        fontSize: 16,
        notifications: true,
        model: "gpt-4",
      },
      themeName: "deep-space",
      isRTL: false,

      sendMessage: (content, role = "user") => {
        const msg: Message = {
          id: Date.now().toString(),
          role,
          content,
          timestamp: Date.now(),
        };
        set((state) => ({ messages: [...state.messages, msg] }));
      },

      createAgent: (agentData) => {
        const agent: Agent = {
          ...agentData,
          id: Date.now().toString(),
          createdAt: Date.now(),
          status: "idle",
        };
        set((state) => ({ agents: [...state.agents, agent] }));
      },

      deleteAgent: (id) => {
        set((state) => ({ agents: state.agents.filter((a) => a.id !== id) }));
      },

      updateAgentStatus: (id, status) => {
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, status } : a)),
        }));
      },

      searchMemory: (query) => {
        const { memories } = get();
        if (!query.trim()) return memories;
        const lower = query.toLowerCase();
        return memories.filter(
          (m) => m.key.toLowerCase().includes(lower) || m.value.toLowerCase().includes(lower)
        );
      },

      addMemory: (key, value) => {
        const entry: MemoryEntry = {
          id: Date.now().toString(),
          key,
          value,
          timestamp: Date.now(),
        };
        set((state) => ({ memories: [...state.memories, entry] }));
      },

      deleteMemory: (id) => {
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
        }));
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      setThemeName: (name) => set({ themeName: name }),

      setLanguage: (lang) => {
        set((state) => ({
          settings: { ...state.settings, language: lang },
          isRTL: lang === "ar",
        }));
      },

      t: (key: string) => {
        const { settings } = get();
        const lang = settings.language;
        return translations[lang]?.[key] ?? translations["en"]?.[key] ?? key;
      },
    }),
    {
      name: "oh-mobile-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
