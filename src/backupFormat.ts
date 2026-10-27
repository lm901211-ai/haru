import { AppData } from './types';
import { todayKey } from './date';

const FORMAT = 'haru-backup';

export const backupFileName = () => `haru-backup-${todayKey()}.json`;

export function serializeBackup(data: AppData): string {
  return JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), data });
}

/** 백업 파일 내용을 검사해 데이터로 돌려줌 (형식이 다르면 오류) */
export function parseBackup(text: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('백업 파일을 읽을 수 없어요. 하루관리에서 내보낸 .json 파일인지 확인해 주세요.');
  }
  const obj = parsed as { format?: string; data?: AppData };
  if (obj?.format !== FORMAT || !obj.data || typeof obj.data.logs !== 'object') {
    throw new Error('하루관리 백업 파일이 아니에요.');
  }
  return obj.data;
}
