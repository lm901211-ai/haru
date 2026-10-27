const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function formatKey(key: string): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

export const weekdayOf = (key: string) => WEEKDAYS[fromKey(key).getDay()];

/** 오늘(또는 오늘 미완료 시 어제)부터 거꾸로 이어진 연속 달성 일수 */
export function streak(doneDates: string[], today: string): number {
  const set = new Set(doneDates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** b - a (일 수) */
export function dayDiff(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000);
}

/** 그 주의 월요일 */
export function startOfWeek(key: string): string {
  const day = fromKey(key).getDay(); // 0=일
  return addDays(key, -((day + 6) % 7));
}

export function startOfMonth(key: string): string {
  return key.slice(0, 8) + '01';
}

export function addMonths(key: string, n: number): string {
  const d = fromKey(startOfMonth(key));
  d.setMonth(d.getMonth() + n);
  return toKey(d);
}

export function daysInMonth(key: string): number {
  const d = fromKey(startOfMonth(key));
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** 10.27 형식 */
export function shortDate(key: string): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

/** offset주 전(0=이번 주)의 월~일 날짜 7개 */
export function weekDates(today: string, offset: number): string[] {
  const start = addDays(startOfWeek(today), -7 * offset);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** offset달 전(0=이번 달)의 1일~말일 날짜 */
export function monthDates(today: string, offset: number): string[] {
  const start = addMonths(today, -offset);
  return Array.from({ length: daysInMonth(start) }, (_, i) => addDays(start, i));
}
