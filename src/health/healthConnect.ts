import { ImportBatch, ImportKind, emptyBatch } from '../importer/batch';

// 헬스 커넥트는 안드로이드 전용. 웹(아이폰 웹앱)과 iOS 에서는 이 기본 구현이 쓰인다.
// 안드로이드 구현: healthConnect.android.ts

export type HealthStatus = 'unsupported' | 'unavailable' | 'needs-update' | 'available';

export async function getHealthStatus(): Promise<HealthStatus> {
  return 'unsupported';
}

export async function requestHealthAccess(): Promise<ImportKind[]> {
  return [];
}

export async function getGrantedKinds(): Promise<ImportKind[]> {
  return [];
}

export async function readHealthBatch(_from: string, _to: string, _kinds?: ImportKind[]): Promise<ImportBatch> {
  return emptyBatch();
}

export function openHealthConnectSettings(): void {}
