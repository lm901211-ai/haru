import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Card, Chip, GradeBadge, Screen, styles } from '../components/ui';
import { useStore } from '../store';
import { dayRings, DayRings, RINGS, ringClosed, ringSummary } from '../rings';
import { challengeEnd, challengeProgress, STATUS_TEXT } from '../challenges';
import { dayActivities } from '../report';
import { firstUseDate, gradeOf, periodReport } from '../grade';
import { dayScore } from '../score';
import { dayDiff, formatKey, fromKey, monthDates, shortDate, todayKey } from '../date';
import { colors, HIGHLIGHTERS } from '../theme';
import { Challenge } from '../types';

const WEEK_HEAD = ['월', '화', '수', '목', '금', '토', '일'];

/** 바깥부터 활동 · 건강 · 루틴 링 */
export function TripleRing({ rings, size, stroke }: { rings?: DayRings; size: number; stroke: number }) {
  const gap = Math.max(1, stroke * 0.3);
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      {RINGS.map((ring, i) => {
        const r = c - stroke / 2 - i * (stroke + gap);
        if (r <= 0) return null;
        const len = 2 * Math.PI * r;
        const v = Math.max(0, Math.min(rings?.[ring.key] ?? 0, 1));
        return (
          <G key={ring.key}>
            <Circle cx={c} cy={c} r={r} stroke={ring.color} strokeOpacity={0.16} strokeWidth={stroke} fill="none" />
            {v > 0 && (
              <Circle
                cx={c}
                cy={c}
                r={r}
                stroke={ring.color}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${len * v} ${len}`}
                transform={`rotate(-90 ${c} ${c})`}
              />
            )}
          </G>
        );
      })}
    </Svg>
  );
}

type GoalSpan = { goal: Challenge; color: string; start: string; end: string };

export default function CalendarScreen() {
  const { data } = useStore();
  const today = todayKey();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(today);
  const dates = monthDates(today, offset);
  const firstUse = firstUseDate(data);
  const month = fromKey(dates[0]);

  const goals: GoalSpan[] = data.challenges.map((goal, i) => ({ goal, color: HIGHLIGHTERS[i % HIGHLIGHTERS.length], start: goal.startDate, end: challengeEnd(goal) }));
  const monthGoals = goals.filter((g) => g.start <= dates[dates.length - 1] && g.end >= dates[0]);

  // offset: 0 = 이번 달, 양수 = 지난 달, 음수 = 다음 달 (앞으로 시작할 목표 기간 보기용, 최대 12달)
  const changeMonth = (next: number) => {
    const clamped = Math.max(-12, next);
    setOffset(clamped);
    // 이번 달이면 오늘, 지난 달이면 그 달 마지막 날, 다음 달이면 그 달 1일을 선택
    const ds = monthDates(today, clamped);
    setSelected(clamped === 0 ? today : clamped > 0 ? ds[ds.length - 1] : ds[0]);
  };

  return (
    <Screen title="달력">
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Pressable onPress={() => changeMonth(offset + 1)} hitSlop={12}>
          <Text style={{ color: colors.primary, fontSize: 26 }}>‹</Text>
        </Pressable>
        <View style={[styles.row, { gap: 8 }]}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </Text>
          {offset !== 0 && <Chip label="오늘" active={false} onPress={() => changeMonth(0)} />}
        </View>
        <Pressable onPress={() => changeMonth(offset - 1)} hitSlop={12} disabled={offset <= -12}>
          <Text style={{ color: offset <= -12 ? colors.line : colors.primary, fontSize: 26 }}>›</Text>
        </Pressable>
      </View>

      <MonthSummary dates={dates} offset={offset} goals={monthGoals} />

      <Card style={{ paddingHorizontal: 8 }}>
        <MonthGrid dates={dates} today={today} firstUse={firstUse} selected={selected} onSelect={setSelected} goals={monthGoals} />
        <RingLegend />
      </Card>

      <DayDetail date={selected} today={today} firstUse={firstUse} goals={goals} />
      <GoalTimeline goals={goals} today={today} />
    </Screen>
  );
}

function MonthSummary({ dates, offset, goals }: { dates: string[]; offset: number; goals: GoalSpan[] }) {
  const { data } = useStore();
  const today = todayKey();
  if (dates[0] > today) {
    const starting = goals.filter((g) => g.start >= dates[0]);
    return (
      <Card>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>📆 다가오는 달이에요</Text>
        <Text style={styles.muted}>
          이 달에 진행되는 목표 {goals.length}개
          {starting.length ? ` · 새로 시작: ${starting.map((g) => `${shortDate(g.start)} ${g.goal.emoji} ${g.goal.title}`).join(', ')}` : ''}
        </Text>
      </Card>
    );
  }
  const sum = ringSummary(
    data,
    dates.filter((d) => d <= today),
  );
  const monthReport = periodReport(data, 'month', offset, today);
  return (
    <Card>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        {RINGS.map((r) => (
          <View key={r.key} style={[styles.row, { gap: 6 }]}>
            <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 4, borderColor: r.color }} />
            <Text style={{ fontSize: 13, color: colors.text }}>
              {r.label} <Text style={{ fontWeight: '800' }}>{sum.counts[r.key]}일</Text>
            </Text>
          </View>
        ))}
      </View>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={{ fontSize: 13, color: colors.text }}>
          ⭐ 링을 모두 채운 날 <Text style={{ fontWeight: '800' }}>{sum.allClosed}일</Text>
        </Text>
        {monthReport.grade ? (
          <View style={[styles.row, { gap: 6 }]}>
            <Text style={styles.muted}>월 성적</Text>
            <GradeBadge grade={monthReport.grade} size={22} />
            <Text style={{ fontSize: 13, color: colors.text }}>{monthReport.score?.toFixed(1)}점</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function MonthGrid({
  dates,
  today,
  firstUse,
  selected,
  onSelect,
  goals,
}: {
  dates: string[];
  today: string;
  firstUse?: string;
  selected: string;
  onSelect: (d: string) => void;
  goals: GoalSpan[];
}) {
  const { data } = useStore();
  const lead = (fromKey(dates[0]).getDay() + 6) % 7; // 월요일 시작
  const cells: (string | null)[] = [...Array(lead).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  // 목표 이름은 그 달에서 3칸 이상 칠해지는 첫 행에 한 번만 (없으면 첫 행) 쓰고, 나머지 행은 얇은 형광펜 줄로
  const labelRow = new Map<string, number>();
  goals.forEach((g) => {
    const spans = rows.map((row) => row.filter((d) => d && d >= g.start && d <= g.end).length);
    const wide = spans.findIndex((n) => n >= 3);
    labelRow.set(g.goal.id, wide >= 0 ? wide : spans.findIndex((n) => n > 0));
  });

  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row' }}>
        {WEEK_HEAD.map((w, i) => (
          <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: i === 6 ? colors.danger : i === 5 ? colors.primary : colors.sub }}>
            {w}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row' }}>
            {row.map((d, ci) =>
              d ? (
                <DayCell
                  key={d}
                  date={d}
                  today={today}
                  status={firstUse == null || d < firstUse ? (d > today ? 'future' : 'before') : d > today ? 'future' : 'past'}
                  selected={d === selected}
                  rings={d <= today ? dayRings(data, d) : undefined}
                  onPress={() => onSelect(d)}
                />
              ) : (
                <View key={`b${ci}`} style={{ flex: 1 }} />
              ),
            )}
          </View>
          <HighlightLanes row={row} goals={goals} labeled={(id) => labelRow.get(id) === ri} />
        </View>
      ))}
    </View>
  );
}

function DayCell({
  date,
  today,
  status,
  selected,
  rings,
  onPress,
}: {
  date: string;
  today: string;
  status: 'past' | 'future' | 'before';
  selected: boolean;
  rings?: DayRings;
  onPress: () => void;
}) {
  const dow = fromKey(date).getDay();
  const isToday = date === today;
  const present = rings ? RINGS.filter((r) => rings[r.key] != null) : [];
  const star = rings?.hasRecord && present.length > 0 && present.every((r) => ringClosed(rings[r.key]));
  const dateColor = status !== 'past' && !isToday ? colors.sub : dow === 0 ? colors.danger : dow === 6 ? colors.primary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 3, borderRadius: 10, backgroundColor: selected ? '#E9EFFF' : 'transparent' }}
    >
      <View style={[{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, isToday && { backgroundColor: colors.primary }]}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: isToday ? '#fff' : dateColor }}>{fromKey(date).getDate()}</Text>
      </View>
      <View style={{ height: 34, justifyContent: 'center', opacity: status === 'past' || isToday ? 1 : 0.35 }}>
        <TripleRing rings={status === 'before' ? undefined : rings} size={32} stroke={3.4} />
      </View>
      {star && <Text style={{ position: 'absolute', top: 1, right: 2, fontSize: 9 }}>⭐</Text>}
    </Pressable>
  );
}

/** 한 주(행)에 걸친 목표 기간을 형광펜처럼 칠함 */
function HighlightLanes({ row, goals, labeled }: { row: (string | null)[]; goals: GoalSpan[]; labeled: (goalId: string) => boolean }) {
  const lanes = goals
    .map((g) => {
      const idx = row.map((d, i) => (d && d >= g.start && d <= g.end ? i : -1)).filter((i) => i >= 0);
      return idx.length ? { g, first: idx[0], last: idx[idx.length - 1] } : null;
    })
    .filter((x): x is { g: GoalSpan; first: number; last: number } => x != null);
  if (!lanes.length) return null;
  return (
    <View style={{ gap: 2, marginTop: 2 }}>
      {lanes.map(({ g, first, last }) => {
        const starts = row[first] === g.start;
        const ends = row[last] === g.end;
        const span = last - first + 1;
        const withText = labeled(g.goal.id) || starts || ends;
        const label =
          span >= 3
            ? `${starts ? '▶ ' : ''}${g.goal.emoji} ${g.goal.title}${starts && span >= 4 ? ` · ${shortDate(g.start)}~` : ''}${ends ? ' 🏁' : ''}`
            : `${starts ? '▶' : ''}${g.goal.emoji}${ends ? '🏁' : ''}`;
        return (
          <View key={g.goal.id} style={{ height: withText ? 15 : 6 }}>
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${(first / 7) * 100}%`,
                width: `${(span / 7) * 100}%`,
                backgroundColor: g.color + 'B0',
                borderTopLeftRadius: starts ? 8 : 0,
                borderBottomLeftRadius: starts ? 8 : 0,
                borderTopRightRadius: ends ? 8 : 0,
                borderBottomRightRadius: ends ? 8 : 0,
                justifyContent: 'center',
                paddingHorizontal: 5,
              }}
            >
              {withText && (
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#3A3424' }} numberOfLines={1}>
                  {label}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RingLegend() {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, marginTop: 4, paddingTop: 8, paddingHorizontal: 6, gap: 4 }}>
      <View style={[styles.row, { flexWrap: 'wrap', gap: 10 }]}>
        {RINGS.map((r, i) => (
          <Text key={r.key} style={{ fontSize: 11, color: colors.sub }}>
            <Text style={{ color: r.color, fontWeight: '900' }}>●</Text> {i === 0 ? '바깥 ' : i === 1 ? '가운데 ' : '안쪽 '}
            <Text style={{ fontWeight: '700', color: colors.text }}>{r.label}</Text>({r.desc})
          </Text>
        ))}
      </View>
      <Text style={{ fontSize: 11, color: colors.sub }}>하루 목표를 다 채우면 링이 닫혀요. ⭐ = 그날 링을 모두 채운 날 · 형광펜 = 목표 진행 기간</Text>
    </View>
  );
}

function DayDetail({ date, today, firstUse, goals }: { date: string; today: string; firstUse?: string; goals: GoalSpan[] }) {
  const { data } = useStore();
  const activeGoals = goals.filter((g) => date >= g.start && date <= g.end);
  const goalChips = activeGoals.map((g) => (
    <View key={g.goal.id} style={{ backgroundColor: g.color + 'B0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#3A3424' }}>
        {g.goal.emoji} {g.goal.title} · {dayDiff(g.start, date) + 1}일째
      </Text>
    </View>
  ));

  if (date > today || !firstUse || date < firstUse) {
    return (
      <Card title={formatKey(date)}>
        <Text style={styles.muted}>{date > today ? '아직 오지 않은 날이에요.' : '기록을 시작하기 전이에요.'}</Text>
        {goalChips.length > 0 && <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>{goalChips}</View>}
      </Card>
    );
  }

  const rings = dayRings(data, date);
  const score = dayScore(data, date);
  const activities = dayActivities(data, date);
  return (
    <Card
      title={formatKey(date)}
      right={
        rings.hasRecord ? (
          <View style={[styles.row, { gap: 6 }]}>
            <GradeBadge grade={gradeOf(score.total)} size={22} />
            <Text style={{ fontWeight: '800', color: colors.text }}>{score.total}점</Text>
          </View>
        ) : (
          <Text style={styles.muted}>기록 없음</Text>
        )
      }
    >
      <View style={[styles.row, { gap: 16 }]}>
        <TripleRing rings={rings} size={96} stroke={10} />
        <View style={{ flex: 1, gap: 6 }}>
          {RINGS.map((r) => {
            const v = rings[r.key];
            const sub = score.items
              .filter((i) => r.items.includes(i.key))
              .map((i) => `${i.label.split(' ').slice(1).join(' ')} ${i.valueText}`)
              .join(' · ');
            return (
              <View key={r.key}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: r.color }}>
                  {r.label} {v == null ? '-' : `${Math.round(v * 100)}%`}
                </Text>
                <Text style={{ fontSize: 11, color: colors.sub }} numberOfLines={2}>
                  {sub || '해당 항목 없음'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      {activities.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, gap: 5 }}>
          {activities.map((a) => (
            <View key={a.label} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ width: 62, fontSize: 13, color: colors.sub }}>
                {a.icon} {a.label}
              </Text>
              <Text style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 }}>{a.text}</Text>
            </View>
          ))}
        </View>
      )}
      {goalChips.length > 0 && <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>{goalChips}</View>}
    </Card>
  );
}

/** 목표마다 기간(형광펜) 중 어디쯤 왔는지와 달성률을 두 줄 막대로 비교 */
function GoalTimeline({ goals, today }: { goals: GoalSpan[]; today: string }) {
  const { data } = useStore();
  if (!goals.length) return null;
  return (
    <Card title="🗓️ 목표 타임라인">
      {goals.map(({ goal, color, start, end }) => {
        const p = challengeProgress(data, goal, today);
        const elapsedDays = Math.max(0, Math.min(dayDiff(start, today) + 1, goal.days));
        const time = elapsedDays / goal.days;
        const before = today < start;
        const finished = today > end;
        const statusColor = p.status === 'done' ? colors.steps : p.status === 'behind' ? colors.exercise : colors.primary;
        return (
          <View key={goal.id} style={{ gap: 6, paddingVertical: 4 }}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                {goal.emoji} {goal.title}
              </Text>
              <Text style={{ fontSize: 12, color: colors.sub }}>
                {shortDate(start)} ~ {shortDate(end)} ({goal.days}일)
              </Text>
            </View>
            <View style={{ gap: 4 }}>
              <View style={[styles.row, { gap: 8 }]}>
                <Text style={{ width: 28, fontSize: 11, color: colors.sub }}>기간</Text>
                <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: color + '45', overflow: 'hidden' }}>
                  <View style={{ width: `${time * 100}%`, height: '100%', backgroundColor: color }} />
                </View>
                <Text style={{ width: 40, textAlign: 'right', fontSize: 11, color: colors.text }}>{Math.round(time * 100)}%</Text>
              </View>
              <View style={[styles.row, { gap: 8 }]}>
                <Text style={{ width: 28, fontSize: 11, color: colors.sub }}>달성</Text>
                <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.line, overflow: 'hidden' }}>
                  <View style={{ width: `${p.ratio * 100}%`, height: '100%', backgroundColor: statusColor }} />
                </View>
                <Text style={{ width: 40, textAlign: 'right', fontSize: 11, fontWeight: '800', color: statusColor }}>{Math.round(p.ratio * 100)}%</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: colors.sub }}>
              {before ? `${dayDiff(today, start)}일 뒤 시작` : finished ? '기간 종료' : `${elapsedDays}일째 · D-${goal.days - elapsedDays}`}
              {STATUS_TEXT[p.status] ? <Text style={{ color: statusColor, fontWeight: '700' }}>{`  ${STATUS_TEXT[p.status]}`}</Text> : null}
            </Text>
          </View>
        );
      })}
      <Text style={[styles.muted, { fontSize: 11 }]}>달성 막대가 기간 막대보다 길면 계획보다 앞서 있는 거예요.</Text>
    </Card>
  );
}
