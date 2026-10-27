import { AppData } from './types';
import { backupFileName, parseBackup, serializeBackup } from './backupFormat';

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
export function pickBackup(): Promise<AppData | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain';
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return finish(() => resolve(null));
      f.text()
        .then((text) => finish(() => resolve(parseBackup(text))))
        .catch((e) => finish(() => reject(e)));
    });
    // 선택을 취소한 경우 (지원하는 브라우저)
    input.addEventListener('cancel', () => finish(() => resolve(null)));
    // cancel 이벤트가 없는 브라우저: 창으로 돌아온 뒤에도 파일이 없으면 취소로 봄
    window.addEventListener(
      'focus',
      () =>
        setTimeout(() => {
          if (!input.files?.length) finish(() => resolve(null));
        }, 1500),
      { once: true },
    );
    input.click();
  });
}
