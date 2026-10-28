import { AppData } from './types';
import { backupFileName, parseBackup, serializeBackup } from './backupFormat';
import { chooseFiles } from './webFiles';

/**
 * 웹(아이폰 홈 화면 웹앱)용 백업.
 * 공유 시트로 파일을 보낼 수 있으면(아이폰 사파리) 공유하고, 아니면 파일로 내려받음.
 */
export async function exportBackup(data: AppData): Promise<void> {
  const file = new File([serializeBackup(data)], backupFileName(), { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '하루관리 백업' });
      return;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return; // 사용자가 공유 창을 닫음
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 파일 선택 창으로 백업 파일을 골라 데이터를 돌려줌 (취소 시 null) */
export async function pickBackup(): Promise<AppData | null> {
  const [file] = await chooseFiles({ accept: 'application/json,.json,text/plain' });
  return file ? parseBackup(await file.text()) : null;
}
