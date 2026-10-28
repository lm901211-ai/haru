import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { Card, Segmented, styles } from './ui';
import { addDays, dayDiff, fromKey, monthDates, shortDate, startOfWeek, todayKey, weekDates, weekdayOf } from '../date';
import { colors, ink, plain } from '../theme';

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const fmt = (n: number, d = 1) => round(n, d).toLocaleString();

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

/** 원형 달성 게이지 */
/** label 을 주면 화면 읽기 프로그램이 링 대신 그 문장을 읽음 (예: "하루 점수 84점") */
export function Ring({ ratio, size = 64, stroke = 7, color, children, label }: { ratio: number; size?: number; stroke?: number; color: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(ratio, 1));
  return (
    <View role={label ? 'img' : undefined} aria-label={label} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }} aria-hidden>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#ECEFF4" strokeWidth={stroke} fill="none" />
        {clamped > 0 && <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />}
      </Svg>
      {children}
    </View>
  );
}

export type ChartPoint = { label: string; value?: number };

const PAD = { l: 36, r: 8, t: 12, b: 20 };

function yTicks(min: number, max: number): number[] {
  return [min, (min + max) / 2, max];
}

/** 1, 2, 2.5, 5 × 10^k 중 x 이상인 가장 작은 값 */
function niceNumber(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** 날짜별 막대/꺾은선 그래프. label이 빈 문자열인 점은 x축 라벨을 생략 */
export function TrendChart({
  points,
  kind,
  color,
  goal,
  target,
  height = 160,
}: {
  points: ChartPoint[];
  kind: 'bar' | 'line';
  color: string;
  goal?: number;
  target?: (number | undefined)[]; // 점선으로 그리는 계획 값 (points와 같은 길이)
  height?: number;
}) {
  const [width, onLayout] = useWidth();
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  const targets = (target ?? []).filter((v): v is number => v != null);
  let yMin = 0;
  let yMax = 2 * niceNumber((Math.max(...values, goal ?? 0, 1) * 1.05) / 2);
  if (kind === 'line' && values.length) {
    const lo = Math.min(...values, ...targets, goal ?? Infinity);
    const hi = Math.max(...values, ...targets, goal ?? -Infinity);
    const step = niceNumber(Math.max((hi - lo) / 2, 0.5));
    yMin = Math.floor(lo / step - 0.3) * step;
    yMax = yMin + 2 * step * Math.ceil((hi - yMin) / (2 * step) + 0.1);
  }
  const innerW = width - PAD.l - PAD.r;
  const innerH = height - PAD.t - PAD.b;
  const n = points.length;
  const slot = innerW / n;
  const x = (i: number) => PAD.l + slot * (i + 0.5);
  const y = (v: number) => PAD.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const tickDecimals = Number.isInteger((yMax - yMin) / 2) && Number.isInteger(yMin) ? 0 : 1;
  const linePoints = (vals: (number | undefined)[]) =>
    vals
      .map((v, i) => (v != null ? `${x(i)},${y(v)}` : null))
      .filter(Boolean)
      .join(' ');

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {yTicks(yMin, yMax).map((t) => (
            <G key={t}>
              <Line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
              <SvgText x={PAD.l - 5} y={y(t) + 4} fontSize={10} fill={colors.sub} textAnchor="end">
                {t >= 10000 ? `${round(t / 1000, 0)}k` : round(t, tickDecimals)}
              </SvgText>
            </G>
          ))}
          {kind === 'bar' &&
            points.map((p, i) =>
              p.value != null && p.value > 0 ? (
                <Rect
                  key={i}
                  x={x(i) - Math.min(slot * 0.32, 14)}
                  width={Math.min(slot * 0.64, 28)}
                  y={y(p.value)}
                  height={Math.max(y(yMin) - y(p.value), 1)}
                  rx={Math.min(slot * 0.2, 4)}
                  fill={goal != null && p.value >= goal ? color : color + '88'}
                />
              ) : null,
            )}
          {target && targets.length > 1 && (
            <Polyline points={linePoints(target)} fill="none" stroke={colors.danger} strokeWidth={1.5} strokeDasharray="5 4" />
          )}
          {kind === 'line' && (
            <>
              <Polyline points={linePoints(points.map((p) => p.value))} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
              {points.map((p, i) => (p.value != null ? <Circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} fill="#fff" stroke={color} strokeWidth={2} /> : null))}
            </>
          )}
          {goal != null && goal >= yMin && goal <= yMax && (
            <G>
              <Line x1={PAD.l} x2={width - PAD.r} y1={y(goal)} y2={y(goal)} stroke={colors.danger} strokeWidth={1.2} strokeDasharray="5 4" />
              <SvgText x={width - PAD.r} y={y(goal) - 4} fontSize={10} fill={colors.danger} textAnchor="end">
                목표
              </SvgText>
            </G>
          )}
          {points.map((p, i) =>
            p.label ? (
              <SvgText key={i} x={x(i)} y={height - 5} fontSize={10} fill={colors.sub} textAnchor="middle">
                {p.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
    </View>
  );
}

type StatMode = 'amount' | 'level';
type Period = 'week' | 'month' | 'quarter';
type Entry = readonly [string, number];

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: '주간' },
  { key: 'month', label: '월간' },
  { key: 'quarter', label: '3개월' },
];
const QUARTER_WEEKS = 13;

const avgOf = (es: readonly Entry[]) => (es.length ? es.reduce((s, e) => s + e[1], 0) / es.length : undefined);

/** 최소제곱 기울기 (단위/일) */
function slopePerDay(es: readonly Entry[]): number | undefined {
  if (es.length < 3) return undefined;
  const xs = es.map((e) => dayDiff(es[0][0], e[0]));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = es.reduce((a, e) => a + e[1], 0) / es.length;
  const sxx = xs.reduce((a, v) => a + (v - mx) ** 2, 0);
  if (sxx === 0) return undefined;
  return xs.reduce((a, v, i) => a + (v - mx) * (es[i][1] - my), 0) / sxx;
}

/** 기간 안의 날짜 목록과 그래프 점(일별 또는 주별) */
function buildRange(period: Period, offset: number, today: string) {
  if (period === 'week') {
    const dates = weekDates(today, offset);
    const label = offset === 0 ? '이번 주' : offset === 1 ? '지난 주' : '';
    return { dates, buckets: dates.map((d) => ({ label: weekdayOf(d), dates: [d] })), title: `${label ? label + ' · ' : ''}${shortDate(dates[0])} ~ ${shortDate(dates[6])}`, prevName: '지난 주' };
  }
  if (period === 'month') {
    const dates = monthDates(today, offset);
    const day = (d: string) => fromKey(d).getDate();
    const m = fromKey(dates[0]);
    return {
      dates,
      buckets: dates.map((d) => ({ label: day(d) === 1 || day(d) % 5 === 0 ? String(day(d)) : '', dates: [d] })),
      title: `${m.getFullYear()}년 ${m.getMonth() + 1}월${offset === 0 ? ' (이번 달)' : ''}`,
      prevName: '지난달',
    };
  }
  const lastWeek = addDays(startOfWeek(today), -7 * QUARTER_WEEKS * offset);
  const weekStarts = Array.from({ length: QUARTER_WEEKS }, (_, i) => addDays(lastWeek, -7 * (QUARTER_WEEKS - 1 - i)));
  const dates = weekStarts.flatMap((w) => Array.from({ length: 7 }, (_, i) => addDays(w, i)));
  return {
    dates,
    buckets: weekStarts.map((w, i) => ({
      label: i % 3 === 0 || i === QUARTER_WEEKS - 1 ? `${fromKey(w).getMonth() + 1}/${fromKey(w).getDate()}` : '',
      dates: Array.from({ length: 7 }, (_, j) => addDays(w, j)),
    })),
    title: `${offset === 0 ? '최근 13주 · ' : ''}${shortDate(dates[0])} ~ ${shortDate(dates[dates.length - 1])} (주 평균)`,
    prevName: '이전 13주',
  };
}

/**
 * 주간/월간/3개월 그래프 카드. 기간 이동(‹ ›)과 기간 평균·합계·변화량을 함께 보여줌.
 * - amount: 걸음/운동/물처럼 쌓이는 값 → 하루 평균, 합계, 목표 달성일
 * - level: 체중처럼 상태값 → 평균, 범위, 기간 변화, 주당 추세
 * - target: 체중 목표처럼 날짜별 계획값이 있으면 점선으로 함께 그림
 */
export function TrendCard({
  title,
  unit,
  color,
  kind,
  mode,
  goal,
  decimals = 0,
  getValue,
  target,
}: {
  title: string;
  unit: string;
  color: string;
  kind: 'bar' | 'line';
  mode: StatMode;
  goal?: number;
  decimals?: number;
  getValue: (date: string) => number | undefined;
  target?: { label: string; at: (date: string) => number | undefined; lowerIsBetter: boolean };
}) {
  const [period, setPeriod] = useState<Period>('week');
  const [offset, setOffset] = useState(0);
  const today = todayKey();
  const range = buildRange(period, offset, today);
  const prevRange = buildRange(period, offset + 1, today);

  const recorded = (ds: string[]): Entry[] =>
    ds
      .filter((d) => d <= today)
      .map((d) => [d, getValue(d)] as const)
      .filter((e): e is Entry => e[1] != null && (mode === 'level' || e[1] > 0));

  const points: ChartPoint[] = range.buckets.map((b) => ({ label: b.label, value: avgOf(recorded(b.dates)) }));
  const targetSeries = target
    ? range.buckets.map((b) => {
        const last = b.dates.filter((d) => d <= today).pop() ?? b.dates[0];
        return target.at(b.dates.length === 1 ? b.dates[0] : last);
      })
    : undefined;

  const cur = recorded(range.dates);
  const curAvg = avgOf(cur);
  const prevAvg = avgOf(recorded(prevRange.dates));
  const elapsedDays = range.dates.filter((d) => d <= today).length;
  const lowerIsBetter = target?.lowerIsBetter ?? true;
  const goodBad = (delta: number) => (delta === 0 ? colors.sub : delta < 0 === lowerIsBetter ? colors.steps : colors.danger);

  const stats: { label: string; value: string; color?: string }[] = [];
  if (curAvg != null) stats.push({ label: mode === 'amount' ? '하루 평균' : '평균', value: `${fmt(curAvg, decimals)}${unit}` });
  if (mode === 'amount') {
    stats.push({ label: '합계', value: `${fmt(cur.reduce((s, e) => s + e[1], 0), decimals)}${unit}` });
    if (goal != null) stats.push({ label: '목표 달성', value: `${cur.filter((e) => e[1] >= goal).length}/${elapsedDays}일` });
  } else if (cur.length >= 2) {
    const first = cur[0];
    const last = cur[cur.length - 1];
    const change = last[1] - first[1];
    stats.push({ label: '최저 ~ 최고', value: `${fmt(Math.min(...cur.map((e) => e[1])))} ~ ${fmt(Math.max(...cur.map((e) => e[1])))}` });
    stats.push({ label: period === 'week' ? '이번 주 변화' : '기간 변화', value: `${change > 0 ? '+' : ''}${fmt(change, 2)}${unit}`, color: goodBad(change) });
    const slope = slopePerDay(cur);
    if (period !== 'week' && slope != null && dayDiff(first[0], last[0]) >= 7) {
      const perWeek = slope * 7;
      const flat = Math.abs(perWeek) < 0.005;
      stats.push({
        label: flat ? '주당 평균 변화 (추세)' : `주당 평균 ${perWeek < 0 ? '감량' : '증가'} (추세)`,
        value: flat ? `변화 없음` : `${fmt(Math.abs(perWeek), 2)}${unit}`,
        color: flat ? colors.sub : goodBad(perWeek),
      });
    }
  }
  if (target && cur.length) {
    const [lastDate, lastValue] = cur[cur.length - 1];
    const planned = target.at(lastDate);
    if (planned != null) {
      const gap = lastValue - planned;
      const ahead = gap === 0 || gap < 0 === target.lowerIsBetter;
      stats.push({ label: `${target.label} 대비`, value: `${gap > 0 ? '+' : ''}${fmt(gap, 2)}${unit} ${ahead ? '앞섬' : '뒤처짐'}`, color: ahead ? colors.steps : colors.danger });
    }
  }
  if (curAvg != null && prevAvg != null) {
    const d = curAvg - prevAvg;
    stats.push({ label: `${range.prevName} 평균 대비`, value: `${d > 0 ? '+' : ''}${fmt(d, decimals || 1)}${unit}`, color: mode === 'level' ? goodBad(d) : undefined });
  }

  return (
    <Card title={title}>
      <Segmented
        label={`${plain(title)} 기간`}
        options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
        value={period}
        onChange={(v) => {
          setPeriod(v);
          setOffset(0);
        }}
      />
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Pressable role="button" aria-label="이전 기간" onPress={() => setOffset(offset + 1)} hitSlop={4} style={({ pressed }) => [styles.navButton, { width: 36, height: 36 }, pressed && { opacity: 0.6 }]}>
          <Text style={{ color: colors.primary, fontSize: 20, lineHeight: 24 }}>‹</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, flexShrink: 1, textAlign: 'center' }}>{range.title}</Text>
        <Pressable
          role="button"
          aria-label="다음 기간"
          aria-disabled={offset === 0}
          onPress={() => setOffset(Math.max(0, offset - 1))}
          hitSlop={4}
          disabled={offset === 0}
          style={({ pressed }) => [styles.navButton, { width: 36, height: 36 }, offset === 0 && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}
        >
          <Text style={{ color: colors.primary, fontSize: 20, lineHeight: 24 }}>›</Text>
        </Pressable>
      </View>
      {cur.length === 0 ? (
        <Text style={[styles.empty, { paddingVertical: 40 }]}>이 기간에는 기록이 없어요</Text>
      ) : (
        <View role="img" aria-label={`${plain(title)} 그래프, ${range.title}. ${stats.map((x) => `${x.label} ${x.value}`).join(', ')}`}>
          <TrendChart points={points} kind={kind} color={color} goal={goal} target={targetSeries} />
        </View>
      )}
      {target && cur.length > 0 && targetSeries?.some((v) => v != null) && (
        <View style={[styles.row, { gap: 14 }]} aria-hidden>
          <Text style={{ fontSize: 12, color: ink(color) }}>━ 실제</Text>
          <Text style={{ fontSize: 12, color: ink(colors.danger) }}>╍ {target.label}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {stats.map((x) => (
          <View key={x.label} style={{ flexGrow: 1, minWidth: '30%', backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10 }}>
            <Text style={{ fontSize: 12, color: colors.sub }}>{x.label}</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: x.color ? ink(x.color) : colors.text }}>{x.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
