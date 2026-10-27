import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, Chip, Input, NumberField, ProgressBar, Screen, styles } from '../components/ui';
import { useStore } from '../store';
import { challengeProgress, currentWeight, STATUS_TEXT, termOf } from '../challenges';
import { newId, todayKey } from '../date';
import { colors } from '../theme';
import { Challenge } from '../types';

type Kind = Challenge['kind'];

const KINDS: { kind: Kind; label: string; desc: string }[] = [
  { kind: 'weight', label: '⚖️ 체중', desc: '목표 체중까지 기간 안에 감량/증량' },
  { kind: 'streak', label: '✅ 매일 실천', desc: '하루 한 번 체크 (연속 또는 누적 일수)' },
  { kind: 'amount', label: '📈 누적 수치', desc: '권, 개, 시간 등을 쌓아서 목표치 달성' },
];

type Template = { label: string; kind: Kind; title: string; emoji: string; days: string; mode?: 'consecutive' | 'total'; unit?: string; target?: string; weekly?: string };
const TEMPLATES: Template[] = [
  { label: '다이어트 100일', kind: 'weight', title: '다이어트 100일', emoji: '🥗', days: '100', weekly: '0.1' },
  { label: '영어 공부 100일 연속', kind: 'streak', title: '영어 공부 100일 연속', emoji: '🇺🇸', days: '100', mode: 'consecutive' },
  { label: '운동 30일 챌린지', kind: 'streak', title: '운동 30일 챌린지', emoji: '🏋️', days: '30', mode: 'total' },
  { label: '1년 책 12권', kind: 'amount', title: '1년에 책 12권 읽기', emoji: '📚', days: '365', unit: '권', target: '12' },
  { label: '영단어 1000개', kind: 'amount', title: '영단어 1000개 외우기', emoji: '🔤', days: '60', unit: '개', target: '1000' },
];

const EMOJIS = ['🎯', '🥗', '🇺🇸', '📚', '🏋️', '🔤', '✍️', '🧘', '💰', '🎹'];

export default function GoalScreen() {
  const { data, addChallenge, updateChallenge, deleteChallenge, updateLog } = useStore();
  const today = todayKey();
  const [showForm, setShowForm] = useState(data.challenges.length === 0);

  const confirmDelete = (c: Challenge) =>
    Alert.alert('목표 삭제', `"${c.title}" 목표를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteChallenge(c.id) },
    ]);

  return (
    <Screen title="목표">
      {data.challenges.map((c) => {
        const p = challengeProgress(data, c, today);
        const pct = Math.round(p.ratio * 100);
        const barColor = p.status === 'done' ? colors.steps : p.status === 'behind' ? colors.exercise : colors.primary;
        return (
          <Card key={c.id}>
            <Pressable onLongPress={() => confirmDelete(c)} style={{ gap: 10 }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.row}>
                    <View style={{ backgroundColor: p.term === '장기' ? '#EDE8FF' : '#E6F7EE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: p.term === '장기' ? colors.sleep : colors.steps }}>{p.term}</Text>
                    </View>
                    <Text style={styles.muted}>{p.dayLabel}</Text>
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                    {c.emoji} {c.title}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: barColor }}>{pct}%</Text>
                  {STATUS_TEXT[p.status] ? <Text style={{ fontSize: 12, fontWeight: '700', color: barColor }}>{STATUS_TEXT[p.status]}</Text> : null}
                </View>
              </View>
              <ProgressBar value={p.ratio} max={1} color={barColor} height={12} marker={p.expected} />
              {p.expected != null && p.status !== 'done' && (
                <Text style={[styles.muted, { fontSize: 12 }]}>│ 표시는 기간상 지금쯤 와 있어야 할 지점({Math.round(p.expected * 100)}%)</Text>
              )}
              <View style={{ gap: 3 }}>
                {p.details.map((d) => (
                  <Text key={d} style={{ fontSize: 14, color: colors.text }}>
                    · {d}
                  </Text>
                ))}
              </View>
            </Pressable>

            {c.kind === 'weight' && (
              <NumberField
                decimal
                value={data.logs[today]?.weight}
                placeholder={`오늘 체중 (최근 ${currentWeight(data, c)}kg)`}
                unit="kg"
                onCommit={(v) => updateLog(today, (l) => ({ ...l, weight: v }))}
              />
            )}
            {c.kind === 'streak' && (
              <Button
                label={c.doneDates.includes(today) ? '✅ 오늘 완료! (취소하려면 탭)' : '오늘 했어요'}
                outline={c.doneDates.includes(today)}
                color={colors.steps}
                onPress={() =>
                  updateChallenge(c.id, (x) => {
                    if (x.kind !== 'streak') return x;
                    const has = x.doneDates.includes(today);
                    return { ...x, doneDates: has ? x.doneDates.filter((d) => d !== today) : [...x.doneDates, today] };
                  })
                }
              />
            )}
            {c.kind === 'amount' && <AmountInput unit={c.unit} onAdd={(n) => updateChallenge(c.id, (x) => (x.kind === 'amount' ? { ...x, entries: { ...x.entries, [today]: Math.max(0, (x.entries[today] ?? 0) + n) } } : x))} />}
          </Card>
        );
      })}

      {data.challenges.length > 0 && !showForm && <Button label="＋ 새 목표 만들기" onPress={() => setShowForm(true)} />}
      {data.challenges.length > 0 && <Text style={[styles.muted, { textAlign: 'center' }]}>목표 카드를 길게 누르면 삭제할 수 있어요</Text>}

      {showForm && (
        <NewChallengeForm
          defaultWeight={Object.keys(data.logs).sort().reverse().map((d) => data.logs[d].weight).find((w) => w != null)}
          onCancel={data.challenges.length > 0 ? () => setShowForm(false) : undefined}
          onCreate={(c) => {
            addChallenge(c);
            setShowForm(false);
          }}
        />
      )}
    </Screen>
  );
}

function AmountInput({ unit, onAdd }: { unit: string; onAdd: (n: number) => void }) {
  const [text, setText] = useState('');
  const submit = (sign: 1 | -1) => {
    const n = parseFloat(text);
    if (!(n > 0)) return;
    onAdd(sign * n);
    setText('');
  };
  return (
    <View style={styles.row}>
      <Input value={text} onChangeText={setText} placeholder={`오늘 한 양 (${unit})`} keyboardType="decimal-pad" style={{ flex: 1 }} />
      <Button label="빼기" small outline onPress={() => submit(-1)} />
      <Button label="＋ 기록" small onPress={() => submit(1)} />
    </View>
  );
}

function NewChallengeForm({ defaultWeight, onCreate, onCancel }: { defaultWeight?: number; onCreate: (c: Challenge) => void; onCancel?: () => void }) {
  const [kind, setKind] = useState<Kind>('weight');
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [days, setDays] = useState('100');
  const [startWeight, setStartWeight] = useState(defaultWeight != null ? String(defaultWeight) : '');
  const [targetWeight, setTargetWeight] = useState('');
  const [weekly, setWeekly] = useState('');
  const [lose, setLose] = useState(true);
  const [mode, setMode] = useState<'consecutive' | 'total'>('consecutive');
  const [unit, setUnit] = useState('');
  const [target, setTarget] = useState('');

  const applyTemplate = (t: Template) => {
    setKind(t.kind);
    setTitle(t.title);
    setEmoji(t.emoji);
    setDays(t.days);
    if (t.mode) setMode(t.mode);
    setUnit(t.unit ?? '');
    setTarget(t.target ?? '');
    setWeekly(t.weekly ?? '');
    setTargetWeight('');
  };

  const nDays = parseInt(days, 10);
  const sw = parseFloat(startWeight);
  // 주당 목표를 입력하면 목표 체중을 계산, 목표 체중을 입력하면 주당 목표를 계산
  const tw = targetWeight ? parseFloat(targetWeight) : sw + (lose ? -1 : 1) * parseFloat(weekly) * (nDays / 7);
  const weeklyCalc = Math.abs(tw - sw) / (nDays / 7);

  const create = () => {
    if (!title.trim()) return Alert.alert('목표 이름을 입력해 주세요.');
    if (!(nDays > 0)) return Alert.alert('기간(일)을 입력해 주세요.');
    const base = { id: newId(), title: title.trim(), emoji, startDate: todayKey(), days: nDays };
    if (kind === 'weight') {
      if (!(sw > 0) || !Number.isFinite(tw) || tw <= 0) return Alert.alert('시작 체중과, 목표 체중 또는 주당 목표를 입력해 주세요.');
      return onCreate({ ...base, kind, startWeight: sw, targetWeight: Math.round(tw * 10) / 10 });
    }
    if (kind === 'streak') return onCreate({ ...base, kind, mode, doneDates: [] });
    const t = parseFloat(target);
    if (!(t > 0) || !unit.trim()) return Alert.alert('목표 수치와 단위를 입력해 주세요.');
    onCreate({ ...base, kind, unit: unit.trim(), target: t, entries: {} });
  };

  const Label = ({ children }: { children: string }) => <Text style={[styles.muted, { marginTop: 4 }]}>{children}</Text>;

  return (
    <Card title="새 목표 만들기" right={onCancel ? <Button label="닫기" small outline onPress={onCancel} /> : undefined}>
      <Label>빠른 시작</Label>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {TEMPLATES.map((t) => (
          <Chip key={t.label} label={t.label} active={title === t.title} onPress={() => applyTemplate(t)} color={colors.sleep} />
        ))}
      </View>

      <Label>종류</Label>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {KINDS.map((k) => (
          <Chip key={k.kind} label={k.label} active={kind === k.kind} onPress={() => setKind(k.kind)} />
        ))}
      </View>
      <Text style={[styles.muted, { fontSize: 12 }]}>{KINDS.find((k) => k.kind === kind)?.desc}</Text>

      <Label>이름</Label>
      <Input value={title} onChangeText={setTitle} placeholder="예: 영어 공부 100일 연속" />
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {EMOJIS.map((e) => (
          <Chip key={e} label={e} active={emoji === e} onPress={() => setEmoji(e)} />
        ))}
      </View>

      <Label>{kind === 'streak' ? '목표 일수' : '기간 (일)'}</Label>
      <View style={styles.row}>
        <Input value={days} onChangeText={setDays} keyboardType="number-pad" style={{ flex: 1 }} />
        <Text style={styles.unit}>일</Text>
        {nDays > 0 && <Text style={{ color: colors.sub }}>{termOf(nDays)} 목표</Text>}
      </View>

      {kind === 'weight' && (
        <>
          <View style={[styles.row, { marginTop: 4 }]}>
            <Chip label="감량" active={lose} onPress={() => setLose(true)} color={colors.exercise} />
            <Chip label="증량" active={!lose} onPress={() => setLose(false)} color={colors.exercise} />
          </View>
          <Label>시작 체중</Label>
          <View style={styles.row}>
            <Input value={startWeight} onChangeText={setStartWeight} keyboardType="decimal-pad" placeholder="예: 70" style={{ flex: 1 }} />
            <Text style={styles.unit}>kg</Text>
          </View>
          <Label>주당 목표 (또는 아래 목표 체중 중 하나만 입력)</Label>
          <View style={styles.row}>
            <Input value={weekly} onChangeText={(v) => { setWeekly(v); setTargetWeight(''); }} keyboardType="decimal-pad" placeholder="예: 0.1" style={{ flex: 1 }} />
            <Text style={styles.unit}>kg/주</Text>
          </View>
          <Label>목표 체중</Label>
          <View style={styles.row}>
            <Input value={targetWeight} onChangeText={(v) => { setTargetWeight(v); setWeekly(''); }} keyboardType="decimal-pad" placeholder="예: 65" style={{ flex: 1 }} />
            <Text style={styles.unit}>kg</Text>
          </View>
          {sw > 0 && Number.isFinite(tw) && nDays > 0 && (
            <Text style={{ color: colors.primary, fontWeight: '600' }}>
              → {nDays}일 후 {Math.round(tw * 10) / 10}kg · 주당 {Math.round(weeklyCalc * 100) / 100}kg {tw < sw ? '감량' : '증량'}
            </Text>
          )}
        </>
      )}

      {kind === 'streak' && (
        <>
          <Label>세는 방식</Label>
          <View style={styles.row}>
            <Chip label="연속 (하루 빠지면 처음부터)" active={mode === 'consecutive'} onPress={() => setMode('consecutive')} />
            <Chip label="누적" active={mode === 'total'} onPress={() => setMode('total')} />
          </View>
        </>
      )}

      {kind === 'amount' && (
        <>
          <Label>목표 수치</Label>
          <View style={styles.row}>
            <Input value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="예: 12" style={{ flex: 2 }} />
            <Input value={unit} onChangeText={setUnit} placeholder="단위 (권)" style={{ flex: 1 }} />
          </View>
        </>
      )}

      <Button label="목표 시작하기" onPress={create} />
    </Card>
  );
}
