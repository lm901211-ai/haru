import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/store';
import { Tab, TABS } from './src/tabs';
import { colors } from './src/theme';
import TodayScreen from './src/screens/TodayScreen';
import HealthScreen from './src/screens/HealthScreen';
import TodoScreen from './src/screens/TodoScreen';
import HabitScreen from './src/screens/HabitScreen';

function Main() {
  const { loaded } = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const insets = useSafeAreaInsets();

  if (!loaded) {
    return (
      <View style={[styles.fill, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.fill}>
        {tab === 'today' && <TodayScreen goTo={setTab} />}
        {tab === 'health' && <HealthScreen />}
        {tab === 'todo' && <TodoScreen />}
        {tab === 'habit' && <HabitScreen />}
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
              <Text style={[styles.tabIcon, !active && { opacity: 0.4 }]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active && { color: colors.primary }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Main />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  tabBar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 12, fontWeight: '600', color: colors.sub },
});
