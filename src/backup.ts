import { File, Paths } from 'expo-file-system';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { AppData } from './types';
import { backupFileName, parseBackup, serializeBackup } from './backupFormat';

/** 전체 데이터를 JSON 파일로 만들어 공유 시트(드라이브, 카톡 나에게, 메일 등)로 내보냄 */
export async function exportBackup(data: AppData): Promise<void> {
  const file = new File(Paths.cache, backupFileName());
  if (file.exists) file.delete();
  file.create();
  await file.write(serializeBackup(data));
  if (!(await Sharing.isAvailableAsync())) throw new Error('이 기기에서는 공유 기능을 사용할 수 없어요.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: '백업 파일 저장' });
}

/** 백업 파일을 골라 내용을 확인한 뒤 데이터를 돌려줌 (취소 시 null) */
export async function pickBackup(): Promise<AppData | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
  if (picked.canceled) return null;
  // 일부 파일 앱이 주는 content:// 주소는 기존 방식으로 한 번 더 시도
  const text = await picked.result.text().catch(() => readAsStringAsync(picked.result.uri));
  return parseBackup(text);
}
