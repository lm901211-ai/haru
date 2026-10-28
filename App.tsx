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
import CalendarScreen from './src/screens/CalendarScreen';
import { useHealthAutoSync } from './src/health/useHealthAutoSync';

function Main() {
  const { loaded } = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const insets = useSafeAreaInsets();
  useHealthAutoSync();

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
      <Pressable key={t.key} role="tab" aria-selected={active} aria-label={t.label} onPress={() => setTab(t.key)} style={styles.tabItem}>
        <View style={[styles.tabPill, active && styles.tabPillActive]} aria-hidden>
          <Text style={[styles.tabIcon, !active && { opacity: 0.55 }]} maxFontSizeMultiplier={1.1}>
            {t.icon}
          </Text>
        </View>
        <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
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
        {tab === 'calendar' && <CalendarScreen />}
        {tab === 'exercise' && <ExerciseScreen />}
        {tab === 'diet' && <DietScreen />}
        {tab === 'body' && <BodyScreen />}
        {tab === 'goal' && <GoalScreen />}
        {tab === 'todo' && <TodoScreen />}
        {tab === 'habit' && <HabitScreen />}
        {tab === 'report' && <ReportScreen />}
      </View>
      <View role="navigation" aria-label="메뉴">
        <View role="tablist" style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {/* 홈 버튼이 정가운데에 오도록 좌우 탭 묶음을 같은 폭으로 나눔 */}
          <View style={styles.tabGroup}>{left.map(renderTab)}</View>
          <Pressable role="tab" aria-selected={tab === home.key} aria-label={home.label} onPress={() => setTab(home.key)} style={styles.homeSlot}>
            <View style={[styles.homeButton, tab === home.key && styles.homeButtonActive]} aria-hidden>
              <Text style={{ fontSize: 26 }} maxFontSizeMultiplier={1.1}>
                {home.icon}
              </Text>
            </View>
            <Text style={[styles.tabLabel, { fontWeight: '800', fontSize: 12 }, tab === home.key && styles.tabLabelActive]} maxFontSizeMultiplier={1.2}>
              {home.label}
            </Text>
          </Pressable>
          <View style={styles.tabGroup}>{right.map(renderTab)}</View>
        </View>
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
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 6,
    boxShadow: '0px -2px 12px rgba(22, 34, 64, 0.06)',
  },
  tabGroup: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  tabItem: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48 },
  tabPill: { width: 40, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabPillActive: { backgroundColor: colors.primarySoft },
  homeSlot: { width: 66, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 19 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.sub },
  tabLabelActive: { color: colors.primary, fontWeight: '800' },
  homeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -26,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 14px rgba(22, 34, 64, 0.16)',
  },
  homeButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
