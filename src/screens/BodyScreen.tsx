import { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, DateNav, NumberField, Screen, styles } from '../components/ui';
import { TrendCard } from '../components/charts';
import { GoalField } from '../components/GoalField';
import { useStore } from '../store';
import { todayKey } from '../date';
import { bmiInfo } from '../score';
import { activeWeightChallenge, plannedWeight } from '../challenges';
import { colors, ink } from '../theme';

export default function BodyScreen() {
  const { data, getLog, updateLog, setProfile } = useStore();
  const [date, setDate] = useState(todayKey());
  const log = getLog(date);
  const height = data.profile.heightCm;
  const update = (fn: Parameters<typeof updateLog>[1]) => updateLog(date, fn);
  const bmi = log.weight != null && height ? bmiInfo(log.weight, height) : null;
  const diet = activeWeightChallenge(data, todayKey());

  return (
    <Screen title="체중 · 신체">
      <DateNav date={date} onChange={setDate} />

      <Card title="⚖️ 체중">
        <NumberField key={`w${date}`} decimal value={log.weight} label="체중" placeholder="몸무게 (예: 65.2)" unit="kg" onCommit={(v) => update((l) => ({ ...l, weight: v }))} />
        {bmi && (
          <View style={[styles.row, { justifyContent: 'space-between', backgroundColor: colors.bg, borderRadius: 12, padding: 12 }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>BMI {bmi.bmi.toFixed(1)}</Text>
            <Text style={{ color: ink(bmi.color), fontWeight: '700' }}>{bmi.label}</Text>
          </View>
        )}
      </Card>

      <TrendCard
        title="체중 변화"
        unit="kg"
        color={colors.primary}
        kind="line"
        mode="level"
        decimals={1}
        getValue={(d) => data.logs[d]?.weight}
        target={diet && { label: '계획 페이스', at: (d) => plannedWeight(diet, d), lowerIsBetter: diet.targetWeight < diet.startWeight }}
      />

      <Card title="😴 수면" right={<GoalField k="sleepHours" unit="시간" decimal />}>
        <NumberField key={`s${date}`} decimal value={log.sleepHours} label="수면 시간" placeholder="수면 시간 (예: 7.5)" unit="시간" onCommit={(v) => update((l) => ({ ...l, sleepHours: v }))} />
      </Card>

      <TrendCard title="수면 시간 추이" unit="시간" color={colors.sleep} kind="bar" mode="amount" decimals={1} goal={data.goals.sleepHours} getValue={(d) => data.logs[d]?.sleepHours} />

      <Card title="👤 내 정보">
        <View style={styles.row}>
          <Text style={{ width: 60, color: colors.text }}>키</Text>
          <View style={{ flex: 1 }}>
            <NumberField decimal value={height} label="키" placeholder="예: 170" unit="cm" onCommit={(v) => setProfile({ ...data.profile, heightCm: v })} />
          </View>
        </View>
      </Card>
    </Screen>
  );
}
