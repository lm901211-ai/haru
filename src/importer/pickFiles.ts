import { File } from 'expo-file-system';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { combineBatches, ImportBatch } from './batch';
import { FileKind, parseFileText } from './parse';

export type PickedFile = { name: string; kind: FileKind };
export type PickedImport = { batch: ImportBatch; files: PickedFile[] };

/** 파일(여러 개 가능)을 골라 읽고 기록을 정리 (취소 시 null) */
export async function pickImportFiles(): Promise<PickedImport | null> {
  const picked = await File.pickFileAsync({ multipleFiles: true, mimeTypes: ['text/*', 'application/*', '*/*'] });
  if (picked.canceled) return null;
  const parsed = [];
  for (const f of picked.result) {
    // 일부 파일 앱이 주는 content:// 주소는 기존 방식으로 한 번 더 시도
    const text = await f.text().catch(() => readAsStringAsync(f.uri));
    parsed.push({ name: f.name, ...parseFileText(f.name, text) });
  }
  return { batch: combineBatches(parsed.map((p) => p.batch)), files: parsed.map(({ name, kind }) => ({ name, kind })) };
}
