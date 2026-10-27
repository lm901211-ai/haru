import { AppData } from './types';
import { colors } from './theme';

export type ScoreItem = { key: string; label: string; ratio: number; weight: number; color: string };
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

  const items: ScoreItem[] = [
    { key: 'water', label: '💧 물', ratio: clamp((log?.water ?? 0) / g.waterCups), weight: 15, color: colors.water },
    { key: 'steps', label: '👟 걸음', ratio: clamp((log?.steps ?? 0) / g.steps), weight: 15, color: colors.steps },
    { key: 'exercise', label: '🏃 운동', ratio: clamp(exerciseMin / g.exerciseMin), weight: 20, color: colors.exercise },
    { key: 'sleep', label: '😴 수면', ratio: clamp((log?.sleepHours ?? 0) / g.sleepHours), weight: 15, color: colors.sleep },
    { key: 'meals', label: '🍚 식사', ratio: mealsDone / MAIN_MEALS.length, weight: 10, color: colors.star },
  ];
  if (todos.length > 0) {
    items.push({ key: 'todo', label: '📝 할 일', ratio: todos.filter((t) => t.done).length / todos.length, weight: 10, color: colors.primary });
  }
  if (data.habits.length > 0) {
    items.push({ key: 'habit', label: '🔥 습관', ratio: habitsDone / data.habits.length, weight: 15, color: colors.danger });
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
