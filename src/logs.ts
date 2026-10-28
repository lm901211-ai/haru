import { DayLog } from './types';

export const emptyLog = (): DayLog => ({ water: 0, steps: 0, meals: [], exercises: [] });
