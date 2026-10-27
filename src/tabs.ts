export type Tab = 'exercise' | 'diet' | 'body' | 'today' | 'goal' | 'todo' | 'habit';

// 홈을 가운데에 두고 왼쪽은 신체(운동·식단·체중), 오른쪽은 목표·루틴
export const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'exercise', label: '운동', icon: '🏃' },
  { key: 'diet', label: '식단', icon: '🍚' },
  { key: 'body', label: '체중', icon: '⚖️' },
  { key: 'today', label: '홈', icon: '🏠' },
  { key: 'goal', label: '목표', icon: '🎯' },
  { key: 'todo', label: '할 일', icon: '📝' },
  { key: 'habit', label: '습관', icon: '🔥' },
];
