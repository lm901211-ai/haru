import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { addDays, formatKey, todayKey, weekdayOf } from '../date';

export function Screen({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    // Android도 edge-to-edge라 창이 줄어들지 않으므로 양쪽 모두 padding 방식으로 키보드를 피함
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 32, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={[styles.screenTitle, { flex: 1 }]}>{title}</Text>
          {right}
        </View>
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

/** marker: 0~1 위치에 세로 표시선 (예: 지금쯤 와 있어야 할 지점) */
export function ProgressBar({ value, max, color, height = 8, marker }: { value: number; max: number; color: string; height?: number; marker?: number }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2 }]}>
      <View style={[styles.barFill, { width: `${ratio * 100}%`, backgroundColor: color, borderRadius: height / 2 }]} />
      {marker != null && marker > 0 && marker < 1 && (
        <View style={{ position: 'absolute', left: `${marker * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: colors.text, opacity: 0.45 }} />
      )}
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

const parseNumber = (text: string, decimal?: boolean) => {
  const n = decimal ? parseFloat(text.replace(',', '.')) : parseInt(text, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/**
 * 숫자 입력칸: 입력 중에는 로컬 상태로 두고, 입력이 끝나면 저장.
 * 값이 실제로 바뀐 경우에만 저장하고, 입력 도중 다른 탭으로 넘어가도(언마운트) 저장한다.
 */
export function NumberField({
  value,
  onCommit,
  onDone,
  placeholder,
  unit,
  decimal,
  autoFocus,
}: {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  onDone?: () => void;
  placeholder?: string;
  unit?: string;
  decimal?: boolean;
  autoFocus?: boolean;
}) {
  const show = (v: number | undefined) => (v != null ? String(v) : '');
  const [text, setText] = useState(show(value));
  // 바깥에서 값이 바뀌면(날짜 이동, 다른 화면에서 입력 등) 입력칸도 맞춤
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setText(show(value));
  }

  const latest = useRef({ text, value, onCommit, decimal });
  useEffect(() => {
    latest.current = { text, value, onCommit, decimal };
  });

  const commit = () => {
    const { text: t, value: v, onCommit: save, decimal: dec } = latest.current;
    const n = parseNumber(t, dec);
    if (n !== v) save(n);
  };

  // 저장하지 않은 입력이 남은 채로 화면을 벗어나면 저장
  useEffect(() => () => commit(), []);

  return (
    <View style={styles.row}>
      <Input
        value={text}
        onChangeText={setText}
        onBlur={() => {
          commit();
          onDone?.();
        }}
        onSubmitEditing={commit}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder}
        style={{ flex: 1 }}
        returnKeyType="done"
        autoFocus={autoFocus}
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

/** 최근 7일 체크 동그라미. 눌러서 지난 날짜도 체크/해제할 수 있음 (minDate 이전은 비활성) */
export function WeekDots({ doneDates, onToggle, minDate, color = colors.steps }: { doneDates: string[]; onToggle: (date: string) => void; minDate?: string; color?: string }) {
  const today = todayKey();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      {week.map((d) => {
        const done = doneDates.includes(d);
        const disabled = minDate != null && d < minDate;
        return (
          <Pressable key={d} onPress={() => onToggle(d)} disabled={disabled} style={{ alignItems: 'center', gap: 4, opacity: disabled ? 0.3 : 1 }} hitSlop={4}>
            <Text style={[styles.muted, d === today && { color: colors.primary, fontWeight: '700' }]}>{d === today ? '오늘' : weekdayOf(d)}</Text>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: done ? color : colors.bg,
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
