import { AppData, Challenge, StreakChallenge, WeightChallenge } from './types';
import { addDays, dayDiff, streak } from './date';

export type Progress = {
  ratio: number; // 0~1 달성도
  expected?: number; // 기간 대비 지금쯤 와 있어야 할 달성도
  status: 'done' | 'ahead' | 'behind' | 'none';
  dayLabel: string;
  term: '단기' | '장기';
  details: string[];
};

const clamp = (n: number) => Math.max(0, Math.min(n, 1));
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const signed = (n: number) => (n > 0 ? `+${round1(n)}` : `${round1(n)}`);

export const termOf = (days: number) => (days <= 30 ? '단기' : '장기');

/** 기간형 목표의 경과 정보 */
function period(c: Challenge, today: string) {
  const elapsed = Math.max(0, Math.min(dayDiff(c.startDate, today) + 1, c.days));
  const left = c.days - elapsed;
  const ended = dayDiff(c.startDate, today) + 1 > c.days;
  return { elapsed, expected: elapsed / c.days, dayLabel: ended ? '기간 종료' : `${elapsed}일째 · D-${left}` };
}

function statusOf(ratio: number, expected?: number): Progress['status'] {
  if (ratio >= 1) return 'done';
  if (expected == null) return 'none';
  return ratio >= expected - 0.02 ? 'ahead' : 'behind';
}

/** 시작일 이후 체중 기록 [날짜, kg] (날짜순) */
function weightRecords(data: AppData, from: string): [string, number][] {
  return Object.keys(data.logs)
    .filter((d) => d >= from && data.logs[d].weight != null)
    .sort()
    .map((d) => [d, data.logs[d].weight as number]);
}

export function currentWeight(data: AppData, c: WeightChallenge): number {
  const recs = weightRecords(data, c.startDate);
  return recs.length ? recs[recs.length - 1][1] : c.startWeight;
}

function weightProgress(data: AppData, c: WeightChallenge, today: string): Progress {
  const p = period(c, today);
  const total = c.targetWeight - c.startWeight; // 감량이면 음수
  const lose = total < 0;
  const current = currentWeight(data, c);
  const ratio = total === 0 ? 1 : clamp((current - c.startWeight) / total);
  const weekly = Math.abs(total) / (c.days / 7);

  const details = [
    `시작 ${c.startWeight}kg → 목표 ${c.targetWeight}kg · 현재 ${current}kg`,
    `주당 목표: ${round2(weekly)}kg ${lose ? '감량' : '증량'}`,
  ];

  // 최근 1주 변화: 마지막 기록과 그 7일 전(또는 그 이전) 기록 비교
  const recs = weightRecords(data, addDays(c.startDate, -7));
  if (recs.length >= 2) {
    const [lastDate, lastKg] = recs[recs.length - 1];
    const before = [...recs].reverse().find(([d]) => d <= addDays(lastDate, -7)) ?? recs[0];
    const change = lastKg - before[1];
    const ok = lose ? change <= -weekly : change >= weekly;
    details.push(`최근 ${Math.max(dayDiff(before[0], lastDate), 1)}일 변화: ${signed(change)}kg ${ok ? '✅ 목표 페이스' : '⚠️ 목표보다 느려요'}`);
  }

  const remain = c.targetWeight - current;
  const weeksLeft = (c.days - p.elapsed) / 7;
  if (ratio < 1 && weeksLeft > 0) {
    details.push(`남은 ${round1(Math.abs(remain))}kg · 앞으로 주당 ${round2(Math.abs(remain) / weeksLeft)}kg 필요`);
  }
  return { ratio, expected: p.expected, status: statusOf(ratio, p.expected), dayLabel: p.dayLabel, term: termOf(c.days), details };
}

function bestStreak(dates: string[]): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((d, i) => {
    run = i > 0 && dayDiff(sorted[i - 1], d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

function streakProgress(c: StreakChallenge, today: string): Progress {
  const dates = c.doneDates.filter((d) => d >= c.startDate);
  const doneToday = dates.includes(today);
  const best = bestStreak(dates);
  const term = termOf(c.days);

  if (c.mode === 'consecutive') {
    const cur = streak(dates, today);
    const ratio = clamp(cur / c.days);
    const details = [`연속 ${cur}일 / 목표 ${c.days}일 · 최고 기록 ${best}일`];
    if (ratio < 1) {
      if (cur === 0 && best > 0) details.push('연속 기록이 끊겼어요. 오늘부터 다시 시작해요! 💪');
      else details.push(doneToday ? `✅ 오늘 완료 · ${c.days - cur}일 남았어요` : '⏳ 오늘 아직 안 했어요');
    }
    return { ratio, status: ratio >= 1 ? 'done' : 'none', dayLabel: `${cur}일 연속`, term, details };
  }

  const ratio = clamp(dates.length / c.days);
  const sinceStart = Math.max(dayDiff(c.startDate, today) + 1, 0);
  return {
    ratio,
    status: ratio >= 1 ? 'done' : 'none',
    dayLabel: `누적 ${dates.length}일`,
    term,
    details: [
      `누적 ${dates.length}일 / 목표 ${c.days}일 · 최고 연속 ${best}일`,
      `시작 후 ${sinceStart}일 중 ${dates.length}일 실천` + (doneToday ? ' · ✅ 오늘 완료' : ''),
    ],
  };
}

export function challengeProgress(data: AppData, c: Challenge, today: string): Progress {
  if (c.kind === 'weight') return weightProgress(data, c, today);
  if (c.kind === 'streak') return streakProgress(c, today);

  const p = period(c, today);
  const sum = Object.entries(c.entries)
    .filter(([d]) => d >= c.startDate)
    .reduce((s, [, v]) => s + v, 0);
  const ratio = clamp(sum / c.target);
  const details = [`${round1(sum)} / ${c.target}${c.unit}`];
  const daysLeft = c.days - p.elapsed;
  if (ratio < 1) {
    details.push(`지금쯤 ${round1(c.target * p.expected)}${c.unit} 정도면 순조로워요`);
    if (daysLeft > 0) {
      const perDay = (c.target - sum) / daysLeft;
      // 하루 분량이 1 미만이면 주/월 단위로 보여줌 (예: 책 → 한 달에 0.8권)
      const pace =
        perDay >= 1 ? `하루 ${round1(perDay)}` : perDay * 7 >= 1 ? `일주일에 ${round1(perDay * 7)}` : `한 달에 ${round1(perDay * 30)}`;
      details.push(`남은 ${daysLeft}일 동안 ${pace}${c.unit}씩`);
    }
  }
  if (c.entries[today]) details.push(`오늘 +${c.entries[today]}${c.unit}`);
  return { ratio, expected: p.expected, status: statusOf(ratio, p.expected), dayLabel: p.dayLabel, term: termOf(c.days), details };
}

export const STATUS_TEXT: Record<Progress['status'], string> = {
  done: '🎉 달성!',
  ahead: '순항 중',
  behind: '조금 뒤처졌어요',
  none: '',
};
