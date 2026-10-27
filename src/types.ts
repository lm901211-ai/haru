export type MealType = '아침' | '점심' | '저녁' | '간식';

export type Meal = { id: string; type: MealType; text: string; kcal?: number };
export type Exercise = { id: string; name: string; minutes: number };

export type DayLog = {
  water: number; // 잔 수 (1잔 = 250ml)
  steps: number;
  sleepHours?: number;
  weight?: number;
  meals: Meal[];
  exercises: Exercise[];
};

export type Todo = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  done: boolean;
  important: boolean;
};

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  doneDates: string[];
};

export type Goals = {
  waterCups: number;
  steps: number;
  exerciseMin: number;
  sleepHours: number;
};

export type Profile = {
  heightCm?: number;
};

export type AppData = {
  profile: Profile;
  logs: Record<string, DayLog>;
  todos: Todo[];
  habits: Habit[];
  goals: Goals;
};
