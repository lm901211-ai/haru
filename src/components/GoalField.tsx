import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { NumberField, styles } from './ui';
import { useStore } from '../store';
import { colors } from '../theme';
import { Goals } from '../types';

/** 카드 오른쪽 위에 "목표 N단위 ✎" 로 보이고, 누르면 바로 수정 */
export function GoalField({ k, unit, decimal }: { k: keyof Goals; unit: string; decimal?: boolean }) {
  const { data, setGoals } = useStore();
  const [editing, setEditing] = useState(false);
  const value = data.goals[k];
  if (!editing) {
    return (
      <Pressable role="button" aria-label={`목표 ${value.toLocaleString()}${unit}, 눌러서 바꾸기`} onPress={() => setEditing(true)} hitSlop={10}>
        <Text style={styles.muted}>
          목표 {value.toLocaleString()}{unit} <Text style={{ color: colors.primary }}>✎</Text>
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={{ width: 130 }}>
      <NumberField
        autoFocus
        decimal={decimal}
        value={value}
        unit={unit}
        onCommit={(v) => v && setGoals({ ...data.goals, [k]: v })}
        onDone={() => setEditing(false)}
      />
    </View>
  );
}
