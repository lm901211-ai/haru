import { Pressable, Text, View } from 'react-native';
import { Card, Empty, ProgressBar, Screen, styles } from '../components/ui';
import { useStore } from '../store';
import { formatKey, todayKey } from '../date';
import { colors } from '../theme';
import { TodoRow } from './TodoScreen';
import { ChallengeSummary, ScoreReport, WeatherCard, WeightCard } from '../components/home';
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
  const g = data.goals;
  const exerciseMin = log.exercises.reduce((s, e) => s + e.minutes, 0);
  const todos = data.todos.filter((t) => t.date === today).sort((a, b) => Number(a.done) - Number(b.done) || Number(b.important) - Number(a.important));
  const habitsDone = data.habits.filter((h) => h.doneDates.includes(today)).length;

  const stats = [
    { label: '💧 물', value: log.water, max: g.waterCups, unit: '잔', color: colors.water },
    { label: '👟 걸음', value: log.steps, max: g.steps, unit: '보', color: colors.steps },
    { label: '🏃 운동', value: exerciseMin, max: g.exerciseMin, unit: '분', color: colors.exercise },
    { label: '😴 수면', value: log.sleepHours ?? 0, max: g.sleepHours, unit: '시간', color: colors.sleep },
  ];

  return (
    <Screen title={greeting()}>
      <Text style={[styles.muted, { marginTop: -8, fontSize: 15 }]}>{formatKey(today)}</Text>

      <WeatherCard />
      <ScoreReport />
      <ChallengeSummary onOpen={() => goTo('goal')} />

      <Card title="오늘의 건강" right={<Pressable onPress={() => goTo('health')}><Text style={{ color: colors.primary, fontWeight: '600' }}>기록하기 ›</Text></Pressable>}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {stats.map((s) => (
            <View key={s.label} style={{ width: '47%', gap: 6 }}>
              <Text style={styles.muted}>{s.label}</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                {s.value.toLocaleString()}
                <Text style={styles.muted}> / {s.max.toLocaleString()}{s.unit}</Text>
              </Text>
              <ProgressBar value={s.value} max={s.max} color={s.color} />
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => updateLog(today, (l) => ({ ...l, water: l.water + 1 }))}
          style={({ pressed }) => [{ backgroundColor: '#E8F6FD', borderRadius: 10, padding: 10, alignItems: 'center' }, pressed && { opacity: 0.6 }]}
        >
          <Text style={{ color: colors.water, fontWeight: '700' }}>💧 물 한 잔 마셨어요</Text>
        </Pressable>
      </Card>

      <WeightCard />

      <Card title="오늘 할 일" right={<Pressable onPress={() => goTo('todo')}><Text style={{ color: colors.primary, fontWeight: '600' }}>전체 ›</Text></Pressable>}>
        {todos.length === 0 && <Empty text="오늘 할 일이 없어요" />}
        {todos.map((t) => (
          <TodoRow key={t.id} todo={t} onToggle={() => updateTodo(t.id, { done: !t.done })} />
        ))}
      </Card>

      <Card
        title="오늘의 습관"
        right={<Text style={styles.muted}>{habitsDone} / {data.habits.length}</Text>}
      >
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
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: done ? colors.steps : colors.bg,
                }}
              >
                <Text style={{ color: done ? '#fff' : colors.text, fontWeight: '600' }}>
                  {done ? '✓ ' : ''}{h.emoji} {h.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}
