import { ReactNode, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { addDays, formatKey, todayKey } from '../date';

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 32, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>{title}</Text>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({ title, right, children, style }: { title?: string; right?: ReactNode; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <View style={styles.cardHeader}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Button({
  label,
  onPress,
  color = colors.primary,
  outline,
  small,
  disabled,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  outline?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        outline ? { borderColor: color, borderWidth: 1.5 } : { backgroundColor: color },
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: outline ? color : '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color = colors.primary }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.sub} {...props} style={[styles.input, props.style]} />;
}

/** 숫자 입력칸: 입력 중에는 로컬 상태로 두고, 입력이 끝나면 저장 */
export function NumberField({
  value,
  onCommit,
  placeholder,
  unit,
  decimal,
}: {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  placeholder?: string;
  unit?: string;
  decimal?: boolean;
}) {
  const [text, setText] = useState(value != null ? String(value) : '');
  useEffect(() => setText(value != null ? String(value) : ''), [value]);

  const commit = () => {
    const n = decimal ? parseFloat(text) : parseInt(text, 10);
    onCommit(Number.isFinite(n) && n >= 0 ? n : undefined);
  };

  return (
    <View style={styles.row}>
      <Input
        value={text}
        onChangeText={setText}
        onEndEditing={commit}
        onSubmitEditing={commit}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder}
        style={{ flex: 1 }}
        returnKeyType="done"
      />
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </View>
  );
}

export function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = todayKey();
  return (
    <View style={styles.dateNav}>
      <Pressable onPress={() => onChange(addDays(date, -1))} hitSlop={12}>
        <Text style={styles.dateArrow}>‹</Text>
      </Pressable>
      <Pressable onPress={() => onChange(today)}>
        <Text style={styles.dateText}>{formatKey(date)}</Text>
        {date !== today && <Text style={styles.dateHint}>오늘로 돌아가기</Text>}
      </Pressable>
      <Pressable onPress={() => onChange(addDays(date, 1))} hitSlop={12}>
        <Text style={styles.dateArrow}>›</Text>
      </Pressable>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function DeleteX({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Text style={{ color: colors.sub, fontSize: 16 }}>✕</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screenTitle: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 4 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  button: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#FAFBFD',
    minWidth: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unit: { fontSize: 15, color: colors.sub, minWidth: 28 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 10 },
  dateArrow: { fontSize: 30, color: colors.primary, fontWeight: '300' },
  dateText: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  dateHint: { fontSize: 12, color: colors.primary, textAlign: 'center', marginTop: 2 },
  empty: { color: colors.sub, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  muted: { color: colors.sub, fontSize: 13 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
});
