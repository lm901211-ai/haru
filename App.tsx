import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
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
import ReportScreen from './src/screens/ReportScreen';

function Main() {
  const { loaded } = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const insets = useSafeAreaInsets();

  // Android 뒤로가기: 다른 탭에서는 홈으로, 홈에서는 기본 동작(앱 종료)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab === 'today') return false;
      setTab('today');
      return true;
    });
    return () => sub.remove();
  }, [tab]);

  const homeIndex = TABS.findIndex((t) => t.key === 'today');
  const home = TABS[homeIndex];
  const left = TABS.slice(0, homeIndex);
  const right = TABS.slice(homeIndex + 1);
  const renderTab = (t: (typeof TABS)[number]) => {
    const active = t.key === tab;
    return (
      <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
        <Text style={[styles.tabIcon, !active && { opacity: 0.4 }]}>{t.icon}</Text>
        <Text style={[styles.tabLabel, active && { color: colors.primary }]} numberOfLines={1}>
          {t.label}
        </Text>
      </Pressable>
    );
  };

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
        {tab === 'report' && <ReportScreen />}
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {/* 홈 양쪽 탭 개수가 달라도(3 | 4) 홈 버튼이 정가운데에 오도록 좌우를 같은 폭으로 나눔 */}
        <View style={styles.tabGroup}>{left.map(renderTab)}</View>
        <Pressable onPress={() => setTab(home.key)} style={styles.homeSlot}>
          <View style={[styles.homeButton, tab === home.key && styles.homeButtonActive]}>
            <Text style={{ fontSize: 26 }}>{home.icon}</Text>
          </View>
          <Text style={[styles.tabLabel, { fontWeight: '800', fontSize: 13 }, tab === home.key && { color: colors.primary }]}>{home.label}</Text>
        </Pressable>
        <View style={styles.tabGroup}>{right.map(renderTab)}</View>
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
  tabGroup: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  homeSlot: { width: 64, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.sub },
  homeButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginTop: -24,
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
