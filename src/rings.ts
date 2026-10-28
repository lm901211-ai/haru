import { AppData } from './types';
import { dayScore } from './score';

export type RingKey = 'activity' | 'health' | 'routine';

/** 애플/갤럭시 링처럼 하루를 3개 링으로 요약 (바깥 → 안쪽) */
export const RINGS: { key: RingKey; label: string; desc: string; color: string; items: string[] }[] = [
  { key: 'activity', label: '활동', desc: '운동 · 걸음', color: '#F43F5E', items: ['exercise', 'steps'] },
  { key: 'health', label: '건강', desc: '수면 · 식사', color: '#10B981', items: ['sleep', 'meals'] },
  { key: 'routine', label: '루틴', desc: '할 일 · 습관 · 목표', color: '#3B82F6', items: ['todo', 'habit', 'goal'] },
];

export type DayRings = Record<RingKey, number | undefined> & { hasRecord: boolean; score: number };

/** 링 값 = 그 링에 속한 점수 항목 달성률의 평균 (그날 해당 항목이 하나도 없으면 undefined) */
export function dayRings(data: AppData, date: string): DayRings {
  const s = dayScore(data, date);
  const ring = (items: string[]) => {
    const its = s.items.filter((i) => items.includes(i.key));
    return its.length ? its.reduce((a, i) => a + i.ratio, 0) / its.length : undefined;
  };
  return {
    activity: ring(RINGS[0].items),
    health: ring(RINGS[1].items),
    routine: ring(RINGS[2].items),
    hasRecord: s.hasRecord,
    score: s.total,
  };
}

export const ringClosed = (v: number | undefined) => v != null && v >= 1;

/** 날짜들 중 링별로 100%를 채운 날 수와, 있는 링을 모두 채운 날 수 */
export function ringSummary(data: AppData, dates: string[]) {
  const counts: Record<RingKey, number> = { activity: 0, health: 0, routine: 0 };
  let allClosed = 0;
  dates.forEach((d) => {
    const r = dayRings(data, d);
    if (!r.hasRecord) return;
    RINGS.forEach((x) => ringClosed(r[x.key]) && counts[x.key]++);
    const present = RINGS.filter((x) => r[x.key] != null);
    if (present.length && present.every((x) => ringClosed(r[x.key]))) allClosed++;
  });
  return { counts, allClosed };
}
