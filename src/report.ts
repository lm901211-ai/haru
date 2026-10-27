import { AppData } from './types';

export type ActivityRow = { icon: string; label: string; text: string };

const join = (xs: string[]) => xs.join(' · ');

/** 그날 실제로 한 일을 항목별 한 줄로 정리 (기록이 없는 항목은 생략) */
export function dayActivities(data: AppData, date: string): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const log = data.logs[date];

  if (log?.exercises.length) {
    const total = log.exercises.reduce((s, e) => s + e.minutes, 0);
    rows.push({ icon: '🏃', label: '운동', text: `${join(log.exercises.map((e) => `${e.name} ${e.minutes}분`))}${log.exercises.length > 1 ? ` (총 ${total}분)` : ''}` });
  }
  if (log?.meals.length) {
    const kcal = log.meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
    rows.push({ icon: '🍚', label: '식사', text: `${join(log.meals.map((m) => `${m.type} ${m.text}`))}${kcal ? ` (${kcal.toLocaleString()}kcal)` : ''}` });
  }
  const body: string[] = [];
  if (log?.water) body.push(`물 ${log.water}잔`);
  if (log?.steps) body.push(`${log.steps.toLocaleString()}보`);
  if (log?.sleepHours != null) body.push(`수면 ${log.sleepHours}시간`);
  if (log?.weight != null) body.push(`체중 ${log.weight}kg`);
  if (body.length) rows.push({ icon: '📏', label: '기록', text: join(body) });

  const todos = data.todos.filter((t) => t.date === date);
  if (todos.length) {
    const done = todos.filter((t) => t.done);
    rows.push({
      icon: '📝',
      label: '할 일',
      text: `${done.length}/${todos.length} 완료${done.length ? ` — ${join(done.map((t) => t.title))}` : ''}`,
    });
  }
  const habits = data.habits.filter((h) => h.doneDates.includes(date));
  if (habits.length) rows.push({ icon: '🔥', label: '습관', text: join(habits.map((h) => `${h.emoji} ${h.name}`)) });

  const goals: string[] = [];
  data.challenges.forEach((c) => {
    if (c.kind === 'streak' && c.doneDates.includes(date)) goals.push(`${c.emoji} ${c.title} ✓`);
    if (c.kind === 'amount' && c.entries[date]) goals.push(`${c.emoji} ${c.title} +${c.entries[date]}${c.unit}`);
  });
  if (goals.length) rows.push({ icon: '🎯', label: '목표', text: join(goals) });
  return rows;
}
