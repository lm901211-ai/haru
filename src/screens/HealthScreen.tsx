import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { Button, Card, Chip, DateNav, DeleteX, Empty, Input, NumberField, ProgressBar, Screen, styles } from '../components/ui';
import { useStore } from '../store';
import { fromKey, newId, todayKey } from '../date';
import { colors } from '../theme';
import { MealType } from '../types';
import { bmiInfo } from '../score';

const MEAL_TYPES: MealType[] = ['아침', '점심', '저녁', '간식'];
const CUP_ML = 250;

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

export default function HealthScreen() {
  const { data, getLog, updateLog, setGoals, setProfile } = useStore();
  const [date, setDate] = useState(todayKey());
  const log = getLog(date);
  const goals = data.goals;
  const update = (fn: Parameters<typeof updateLog>[1]) => updateLog(date, fn);

  const [exName, setExName] = useState('');
  const [exMin, setExMin] = useState('');
  const [mealType, setMealType] = useState<MealType>('아침');
  const [mealText, setMealText] = useState('');
  const [mealKcal, setMealKcal] = useState('');
  const [showGoals, setShowGoals] = useState(false);

  const exerciseTotal = log.exercises.reduce((s, e) => s + e.minutes, 0);
  const kcalTotal = log.meals.reduce((s, m) => s + (m.kcal ?? 0), 0);

  const addExercise = () => {
    const minutes = parseInt(exMin, 10);
    if (!exName.trim() || !(minutes > 0)) return Alert.alert('운동 이름과 시간(분)을 입력해 주세요.');
    update((l) => ({ ...l, exercises: [...l.exercises, { id: newId(), name: exName.trim(), minutes }] }));
    setExName('');
    setExMin('');
  };

  const addMeal = () => {
    if (!mealText.trim()) return Alert.alert('무엇을 먹었는지 입력해 주세요.');
    const kcal = parseInt(mealKcal, 10);
    update((l) => ({
      ...l,
      meals: [...l.meals, { id: newId(), type: mealType, text: mealText.trim(), kcal: kcal > 0 ? kcal : undefined }],
    }));
    setMealText('');
    setMealKcal('');
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
    <Screen title="건강 기록">
      <DateNav date={date} onChange={setDate} />

      <Card title="💧 물 마시기" right={<Text style={styles.muted}>{log.water * CUP_ML}ml</Text>}>
        <ProgressBar value={log.water} max={goals.waterCups} color={colors.water} />
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Button label="－" small outline color={colors.water} onPress={() => update((l) => ({ ...l, water: Math.max(0, l.water - 1) }))} />
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
            {log.water} <Text style={styles.muted}>/ {goals.waterCups}잔</Text>
          </Text>
          <Button label="＋ 한 잔" small color={colors.water} onPress={() => update((l) => ({ ...l, water: l.water + 1 }))} />
        </View>
      </Card>

      <Card title="👟 걸음 수" right={<Text style={styles.muted}>목표 {goals.steps.toLocaleString()}보</Text>}>
        <ProgressBar value={log.steps} max={goals.steps} color={colors.steps} />
        <NumberField value={log.steps || undefined} placeholder="걸음 수 입력" unit="보" onCommit={(v) => update((l) => ({ ...l, steps: v ?? 0 }))} />
        {Platform.OS === 'ios' && <Button label="휴대폰 만보기에서 불러오기" small outline color={colors.steps} onPress={syncSteps} />}
      </Card>

      <Card title="🏃 운동" right={<Text style={styles.muted}>{exerciseTotal} / {goals.exerciseMin}분</Text>}>
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

      <Card title="🍚 식사" right={kcalTotal > 0 ? <Text style={styles.muted}>총 {kcalTotal}kcal</Text> : undefined}>
        {log.meals.length === 0 && <Empty text="아직 식사 기록이 없어요" />}
        {MEAL_TYPES.map((type) =>
          log.meals
            .filter((m) => m.type === type)
            .map((m) => (
              <View key={m.id} style={styles.listItem}>
                <Text style={{ width: 36, fontWeight: '700', color: colors.sub }}>{m.type}</Text>
                <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{m.text}</Text>
                {m.kcal ? <Text style={styles.muted}>{m.kcal}kcal</Text> : null}
                <DeleteX onPress={() => update((l) => ({ ...l, meals: l.meals.filter((x) => x.id !== m.id) }))} />
              </View>
            )),
        )}
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {MEAL_TYPES.map((t) => (
            <Chip key={t} label={t} active={mealType === t} onPress={() => setMealType(t)} />
          ))}
        </View>
        <View style={styles.row}>
          <Input value={mealText} onChangeText={setMealText} placeholder="메뉴" style={{ flex: 2 }} />
          <Input value={mealKcal} onChangeText={setMealKcal} placeholder="kcal(선택)" keyboardType="number-pad" style={{ flex: 1 }} />
          <Button label="추가" small onPress={addMeal} />
        </View>
      </Card>

      <Card title="😴 수면 · ⚖️ 체중">
        <Text style={styles.muted}>수면 시간 (목표 {goals.sleepHours}시간)</Text>
        <NumberField decimal value={log.sleepHours} placeholder="예: 7.5" unit="시간" onCommit={(v) => update((l) => ({ ...l, sleepHours: v }))} />
        <Text style={styles.muted}>체중</Text>
        <NumberField decimal value={log.weight} placeholder="예: 65.2" unit="kg" onCommit={(v) => update((l) => ({ ...l, weight: v }))} />
        {log.weight != null && data.profile.heightCm ? (
          <Text style={styles.muted}>
            BMI {bmiInfo(log.weight, data.profile.heightCm).bmi.toFixed(1)} · {bmiInfo(log.weight, data.profile.heightCm).label}
          </Text>
        ) : null}
      </Card>

      <Card title="👤 내 정보">
        <View style={styles.row}>
          <Text style={{ width: 90, color: colors.text }}>키</Text>
          <View style={{ flex: 1 }}>
            <NumberField decimal value={data.profile.heightCm} placeholder="예: 170" unit="cm" onCommit={(v) => setProfile({ ...data.profile, heightCm: v })} />
          </View>
        </View>
      </Card>

      <Card title="🎯 하루 목표" right={<Button label={showGoals ? '닫기' : '수정'} small outline onPress={() => setShowGoals((s) => !s)} />}>
        {showGoals ? (
          <>
            <GoalRow label="물 (잔)" value={goals.waterCups} onCommit={(v) => setGoals({ ...goals, waterCups: v })} />
            <GoalRow label="걸음 수" value={goals.steps} onCommit={(v) => setGoals({ ...goals, steps: v })} />
            <GoalRow label="운동 (분)" value={goals.exerciseMin} onCommit={(v) => setGoals({ ...goals, exerciseMin: v })} />
            <GoalRow label="수면 (시간)" value={goals.sleepHours} onCommit={(v) => setGoals({ ...goals, sleepHours: v })} decimal />
          </>
        ) : (
          <Text style={styles.muted}>
            물 {goals.waterCups}잔 · {goals.steps.toLocaleString()}보 · 운동 {goals.exerciseMin}분 · 수면 {goals.sleepHours}시간
          </Text>
        )}
      </Card>
    </Screen>
  );
}

function GoalRow({ label, value, onCommit, decimal }: { label: string; value: number; onCommit: (v: number) => void; decimal?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={{ width: 90, color: colors.text }}>{label}</Text>
      <View style={{ flex: 1 }}>
        <NumberField decimal={decimal} value={value} onCommit={(v) => v && onCommit(v)} />
      </View>
    </View>
  );
}

