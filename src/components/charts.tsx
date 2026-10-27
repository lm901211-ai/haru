import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { Card, Chip, styles } from './ui';
import { addDays, dayDiff, fromKey, todayKey, weekdayOf } from '../date';
import { colors } from '../theme';

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const fmt = (n: number, d = 1) => round(n, d).toLocaleString();

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

/** 원형 달성 게이지 */
export function Ring({ ratio, size = 64, stroke = 7, color, children }: { ratio: number; size?: number; stroke?: number; color: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(ratio, 1));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
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

function xLabelVisible(i: number, n: number) {
  return n <= 7 || i % 5 === 0 || i === n - 1;
}

/** 날짜별 막대/꺾은선 그래프 */
export function TrendChart({
  points,
  kind,
  color,
  goal,
  height = 160,
}: {
  points: ChartPoint[];
  kind: 'bar' | 'line';
  color: string;
  goal?: number;
  height?: number;
}) {
  const [width, onLayout] = useWidth();
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  let yMin = 0;
  let yMax = 2 * niceNumber((Math.max(...values, goal ?? 0, 1) * 1.05) / 2);
  if (kind === 'line' && values.length) {
    const lo = Math.min(...values, goal ?? Infinity);
    const hi = Math.max(...values, goal ?? -Infinity);
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
          {kind === 'line' && (
            <>
              <Polyline
                points={points
                  .map((p, i) => (p.value != null ? `${x(i)},${y(p.value)}` : null))
                  .filter(Boolean)
                  .join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
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
            xLabelVisible(i, n) ? (
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

/** 관리도 (Control chart): 중심선(CL), 관리 상·하한(UCL/LCL), 목표 하한(LSL) */
export function ControlChart({
  points,
  cl,
  ucl,
  lcl,
  lsl,
  height = 190,
}: {
  points: ChartPoint[];
  cl: number;
  ucl: number;
  lcl: number;
  lsl: number;
  height?: number;
}) {
  const [width, onLayout] = useWidth();
  const innerW = width - PAD.l - 34;
  const innerH = height - PAD.t - PAD.b;
  const n = points.length;
  const x = (i: number) => PAD.l + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v: number) => PAD.t + innerH - (v / 100) * innerH;
  const refLines = [
    { v: ucl, label: 'UCL', color: colors.danger, dash: '4 3' },
    { v: cl, label: 'CL', color: colors.primary, dash: undefined },
    { v: lcl, label: 'LCL', color: colors.danger, dash: '4 3' },
    { v: lsl, label: 'LSL', color: colors.exercise, dash: '2 3' },
  ];

  // 라벨끼리 10px 이상 떨어지도록 위에서부터 밀어냄
  const labelY: Record<string, number> = {};
  let lastY = -Infinity;
  [...refLines].sort((a, b) => b.v - a.v).forEach((r) => {
    const yy = Math.max(y(r.v) + 3, lastY + 10);
    labelY[r.label] = yy;
    lastY = yy;
  });

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {/* 목표 하한 아래 영역 */}
          <Rect x={PAD.l} y={y(lsl)} width={innerW} height={y(0) - y(lsl)} fill={colors.exercise} opacity={0.07} />
          {[0, 50, 100].map((t) => (
            <SvgText key={t} x={PAD.l - 6} y={y(t) + 4} fontSize={10} fill={colors.sub} textAnchor="end">
              {t}
            </SvgText>
          ))}
          {refLines.map((r) => (
            <G key={r.label}>
              <Line x1={PAD.l} x2={PAD.l + innerW} y1={y(r.v)} y2={y(r.v)} stroke={r.color} strokeWidth={r.label === 'CL' ? 1.5 : 1.2} strokeDasharray={r.dash} />
              <SvgText x={PAD.l + innerW + 4} y={labelY[r.label]} fontSize={9} fill={r.color} fontWeight="bold">
                {r.label}
              </SvgText>
            </G>
          ))}
          <Polyline
            points={points
              .map((p, i) => (p.value != null ? `${x(i)},${y(p.value)}` : null))
              .filter(Boolean)
              .join(' ')}
            fill="none"
            stroke={colors.text}
            strokeOpacity={0.55}
            strokeWidth={1.5}
          />
          {points.map((p, i) => {
            if (p.value == null) return null;
            const out = p.value > ucl || p.value < lcl;
            const fill = out ? colors.danger : p.value < lsl ? colors.exercise : colors.primary;
            return <Circle key={i} cx={x(i)} cy={y(p.value)} r={out ? 5 : 4} fill={fill} stroke="#fff" strokeWidth={1.5} />;
          })}
          {points.map((p, i) =>
            n <= 7 || (n - 1 - i) % 2 === 0 ? (
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

/**
 * 주간/월간 그래프 카드. 기간 이동(‹ ›)과 기간 평균·합계·변화량을 함께 보여줌.
 * - amount: 걸음/운동/물처럼 쌓이는 값 → 평균, 합계, 목표 달성일
 * - level: 체중처럼 상태값 → 평균, 범위, 기간 변화, 주당 평균 변화
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
}: {
  title: string;
  unit: string;
  color: string;
  kind: 'bar' | 'line';
  mode: StatMode;
  goal?: number;
  decimals?: number;
  getValue: (date: string) => number | undefined;
}) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const [offset, setOffset] = useState(0);
  const end = addDays(todayKey(), -offset * period);
  const dates = Array.from({ length: period }, (_, i) => addDays(end, i - period + 1));
  const prevDates = dates.map((d) => addDays(d, -period));

  const points: ChartPoint[] = dates.map((d) => ({
    label: period === 7 ? weekdayOf(d) : String(fromKey(d).getDate()),
    value: getValue(d),
  }));
  const recorded = (ds: string[]) =>
    ds.map((d) => [d, getValue(d)] as const).filter((e): e is readonly [string, number] => e[1] != null && (mode === 'level' || e[1] > 0));
  const cur = recorded(dates);
  const prev = recorded(prevDates);
  const avg = (es: readonly (readonly [string, number])[]) => (es.length ? es.reduce((s, e) => s + e[1], 0) / es.length : undefined);
  const curAvg = avg(cur);
  const prevAvg = avg(prev);
  const periodName = period === 7 ? '주' : '달';

  const stats: { label: string; value: string; color?: string }[] = [];
  if (curAvg != null) stats.push({ label: mode === 'amount' ? '하루 평균' : '평균', value: `${fmt(curAvg, decimals)}${unit}` });
  if (mode === 'amount') {
    stats.push({ label: '합계', value: `${fmt(cur.reduce((s, e) => s + e[1], 0), decimals)}${unit}` });
    if (goal != null) stats.push({ label: '목표 달성', value: `${cur.filter((e) => e[1] >= goal).length}/${period}일` });
  } else if (cur.length >= 2) {
    const [firstD, firstV] = cur[0];
    const [lastD, lastV] = cur[cur.length - 1];
    const change = lastV - firstV;
    const weeks = Math.max(dayDiff(firstD, lastD), 1) / 7;
    const c = change < 0 ? colors.steps : change > 0 ? colors.danger : colors.sub;
    stats.push({ label: '최저 ~ 최고', value: `${fmt(Math.min(...cur.map((e) => e[1])))} ~ ${fmt(Math.max(...cur.map((e) => e[1])))}` });
    stats.push({ label: '기간 변화', value: `${change > 0 ? '+' : ''}${fmt(change, 2)}${unit}`, color: c });
    stats.push({ label: change <= 0 ? '주당 평균 감량' : '주당 평균 증가', value: `${fmt(Math.abs(change) / weeks, 2)}${unit}`, color: c });
  }
  if (curAvg != null && prevAvg != null) {
    const d = curAvg - prevAvg;
    stats.push({ label: `지난 ${periodName} 평균 대비`, value: `${d > 0 ? '+' : ''}${fmt(d, decimals || 1)}${unit}` });
  }

  const rangeLabel = `${fromKey(dates[0]).getMonth() + 1}.${fromKey(dates[0]).getDate()} ~ ${fromKey(end).getMonth() + 1}.${fromKey(end).getDate()}`;

  return (
    <Card
      title={title}
      right={
        <View style={styles.row}>
          <Chip label="주간" active={period === 7} onPress={() => (setPeriod(7), setOffset(0))} color={color} />
          <Chip label="월간" active={period === 30} onPress={() => (setPeriod(30), setOffset(0))} color={color} />
        </View>
      }
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Pressable onPress={() => setOffset(offset + 1)} hitSlop={10}>
          <Text style={{ color: colors.primary, fontSize: 20 }}>‹</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{rangeLabel}</Text>
        <Pressable onPress={() => setOffset(Math.max(0, offset - 1))} hitSlop={10} disabled={offset === 0}>
          <Text style={{ color: offset === 0 ? colors.line : colors.primary, fontSize: 20 }}>›</Text>
        </Pressable>
      </View>
      {cur.length === 0 ? (
        <Text style={[styles.empty, { paddingVertical: 40 }]}>이 기간에는 기록이 없어요</Text>
      ) : (
        <TrendChart points={points} kind={kind} color={color} goal={goal} />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {stats.map((s) => (
          <View key={s.label} style={{ flexGrow: 1, minWidth: '30%', backgroundColor: colors.bg, borderRadius: 10, padding: 8 }}>
            <Text style={{ fontSize: 11, color: colors.sub }}>{s.label}</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: s.color ?? colors.text }}>{s.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
