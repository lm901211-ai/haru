import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppData, DayLog, Goals, Habit, Profile, Todo } from './types';
import { newId } from './date';

const STORAGE_KEY = 'daily-app/v1';

const defaultGoals: Goals = { waterCups: 8, steps: 8000, exerciseMin: 30, sleepHours: 7 };
const emptyData: AppData = { profile: {}, logs: {}, todos: [], habits: [], goals: defaultGoals };
export const emptyLog = (): DayLog => ({ water: 0, steps: 0, meals: [], exercises: [] });

type Store = {
  data: AppData;
  loaded: boolean;
  getLog: (date: string) => DayLog;
  updateLog: (date: string, fn: (log: DayLog) => DayLog) => void;
  setGoals: (goals: Goals) => void;
  setProfile: (profile: Profile) => void;
  addTodo: (title: string, date: string) => void;
  updateTodo: (id: string, patch: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  addHabit: (name: string, emoji: string) => void;
  toggleHabit: (id: string, date: string) => void;
  deleteHabit: (id: string) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loaded, setLoaded] = useState(false);
  const skipSave = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AppData>;
          setData({ ...emptyData, ...parsed, goals: { ...defaultGoals, ...parsed.goals } });
        }
      })
      .catch((e) => console.warn('데이터 불러오기 실패', e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    // 불러오기 직후의 첫 렌더는 저장할 필요가 없음
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((e) => console.warn('저장 실패', e));
  }, [data, loaded]);

  const getLog = useCallback((date: string) => data.logs[date] ?? emptyLog(), [data.logs]);

  const updateLog = useCallback((date: string, fn: (log: DayLog) => DayLog) => {
    setData((d) => ({ ...d, logs: { ...d.logs, [date]: fn(d.logs[date] ?? emptyLog()) } }));
  }, []);

  const setGoals = useCallback((goals: Goals) => setData((d) => ({ ...d, goals })), []);

  const setProfile = useCallback((profile: Profile) => setData((d) => ({ ...d, profile })), []);

  const addTodo = useCallback((title: string, date: string) => {
    const todo: Todo = { id: newId(), title, date, done: false, important: false };
    setData((d) => ({ ...d, todos: [...d.todos, todo] }));
  }, []);

  const updateTodo = useCallback((id: string, patch: Partial<Todo>) => {
    setData((d) => ({ ...d, todos: d.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setData((d) => ({ ...d, todos: d.todos.filter((t) => t.id !== id) }));
  }, []);

  const addHabit = useCallback((name: string, emoji: string) => {
    const habit: Habit = { id: newId(), name, emoji, doneDates: [] };
    setData((d) => ({ ...d, habits: [...d.habits, habit] }));
  }, []);

  const toggleHabit = useCallback((id: string, date: string) => {
    setData((d) => ({
      ...d,
      habits: d.habits.map((h) => {
        if (h.id !== id) return h;
        const has = h.doneDates.includes(date);
        return { ...h, doneDates: has ? h.doneDates.filter((x) => x !== date) : [...h.doneDates, date] };
      }),
    }));
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setData((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id) }));
  }, []);

  return (
    <StoreContext.Provider
      value={{ data, loaded, getLog, updateLog, setGoals, setProfile, addTodo, updateTodo, deleteTodo, addHabit, toggleHabit, deleteHabit }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
