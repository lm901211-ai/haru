import { chooseFiles } from '../webFiles';
import { combineBatches, ImportBatch } from './batch';
import { AppleHealthParser, fileKind, parseFileText } from './parse';
import type { PickedFile, PickedImport } from './pickFiles';

export type { PickedFile, PickedImport };

/** 애플 건강 export.xml 은 수백 MB가 될 수 있어 조금씩 읽어 처리 */
async function parseAppleStream(file: File): Promise<ImportBatch> {
  const parser = new AppleHealthParser();
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.push(decoder.decode());
  return parser.finish();
}

/** 파일(여러 개 가능)을 골라 읽고 기록을 정리 (취소 시 null) */
export async function pickImportFiles(): Promise<PickedImport | null> {
  const files = await chooseFiles({ accept: '.csv,.xml,.txt,text/csv,text/plain,text/xml,application/xml', multiple: true });
  if (!files.length) return null;
  const parsed = [];
  for (const f of files) {
    const head = await f.slice(0, 2000).text();
    if (fileKind(f.name, head) === 'apple') parsed.push({ name: f.name, kind: 'apple' as const, batch: await parseAppleStream(f) });
    else parsed.push({ name: f.name, ...parseFileText(f.name, await f.text()) });
  }
  return { batch: combineBatches(parsed.map((p) => p.batch)), files: parsed.map(({ name, kind }) => ({ name, kind })) };
}
