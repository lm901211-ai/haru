import { ReactNode, useEffect, useRef, useState } from 'react';
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
import { colors, ink, plain, radius, shadow, solid, splitIcon, tint } from '../theme';
import { addDays, formatKey, todayKey, weekdayOf } from '../date';
import type { GradeInfo } from '../grade';

/** 성적표 느낌을 낼 때만 쓰는 세리프 글꼴 */
export const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

/** 제목 단계 (웹에서는 h1·h2 로 그려짐, 앱에서는 무시) */
export const headingLevel = (n: number) => ({ 'aria-level': n }) as object;

/** 팝업(Modal)의 이름 (웹에서 dialog 이름으로 읽힘, 앱에서는 무시) */
export const dialogName = (name: string) => ({ 'aria-label': name }) as object;

export function Screen({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    // Android도 edge-to-edge라 창이 줄어들지 않으므로 양쪽 모두 padding 방식으로 키보드를 피함
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        role="main"
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 14, paddingBottom: 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.row, { justifyContent: 'space-between', minHeight: 44 }]}>
          <Text role="heading" {...headingLevel(1)} style={[styles.screenTitle, { flex: 1 }]}>
            {title}
          </Text>
          {right}
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** 제목 앞의 이모지는 동그란 배지로 따로 그리고, 화면 읽기에서는 글자만 읽힘 */
export function Card({ title, right, children, style }: { title?: string; right?: ReactNode; children: ReactNode; style?: ViewStyle }) {
  const head = title ? splitIcon(title) : null;
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <View style={styles.cardHeader}>
          {head ? (
            <View style={[styles.row, { flex: 1, gap: 10 }]}>
              {head.icon && (
                <View style={styles.iconBadge} aria-hidden>
                  <Text style={{ fontSize: 16 }} maxFontSizeMultiplier={1.2}>
                    {head.icon}
                  </Text>
                </View>
              )}
              <Text role="heading" {...headingLevel(2)} style={[styles.cardTitle, { flexShrink: 1 }]}>
                {head.text}
              </Text>
            </View>
          ) : (
            <View />
          )}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

/** marker: 0~1 위치에 세로 표시선 (예: 지금쯤 와 있어야 할 지점) */
export function ProgressBar({ value, max, color, height = 8, marker, label }: { value: number; max: number; color: string; height?: number; marker?: number; label?: string }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      style={[styles.barTrack, { height, borderRadius: height / 2 }]}
    >
      <View style={[styles.barFill, { width: `${ratio * 100}%`, backgroundColor: color, borderRadius: height / 2 }]} />
      {marker != null && marker > 0 && marker < 1 && (
        <View style={{ position: 'absolute', left: `${marker * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: colors.text, opacity: 0.45 }} />
      )}
    </View>
  );
}

/** outline 은 옅은 색 바탕의 보조 버튼 */
export function Button({
  label,
  onPress,
  color = colors.primary,
  outline,
  small,
  disabled,
  a11yLabel,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  outline?: boolean;
  small?: boolean;
  disabled?: boolean;
  a11yLabel?: string;
}) {
  return (
    <Pressable
      role="button"
      aria-label={a11yLabel ?? plain(label)}
      aria-disabled={disabled}
      onPress={onPress}
      disabled={disabled}
      hitSlop={small ? 4 : 0}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: outline ? tint(color, 0.1) : solid(color) },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: outline ? ink(color) : '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 여러 개 중 하나를 고르는 동그란 칩 (a11yRole="button" 이면 바로 실행되는 버튼) */
export function Chip({
  label,
  active,
  onPress,
  color = colors.primary,
  a11yRole = 'radio',
  a11yLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
  a11yRole?: 'radio' | 'button';
  a11yLabel?: string;
}) {
  return (
    <Pressable
      role={a11yRole}
      aria-checked={a11yRole === 'radio' ? active : undefined}
      aria-label={a11yLabel ?? plain(label)}
      onPress={onPress}
      hitSlop={5}
      style={({ pressed }) => [styles.chip, active && { backgroundColor: solid(color), borderColor: solid(color) }, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

/** 주간/월간처럼 붙어 있는 선택 버튼 묶음 */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <View role="radiogroup" aria-label={label} style={styles.segment}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            role="radio"
            aria-checked={on}
            aria-label={plain(o.label)}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.segmentItem, on && styles.segmentItemOn]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 입력칸: 누르면 테두리가 파랗게. 따로 이름이 없으면 안내 문구를 화면 읽기 이름으로 씀 */
export function Input(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.sub}
      aria-label={props['aria-label'] ?? props.placeholder}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[styles.input, focused && styles.inputFocused, props.style]}
    />
  );
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
  label,
}: {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  onDone?: () => void;
  placeholder?: string;
  unit?: string;
  decimal?: boolean;
  autoFocus?: boolean;
  label?: string;
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

  const a11y = [label ?? placeholder, unit ? `단위 ${unit}` : ''].filter(Boolean).join(', ');
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
        aria-label={a11y || undefined}
        style={{ flex: 1 }}
        returnKeyType="done"
        autoFocus={autoFocus}
      />
      {unit ? (
        <Text style={styles.unit} aria-hidden>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

export function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = todayKey();
  return (
    <View style={styles.dateNav}>
      <Pressable role="button" aria-label="이전 날" onPress={() => onChange(addDays(date, -1))} hitSlop={6} style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}>
        <Text style={styles.dateArrow}>‹</Text>
      </Pressable>
      <Pressable
        role="button"
        aria-label={date === today ? `${formatKey(date)}, 오늘` : `${formatKey(date)}. 누르면 오늘로 돌아가요`}
        onPress={() => onChange(today)}
        style={{ flex: 1, alignItems: 'center' }}
      >
        <Text style={styles.dateText}>{formatKey(date)}</Text>
        {date !== today ? <Text style={styles.dateHint}>오늘로 돌아가기</Text> : <Text style={[styles.dateHint, { color: colors.sub }]}>오늘</Text>}
      </Pressable>
      <Pressable role="button" aria-label="다음 날" onPress={() => onChange(addDays(date, 1))} hitSlop={6} style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}>
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
          <Pressable
            key={d}
            role="checkbox"
            aria-checked={done}
            aria-disabled={disabled}
            aria-label={`${formatKey(d)}${d === today ? ' 오늘' : ''}`}
            onPress={() => onToggle(d)}
            disabled={disabled}
            style={{ alignItems: 'center', gap: 4, opacity: disabled ? 0.3 : 1 }}
            hitSlop={6}
          >
            <Text style={[styles.muted, d === today && { color: colors.primary, fontWeight: '700' }]} maxFontSizeMultiplier={1.3}>
              {d === today ? '오늘' : weekdayOf(d)}
            </Text>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: done ? solid(color) : colors.soft,
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

/** S~F 등급 배지 */
export function GradeBadge({ grade, size = 26 }: { grade?: GradeInfo; size?: number }) {
  if (!grade)
    return (
      <Text style={{ width: size, textAlign: 'center', color: colors.sub }} aria-label="등급 없음">
        -
      </Text>
    );
  return (
    <View role="img" aria-label={`${grade.grade} 등급, ${grade.label}`} style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: solid(grade.color), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.55, fontFamily: SERIF }} maxFontSizeMultiplier={1}>
        {grade.grade}
      </Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function DeleteX({ onPress, label = '삭제' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable role="button" aria-label={label} onPress={onPress} hitSlop={9} style={({ pressed }) => [styles.deleteX, pressed && { backgroundColor: colors.soft }]}>
      <Text style={{ color: colors.sub, fontSize: 15 }}>✕</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screenTitle: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 18, gap: 12, ...shadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 30 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  iconBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#ECEFF4', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { minHeight: 36, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextSmall: { fontSize: 14 },
  chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  segment: { flexDirection: 'row', backgroundColor: '#ECEFF5', borderRadius: 12, padding: 3, gap: 3 },
  segmentItem: { flex: 1, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentItemOn: { backgroundColor: '#fff', boxShadow: '0px 1px 3px rgba(22, 34, 64, 0.12)' },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.sub },
  segmentTextOn: { color: colors.text, fontWeight: '800' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CDD3DD',
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.field,
    minWidth: 0,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unit: { fontSize: 15, color: colors.sub, minWidth: 28 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: 8, paddingVertical: 8, ...shadow },
  navButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  dateArrow: { fontSize: 26, lineHeight: 30, color: colors.primary, fontWeight: '500' },
  dateText: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  dateHint: { fontSize: 12, color: colors.primary, textAlign: 'center', marginTop: 2, fontWeight: '600' },
  empty: { color: colors.sub, fontSize: 14, textAlign: 'center', paddingVertical: 10 },
  muted: { color: colors.sub, fontSize: 13 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEF0F4' },
  deleteX: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
