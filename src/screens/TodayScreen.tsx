import { Pressable, Text, View } from 'react-native';
import { Card, Empty, Screen, styles } from '../components/ui';
import { useStore } from '../store';
import { formatKey, todayKey } from '../date';
import { colors } from '../theme';
import { TodoRow } from './TodoScreen';
import { ChallengeSummary, DailyReport, ScoreControlCard, WeatherCard, WeightCard } from '../components/home';
import { Tab } from '../tabs';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '늦은 밤이에요 🌙';
  if (h < 12) return '좋은 아침이에요 ☀️';
  if (h < 18) return '좋은 오후예요 🌤️';
  return '오늘 하루 수고했어요 🌆';
}

export default function TodayScreen({ goTo }: { goTo: (tab: Tab) => void }) {
  const { data, getLog, updateLog, updateTodo, toggleHabit } = useStore();
  const today = todayKey();
  const log = getLog(today);
  const todos = data.todos.filter((t) => t.date === today).sort((a, b) => Number(a.done) - Number(b.done) || Number(b.important) - Number(a.important));
  const habitsDone = data.habits.filter((h) => h.doneDates.includes(today)).length;

  const link = (label: string, tab: Tab) => (
    <Pressable onPress={() => goTo(tab)}>
      <Text style={{ color: colors.primary, fontWeight: '600' }}>{label} ›</Text>
    </Pressable>
  );

  return (
    <Screen title={greeting()}>
      <Text style={[styles.muted, { marginTop: -8, fontSize: 15 }]}>{formatKey(today)}</Text>

      <WeatherCard />
      <DailyReport />
      <ScoreControlCard />
      <ChallengeSummary onOpen={() => goTo('goal')} />

      <Card title="✏️ 빠른 기록">
        <View style={styles.row}>
          <Pressable
            onPress={() => updateLog(today, (l) => ({ ...l, water: l.water + 1 }))}
            style={({ pressed }) => [{ flex: 1, backgroundColor: '#E8F6FD', borderRadius: 10, padding: 10, alignItems: 'center' }, pressed && { opacity: 0.6 }]}
          >
            <Text style={{ color: colors.water, fontWeight: '700' }}>💧 물 한 잔 ({log.water}/{data.goals.waterCups})</Text>
          </Pressable>
        </View>
        <View style={[styles.row, { justifyContent: 'space-around' }]}>
          {link('운동 기록', 'exercise')}
          {link('식사 기록', 'diet')}
          {link('수면 기록', 'body')}
        </View>
      </Card>
      <WeightCard />

      <Card title="오늘 할 일" right={link('전체', 'todo')}>
        {todos.length === 0 && <Empty text="오늘 할 일이 없어요" />}
        {todos.map((t) => (
          <TodoRow key={t.id} todo={t} onToggle={() => updateTodo(t.id, { done: !t.done })} />
        ))}
      </Card>

      <Card title="오늘의 습관" right={<Text style={styles.muted}>{habitsDone} / {data.habits.length}</Text>}>
        {data.habits.length === 0 && (
          <Pressable onPress={() => goTo('habit')}>
            <Empty text="습관을 추가해 보세요 ›" />
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {data.habits.map((h) => {
            const done = h.doneDates.includes(today);
            return (
              <Pressable
                key={h.id}
                onPress={() => toggleHabit(h.id, today)}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: done ? colors.steps : colors.bg }}
              >
                <Text style={{ color: done ? '#fff' : colors.text, fontWeight: '600' }}>
                  {done ? '✓ ' : ''}
                  {h.emoji} {h.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}
