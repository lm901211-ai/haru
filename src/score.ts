import { AppData } from './types';
import { colors } from './theme';
import { addDays } from './date';

export type ScoreItem = { key: string; label: string; ratio: number; weight: number; color: string; valueText: string };
export type DayScore = { total: number; items: ScoreItem[]; hasRecord: boolean };

const clamp = (n: number) => Math.max(0, Math.min(n, 1));
const MAIN_MEALS = ['아침', '점심', '저녁'];

/**
 * 하루 점수 (100점 만점). 항목별 달성률 × 가중치로 계산하고,
 * 할 일/습관이 하나도 없는 날은 그 항목을 빼고 나머지로 100점 환산한다.
 */
export function dayScore(data: AppData, date: string): DayScore {
  const g = data.goals;
  const log = data.logs[date];
  const todos = data.todos.filter((t) => t.date === date);
  const habitsDone = data.habits.filter((h) => h.doneDates.includes(date)).length;

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
  if (data.habits.length > 0) {
    items.push({ key: 'habit', label: '🔥 습관', ratio: habitsDone / data.habits.length, weight: 15, color: colors.danger, valueText: `${habitsDone}/${data.habits.length}개` });
  }

  const weightSum = items.reduce((s, i) => s + i.weight, 0);
  const total = Math.round((items.reduce((s, i) => s + i.ratio * i.weight, 0) / weightSum) * 100);
  const hasRecord = !!log || todos.some((t) => t.done) || habitsDone > 0;
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
  sigma: number;
  ucl: number;
  lcl: number;
  cpk: number | null; // 하한 규격만 있는 공정능력지수 (μ - LSL) / 3σ
  outOfControl: number;
  belowLsl: number;
};

/** 오늘을 제외한 최근 days일 점수로 관리도 통계 계산 (기록 없는 날은 제외) */
export function controlStats(data: AppData, today: string, days = 14): ControlStats {
  const points = Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days);
    const s = dayScore(data, date);
    return { date, value: s.hasRecord ? s.total : undefined };
  });
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  const n = vals.length;
  const mean = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
  const sigma = n >= 2 ? Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0;
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
    outOfControl: vals.filter((v) => v > ucl || v < lcl).length,
    belowLsl: vals.filter((v) => v < SCORE_LSL).length,
  };
}

export function cpkVerdict(cpk: number | null, mean: number): { text: string; color: string } {
  if (cpk == null) return { text: mean > 0 ? '데이터를 더 모으는 중' : '기록이 쌓이면 보여드려요', color: colors.sub };
  if (cpk >= 1.33) return { text: '매우 안정적인 루틴', color: colors.steps };
  if (cpk >= 1.0) return { text: '안정적인 루틴', color: colors.primary };
  if (cpk >= 0.67) return { text: '들쭉날쭉해요', color: colors.exercise };
  return { text: '개선이 필요해요', color: colors.danger };
}
