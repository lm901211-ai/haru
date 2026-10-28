import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings as openSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type { RecordResult, RecordType } from 'react-native-health-connect';
import { Exercise } from '../types';
import { addDays, fromKey, toKey } from '../date';
import { emptyBatch, ImportBatch, IMPORTED_PREFIX, ImportKind } from '../importer/batch';
import { FirstOfDay, MaxSourceSum } from '../importer/parse';
import type { HealthStatus } from './healthConnect';

export type { HealthStatus };

const RECORD_OF: Record<ImportKind, RecordType> = {
  steps: 'Steps',
  weight: 'Weight',
  sleep: 'SleepSession',
  exercise: 'ExerciseSession',
};
const KINDS = Object.keys(RECORD_OF) as ImportKind[];

// 헬스 커넥트 운동 종류 번호 → 이름
const EXERCISE_NAMES: Record<number, string> = {
  0: '운동',
  2: '배드민턴',
  5: '농구',
  8: '자전거',
  9: '실내 자전거',
  13: '맨몸 운동',
  16: '댄스',
  25: '일립티컬',
  32: '골프',
  36: 'HIIT',
  37: '하이킹',
  41: '줄넘기',
  48: '필라테스',
  54: '로잉머신',
  56: '달리기',
  57: '러닝머신',
  64: '축구',
  68: '계단 오르기',
  70: '근력 운동',
  71: '스트레칭',
  73: '수영',
  74: '수영',
  76: '테니스',
  79: '걷기',
  81: '웨이트',
  83: '요가',
};

let ready: Promise<boolean> | null = null;
function ensureReady(): Promise<boolean> {
  ready ??= initialize().catch(() => false);
  return ready.then((ok) => {
    if (!ok) ready = null; // 다음에 다시 시도
    return ok;
  });
}

export async function getHealthStatus(): Promise<HealthStatus> {
  try {
    const s = await getSdkStatus();
    if (s === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (s === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-update';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

const kindsFrom = (granted: { accessType: string; recordType: string }[]) =>
  KINDS.filter((k) => granted.some((g) => g.accessType === 'read' && g.recordType === RECORD_OF[k]));

/** 읽기 권한 요청 (과거 기록 읽기 권한 포함). 허락된 종류를 돌려줌 */
export async function requestHealthAccess(): Promise<ImportKind[]> {
  if (!(await ensureReady())) return [];
  const granted = await requestPermission([
    ...KINDS.map((k) => ({ accessType: 'read' as const, recordType: RECORD_OF[k] })),
    { accessType: 'read', recordType: 'ReadHealthDataHistory' },
  ]);
  return kindsFrom(granted);
}

export async function getGrantedKinds(): Promise<ImportKind[]> {
  if (!(await ensureReady())) return [];
  try {
    return kindsFrom(await getGrantedPermissions());
  } catch {
    return [];
  }
}

export function openHealthConnectSettings(): void {
  openSettings();
}

/** 그 날짜 0시(기기 시간대)를 ISO 문자열로 */
const midnightIso = (date: string) => fromKey(date).toISOString();

async function readAll<T extends RecordType>(type: T, from: string, to: string): Promise<RecordResult<T>[]> {
  const out: RecordResult<T>[] = [];
  let pageToken: string | undefined;
  do {
    const res = await readRecords(type, {
      timeRangeFilter: { operator: 'between', startTime: midnightIso(from), endTime: midnightIso(addDays(to, 1)) },
      pageSize: 1000,
      pageToken,
    });
    out.push(...res.records);
    pageToken = res.pageToken || undefined;
  } while (pageToken);
  return out;
}

/** from~to(포함) 기간의 기록을 헬스 커넥트에서 읽어 날짜별로 정리 */
export async function readHealthBatch(from: string, to: string, kinds: ImportKind[] = KINDS): Promise<ImportBatch> {
  const out = emptyBatch();
  if (!(await ensureReady())) return out;
  const want = new Set(kinds);
  // 권한이 없는 종류는 읽을 때 오류가 나므로 종류마다 따로 처리
  const safe = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch {
      // 해당 종류는 건너뜀
    }
  };

  if (want.has('steps')) {
    await safe(async () => {
      // 헬스 커넥트가 폰·워치 등 여러 앱의 걸음 수를 중복 없이 합쳐 줌. 긴 기간은 90일씩 나눠 요청
      for (let start = from; start <= to; start = addDays(start, 90)) {
        const end = addDays(start, 89) < to ? addDays(start, 89) : to;
        const days = await aggregateGroupByPeriod({
          recordType: 'Steps',
          timeRangeFilter: { operator: 'between', startTime: midnightIso(start), endTime: midnightIso(addDays(end, 1)) },
          timeRangeSlicer: { period: 'DAYS', length: 1 },
        });
        days.forEach((d) => {
          const count = Math.round(d.result.COUNT_TOTAL ?? 0);
          if (count > 0) out.steps[d.startTime.slice(0, 10)] = count;
        });
      }
    });
  }
  if (want.has('weight')) {
    await safe(async () => {
      const first = new FirstOfDay();
      (await readAll('Weight', from, to)).forEach((r) => {
        const t = new Date(r.time);
        if (r.weight.inKilograms > 0) first.add({ date: toKey(t), time: t.getTime() }, r.weight.inKilograms);
      });
      out.weight = first.result();
    });
  }
  if (want.has('sleep')) {
    await safe(async () => {
      const sums = new MaxSourceSum();
      (await readAll('SleepSession', from, to)).forEach((r) => {
        const start = new Date(r.startTime);
        const end = new Date(r.endTime);
        const hours = (end.getTime() - start.getTime()) / 3600000;
        if (hours > 0 && hours < 24) sums.add(toKey(end), r.metadata?.dataOrigin ?? '', hours);
      });
      out.sleep = sums.result((n) => Math.round(n * 10) / 10);
    });
  }
  if (want.has('exercise')) {
    await safe(async () => {
      (await readAll('ExerciseSession', from, to)).forEach((r, i) => {
        const start = new Date(r.startTime);
        const minutes = Math.round((new Date(r.endTime).getTime() - start.getTime()) / 60000);
        if (minutes < 1) return;
        const ex: Exercise = {
          id: `${IMPORTED_PREFIX}hc:${r.metadata?.id ?? `${start.getTime()}-${i}`}`,
          name: r.title?.trim() || EXERCISE_NAMES[r.exerciseType] || '운동',
          minutes,
        };
        (out.exercise[toKey(start)] ??= []).push(ex);
      });
    });
  }
  return out;
}
