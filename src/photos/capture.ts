import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** 막 찍거나 고른 사진 (아직 저장 전) */
export type PickedPhoto = { uri: string; base64: string; width: number; height: number };

// 긴 변 1280px · JPEG 70% → 한 장에 보통 100~250KB. AI 분석에도 충분한 해상도
const MAX_SIDE = 1280;

/** 카메라로 찍거나 앨범에서 고른 사진을 줄여서 돌려줌 (취소하면 null) */
export async function pickMealPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error('카메라 권한이 필요해요. 휴대폰 설정 › 애플리케이션 › 하루관리 › 권한에서 카메라를 허용해 주세요.');
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets?.length) return null;

  const context = ImageManipulator.manipulate(res.assets[0].uri, { maxWidth: MAX_SIDE, maxHeight: MAX_SIDE });
  const image = await context.renderAsync();
  try {
    const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    if (!out.base64) throw new Error('사진을 읽지 못했어요. 다른 사진으로 다시 시도해 주세요.');
    return { uri: out.uri, base64: out.base64, width: out.width, height: out.height };
  } finally {
    image.release();
    context.release();
  }
}
