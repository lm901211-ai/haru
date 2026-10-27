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
