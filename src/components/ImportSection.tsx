import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Switch, Text, View } from 'react-native';
import { Button, Card, Chip, styles } from './ui';
import { useStore } from '../store';
import { notify } from '../dialog';
import { addDays, fromKey, todayKey } from '../date';
import { colors } from '../theme';
import { batchIsEmpty, ImportBatch, ImportKind, ImportMode, IMPORT_KINDS, summarizeBatch } from '../importer/batch';
import { pickImportFiles, PickedFile } from '../importer/pickFiles';
import { getGrantedKinds, getHealthStatus, HealthStatus, openHealthConnectSettings, readHealthBatch, requestHealthAccess } from '../health/healthConnect';

const RANGES: { days: number; label: string }[] = [
  { days: 30, label: '최근 1달' },
  { days: 182, label: '6개월' },
  { days: 365, label: '1년' },
  { days: 365 * 5, label: '전체(5년)' },
];

const KIND_NAMES: Record<ImportKind, string> = { steps: '걸음 수', weight: '체중', sleep: '수면', exercise: '운동' };
const FILE_KIND_NAMES = { samsung: '삼성 헬스', apple: '애플 건강', csv: 'CSV', unknown: '알 수 없는 파일' } as const;

const dotDate = (key: string) => {
  const d = fromKey(key);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};

type Pending = { batch: ImportBatch; source: string; files?: PickedFile[] };

/** ⚙️ 설정 안의 "다른 앱 기록 가져오기" */
export function ImportSection() {
  const { data, importBatch, setSync } = useStore();
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [granted, setGranted] = useState<ImportKind[]>([]);
  const [range, setRange] = useState(365);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<ImportMode>('fill');
  const [busy, setBusy] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let alive = true;
    getHealthStatus().then((s) => {
      if (!alive) return;
      setStatus(s);
      if (s === 'available') getGrantedKinds().then((k) => alive && setGranted(k));
    });
    return () => {
      alive = false;
    };
  }, []);

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label);
    try {
      await job();
    } catch (e) {
      notify('가져오기 오류', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const fromHealth = () =>
    run('헬스 커넥트에서 읽는 중…', async () => {
      let kinds = granted;
      if (!kinds.length) {
        kinds = await requestHealthAccess();
        setGranted(kinds);
      }
      if (!kinds.length) {
        notify('권한이 필요해요', '헬스 커넥트에서 하루관리가 걸음 수·체중 등을 읽을 수 있게 허용해 주세요.');
        return;
      }
      const today = todayKey();
      const batch = await readHealthBatch(addDays(today, -(range - 1)), today, kinds);
      if (batchIsEmpty(batch)) {
        notify('가져올 기록이 없어요', '삼성 헬스·앳플리 앱에서 헬스 커넥트로 데이터 공유가 켜져 있는지 확인해 주세요. (아래 "연결 방법" 참고)');
        return;
      }
      setPending({ batch, source: '헬스 커넥트' });
    });

  const fromFiles = () =>
    run('파일을 읽는 중…', async () => {
      const picked = await pickImportFiles();
      if (!picked) return;
      if (batchIsEmpty(picked.batch)) {
        notify('가져올 기록을 찾지 못했어요', '삼성 헬스 CSV, 애플 건강 export.xml, 또는 "날짜"와 "체중"/"걸음" 열이 있는 CSV 파일인지 확인해 주세요. 압축(zip) 파일은 먼저 풀어 주세요.');
        return;
      }
      setPending({ batch: picked.batch, source: `파일 ${picked.files.length}개`, files: picked.files });
    });

  const confirm = () => {
    if (!pending) return;
    const changed = importBatch(pending.batch, mode);
    setPending(null);
    const parts = (Object.keys(changed) as ImportKind[]).filter((k) => changed[k] > 0).map((k) => `${KIND_NAMES[k]} ${changed[k]}일`);
    notify('가져오기 완료', parts.length ? `${parts.join(', ')}을 반영했어요.` : '새로 반영할 기록이 없었어요 (이미 같은 기록이 있어요).');
  };

  const isAndroid = Platform.OS === 'android';
  const lastSync = data.sync?.lastSyncAt ? new Date(data.sync.lastSyncAt) : null;

  return (
    <Card title="📥 다른 앱 기록 가져오기">
      <Text style={{ color: colors.text, lineHeight: 20 }}>삼성 헬스, 앳플리 같은 다른 앱에 쌓인 걸음 수·체중·수면·운동 기록을 과거 기록까지 가져와요.</Text>

      {pending && <ImportPreview pending={pending} mode={mode} setMode={setMode} onCancel={() => setPending(null)} onConfirm={confirm} />}

      {busy && (
        <View style={[styles.row, { gap: 8 }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>{busy}</Text>
        </View>
      )}

      {isAndroid && (
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}>
          <Text style={{ fontWeight: '800', color: colors.text }}>① 헬스 커넥트 (삼성 헬스 · 앳플리 등)</Text>
          <Text style={styles.muted}>
            {status === 'available'
              ? granted.length
                ? `연결됨 · ${granted.map((k) => KIND_NAMES[k]).join(', ')}`
                : '아직 연결하지 않았어요'
              : status === 'needs-update'
                ? '헬스 커넥트 앱 업데이트가 필요해요'
                : status === 'unavailable'
                  ? 'Play 스토어에서 "헬스 커넥트" 앱을 설치해 주세요'
                  : '확인 중…'}
          </Text>
          {status === 'available' && (
            <>
              <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
                {RANGES.map((r) => (
                  <Chip key={r.days} label={r.label} active={range === r.days} onPress={() => setRange(r.days)} />
                ))}
              </View>
              <Button label={granted.length ? '헬스 커넥트에서 가져오기' : '헬스 커넥트 연결하고 가져오기'} disabled={!!busy} onPress={fromHealth} />
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text }}>앱을 열 때 자동으로 가져오기</Text>
                  <Text style={[styles.muted, { fontSize: 11 }]}>
                    최근 7일 · 걸음 수는 기기 값으로 갱신, 나머지는 빈 날만 채움{lastSync ? ` · 마지막 ${lastSync.getMonth() + 1}/${lastSync.getDate()} ${String(lastSync.getHours()).padStart(2, '0')}:${String(lastSync.getMinutes()).padStart(2, '0')}` : ''}
                  </Text>
                </View>
                <Switch
                  aria-label="앱을 열 때 헬스 커넥트에서 자동으로 가져오기"
                  value={!!data.sync?.healthConnect}
                  onValueChange={async (on) => {
                    if (on && !granted.length) {
                      const kinds = await requestHealthAccess();
                      setGranted(kinds);
                      if (!kinds.length) return;
                    }
                    setSync({ healthConnect: on });
                  }}
                />
              </View>
              <Pressable role="link" onPress={openHealthConnectSettings} hitSlop={8}>
                <Text style={{ color: colors.primary, fontSize: 13 }}>헬스 커넥트 권한 설정 열기 ›</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}>
        <Text style={{ fontWeight: '800', color: colors.text }}>{isAndroid ? '②' : '①'} 파일에서 가져오기</Text>
        <Text style={styles.muted}>삼성 헬스 내보내기(CSV) · 애플 건강 export.xml · 날짜와 체중/걸음 열이 있는 CSV</Text>
        <Button label="파일 선택해서 가져오기" outline disabled={!!busy} onPress={fromFiles} />
      </View>

      <Pressable role="button" aria-expanded={help} onPress={() => setHelp(!help)} hitSlop={8}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{help ? '연결 방법 닫기' : '연결 방법 보기 ›'}</Text>
      </Pressable>
      {help && <ImportHelp android={isAndroid} />}
    </Card>
  );
}

function ImportPreview({
  pending,
  mode,
  setMode,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  mode: ImportMode;
  setMode: (m: ImportMode) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const rows = summarizeBatch(pending.batch).filter((s) => s.days > 0);
  const kinds = pending.files ? [...new Set(pending.files.map((f) => FILE_KIND_NAMES[f.kind]))].join(', ') : '';
  return (
    <View style={{ backgroundColor: '#EEF3FF', borderRadius: 12, padding: 12, gap: 8 }}>
      <Text style={{ fontWeight: '800', color: colors.text }}>
        {pending.source}에서 찾은 기록{kinds ? ` (${kinds})` : ''}
      </Text>
      {rows.map((s) => (
        <View key={s.kind} style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={{ color: colors.text }}>{IMPORT_KINDS.find((k) => k.kind === s.kind)?.label}</Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {s.days}일 <Text style={styles.muted}>({dotDate(s.from as string)} ~ {dotDate(s.to as string)})</Text>
          </Text>
        </View>
      ))}
      <Text style={[styles.muted, { marginTop: 4 }]}>이미 기록한 날은</Text>
      <View style={[styles.row, { gap: 6 }]}>
        <Chip label="그대로 두기" active={mode === 'fill'} onPress={() => setMode('fill')} />
        <Chip label="가져온 값으로 바꾸기" active={mode === 'overwrite'} onPress={() => setMode('overwrite')} />
      </View>
      <View style={[styles.row, { gap: 8 }]}>
        <View style={{ flex: 1 }}>
          <Button label="취소" outline onPress={onCancel} />
        </View>
        <View style={{ flex: 2 }}>
          <Button label="가져오기" onPress={onConfirm} />
        </View>
      </View>
    </View>
  );
}

function ImportHelp({ android }: { android: boolean }) {
  const step = (n: string, text: string) => (
    <Text key={n} style={{ fontSize: 13, color: colors.text, lineHeight: 20 }}>
      {n} {text}
    </Text>
  );
  return (
    <View style={{ backgroundColor: colors.bg, borderRadius: 10, padding: 10, gap: 4 }}>
      {android && (
        <>
          <Text style={{ fontWeight: '800', color: colors.text }}>헬스 커넥트로 자동 연결</Text>
          {step('1.', '삼성 헬스 → 설정(⋮) → 헬스 커넥트(또는 연결된 서비스) → 걸음 수·체중·수면·운동 공유를 켜요.')}
          {step('2.', '앳플리 앱에서 헬스 커넥트(구글) 연동을 켜요. 연동하기 전 기록은 헬스 커넥트에 없을 수 있어요.')}
          {step('3.', '여기서 "헬스 커넥트 연결하고 가져오기"를 누르고 권한을 모두 허용해요. "과거 데이터 읽기"도 허용해야 30일보다 오래된 기록까지 가져와요.')}
        </>
      )}
      <Text style={{ fontWeight: '800', color: colors.text, marginTop: android ? 6 : 0 }}>파일로 과거 기록 전체 가져오기</Text>
      {step('•', '삼성 헬스: 설정(⋮) → 개인 데이터 다운로드 → 받은 폴더(내 파일 › Download › Samsung Health)에서 CSV 파일들을 한 번에 선택해요.')}
      {step('•', '애플 건강(아이폰): 건강 앱 → 오른쪽 위 프로필 → 모든 건강 데이터 내보내기 → 받은 zip을 파일 앱에서 눌러 압축을 풀고 export.xml을 선택해요.')}
      {step('•', '다른 앱(앳플리 등): 기록을 CSV/엑셀로 내보낼 수 있으면 "날짜"와 "체중"(또는 "걸음") 열이 있는 CSV로 저장해 선택해요.')}
    </View>
  );
}
