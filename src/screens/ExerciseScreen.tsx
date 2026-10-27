import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { Button, Card, DateNav, DeleteX, Empty, Input, NumberField, ProgressBar, Screen, styles } from '../components/ui';
import { TrendCard } from '../components/charts';
import { GoalField } from '../components/GoalField';
import { useStore } from '../store';
import { fromKey, newId, todayKey } from '../date';
import { colors } from '../theme';

async function readDeviceSteps(date: string): Promise<number> {
  if (Platform.OS !== 'ios') {
    throw new Error('Android에서는 기기 걸음 수 기록 조회를 지원하지 않아요. 직접 입력해 주세요.');
  }
  if (!(await Pedometer.isAvailableAsync())) throw new Error('이 기기에서는 만보기를 사용할 수 없어요.');
  const perm = await Pedometer.requestPermissionsAsync();
  if (!perm.granted) throw new Error('동작 및 피트니스 권한을 허용해 주세요.');
  const start = fromKey(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const now = new Date();
  const { steps } = await Pedometer.getStepCountAsync(start, end > now ? now : end);
  return steps;
}

export default function ExerciseScreen() {
  const { data, getLog, updateLog } = useStore();
  const [date, setDate] = useState(todayKey());
  const log = getLog(date);
  const goals = data.goals;
  const update = (fn: Parameters<typeof updateLog>[1]) => updateLog(date, fn);
  const [exName, setExName] = useState('');
  const [exMin, setExMin] = useState('');

  const exerciseTotal = log.exercises.reduce((s, e) => s + e.minutes, 0);
  const minutesOf = (d: string) => data.logs[d]?.exercises.reduce((s, e) => s + e.minutes, 0);

  const addExercise = () => {
    const minutes = parseInt(exMin, 10);
    if (!exName.trim() || !(minutes > 0)) return Alert.alert('운동 이름과 시간(분)을 입력해 주세요.');
    update((l) => ({ ...l, exercises: [...l.exercises, { id: newId(), name: exName.trim(), minutes }] }));
    setExName('');
    setExMin('');
  };

  const syncSteps = async () => {
    try {
      const steps = await readDeviceSteps(date);
      update((l) => ({ ...l, steps }));
    } catch (e) {
      Alert.alert('걸음 수 불러오기', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen title="운동">
      <DateNav date={date} onChange={setDate} />

      <Card title="🏃 운동 기록" right={<GoalField k="exerciseMin" unit="분" />}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
            {exerciseTotal}
            <Text style={styles.muted}> / {goals.exerciseMin}분</Text>
          </Text>
        </View>
        <ProgressBar value={exerciseTotal} max={goals.exerciseMin} color={colors.exercise} />
        {log.exercises.length === 0 && <Empty text="아직 운동 기록이 없어요" />}
        {log.exercises.map((e) => (
          <View key={e.id} style={styles.listItem}>
            <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{e.name}</Text>
            <Text style={styles.muted}>{e.minutes}분</Text>
            <DeleteX onPress={() => update((l) => ({ ...l, exercises: l.exercises.filter((x) => x.id !== e.id) }))} />
          </View>
        ))}
        <View style={styles.row}>
          <Input value={exName} onChangeText={setExName} placeholder="예: 러닝, 헬스" style={{ flex: 2 }} />
          <Input value={exMin} onChangeText={setExMin} placeholder="분" keyboardType="number-pad" style={{ flex: 1 }} />
          <Button label="추가" small color={colors.exercise} onPress={addExercise} />
        </View>
      </Card>

      <Card title="👟 걸음 수" right={<GoalField k="steps" unit="보" />}>
        <ProgressBar value={log.steps} max={goals.steps} color={colors.steps} />
        <NumberField value={log.steps || undefined} placeholder="걸음 수 입력" unit="보" onCommit={(v) => update((l) => ({ ...l, steps: v ?? 0 }))} />
        {Platform.OS === 'ios' && <Button label="휴대폰 만보기에서 불러오기" small outline color={colors.steps} onPress={syncSteps} />}
      </Card>

      <TrendCard title="운동 시간 추이" unit="분" color={colors.exercise} kind="bar" mode="amount" goal={goals.exerciseMin} getValue={minutesOf} />
      <TrendCard title="걸음 수 추이" unit="보" color={colors.steps} kind="bar" mode="amount" goal={goals.steps} getValue={(d) => data.logs[d]?.steps} />
    </Screen>
  );
}
