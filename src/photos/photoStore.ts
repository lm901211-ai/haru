import { useMemo } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import type { PickedPhoto } from './capture';

// 식사 사진은 앱 전용 폴더에 "<id>.jpg" 로 저장하고, 기록(meal.photo)에는 파일 이름만 남긴다.
// (앱을 지우면 함께 지워지고, 백업 파일에는 들어가지 않음)
const folder = () => new Directory(Paths.document, 'meal-photos');

export async function savePhoto(photo: PickedPhoto, id: string): Promise<string> {
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const name = `${id}.jpg`;
  const dest = new File(dir, name);
  if (dest.exists) dest.delete();
  await new File(photo.uri).copy(dest);
  return name;
}

export function deletePhoto(ref?: string) {
  if (!ref) return;
  try {
    const f = new File(folder(), ref);
    if (f.exists) f.delete();
  } catch (e) {
    console.warn('사진 삭제 실패', e);
  }
}

/** 저장된 사진을 AI 분석용 base64 로 읽음 (없으면 null) */
export async function loadPhotoBase64(ref: string): Promise<string | null> {
  const f = new File(folder(), ref);
  return f.exists ? f.base64() : null;
}

/** 화면에 보여줄 주소 (파일이 없으면 undefined) */
export function usePhotoUri(ref?: string): string | undefined {
  return useMemo(() => {
    if (!ref) return undefined;
    const f = new File(folder(), ref);
    return f.exists ? f.uri : undefined;
  }, [ref]);
}
