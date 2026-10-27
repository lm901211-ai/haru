import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, Chip, DateNav, DeleteX, Empty, Input, ProgressBar, Screen, styles } from '../components/ui';
import { TrendCard } from '../components/charts';
import { GoalField } from '../components/GoalField';
import { useStore } from '../store';
import { newId, todayKey } from '../date';
import { colors } from '../theme';
import { MealType } from '../types';

const MEAL_TYPES: MealType[] = ['아침', '점심', '저녁', '간식'];
const CUP_ML = 250;

export default function DietScreen() {
  const { data, getLog, updateLog } = useStore();
  const [date, setDate] = useState(todayKey());
  const log = getLog(date);
  const goals = data.goals;
  const update = (fn: Parameters<typeof updateLog>[1]) => updateLog(date, fn);
  const [mealType, setMealType] = useState<MealType>('아침');
  const [mealText, setMealText] = useState('');
  const [mealKcal, setMealKcal] = useState('');

  const kcalTotal = log.meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
  const kcalOf = (d: string) => {
    const k = data.logs[d]?.meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
    return k ? k : undefined;
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

  return (
    <Screen title="식단">
      <DateNav date={date} onChange={setDate} />

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

      <Card title="💧 물 마시기" right={<GoalField k="waterCups" unit="잔" />}>
        <ProgressBar value={log.water} max={goals.waterCups} color={colors.water} />
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Button label="－" small outline color={colors.water} onPress={() => update((l) => ({ ...l, water: Math.max(0, l.water - 1) }))} />
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
            {log.water} <Text style={styles.muted}>잔 · {log.water * CUP_ML}ml</Text>
          </Text>
          <Button label="＋ 한 잔" small color={colors.water} onPress={() => update((l) => ({ ...l, water: l.water + 1 }))} />
        </View>
      </Card>

      <TrendCard title="섭취 칼로리 추이" unit="kcal" color={colors.star} kind="bar" mode="amount" getValue={kcalOf} />
      <TrendCard title="물 섭취 추이" unit="잔" color={colors.water} kind="bar" mode="amount" goal={goals.waterCups} decimals={1} getValue={(d) => data.logs[d]?.water} />
    </Screen>
  );
}
