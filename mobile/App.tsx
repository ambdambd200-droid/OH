import React, { useMemo } from "react";
import { StatusBar, useColorScheme, I18nManager } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeContext, themes, Theme } from "./src/theme";
import { useStore } from "./src/store";
import HomeScreen from "./src/screens/HomeScreen";
import ChatScreen from "./src/screens/ChatScreen";
import AgentsScreen from "./src/screens/AgentsScreen";
import MemoryScreen from "./src/screens/MemoryScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

const TAB_ICONS: Record<string, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  Home: { focused: "home", default: "home-outline" },
  Chat: { focused: "chatbubbles", default: "chatbubbles-outline" },
  Agents: { focused: "robot", default: "robot-outline" },
  Memory: { focused: "cube", default: "cube-outline" },
  Settings: { focused: "settings", default: "settings-outline" },
};

function TabNavigator() {
  const themeName = useStore((s) => s.themeName);
  const theme = themes[themeName] || themes["deep-space"];

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, size }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <Ionicons
              name={focused ? icons.focused : icons.default}
              size={size}
              color={focused ? theme.colors.primary : theme.colors.textMuted}
            />
          );
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Agents" component={AgentsScreen} />
      <Tab.Screen name="Memory" component={MemoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const themeName = useStore((s) => s.themeName);
  const theme = themes[themeName] || themes["deep-space"];

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: theme.colors.surfaceDark }}
    >
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

export default function App() {
  const themeName = useStore((s) => s.themeName);
  const isRTL = useStore((s) => s.isRTL);
  const theme = themes[themeName] || themes["deep-space"];

  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);

  const themeContext = useMemo(
    () => ({ theme, themeName, setTheme: (n: string) => useStore.getState().setThemeName(n) }),
    [theme, themeName]
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeContext.Provider value={themeContext}>
        <StatusBar
          barStyle={theme.colors.statusBar === "dark" ? "dark-content" : "light-content"}
          backgroundColor={theme.colors.headerBg}
        />
        <NavigationContainer
          theme={{
            dark: theme.isDark,
            colors: {
              primary: theme.colors.primary,
              background: theme.colors.surfaceDark,
              card: theme.colors.card,
              text: theme.colors.textPrimary,
              border: theme.colors.border,
              notification: theme.colors.error,
            },
            fonts: {
              regular: { fontFamily: "System", fontWeight: "400" },
              medium: { fontFamily: "System", fontWeight: "600" },
              bold: { fontFamily: "System", fontWeight: "700" },
              heavy: { fontFamily: "System", fontWeight: "800" },
            },
          }}
        >
          <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
              headerShown: false,
              drawerStyle: {
                backgroundColor: theme.colors.surfaceDark,
                width: 280,
              },
              drawerLabelStyle: {
                color: theme.colors.textPrimary,
                fontSize: 14,
              },
              drawerItemStyle: {
                borderRadius: 8,
                marginHorizontal: 8,
              },
              drawerActiveTintColor: theme.colors.primary,
              drawerInactiveTintColor: theme.colors.textSecondary,
            }}
          >
            <Drawer.Screen
              name="MainTabs"
              component={TabNavigator}
              options={{ drawerLabel: "Home", drawerIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} /> }}
            />
            <Drawer.Screen
              name="DrawerChat"
              component={ChatScreen}
              options={{ drawerLabel: "Chat", drawerIcon: ({ color }) => <Ionicons name="chatbubbles-outline" size={22} color={color} /> }}
            />
            <Drawer.Screen
              name="DrawerAgents"
              component={AgentsScreen}
              options={{ drawerLabel: "Agents", drawerIcon: ({ color }) => <Ionicons name="robot-outline" size={22} color={color} /> }}
            />
            <Drawer.Screen
              name="DrawerMemory"
              component={MemoryScreen}
              options={{ drawerLabel: "Memory", drawerIcon: ({ color }) => <Ionicons name="cube-outline" size={22} color={color} /> }}
            />
            <Drawer.Screen
              name="DrawerSettings"
              component={SettingsScreen}
              options={{ drawerLabel: "Settings", drawerIcon: ({ color }) => <Ionicons name="settings-outline" size={22} color={color} /> }}
            />
            <Drawer.Screen
              name="DrawerTerminal"
              component={HomeScreen}
              options={{ drawerLabel: "Terminal", drawerIcon: ({ color }) => <Ionicons name="terminal-outline" size={22} color={color} /> }}
            />
          </Drawer.Navigator>
        </NavigationContainer>
      </ThemeContext.Provider>
    </GestureHandlerRootView>
  );
}
