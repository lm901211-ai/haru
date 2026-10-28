import { Meal } from './types';

export type MacroKey = 'carbs' | 'protein' | 'fat';
export type Totals = { kcal: number; carbs: number; protein: number; fat: number };

/** 탄·단·지 (g 당 열량: 4 / 4 / 9 kcal) */
export const MACROS: { k: MacroKey; label: string; short: string; color: string; kcalPerG: number }[] = [
  { k: 'carbs', label: '탄수화물', short: '탄', color: '#F5A524', kcalPerG: 4 },
  { k: 'protein', label: '단백질', short: '단', color: '#E5484D', kcalPerG: 4 },
  { k: 'fat', label: '지방', short: '지', color: '#4F7CFF', kcalPerG: 9 },
];

/** 한국인 영양소 섭취기준(2020) 성인 에너지적정비율 (%) */
export const MACRO_RANGE: Record<MacroKey, [number, number]> = { carbs: [55, 65], protein: [7, 20], fat: [15, 30] };

export function mealTotals(meals: Meal[]): Totals {
  return meals.reduce(
    (t, m) => ({ kcal: t.kcal + (m.kcal ?? 0), carbs: t.carbs + (m.carbs ?? 0), protein: t.protein + (m.protein ?? 0), fat: t.fat + (m.fat ?? 0) }),
    { kcal: 0, carbs: 0, protein: 0, fat: 0 },
  );
}

export const hasMacros = (t: Pick<Totals, MacroKey>) => t.carbs + t.protein + t.fat > 0;

/** 탄·단·지가 열량에서 차지하는 비율 (0~1, 합 1). 값이 없으면 null */
export function macroShares(t: Pick<Totals, MacroKey>): Record<MacroKey, number> | null {
  const kcal = MACROS.map((m) => t[m.k] * m.kcalPerG);
  const sum = kcal.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  return { carbs: kcal[0] / sum, protein: kcal[1] / sum, fat: kcal[2] / sum };
}

/** "탄 65g · 단 30g · 지 12g" (값이 있는 것만) */
export function macroText(t: Partial<Pick<Totals, MacroKey>>): string {
  return MACROS.filter((m) => t[m.k] != null && (t[m.k] as number) > 0)
    .map((m) => `${m.short} ${Math.round(t[m.k] as number)}g`)
    .join(' · ');
}

/** 시간대에 맞는 식사 종류 (기본 선택값) */
export function mealTypeForHour(h: number): Meal['type'] {
  if (h >= 5 && h < 11) return '아침';
  if (h >= 11 && h < 16) return '점심';
  if (h >= 16 && h < 22) return '저녁';
  return '간식';
}
