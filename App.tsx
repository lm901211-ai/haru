import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/store';
import { Tab, TABS } from './src/tabs';
import { colors } from './src/theme';
import TodayScreen from './src/screens/TodayScreen';
import ExerciseScreen from './src/screens/ExerciseScreen';
import DietScreen from './src/screens/DietScreen';
import BodyScreen from './src/screens/BodyScreen';
import GoalScreen from './src/screens/GoalScreen';
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
        {tab === 'exercise' && <ExerciseScreen />}
        {tab === 'diet' && <DietScreen />}
        {tab === 'body' && <BodyScreen />}
        {tab === 'goal' && <GoalScreen />}
        {tab === 'todo' && <TodoScreen />}
        {tab === 'habit' && <HabitScreen />}
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => {
          const active = t.key === tab;
          if (t.key === 'today') {
            // 홈은 가운데에 떠 있는 원형 버튼으로 강조
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
                <View style={[styles.homeButton, active && styles.homeButtonActive]}>
                  <Text style={{ fontSize: 26 }}>{t.icon}</Text>
                </View>
                <Text style={[styles.tabLabel, { fontWeight: '800', fontSize: 13 }, active && { color: colors.primary }]}>{t.label}</Text>
              </Pressable>
            );
          }
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
  tabBar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6 },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.sub },
  homeButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginTop: -26,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  homeButtonActive: { borderColor: colors.primary, backgroundColor: '#EEF3FF' },
});
