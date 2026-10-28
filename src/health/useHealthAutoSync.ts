import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useStore } from '../store';
import { addDays, todayKey } from '../date';
import { getGrantedKinds, readHealthBatch } from './healthConnect';

const MIN_GAP_MS = 2 * 60 * 1000;
let lastRun = 0;

/**
 * 헬스 커넥트 자동 가져오기: 앱을 열거나 다시 볼 때 최근 7일을 가져온다.
 * 걸음 수는 기기 값이 정확하므로 덮어쓰고, 나머지(체중·수면·물·운동)는 비어 있는 날만 채운다.
 */
export function useHealthAutoSync() {
  const { data, loaded, importBatch, setSync } = useStore();
  const enabled = loaded && Platform.OS === 'android' && !!data.sync?.healthConnect;

  useEffect(() => {
    if (!enabled) return;
    let running = false;
    const run = async (force: boolean) => {
      if (running || (!force && Date.now() - lastRun < MIN_GAP_MS)) return;
      running = true;
      lastRun = Date.now();
      try {
        const kinds = await getGrantedKinds();
        if (!kinds.length) return;
        const today = todayKey();
        importBatch(await readHealthBatch(addDays(today, -6), today, kinds), { steps: 'overwrite' });
        setSync({ lastSyncAt: new Date().toISOString() });
      } catch {
        // 다음에 다시 시도
      } finally {
        running = false;
      }
    };
    run(true);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run(false));
    return () => sub.remove();
  }, [enabled, importBatch, setSync]);
}
