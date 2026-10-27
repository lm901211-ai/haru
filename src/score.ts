import { AppData, DayLog, StreakChallenge } from './types';
import { colors } from './theme';
import { addDays } from './date';

export type ScoreItem = { key: string; label: string; ratio: number; weight: number; color: string; valueText: string };
export type DayScore = { total: number; items: ScoreItem[]; hasRecord: boolean };

const clamp = (n: number) => Math.max(0, Math.min(n, 1));
const MAIN_MEALS = ['아침', '점심', '저녁'];

/** 실제로 뭔가 기록된 날인지 (빈 기록은 제외) */
export function logHasData(log: DayLog | undefined): boolean {
  if (!log) return false;
  return log.water > 0 || log.steps > 0 || log.sleepHours != null || log.weight != null || log.meals.length > 0 || log.exercises.length > 0;
}

/** 그날 진행 중이던 매일 실천 목표인지 (시작 전이거나 이미 달성한 목표는 제외) */
export function streakActiveOn(c: StreakChallenge, date: string): boolean {
  if (date < c.startDate) return false;
  const before = new Set(c.doneDates.filter((d) => d >= c.startDate && d < date));
  if (c.mode === 'total') return before.size < c.days;
  let run = 0;
  for (let d = addDays(date, -1); before.has(d); d = addDays(d, -1)) run++;
  return run < c.days;
}

/**
 * 하루 점수 (100점 만점). 항목별 달성률 × 가중치로 계산하고,
 * 할 일/습관/매일 실천 목표가 없는 날은 그 항목을 빼고 나머지로 100점 환산한다.
 */
export function dayScore(data: AppData, date: string): DayScore {
  const g = data.goals;
  const log = data.logs[date];
  const todos = data.todos.filter((t) => t.date === date);
  // 그날 이후에 만든 습관은 그날 점수에 넣지 않음
  const habits = data.habits.filter((h) => !h.createdAt || h.createdAt <= date);
  const habitsDone = habits.filter((h) => h.doneDates.includes(date)).length;
  const streaks = data.challenges.filter((c): c is StreakChallenge => c.kind === 'streak' && streakActiveOn(c, date));
  const streaksDone = streaks.filter((c) => c.doneDates.includes(date)).length;

  const exerciseMin = log?.exercises.reduce((s, e) => s + e.minutes, 0) ?? 0;
  const mealsDone = new Set(log?.meals.map((m) => m.type).filter((t) => MAIN_MEALS.includes(t))).size;

  const water = log?.water ?? 0;
  const steps = log?.steps ?? 0;
  const sleep = log?.sleepHours ?? 0;
  const todosDone = todos.filter((t) => t.done).length;

  const items: ScoreItem[] = [
    { key: 'water', label: '💧 물', ratio: clamp(water / g.waterCups), weight: 15, color: colors.water, valueText: `${water}/${g.waterCups}잔` },
    { key: 'steps', label: '👟 걸음', ratio: clamp(steps / g.steps), weight: 15, color: colors.steps, valueText: `${steps.toLocaleString()}보` },
    { key: 'exercise', label: '🏃 운동', ratio: clamp(exerciseMin / g.exerciseMin), weight: 20, color: colors.exercise, valueText: `${exerciseMin}/${g.exerciseMin}분` },
    { key: 'sleep', label: '😴 수면', ratio: clamp(sleep / g.sleepHours), weight: 15, color: colors.sleep, valueText: `${sleep}/${g.sleepHours}시간` },
    { key: 'meals', label: '🍚 식사', ratio: mealsDone / MAIN_MEALS.length, weight: 10, color: colors.star, valueText: `${mealsDone}/3끼` },
  ];
  if (todos.length > 0) {
    items.push({ key: 'todo', label: '📝 할 일', ratio: todosDone / todos.length, weight: 10, color: colors.primary, valueText: `${todosDone}/${todos.length}개` });
  }
  if (habits.length > 0) {
    items.push({ key: 'habit', label: '🔥 습관', ratio: habitsDone / habits.length, weight: 15, color: colors.danger, valueText: `${habitsDone}/${habits.length}개` });
  }
  if (streaks.length > 0) {
    items.push({ key: 'goal', label: '🎯 목표', ratio: streaksDone / streaks.length, weight: 15, color: colors.sleep, valueText: `${streaksDone}/${streaks.length}개` });
  }

  const weightSum = items.reduce((s, i) => s + i.weight, 0);
  const total = Math.round((items.reduce((s, i) => s + i.ratio * i.weight, 0) / weightSum) * 100);
  const hasRecord = logHasData(log) || todos.some((t) => t.done) || habitsDone > 0 || streaksDone > 0;
  return { total, items, hasRecord };
}

export function scoreComment(score: number): string {
  if (score >= 90) return '최고의 하루예요 🏆';
  if (score >= 70) return '잘하고 있어요 👍';
  if (score >= 50) return '조금만 더 힘내요 💪';
  return '하나씩 채워봐요 🌱';
}

export function bmiInfo(weight: number, heightCm: number): { bmi: number; label: string; color: string } {
  const bmi = weight / (heightCm / 100) ** 2;
  // 대한비만학회 기준
  if (bmi < 18.5) return { bmi, label: '저체중', color: colors.water };
  if (bmi < 23) return { bmi, label: '정상', color: colors.steps };
  if (bmi < 25) return { bmi, label: '비만 전 단계', color: colors.star };
  return { bmi, label: '비만', color: colors.danger };
}

/** 점수 하한 규격(LSL): 이 점수 이상이면 "괜찮은 하루" */
export const SCORE_LSL = 70;

export type ControlStats = {
  points: { date: string; value?: number }[];
  n: number;
  mean: number;
  sigma: number; // 이동범위 평균(MR̄) ÷ 1.128 로 추정한 단기 표준편차
  ucl: number;
  lcl: number;
  cpk: number | null; // 하한 규격만 있는 공정능력지수 (X̄ − LSL) ÷ 3σ
  outOfControl: number;
  belowLsl: number;
};

const D2 = 1.128; // 이동범위(n=2)의 d2 상수

/** 오늘을 제외한 최근 days일 점수로 개별값-이동범위(I-MR) 관리도 통계 계산. 기록 없는 날은 제외 */
export function controlStats(data: AppData, today: string, days = 14): ControlStats {
  const points = Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days);
    const s = dayScore(data, date);
    return { date, value: s.hasRecord ? s.total : undefined };
  });
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  const n = vals.length;
  const mean = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
  const mrs = vals.slice(1).map((v, i) => Math.abs(v - vals[i]));
  const sigma = mrs.length ? mrs.reduce((a, b) => a + b, 0) / mrs.length / D2 : 0;
  const ucl = Math.min(100, mean + 3 * sigma);
  const lcl = Math.max(0, mean - 3 * sigma);
  const cpk = n >= 3 && sigma > 0 ? (mean - SCORE_LSL) / (3 * sigma) : null;
  return {
    points,
    n,
    mean,
    sigma,
    ucl,
    lcl,
    cpk,
    outOfControl: n >= 3 ? vals.filter((v) => v > ucl || v < lcl).length : 0,
    belowLsl: vals.filter((v) => v < SCORE_LSL).length,
  };
}

export function cpkVerdict(st: ControlStats): { text: string; color: string } {
  if (st.n < 3) return { text: st.n ? '3일 이상 기록되면 판정해요' : '기록이 쌓이면 보여드려요', color: colors.sub };
  if (st.cpk == null) {
    // 점수 변동이 전혀 없는 경우
    return st.mean >= SCORE_LSL ? { text: '매우 안정적인 루틴', color: colors.steps } : { text: '꾸준하지만 목표 미달이에요', color: colors.danger };
  }
  if (st.cpk >= 1.33) return { text: '매우 안정적인 루틴', color: colors.steps };
  if (st.cpk >= 1.0) return { text: '안정적인 루틴', color: colors.primary };
  if (st.cpk >= 0.67) return { text: '들쭉날쭉해요', color: colors.exercise };
  return { text: '개선이 필요해요', color: colors.danger };
}
