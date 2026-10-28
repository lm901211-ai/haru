import * as SecureStore from 'expo-secure-store';

// API 키는 기록 데이터(백업 파일)와 따로, 안드로이드 키스토어로 암호화해서 보관
const KEY = 'anthropic-api-key';

export const loadApiKey = (): Promise<string | null> => SecureStore.getItemAsync(KEY);

export async function storeApiKey(key: string | null): Promise<void> {
  if (key) await SecureStore.setItemAsync(KEY, key);
  else await SecureStore.deleteItemAsync(KEY);
}
