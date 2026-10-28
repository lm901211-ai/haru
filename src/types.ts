export type MealType = '아침' | '점심' | '저녁' | '간식';

export type Meal = {
  id: string;
  type: MealType;
  text: string;
  kcal?: number;
  carbs?: number; // 탄수화물 g
  protein?: number; // 단백질 g
  fat?: number; // 지방 g
  photo?: string; // 사진 저장 위치 (photos/photoStore 참고)
  ai?: boolean; // 사진으로 AI가 추정한 값
};
export type Exercise = { id: string; name: string; minutes: number };

export type DayLog = {
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
  createdAt?: string; // 만든 날 (이전 날짜의 점수에는 포함하지 않음)
};

export type Goals = {
  steps: number;
  exerciseMin: number;
  sleepHours: number;
};

export type Profile = {
  heightCm?: number;
};

type ChallengeBase = {
  id: string;
  title: string;
  emoji: string;
  startDate: string;
  days: number; // 기간(일) — 매일 실천형은 목표 일수
};

export type WeightChallenge = ChallengeBase & { kind: 'weight'; startWeight: number; targetWeight: number };
export type StreakChallenge = ChallengeBase & { kind: 'streak'; mode: 'consecutive' | 'total'; doneDates: string[] };
export type AmountChallenge = ChallengeBase & { kind: 'amount'; unit: string; target: number; entries: Record<string, number> };
export type Challenge = WeightChallenge | StreakChallenge | AmountChallenge;

export type SyncSettings = {
  healthConnect?: boolean; // 앱을 열 때 헬스 커넥트에서 최근 기록 자동으로 가져오기
  lastSyncAt?: string; // ISO 시각
};

export type AppData = {
  profile: Profile;
  sync?: SyncSettings;
  logs: Record<string, DayLog>;
  todos: Todo[];
  habits: Habit[];
  goals: Goals;
  challenges: Challenge[];
};
