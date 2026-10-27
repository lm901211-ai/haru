export type Tab = 'today' | 'health' | 'goal' | 'todo' | 'habit';

export const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'today', label: '오늘', icon: '🏠' },
  { key: 'health', label: '건강', icon: '❤️' },
  { key: 'goal', label: '목표', icon: '🎯' },
  { key: 'todo', label: '할 일', icon: '📝' },
  { key: 'habit', label: '습관', icon: '🔥' },
];
