import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { confirmAction, notify } from '../dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, NumberField, styles } from './ui';
import { useStore } from '../store';
import { exportBackup, pickBackup } from '../backup';
import { ImportSection } from './ImportSection';
import { AiSettingsCard } from './AiSettingsCard';
import { colors } from '../theme';
import { Goals } from '../types';

const GOAL_FIELDS: { k: keyof Goals; label: string; unit: string; decimal?: boolean }[] = [
  { k: 'steps', label: '👟 걸음', unit: '보' },
  { k: 'exerciseMin', label: '🏃 운동', unit: '분' },
  { k: 'sleepHours', label: '😴 수면', unit: '시간', decimal: true },
];

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} style={{ padding: 6 }}>
        <Text style={{ fontSize: 24 }}>⚙️</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SettingsSheet onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { data, setGoals, setProfile, replaceAll } = useStore();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const days = Object.keys(data.logs).length;

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch (e) {
      notify('오류', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const restore = () =>
    run(async () => {
      const next = await pickBackup();
      if (!next) return;
      confirmAction('백업 복원', `백업 파일의 기록(${Object.keys(next.logs).length}일치)으로 지금 데이터를 바꿀까요?\n현재 데이터는 사라져요.`, '복원', () => {
        replaceAll(next);
        notify('복원 완료', '백업 데이터를 불러왔어요.');
      });
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.screenTitle}>설정</Text>
          <Button label="닫기" small outline onPress={onClose} />
        </View>

        <Card title="👤 내 정보">
          <View style={styles.row}>
            <Text style={{ width: 80, color: colors.text }}>키</Text>
            <View style={{ flex: 1 }}>
              <NumberField decimal value={data.profile.heightCm} placeholder="예: 170" unit="cm" onCommit={(v) => setProfile({ ...data.profile, heightCm: v })} />
            </View>
          </View>
        </Card>

        <Card title="🎯 하루 목표">
          {GOAL_FIELDS.map((f) => (
            <View key={f.k} style={styles.row}>
              <Text style={{ width: 80, color: colors.text }}>{f.label}</Text>
              <View style={{ flex: 1 }}>
                <NumberField decimal={f.decimal} value={data.goals[f.k]} unit={f.unit} onCommit={(v) => v && setGoals({ ...data.goals, [f.k]: v })} />
              </View>
            </View>
          ))}
          <Text style={styles.muted}>하루 점수와 그래프의 목표선에 쓰여요.</Text>
        </Card>

        <AiSettingsCard />

        <ImportSection />

        <Card title="💾 데이터 백업">
          <Text style={{ color: colors.text, lineHeight: 20 }}>
            모든 기록은 이 휴대폰 안에만 저장돼요. 앱을 지우거나 휴대폰을 바꾸기 전에 백업 파일을 만들어 두세요.
          </Text>
          <Text style={styles.muted}>
            지금 저장된 기록: {days}일 · 할 일 {data.todos.length}개 · 습관 {data.habits.length}개 · 목표 {data.challenges.length}개
          </Text>
          <Button label="백업 파일 내보내기" disabled={busy} onPress={() => run(() => exportBackup(data))} />
          <Button label="백업 파일에서 복원" outline disabled={busy} onPress={restore} />
          <Text style={styles.muted}>내보내기를 누르면 구글 드라이브, 카카오톡 ‘나와의 채팅’, 메일 등으로 저장할 수 있어요. 식사 사진과 AI 키는 백업 파일에 들어가지 않아요.</Text>
        </Card>

        <Text style={[styles.muted, { textAlign: 'center' }]}>하루관리 1.0.4</Text>
      </ScrollView>
    </View>
  );
}
