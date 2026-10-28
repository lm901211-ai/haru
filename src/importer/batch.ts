import { AppData, DayLog, Exercise } from '../types';
import { emptyLog } from '../logs';

/** 다른 앱에서 가져온 날짜별 기록 (YYYY-MM-DD → 값) */
export type ImportBatch = {
  steps: Record<string, number>;
  weight: Record<string, number>; // kg, 그날 첫 측정값
  sleep: Record<string, number>; // 시간, 깬 날짜 기준
  water: Record<string, number>; // 잔(250ml)
  exercise: Record<string, Exercise[]>; // id 는 IMPORTED_PREFIX 로 시작
};

export type ImportKind = keyof ImportBatch;
export type ImportMode = 'fill' | 'overwrite';

export const IMPORTED_PREFIX = 'imp:';
export const IMPORT_KINDS: { kind: ImportKind; label: string; unit: string }[] = [
  { kind: 'steps', label: '👟 걸음 수', unit: '일' },
  { kind: 'weight', label: '⚖️ 체중', unit: '일' },
  { kind: 'sleep', label: '😴 수면', unit: '일' },
  { kind: 'water', label: '💧 물', unit: '일' },
  { kind: 'exercise', label: '🏃 운동', unit: '일' },
];

export const emptyBatch = (): ImportBatch => ({ steps: {}, weight: {}, sleep: {}, water: {}, exercise: {} });

/** 여러 파일에서 나온 기록을 합침 (같은 날이 겹치면 걸음·물·수면은 큰 값, 체중은 먼저 것, 운동은 id 로 중복 제거) */
export function combineBatches(batches: ImportBatch[]): ImportBatch {
  const out = emptyBatch();
  for (const b of batches) {
    for (const k of ['steps', 'sleep', 'water'] as const) {
      Object.entries(b[k]).forEach(([d, v]) => (out[k][d] = Math.max(out[k][d] ?? 0, v)));
    }
    Object.entries(b.weight).forEach(([d, v]) => (out.weight[d] ??= v));
    Object.entries(b.exercise).forEach(([d, list]) => {
      const seen = new Set((out.exercise[d] ?? []).map((e) => e.id));
      out.exercise[d] = [...(out.exercise[d] ?? []), ...list.filter((e) => !seen.has(e.id))];
    });
  }
  return out;
}

export type KindSummary = { kind: ImportKind; label: string; days: number; from?: string; to?: string };

export function summarizeBatch(b: ImportBatch): KindSummary[] {
  return IMPORT_KINDS.map(({ kind, label }) => {
    const dates = Object.keys(b[kind]).sort();
    return { kind, label, days: dates.length, from: dates[0], to: dates[dates.length - 1] };
  });
}

export const batchIsEmpty = (b: ImportBatch) => summarizeBatch(b).every((s) => s.days === 0);

export type ImportResult = { data: AppData; changed: Record<ImportKind, number> };

/**
 * 가져온 기록을 앱 데이터에 반영.
 * - fill: 그날 이미 기록이 있으면 그대로 두고 빈 날만 채움
 * - overwrite: 가져온 값으로 바꿈
 * 운동은 직접 적은 운동이 있는 날엔 (fill 일 때) 손대지 않고, 전에 가져온 운동은 새로 가져온 것으로 교체한다.
 */
export function applyImport(data: AppData, b: ImportBatch, modes: Partial<Record<ImportKind, ImportMode>> | ImportMode): ImportResult {
  const modeOf = (k: ImportKind): ImportMode => (typeof modes === 'string' ? modes : (modes[k] ?? 'fill'));
  const logs = { ...data.logs };
  const changed: Record<ImportKind, number> = { steps: 0, weight: 0, sleep: 0, water: 0, exercise: 0 };
  const edit = (date: string, fn: (l: DayLog) => DayLog | null, kind: ImportKind) => {
    const before = logs[date] ?? emptyLog();
    const after = fn(before);
    if (after) {
      logs[date] = after;
      changed[kind]++;
    }
  };

  Object.entries(b.steps).forEach(([d, v]) =>
    edit(d, (l) => (v > 0 && l.steps !== v && (modeOf('steps') === 'overwrite' || !(l.steps > 0)) ? { ...l, steps: v } : null), 'steps'),
  );
  Object.entries(b.weight).forEach(([d, v]) =>
    edit(d, (l) => (l.weight !== v && (modeOf('weight') === 'overwrite' || l.weight == null) ? { ...l, weight: v } : null), 'weight'),
  );
  Object.entries(b.sleep).forEach(([d, v]) =>
    edit(d, (l) => (l.sleepHours !== v && (modeOf('sleep') === 'overwrite' || l.sleepHours == null) ? { ...l, sleepHours: v } : null), 'sleep'),
  );
  Object.entries(b.water).forEach(([d, v]) =>
    edit(d, (l) => (v > 0 && l.water !== v && (modeOf('water') === 'overwrite' || !(l.water > 0)) ? { ...l, water: v } : null), 'water'),
  );
  Object.entries(b.exercise).forEach(([d, list]) =>
    edit(
      d,
      (l) => {
        const manual = l.exercises.filter((e) => !e.id.startsWith(IMPORTED_PREFIX));
        if (manual.length && modeOf('exercise') === 'fill') return null;
        const next = [...manual, ...list];
        const same = next.length === l.exercises.length && next.every((e, i) => e.id === l.exercises[i]?.id && e.minutes === l.exercises[i]?.minutes);
        return same ? null : { ...l, exercises: next };
      },
      'exercise',
    ),
  );
  return { data: { ...data, logs }, changed };
}
