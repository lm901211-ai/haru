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
      <Pressable onPress={() => setEditing(true)} hitSlop={8}>
        <Text style={styles.muted}>
          목표 {value.toLocaleString()}{unit} <Text style={{ color: colors.primary }}>✎</Text>
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={{ width: 130 }}>
      <NumberField
        decimal={decimal}
        value={value}
        unit={unit}
        onCommit={(v) => {
          if (v) setGoals({ ...data.goals, [k]: v });
          setEditing(false);
        }}
      />
    </View>
  );
}
