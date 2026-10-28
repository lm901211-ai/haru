import { Exercise } from '../types';
import { toKey } from '../date';
import { emptyBatch, ImportBatch, IMPORTED_PREFIX } from './batch';

const round1 = (n: number) => Math.round(n * 10) / 10;

/* ---------------- CSV ---------------- */

/** 따옴표와 줄바꿈을 처리하는 간단한 CSV 파서 (빈 줄은 버림) */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/* ---------------- 날짜 ---------------- */

export type Stamp = { date: string; time: number }; // time: 같은 날 안에서 순서 비교용 (ms)

/** "UTC+0900", "+09:00" 같은 표기를 분 단위로 */
function offsetMinutes(raw?: string): number | undefined {
  const m = raw?.match(/([+-])(\d{2}):?(\d{2})/);
  if (!m) return undefined;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * 여러 앱의 날짜 표기를 그 지역 날짜로 바꿈.
 * - 숫자 13자리/10자리: epoch ms / s
 * - ISO(2024-01-02T07:30:00Z, +09:00)
 * - "2024-01-02 07:30:00" + offset("UTC+0900"): 삼성 헬스처럼 UTC 시각과 시간대가 따로 있는 경우
 * - 2024-01-02, 2024.01.02, 2024/1/2, 2024. 1. 2., 20240102, 2024년 1월 2일
 */
export function parseStamp(raw: string | undefined, offsetRaw?: string): Stamp | null {
  const s = raw?.trim();
  if (!s) return null;
  if (/^\d{13}$/.test(s) || /^\d{10}$/.test(s)) {
    const ms = Number(s) * (s.length === 10 ? 1000 : 1);
    return { date: toKey(new Date(ms)), time: ms };
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return { date: toKey(d), time: d.getTime() };
  }
  const m = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*[.일]?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?/) ?? s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [y, mo, d, h = '0', mi = '0', se = '0'] = m.slice(1).map((x) => x ?? '0');
  const off = offsetMinutes(offsetRaw);
  if (off != null) {
    // UTC 시각 + 시간대 → 그 지역 날짜
    const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
    const local = new Date(ms + off * 60000);
    const date = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
    return { date, time: ms };
  }
  const date = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return { date, time: Date.UTC(+y, +mo - 1, +d, +h, +mi, +se) };
}

/* ---------------- 공통 헬퍼 ---------------- */

/** 날짜별 첫 측정값 (체중) */
export class FirstOfDay {
  private best: Record<string, { time: number; value: number }> = {};
  add(st: Stamp, value: number) {
    const cur = this.best[st.date];
    if (!cur || st.time < cur.time) this.best[st.date] = { time: st.time, value };
  }
  result(): Record<string, number> {
    return Object.fromEntries(Object.entries(this.best).map(([d, v]) => [d, round1(v.value)]));
  }
}

/** 출처(기기)별 날짜 합계 → 날짜마다 가장 큰 출처 값 (폰+워치 중복 집계를 피함) */
export class MaxSourceSum {
  private sums: Record<string, Record<string, number>> = {};
  add(date: string, source: string, value: number) {
    const day = (this.sums[date] ??= {});
    day[source] = (day[source] ?? 0) + value;
  }
  result(round: (n: number) => number = Math.round): Record<string, number> {
    return Object.fromEntries(Object.entries(this.sums).map(([d, bySrc]) => [d, round(Math.max(...Object.values(bySrc)))]));
  }
}

const num = (v?: string) => {
  const n = parseFloat((v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

/* ---------------- 삼성 헬스 '개인 데이터 다운로드' CSV ---------------- */

/** 열 이름에서 com.samsung.health.weight.start_time 같은 접두어를 떼어냄 */
const shortHeader = (h: string) => h.trim().toLowerCase().split('.').pop() ?? '';

const SAMSUNG_EXERCISE: Record<string, string> = { '1001': '걷기', '1002': '달리기', '11007': '자전거' };

/** 삼성 헬스 하루 요약의 day_time: UTC 자정이면 그 UTC 날짜가 곧 그날 */
function dayStamp(raw: string): Stamp | null {
  const ms = Number(raw.trim());
  if (Number.isFinite(ms) && /^\d{13}$/.test(raw.trim()) && ms % 86400000 === 0) {
    return { date: new Date(ms).toISOString().slice(0, 10), time: ms };
  }
  return parseStamp(raw);
}

type Table = { header: string[]; rows: string[][] };

function toTable(rows: string[][]): Table | null {
  // 첫 줄이 "com.samsung.health.weight,6305003,8" 같은 메타데이터면 건너뜀
  const start = rows[0]?.[0]?.trim().startsWith('com.samsung') ? 1 : 0;
  if (rows.length <= start) return null;
  return { header: rows[start].map(shortHeader), rows: rows.slice(start + 1) };
}

const col = (t: Table, ...names: string[]) => {
  for (const n of names) {
    const i = t.header.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
};

export function isSamsungFile(name: string, text: string): boolean {
  return /com\.samsung/i.test(name) || text.trimStart().startsWith('com.samsung');
}

export function parseSamsungCsv(name: string, text: string): ImportBatch {
  const out = emptyBatch();
  const rows = parseCsv(text);
  const t = toTable(rows);
  if (!t) return out;
  // 파일 종류는 첫 줄의 "com.samsung.health.weight" 같은 이름으로 판단 (휴대폰에서 고른 파일은 이름이 안 남기도 함)
  const meta = rows[0]?.[0]?.trim() ?? '';
  const lower = `${meta.startsWith('com.samsung') ? meta : ''} ${name}`.toLowerCase();
  const iStart = col(t, 'start_time', 'create_time');
  const iOff = col(t, 'time_offset');
  const iDay = col(t, 'day_time');
  const stampOf = (r: string[]) => (iDay >= 0 && r[iDay] ? dayStamp(r[iDay]) : parseStamp(r[iStart], iOff >= 0 ? r[iOff] : undefined));

  if (/weight/.test(lower)) {
    const iW = col(t, 'weight');
    const first = new FirstOfDay();
    t.rows.forEach((r) => {
      const st = parseStamp(r[iStart], iOff >= 0 ? r[iOff] : undefined);
      const w = num(r[iW]);
      if (st && w && w > 0) first.add(st, w);
    });
    out.weight = first.result();
  } else if (/step_daily_trend|pedometer_day_summary|step_count|pedometer_step/.test(lower)) {
    const iCount = col(t, 'step_count', 'count');
    const iSrc = col(t, 'source_type', 'deviceuuid', 'pkg_name');
    const iType = col(t, 'source_type');
    // step_daily_trend 의 source_type -2 는 모든 기기를 합친 값 → 있으면 그 값만 씀
    const hasCombined = iType >= 0 && t.rows.some((r) => r[iType]?.trim() === '-2');
    const daily = /daily_trend|day_summary/.test(lower);
    const sums = new MaxSourceSum();
    t.rows.forEach((r) => {
      if (hasCombined && r[iType]?.trim() !== '-2') return;
      const st = stampOf(r);
      const c = num(r[iCount]);
      if (!st || c == null || c < 0) return;
      // 하루 요약 파일은 기기별 하루 값이므로 합치지 않고 기기 구분만 함
      sums.add(st.date, daily ? `${r[iSrc] ?? ''}#${st.time}` : (r[iSrc] ?? ''), c);
    });
    out.steps = sums.result();
  } else if (/shealth\.sleep\.|shealth\.sleep$|health\.sleep\./.test(lower) && !/stage|combined|goal|snoring/.test(lower)) {
    const iEnd = col(t, 'end_time');
    const sums = new MaxSourceSum();
    t.rows.forEach((r) => {
      const st = parseStamp(r[iStart], iOff >= 0 ? r[iOff] : undefined);
      const en = parseStamp(r[iEnd], iOff >= 0 ? r[iOff] : undefined);
      if (!st || !en || en.time <= st.time) return;
      const hours = (en.time - st.time) / 3600000;
      if (hours > 0 && hours < 24) sums.add(en.date, 'all', hours);
    });
    out.sleep = sums.result(round1);
  } else if (/shealth\.exercise\./.test(lower) && !/weather|routine|recovery|custom|periodization|max_heart/.test(lower)) {
    const iType = col(t, 'exercise_type');
    const iDur = col(t, 'duration');
    const iId = col(t, 'datauuid');
    t.rows.forEach((r, idx) => {
      const st = parseStamp(r[iStart], iOff >= 0 ? r[iOff] : undefined);
      const ms = num(r[iDur]);
      if (!st || !ms || ms <= 0) return;
      const minutes = Math.round(ms / 60000);
      if (minutes < 1) return;
      const ex: Exercise = { id: `${IMPORTED_PREFIX}sh:${r[iId] || `${st.time}-${idx}`}`, name: SAMSUNG_EXERCISE[r[iType]?.trim()] ?? '운동', minutes };
      (out.exercise[st.date] ??= []).push(ex);
    });
  }
  return out;
}

/* ---------------- 다른 앱에서 내보낸 일반 CSV (날짜 + 체중/걸음/수면 열) ---------------- */

const norm = (h: string) => h.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[\s_]/g, '');
const DATE_NAMES = ['date', '날짜', '일자', '측정일', '측정일시', '측정시간', '측정날짜', 'time', 'datetime', 'timestamp', '기록일', '기록일시', 'day', '일시'];
const WEIGHT_NAMES = ['weight', '체중', '몸무게', 'bodyweight', 'kg'];
const STEP_NAMES = ['steps', 'step', 'stepcount', '걸음', '걸음수'];
const SLEEP_NAMES = ['sleep', 'sleephours', '수면', '수면시간'];

export function parseGenericCsv(text: string): ImportBatch {
  const out = emptyBatch();
  const rows = parseCsv(text);
  // 머리글이 있는 줄 찾기 (앞쪽 몇 줄에 설명이 붙은 파일 대비)
  const hi = rows.slice(0, 5).findIndex((r) => r.some((c) => DATE_NAMES.includes(norm(c))));
  if (hi < 0) return out;
  const header = rows[hi].map(norm);
  const find = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iDate = find(DATE_NAMES);
  const iW = find(WEIGHT_NAMES);
  const iS = find(STEP_NAMES);
  const iSl = find(SLEEP_NAMES);
  const lb = iW >= 0 && /lb/i.test(rows[hi][iW]);
  const weights = new FirstOfDay();
  rows.slice(hi + 1).forEach((r) => {
    const st = parseStamp(r[iDate]);
    if (!st) return;
    const w = num(r[iW]);
    if (iW >= 0 && w && w > 0) weights.add(st, lb ? w * 0.45359237 : w);
    const s = num(r[iS]);
    if (iS >= 0 && s != null && s > 0) out.steps[st.date] = Math.max(out.steps[st.date] ?? 0, Math.round(s));
    const sl = num(r[iSl]);
    if (iSl >= 0 && sl && sl > 0 && sl < 24) out.sleep[st.date] = round1(sl);
  });
  out.weight = weights.result();
  return out;
}

/* ---------------- 애플 건강 '모든 건강 데이터 내보내기'의 export.xml ---------------- */

const APPLE_WORKOUTS: Record<string, string> = {
  Running: '달리기',
  Walking: '걷기',
  Cycling: '자전거',
  Swimming: '수영',
  Yoga: '요가',
  Hiking: '하이킹',
  Elliptical: '일립티컬',
  Rowing: '로잉',
  Pilates: '필라테스',
  Dance: '댄스',
  TraditionalStrengthTraining: '근력 운동',
  FunctionalStrengthTraining: '근력 운동',
  HighIntensityIntervalTraining: 'HIIT',
  CoreTraining: '코어 운동',
  MixedCardio: '유산소',
  StairClimbing: '계단 오르기',
  Tennis: '테니스',
  Badminton: '배드민턴',
  Golf: '골프',
  Soccer: '축구',
  Basketball: '농구',
};

const attrs = (line: string) => {
  const out: Record<string, string> = {};
  for (const m of line.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
};

/** "2024-01-02 07:30:00 +0900" → Date */
const appleDate = (s?: string) => {
  const m = s?.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);
  return m ? new Date(`${m[1]}T${m[2]}${m[3]}:${m[4]}`) : null;
};

/**
 * export.xml 은 수백 MB가 될 수 있어 줄 단위로 흘려가며 읽는다.
 * push(조각) 를 여러 번 부른 뒤 finish() 로 결과를 받는다.
 */
export class AppleHealthParser {
  private rest = '';
  private steps = new MaxSourceSum();
  private weights = new FirstOfDay();
  private sleep = new MaxSourceSum();
  private exercise: Record<string, Exercise[]> = {};
  records = 0;

  push(chunk: string) {
    const text = this.rest + chunk;
    const lines = text.split('\n');
    this.rest = lines.pop() ?? '';
    lines.forEach((l) => this.line(l));
  }

  private line(l: string) {
    if (l.includes('<Record ')) {
      const a = attrs(l);
      const start = appleDate(a.startDate);
      const end = appleDate(a.endDate);
      if (!start) return;
      const v = parseFloat(a.value);
      switch (a.type) {
        case 'HKQuantityTypeIdentifierStepCount':
          if (v > 0) this.steps.add(toKey(start), a.sourceName ?? '', v);
          break;
        case 'HKQuantityTypeIdentifierBodyMass':
          if (v > 0) this.weights.add({ date: toKey(start), time: start.getTime() }, a.unit === 'lb' ? v * 0.45359237 : v);
          break;
        case 'HKCategoryTypeIdentifierSleepAnalysis':
          if (end && /Asleep/.test(a.value ?? '')) this.sleep.add(toKey(end), a.sourceName ?? '', (end.getTime() - start.getTime()) / 3600000);
          break;
        default:
          return;
      }
      this.records++;
    } else if (l.includes('<Workout ')) {
      const a = attrs(l);
      const start = appleDate(a.startDate);
      const dur = parseFloat(a.duration);
      if (!start || !(dur > 0)) return;
      const minutes = Math.round(a.durationUnit === 'min' ? dur : a.durationUnit === 'h' ? dur * 60 : dur / 60);
      const kind = (a.workoutActivityType ?? '').replace('HKWorkoutActivityType', '');
      if (minutes >= 1) {
        (this.exercise[toKey(start)] ??= []).push({ id: `${IMPORTED_PREFIX}ah:${start.getTime()}`, name: APPLE_WORKOUTS[kind] ?? '운동', minutes });
        this.records++;
      }
    }
  }

  finish(): ImportBatch {
    if (this.rest) this.line(this.rest);
    this.rest = '';
    return {
      steps: this.steps.result(),
      weight: this.weights.result(),
      sleep: this.sleep.result(round1),
      exercise: this.exercise,
    };
  }
}

/* ---------------- 파일 종류 판별 ---------------- */

export type FileKind = 'samsung' | 'apple' | 'csv' | 'unknown';

export function fileKind(name: string, head: string): FileKind {
  if (/\.xml$/i.test(name) || head.includes('<HealthData')) return 'apple';
  if (isSamsungFile(name, head)) return 'samsung';
  if (/\.(csv|txt)$/i.test(name) || head.includes(',')) return 'csv';
  return 'unknown';
}

/** 텍스트 전체가 이미 있는 경우의 파싱 (CSV 류, 작은 XML) */
export function parseFileText(name: string, text: string): { kind: FileKind; batch: ImportBatch } {
  const kind = fileKind(name, text.slice(0, 2000));
  if (kind === 'samsung') return { kind, batch: parseSamsungCsv(name, text) };
  if (kind === 'csv') return { kind, batch: parseGenericCsv(text) };
  if (kind === 'apple') {
    const p = new AppleHealthParser();
    p.push(text);
    return { kind, batch: p.finish() };
  }
  return { kind, batch: emptyBatch() };
}
