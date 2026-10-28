// 웹앱에서는 이 기기 브라우저에만 보관 (기록 데이터·백업 파일과는 따로)
const KEY = 'haru/anthropic-api-key';

export async function loadApiKey(): Promise<string | null> {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function storeApiKey(key: string | null): Promise<void> {
  if (key) localStorage.setItem(KEY, key);
  else localStorage.removeItem(KEY);
}
