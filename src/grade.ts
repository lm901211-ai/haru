import { AppData, Challenge } from './types';
import { addDays, dayDiff, monthDates, todayKey, weekDates } from './date';
import { dayScore, logHasData, streakActiveOn } from './score';
import { challengeProgress, plannedWeight } from './challenges';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type GradeInfo = { grade: Grade; min: number; color: string; label: string };

/** 점수 → 등급 (위에서부터 처음 만족하는 등급) */
export const GRADES: GradeInfo[] = [
  { grade: 'S', min: 90, color: '#7C4DFF', label: '탁월' },
  { grade: 'A', min: 80, color: '#2F6BFF', label: '우수' },
  { grade: 'B', min: 70, color: '#16A06A', label: '양호' },
  { grade: 'C', min: 60, color: '#D99A00', label: '보통' },
  { grade: 'D', min: 50, color: '#F06B2A', label: '미흡' },
  { grade: 'F', min: 0, color: '#E5484D', label: '노력 필요' },
];

export const gradeOf = (score: number): GradeInfo => GRADES.find((g) => score >= g.min) ?? GRADES[GRADES.length - 1];

export type PeriodKind = 'week' | 'month';

export type DayGrade = {
  date: string;
  status: 'scored' | 'absent' | 'future' | 'before'; // 점수 / 결석(기록 없음) / 아직 안 지남 / 앱 사용 전
  score?: number;
  grade?: GradeInfo;
};

export type SubjectRow = { key: string; name: string; label: string; color: string; ratio: number; grade: GradeInfo };

export type GoalRow = {
  id: string;
  title: string;
  emoji: string;
  detail: string;
  ratio?: number; // 이 기간 계획 대비 달성률 (계산할 수 없으면 없음)
  grade?: GradeInfo;
  overall: number; // 목표 전체 진행률
};

export type BodySummary = {
  weightAvg?: number;
  weightChange?: number;
  sleepAvg?: number;
  stepsAvg?: number;
  exerciseMin: number;
  exerciseDays: number;
};

export type PeriodReport = {
  kind: PeriodKind;
  dates: string[];
  counted: string[]; // 점수에 들어간 날
  provisional: boolean; // 오늘 하루만으로 임시 집계 중
  score?: number; // 소수 첫째 자리
  grade?: GradeInfo;
  recordedDays: number;
  days: DayGrade[];
  distribution: { grade: GradeInfo; count: number }[];
  subjects: SubjectRow[];
  goals: GoalRow[];
  goalGrade?: GradeInfo;
  body: BodySummary;
  prev?: { score: number; grade: GradeInfo };
  prevName: string; // 비교 대상 기간 이름
  comments: string[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.max(0, Math.min(n, 1));
const round2 = (n: number) => Math.round(n * 100) / 100;
const signed2 = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(round2(n))}`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

/** 받침 유무에 따라 은/는 */
export function eunNeun(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  const batchim = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return word + (batchim ? '은' : '는');
}

/** 앱을 처음 쓰기 시작한 날 (이전 날짜는 결석으로 치지 않음) */
export function firstUseDate(data: AppData): string | undefined {
  const ds: string[] = [];
  Object.entries(data.logs).forEach(([d, log]) => logHasData(log) && ds.push(d));
  data.todos.forEach((t) => t.done && ds.push(t.date));
  data.habits.forEach((h) => {
    if (h.createdAt) ds.push(h.createdAt);
    ds.push(...h.doneDates);
  });
  data.challenges.forEach((c) => {
    ds.push(c.startDate);
    if (c.kind === 'streak') ds.push(...c.doneDates);
    if (c.kind === 'amount') ds.push(...Object.keys(c.entries));
  });
  return ds.length ? ds.reduce((a, b) => (a < b ? a : b)) : undefined;
}

export const periodDates = (kind: PeriodKind, offset: number, today: string) =>
  kind === 'week' ? weekDates(today, offset) : monthDates(today, offset);

/**
 * 점수에 넣을 날: 앱 사용 시작일 이후의 "다 지나간 날"(어제까지).
 * 이번 기간이 오늘 시작해 지나간 날이 없으면 오늘 하루로 임시 집계.
 */
function countedDays(dates: string[], today: string, firstUse?: string): { counted: string[]; provisional: boolean } {
  if (!firstUse) return { counted: [], provisional: false };
  const eligible = dates.filter((d) => d >= firstUse);
  const past = eligible.filter((d) => d < today);
  if (past.length) return { counted: past, provisional: false };
  return eligible.includes(today) ? { counted: [today], provisional: true } : { counted: [], provisional: false };
}

function scoreOf(data: AppData, counted: string[]): number | undefined {
  const s = avg(counted.map((d) => dayScore(data, d).total));
  return s == null ? undefined : round1(s);
}

function goalRow(data: AppData, c: Challenge, counted: string[], today: string): GoalRow | null {
  const base = { id: c.id, title: c.title, emoji: c.emoji, overall: challengeProgress(data, c, today).ratio };
  const inWindow = counted.filter((d) => d >= c.startDate && dayDiff(c.startDate, d) < c.days);

  if (c.kind === 'streak') {
    const active = counted.filter((d) => d >= c.startDate && (streakActiveOn(c, d) || c.doneDates.includes(d)));
    if (!active.length) return null;
    const done = active.filter((d) => c.doneDates.includes(d)).length;
    const ratio = done / active.length;
    return { ...base, ratio, grade: gradeOf(ratio * 100), detail: `${done}/${active.length}일 실천` };
  }
  if (!inWindow.length) return null;

  if (c.kind === 'amount') {
    const added = inWindow.reduce((s, d) => s + (c.entries[d] ?? 0), 0);
    const planned = (c.target / c.days) * inWindow.length;
    const ratio = clamp(added / planned);
    return { ...base, ratio, grade: gradeOf(ratio * 100), detail: `+${round1(added)}${c.unit} (계획 ${round1(planned)}${c.unit})` };
  }

  // 체중: 기간 직전 기록(또는 시작 체중) → 기간 마지막 기록 변화를 계획 변화와 비교
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const recs = Object.keys(data.logs)
    .filter((d) => data.logs[d].weight != null && d <= last)
    .sort();
  const lastInPeriod = recs.filter((d) => d >= first).pop();
  if (!lastInPeriod) return { ...base, detail: '이 기간 체중 기록 없음' };
  const before = recs.filter((d) => d < first && d >= c.startDate).pop();
  const [baseDate, baseKg] = before ? [before, data.logs[before].weight as number] : [c.startDate, c.startWeight];
  const actual = (data.logs[lastInPeriod].weight as number) - baseKg;
  const planned = (plannedWeight(c, lastInPeriod) ?? c.targetWeight) - (plannedWeight(c, baseDate) ?? c.startWeight);
  const detail = `${signed2(actual)}kg (계획 ${signed2(planned)}kg)`;
  if (Math.abs(planned) < 0.001) return { ...base, detail };
  const ratio = clamp(actual / planned);
  return { ...base, ratio, grade: gradeOf(ratio * 100), detail };
}

function bodySummary(data: AppData, dates: string[]): BodySummary {
  const logs = dates.map((d) => data.logs[d]).filter((l) => l != null);
  const weights = dates.map((d) => data.logs[d]?.weight).filter((w): w is number => w != null);
  const exerciseByDay = logs.map((l) => l.exercises.reduce((s, e) => s + e.minutes, 0));
  return {
    weightAvg: avg(weights),
    weightChange: weights.length >= 2 ? weights[weights.length - 1] - weights[0] : undefined,
    sleepAvg: avg(logs.map((l) => l.sleepHours).filter((v): v is number => v != null)),
    stepsAvg: avg(logs.map((l) => l.steps).filter((v) => v > 0)),
    exerciseMin: exerciseByDay.reduce((a, b) => a + b, 0),
    exerciseDays: exerciseByDay.filter((m) => m > 0).length,
  };
}

const OVERALL_COMMENT: Record<Grade, string> = {
  S: '훌륭해요! 거의 모든 루틴을 완벽하게 지켰어요. 🏆',
  A: '아주 잘하고 있어요. 지금 흐름을 그대로 이어가세요. 👍',
  B: '좋은 흐름이에요. 조금만 더 채우면 A 등급이에요.',
  C: '기본은 지켰지만 날마다 들쭉날쭉했어요.',
  D: '루틴이 많이 흔들렸어요. 한두 가지부터 다시 챙겨봐요.',
  F: '이번엔 쉬어갔네요. 식사 기록처럼 쉬운 것부터 다시 시작해요. 🌱',
};

function comments(r: Omit<PeriodReport, 'comments'>): string[] {
  if (r.score == null || !r.grade) return [];
  const unit = r.kind === 'week' ? '주' : '달';
  const out = [OVERALL_COMMENT[r.grade.grade]];

  const ranked = [...r.subjects].sort((a, b) => b.ratio - a.ratio);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  // 90% 이상인 과목이 여럿이면 최대 3개까지 함께 칭찬
  const excellent = ranked.filter((x) => x.ratio >= 0.9);
  if (excellent.length >= 2) {
    const names = excellent.slice(0, 3).map((x) => x.name).join(', ') + (excellent.length > 3 ? ' 등' : '');
    out.push(`${eunNeun(names)} 매우 우수합니다.`);
  } else if (best && best.ratio >= 0.8) {
    out.push(`${eunNeun(best.name)} 매우 우수합니다 (평균 ${Math.round(best.ratio * 100)}%).`);
  }
  if (worst && worst !== best && worst.ratio < 0.6) out.push(`${worst.name} 관리에 조금 더 노력이 필요해요 (평균 ${Math.round(worst.ratio * 100)}%).`);

  const absent = r.days.filter((d) => d.status === 'absent').length;
  if (absent > 0) out.push(`기록하지 않은 날이 ${absent}일 있어요. 하루 한 번은 앱을 열어 기록해 보세요.`);
  else if (r.counted.length >= 3) out.push('하루도 빠짐없이 기록했어요. 성실함 최고! ✨');

  if (r.prev) {
    const diff = round1(r.score - r.prev.score);
    if (diff >= 3) out.push(`${r.prevName}보다 ${diff}점 올랐어요. 👏`);
    else if (diff <= -3) out.push(`${r.prevName}보다 ${-diff}점 내려갔어요. 다음 ${unit}엔 다시 올려봐요!`);
  }

  const behind = r.goals.filter((g) => g.ratio != null && g.ratio < 0.5);
  const great = r.goals.filter((g) => g.ratio != null && g.ratio >= 0.9);
  if (great.length) out.push(`'${great[0].title}' 목표를 계획대로 착실히 진행하고 있어요.`);
  if (behind.length) out.push(`'${behind[0].title}' 목표가 계획보다 뒤처졌어요.`);
  return out;
}

export function periodReport(data: AppData, kind: PeriodKind, offset: number, today = todayKey()): PeriodReport {
  const dates = periodDates(kind, offset, today);
  const firstUse = firstUseDate(data);
  const { counted, provisional } = countedDays(dates, today, firstUse);
  const countedSet = new Set(counted);

  const days: DayGrade[] = dates.map((date) => {
    if (!countedSet.has(date)) return { date, status: firstUse && date < firstUse ? 'before' : 'future' };
    const s = dayScore(data, date);
    return s.hasRecord ? { date, status: 'scored', score: s.total, grade: gradeOf(s.total) } : { date, status: 'absent', score: 0 };
  });

  // 과목별 평균: 그 과목이 있었던 날 기준 (기록 없는 날은 0%)
  const acc = new Map<string, { label: string; color: string; sum: number; n: number }>();
  counted.forEach((d) =>
    dayScore(data, d).items.forEach((it) => {
      const a = acc.get(it.key) ?? { label: it.label, color: it.color, sum: 0, n: 0 };
      a.sum += it.ratio;
      a.n += 1;
      acc.set(it.key, a);
    }),
  );
  const subjects: SubjectRow[] = [...acc.entries()].map(([key, a]) => {
    const ratio = a.sum / a.n;
    return { key, label: a.label, name: a.label.split(' ').slice(1).join(' '), color: a.color, ratio, grade: gradeOf(ratio * 100) };
  });

  const goals = data.challenges.map((c) => goalRow(data, c, counted, today)).filter((g): g is GoalRow => g != null);
  const goalRatio = avg(goals.filter((g) => g.ratio != null).map((g) => g.ratio as number));

  const score = scoreOf(data, counted);
  const prevDates = periodDates(kind, offset + 1, today);
  const prevCounted = countedDays(prevDates, today, firstUse);
  const prevScore = prevCounted.provisional ? undefined : scoreOf(data, prevCounted.counted);

  const report: Omit<PeriodReport, 'comments'> = {
    kind,
    dates,
    counted,
    provisional,
    score,
    grade: score != null ? gradeOf(score) : undefined,
    recordedDays: days.filter((d) => d.status === 'scored').length,
    days,
    distribution: GRADES.map((g) => ({ grade: g, count: days.filter((d) => d.status === 'scored' && d.grade?.grade === g.grade).length })),
    subjects,
    goals,
    goalGrade: goalRatio != null ? gradeOf(goalRatio * 100) : undefined,
    body: bodySummary(data, dates.filter((d) => d <= today)),
    prev: prevScore != null ? { score: prevScore, grade: gradeOf(prevScore) } : undefined,
    prevName: kind === 'week' ? (offset === 0 ? '지난주' : '그 전 주') : offset === 0 ? '지난달' : '그 전 달',
  };
  return { ...report, comments: comments(report) };
}

/** 이전 날짜들은 결석이 아니라 "앱 사용 전"이라 점수에 넣지 않았다는 안내용 */
export function countedRangeLabel(r: PeriodReport): string {
  if (!r.counted.length) return '';
  const n = r.counted.length;
  if (r.provisional) return '오늘 하루 임시 집계 (자정이 지나면 확정)';
  const last = r.counted[n - 1];
  return `${n}일 집계${last === addDays(todayKey(), -1) ? ' · 어제까지' : ''}`;
}
