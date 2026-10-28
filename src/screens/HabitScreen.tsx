import { useState } from 'react';
import { Text, View } from 'react-native';
import { confirmAction } from '../dialog';
import { Button, Card, Chip, DeleteX, Input, Screen, styles, WeekDots } from '../components/ui';
import { useStore } from '../store';
import { streak, todayKey } from '../date';
import { colors, ink } from '../theme';

const EMOJIS = ['✅', '📖', '🧘', '💊', '🏋️', '🥗', '🌅', '🚭', '✍️', '🧹'];
const SUGGESTIONS = ['아침 스트레칭', '영양제 먹기', '책 10쪽 읽기', '명상 5분', '일찍 자기'];

export default function HabitScreen() {
  const { data, addHabit, toggleHabit, deleteHabit } = useStore();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const today = todayKey();

  const submit = (habitName = name) => {
    if (!habitName.trim()) return;
    addHabit(habitName.trim(), emoji);
    setName('');
  };

  const confirmDelete = (id: string, habitName: string) =>
    confirmAction('습관 삭제', `"${habitName}" 습관과 기록을 삭제할까요?`, '삭제', () => deleteHabit(id));

  return (
    <Screen title="습관">
      {data.habits.length === 0 && (
        <Card title="이런 습관은 어때요?">
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={`＋ ${s}`} active={false} onPress={() => submit(s)} a11yRole="button" a11yLabel={`${s} 습관 추가`} />
            ))}
          </View>
        </Card>
      )}

      {data.habits.map((h) => {
        const s = streak(h.doneDates, today);
        const doneToday = h.doneDates.includes(today);
        return (
          <Card key={h.id}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text role="heading" style={{ flex: 1, fontSize: 17, fontWeight: '700', color: colors.text }}>
                {h.emoji} {h.name}
              </Text>
              <Text style={{ color: s > 0 ? ink(colors.exercise) : colors.sub, fontWeight: '700' }}>🔥 {s}일 연속</Text>
              <DeleteX label={`${h.name} 습관 삭제`} onPress={() => confirmDelete(h.id, h.name)} />
            </View>
            <WeekDots doneDates={h.doneDates} onToggle={(d) => toggleHabit(h.id, d)} />
            <Button
              label={doneToday ? '오늘 완료! (취소하려면 탭)' : '오늘 완료하기'}
              color={colors.steps}
              outline={doneToday}
              onPress={() => toggleHabit(h.id, today)}
            />
          </Card>
        );
      })}

      <Card title="새 습관 추가">
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {EMOJIS.map((e) => (
            <Chip key={e} label={e} active={emoji === e} onPress={() => setEmoji(e)} />
          ))}
        </View>
        <View style={styles.row}>
          <Input value={name} onChangeText={setName} placeholder="예: 아침 스트레칭" onSubmitEditing={() => submit()} style={{ flex: 1 }} />
          <Button label="추가" onPress={() => submit()} />
        </View>
      </Card>
    </Screen>
  );
}
