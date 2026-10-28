import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadApiKey, storeApiKey } from './apiKey';

export type AiModelId = 'claude-opus-5-5' | 'claude-haiku-5-5';

export const AI_MODELS: { id: AiModelId; label: string; desc: string }[] = [
  { id: 'claude-opus-5-5', label: '정확하게', desc: 'Claude Opus 5.5 · 사진 1장 약 30~70원' },
  { id: 'claude-haiku-5-5', label: '저렴하게', desc: 'Claude Haiku 5.5 · 사진 1장 약 1~3원' },
];
export const DEFAULT_MODEL: AiModelId = 'claude-opus-5-5';

const MODEL_KEY = 'daily-app/ai-model';

export type AiSettings = { loaded: boolean; apiKey: string | null; model: AiModelId };

let state: AiSettings = { loaded: false, apiKey: null, model: DEFAULT_MODEL };
const listeners = new Set<() => void>();
const update = (patch: Partial<AiSettings>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let loading: Promise<void> | null = null;
function ensureLoaded() {
  loading ??= Promise.all([loadApiKey(), AsyncStorage.getItem(MODEL_KEY)])
    .then(([apiKey, model]) => update({ loaded: true, apiKey, model: AI_MODELS.some((m) => m.id === model) ? (model as AiModelId) : DEFAULT_MODEL }))
    .catch((e) => {
      console.warn('AI 설정 불러오기 실패', e);
      update({ loaded: true });
    });
}

/** 설정 화면과 식단 화면이 같은 AI 설정을 함께 봄 */
export function useAiSettings(): AiSettings {
  useEffect(ensureLoaded, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** 이벤트 처리 중에 최신 설정을 읽을 때 (아직 안 불러왔으면 기다림) */
export async function getAiSettings(): Promise<AiSettings> {
  ensureLoaded();
  await loading;
  return state;
}

export async function saveApiKey(apiKey: string | null) {
  await storeApiKey(apiKey);
  update({ apiKey });
}

export async function saveModel(model: AiModelId) {
  update({ model });
  await AsyncStorage.setItem(MODEL_KEY, model);
}

/** "sk-ant-…a1b2" 처럼 끝 4자리만 보여줌 */
export const maskKey = (key: string) => `${key.slice(0, 7)}…${key.slice(-4)}`;
