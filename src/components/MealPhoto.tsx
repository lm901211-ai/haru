import { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { usePhotoUri } from '../photos/photoStore';
import { dialogName } from './ui';
import { colors } from '../theme';

/** 저장된 식사 사진 썸네일. 누르면 크게 보기 (사진 파일이 없으면 아무것도 안 그림) */
export function MealThumb({ photo, size = 52, label = '식사 사진 크게 보기' }: { photo?: string; size?: number; label?: string }) {
  const uri = usePhotoUri(photo);
  const [open, setOpen] = useState(false);
  if (!uri) return null;
  return (
    <>
      <Pressable role="button" aria-label={label} onPress={() => setOpen(true)} hitSlop={4}>
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 12, backgroundColor: colors.line }} resizeMode="cover" />
      </Pressable>
      <PhotoViewer uri={open ? uri : undefined} onClose={() => setOpen(false)} />
    </>
  );
}

/** 사진 전체 화면 보기 (아무 곳이나 누르면 닫힘) */
export function PhotoViewer({ uri, onClose }: { uri?: string; onClose: () => void }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} {...dialogName('식사 사진')}>
      <Pressable role="button" aria-label="사진 닫기" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        {uri && <Image source={{ uri }} style={{ width: '100%', height: '80%' }} resizeMode="contain" aria-label="식사 사진" />}
        <View style={{ position: 'absolute', bottom: 40 }}>
          <Text style={{ color: '#fff', opacity: 0.8 }}>눌러서 닫기</Text>
        </View>
      </Pressable>
    </Modal>
  );
}
