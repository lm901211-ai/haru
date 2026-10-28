import { useEffect, useState } from 'react';
import type { PickedPhoto } from './capture';

// 웹앱(아이폰)에서는 식사 사진을 브라우저의 IndexedDB 에 Blob 으로 저장한다. 키 = "<id>.jpg"
const DB_NAME = 'haru-photos';
const STORE = 'photos';

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('사진 저장소를 열지 못했어요.'));
    };
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('사진 저장소 오류'));
  });
}

function base64ToBlob(base64: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('사진을 읽지 못했어요.'));
    reader.readAsDataURL(blob);
  });
}

export async function savePhoto(photo: PickedPhoto, id: string): Promise<string> {
  const name = `${id}.jpg`;
  await run('readwrite', (s) => s.put(base64ToBlob(photo.base64), name));
  return name;
}

export function deletePhoto(ref?: string) {
  if (!ref) return;
  run('readwrite', (s) => s.delete(ref)).catch((e) => console.warn('사진 삭제 실패', e));
}

export async function loadPhotoBase64(ref: string): Promise<string | null> {
  const blob = await run<Blob | undefined>('readonly', (s) => s.get(ref));
  return blob ? blobToBase64(blob) : null;
}

export function usePhotoUri(ref?: string): string | undefined {
  const [shown, setShown] = useState<{ ref: string; uri: string } | null>(null);
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    let url: string | undefined;
    run<Blob | undefined>('readonly', (s) => s.get(ref))
      .then((blob) => {
        if (!alive || !blob) return;
        url = URL.createObjectURL(blob);
        setShown({ ref, uri: url });
      })
      .catch((e) => console.warn('사진 불러오기 실패', e));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ref]);
  return shown && shown.ref === ref ? shown.uri : undefined;
}
