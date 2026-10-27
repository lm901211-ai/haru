import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, Chip, Empty, Input, Screen, styles } from '../components/ui';
import { useStore } from '../store';
import { addDays, streak, todayKey, weekdayOf } from '../date';
import { colors } from '../theme';

const EMOJIS = ['✅', '📖', '🧘', '💊', '🏋️', '🥗', '🌅', '🚭', '✍️', '🧹'];
const SUGGESTIONS = ['아침 스트레칭', '영양제 먹기', '책 10쪽 읽기', '명상 5분', '일찍 자기'];

export default function HabitScreen() {
  const { data, addHabit, toggleHabit, deleteHabit } = useStore();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const today = todayKey();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  const submit = (habitName = name) => {
    if (!habitName.trim()) return;
    addHabit(habitName.trim(), emoji);
    setName('');
  };

  const confirmDelete = (id: string, habitName: string) =>
    Alert.alert('습관 삭제', `"${habitName}" 습관과 기록을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteHabit(id) },
    ]);

  return (
    <Screen title="습관">
      {data.habits.length === 0 && (
        <Card title="이런 습관은 어때요?">
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={`＋ ${s}`} active={false} onPress={() => submit(s)} />
            ))}
          </View>
        </Card>
      )}

      {data.habits.map((h) => {
        const s = streak(h.doneDates, today);
        const doneToday = h.doneDates.includes(today);
        return (
          <Card key={h.id}>
            <Pressable onLongPress={() => confirmDelete(h.id, h.name)} style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 }}>
                {h.emoji} {h.name}
              </Text>
              <Text style={{ color: s > 0 ? colors.exercise : colors.sub, fontWeight: '700' }}>🔥 {s}일 연속</Text>
            </Pressable>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              {week.map((d) => {
                const done = h.doneDates.includes(d);
                return (
                  <Pressable key={d} onPress={() => toggleHabit(h.id, d)} style={{ alignItems: 'center', gap: 4 }} hitSlop={4}>
                    <Text style={[styles.muted, d === today && { color: colors.primary, fontWeight: '700' }]}>{weekdayOf(d)}</Text>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: done ? colors.steps : colors.bg,
                        borderWidth: d === today ? 2 : 0,
                        borderColor: colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {done && <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </View>
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
          <Input value={name} onChangeText={setName} placeholder="예: 물 2L 마시기" onSubmitEditing={() => submit()} style={{ flex: 1 }} />
          <Button label="추가" onPress={() => submit()} />
        </View>
        {data.habits.length > 0 && <Empty text="습관 이름을 길게 누르면 삭제할 수 있어요" />}
      </Card>
    </Screen>
  );
}
