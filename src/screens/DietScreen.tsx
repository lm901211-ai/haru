import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirmAction, notify } from '../dialog';
import { Button, Card, Chip, DateNav, DeleteX, Empty, Input, Screen, styles } from '../components/ui';
import { TrendCard } from '../components/charts';
import { MealThumb, PhotoViewer } from '../components/MealPhoto';
import { AiSettingsCard } from '../components/AiSettingsCard';
import { useStore } from '../store';
import { newId, todayKey } from '../date';
import { colors } from '../theme';
import { Meal, MealType } from '../types';
import { MACRO_RANGE, MACROS, macroShares, macroText, mealTotals, mealTypeForHour } from '../nutrition';
import { pickMealPhoto, PickedPhoto } from '../photos/capture';
import { deletePhoto, loadPhotoBase64, savePhoto, usePhotoUri } from '../photos/photoStore';
import { getAiSettings, useAiSettings } from '../ai/settings';
import { estimateMeal, isAbort, MealEstimate } from '../ai/mealAnalysis';

const MEAL_TYPES: MealType[] = ['아침', '점심', '저녁', '간식'];
const CONFIDENCE_TEXT = { high: '높음', medium: '보통', low: '낮음' } as const;

export default function DietScreen() {
  const { data, getLog, updateLog } = useStore();
  const [date, setDate] = useState(todayKey());
  const [editing, setEditing] = useState<Meal | null>(null);
  const log = getLog(date);
  const totals = mealTotals(log.meals);

  const kcalOf = (d: string) => {
    const k = data.logs[d]?.meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
    return k ? k : undefined;
  };

  const remove = (m: Meal) => {
    const run = () => {
      updateLog(date, (l) => ({ ...l, meals: l.meals.filter((x) => x.id !== m.id) }));
      deletePhoto(m.photo);
    };
    if (m.photo) confirmAction('식사 삭제', `${m.type} ‘${m.text}’ 기록과 사진을 지울까요?`, '삭제', run);
    else run();
  };

  return (
    <Screen title="식단">
      <DateNav date={date} onChange={setDate} />

      <Card title="🍚 식사" right={totals.kcal > 0 ? <Text style={styles.muted}>총 {Math.round(totals.kcal).toLocaleString()}kcal</Text> : undefined}>
        {log.meals.length === 0 && <Empty text="아직 식사 기록이 없어요" />}
        {MEAL_TYPES.map((type) =>
          log.meals
            .filter((m) => m.type === type)
            .map((m) => <MealRow key={m.id} meal={m} onEdit={() => setEditing(m)} onDelete={() => remove(m)} />),
        )}
        <MealForm key={date} date={date} />
      </Card>

      <NutritionCard meals={log.meals} />

      <TrendCard title="섭취 칼로리 추이" unit="kcal" color={colors.star} kind="bar" mode="amount" getValue={kcalOf} />

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing && <EditSheet date={date} meal={editing} onClose={() => setEditing(null)} />}
      </Modal>
    </Screen>
  );
}

function MealRow({ meal, onEdit, onDelete }: { meal: Meal; onEdit: () => void; onDelete: () => void }) {
  const numbers = [meal.kcal ? `${Math.round(meal.kcal).toLocaleString()}kcal` : '', macroText(meal)].filter(Boolean).join(' · ');
  return (
    <View style={styles.listItem}>
      <MealThumb photo={meal.photo} />
      <Pressable onPress={onEdit} style={({ pressed }) => [{ flex: 1, gap: 2 }, pressed && { opacity: 0.6 }]}>
        <View style={[styles.row, { gap: 6 }]}>
          <Text style={{ fontWeight: '700', color: colors.sub }}>{meal.type}</Text>
          {meal.ai && (
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
              AI 추정
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 15, color: colors.text }}>{meal.text}</Text>
        {numbers ? <Text style={styles.muted}>{numbers}</Text> : null}
      </Pressable>
      <DeleteX onPress={onDelete} />
    </View>
  );
}

function EditSheet({ date, meal, onClose }: { date: string; meal: Meal; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.screenTitle}>식사 수정</Text>
          <Button label="닫기" small outline onPress={onClose} />
        </View>
        <Card>
          <MealForm date={date} meal={meal} onDone={onClose} />
        </Card>
      </ScrollView>
    </View>
  );
}

type Analysis = { status: 'idle' } | { status: 'running' } | { status: 'done'; result: MealEstimate } | { status: 'error'; message: string };

// 열량은 정수, 탄단지(g)는 소수 첫째 자리까지
const num = (s: string, digits = 1) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10 ** digits) / 10 ** digits : undefined;
};
const str = (n?: number) => (n != null && n > 0 ? String(n) : '');

/** 식사 추가(아래쪽 입력칸) · 수정(EditSheet) 양식: 사진 → AI 추정 → 직접 고치기 → 저장 */
function MealForm({ date, meal, onDone }: { date: string; meal?: Meal; onDone?: () => void }) {
  const { updateLog } = useStore();
  const ai = useAiSettings();
  const [type, setType] = useState<MealType>(meal?.type ?? (date === todayKey() ? mealTypeForHour(new Date().getHours()) : '아침'));
  const [text, setText] = useState(meal?.text ?? '');
  const [kcal, setKcal] = useState(str(meal?.kcal));
  const [carbs, setCarbs] = useState(str(meal?.carbs));
  const [protein, setProtein] = useState(str(meal?.protein));
  const [fat, setFat] = useState(str(meal?.fat));
  const [isAi, setIsAi] = useState(meal?.ai ?? false);
  const [picked, setPicked] = useState<PickedPhoto | null>(null); // 새로 찍은 사진 (저장 전)
  const [savedPhoto, setSavedPhoto] = useState(meal?.photo); // 수정 중인 식사에 원래 있던 사진
  const savedUri = usePhotoUri(savedPhoto);
  const [analysis, setAnalysis] = useState<Analysis>({ status: 'idle' });
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [viewing, setViewing] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  // AI가 채운 메뉴 이름 — 사용자가 고치지 않았다면 다음 분석 때 '사용자 메모'로 보내지 않고 새 결과로 바꿈
  const aiMenu = useRef<string | undefined>(meal?.ai ? meal.text : undefined);

  useEffect(() => () => abortRef.current?.abort(), []);

  const previewUri = picked?.uri ?? savedUri;
  const hasPhoto = !!picked || !!savedPhoto;

  const analyze = async (photoBase64?: string) => {
    const userText = text.trim() && text !== aiMenu.current ? text : '';
    const hint = photoBase64 || hasPhoto ? userText : text;
    const settings = await getAiSettings();
    if (!settings.apiKey) {
      setSetupOpen(true);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAnalysis({ status: 'running' });
    try {
      let base64 = photoBase64 ?? picked?.base64;
      if (!base64 && savedPhoto) base64 = (await loadPhotoBase64(savedPhoto)) ?? undefined;
      const result = await estimateMeal({ apiKey: settings.apiKey, model: settings.model, photoBase64: base64, mealType: type, hint, signal: controller.signal });
      if (controller.signal.aborted) return;
      setAnalysis({ status: 'done', result });
      const prevAiMenu = aiMenu.current;
      aiMenu.current = result.menu;
      setText((t) => (!t.trim() || t === prevAiMenu ? result.menu : t));
      setKcal(str(result.kcal));
      setCarbs(str(result.carbs));
      setProtein(str(result.protein));
      setFat(str(result.fat));
      setIsAi(true);
    } catch (e) {
      if (isAbort(e) || controller.signal.aborted) return;
      setAnalysis({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const addPhoto = async (source: 'camera' | 'library') => {
    setBusy('photo');
    try {
      const p = await pickMealPhoto(source);
      if (!p) return;
      abortRef.current?.abort();
      setPicked(p);
      setAnalysis({ status: 'idle' });
      if ((await getAiSettings()).apiKey) analyze(p.base64);
    } catch (e) {
      notify('사진을 넣지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = () => {
    abortRef.current?.abort();
    setPicked(null);
    setSavedPhoto(undefined);
    setAnalysis({ status: 'idle' });
  };

  const reset = () => {
    aiMenu.current = undefined;
    setText('');
    setKcal('');
    setCarbs('');
    setProtein('');
    setFat('');
    setIsAi(false);
    setPicked(null);
    setSavedPhoto(undefined);
    setAnalysis({ status: 'idle' });
  };

  const save = async () => {
    const menu = text.trim() || (hasPhoto ? '사진으로 기록' : '');
    if (!menu) return notify('무엇을 먹었는지 적거나 사진을 넣어 주세요.');
    const id = meal?.id ?? newId();
    setBusy('save');
    try {
      const photo = picked ? await savePhoto(picked, `${id}-${Date.now().toString(36)}`) : savedPhoto;
      const next: Meal = { id, type, text: menu, kcal: num(kcal, 0), carbs: num(carbs), protein: num(protein), fat: num(fat), photo, ai: isAi || undefined };
      updateLog(date, (l) => ({ ...l, meals: meal ? l.meals.map((m) => (m.id === id ? next : m)) : [...l.meals, next] }));
      if (meal?.photo && meal.photo !== photo) deletePhoto(meal.photo);
      if (meal) onDone?.();
      else reset();
    } catch (e) {
      notify('저장하지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const running = analysis.status === 'running';
  const canAnalyze = hasPhoto || text.trim().length > 0;

  return (
    <View style={{ gap: 10, ...(meal ? {} : { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }) }}>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {MEAL_TYPES.map((t) => (
          <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} />
        ))}
      </View>

      {previewUri ? (
        <View>
          <Pressable onPress={() => setViewing(previewUri)}>
            <Image source={{ uri: previewUri }} style={{ width: '100%', aspectRatio: picked ? picked.width / picked.height : 4 / 3, maxHeight: 260, borderRadius: 12, backgroundColor: colors.line }} resizeMode="cover" />
          </Pressable>
          <Pressable onPress={removePhoto} hitSlop={8} style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>✕</Text>
          </Pressable>
          {running && (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, borderRadius: 12, backgroundColor: 'rgba(15,20,35,0.45)', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={{ color: '#fff', fontWeight: '700' }}>AI가 사진을 보고 있어요…</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label={busy === 'photo' ? '사진 준비 중…' : '📷 사진 찍기'} outline disabled={busy != null} onPress={() => addPhoto('camera')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="🖼️ 앨범에서" outline disabled={busy != null} onPress={() => addPhoto('library')} />
          </View>
        </View>
      )}

      {analysis.status === 'running' && !previewUri && (
        <View style={[styles.row, { justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>AI가 메뉴를 보고 추정하는 중…</Text>
        </View>
      )}
      {analysis.status === 'done' && <EstimateBox result={analysis.result} />}
      {analysis.status === 'error' && (
        <View style={{ backgroundColor: '#FDECEC', borderRadius: 10, padding: 10, gap: 6 }}>
          <Text style={{ color: colors.danger, lineHeight: 19 }}>{analysis.message}</Text>
          <Pressable onPress={() => analyze()} hitSlop={6}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>다시 시도 ›</Text>
          </Pressable>
        </View>
      )}

      <Input value={text} onChangeText={setText} placeholder={hasPhoto ? '메뉴 (비워두면 AI가 채워요)' : '메뉴 (예: 김치찌개, 현미밥 반 공기)'} />
      <View style={styles.row}>
        <NumBox label="열량" unit="kcal" value={kcal} onChange={setKcal} />
        {MACROS.map((m) => (
          <NumBox
            key={m.k}
            label={m.short}
            unit="g"
            color={m.color}
            value={m.k === 'carbs' ? carbs : m.k === 'protein' ? protein : fat}
            onChange={m.k === 'carbs' ? setCarbs : m.k === 'protein' ? setProtein : setFat}
          />
        ))}
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button
            label={running ? '분석 중…' : analysis.status === 'done' || isAi ? '🤖 다시 분석' : '🤖 AI로 추정'}
            outline
            disabled={!canAnalyze || running || busy != null}
            onPress={() => analyze()}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={busy === 'save' ? '저장 중…' : meal ? '저장' : '추가'} disabled={running || busy != null} onPress={save} />
        </View>
      </View>
      {ai.loaded && !ai.apiKey && (
        <Pressable onPress={() => setSetupOpen(true)} hitSlop={4}>
          <Text style={styles.muted}>
            🤖 Claude API 키를 연결하면 사진만으로 칼로리·탄단지를 추정해요. <Text style={{ color: colors.primary, fontWeight: '700' }}>연결하기 ›</Text>
          </Text>
        </Pressable>
      )}

      <PhotoViewer uri={viewing} onClose={() => setViewing(undefined)} />
      <Modal visible={setupOpen} animationType="slide" onRequestClose={() => setSetupOpen(false)}>
        <AiSetupSheet
          onClose={() => setSetupOpen(false)}
          onSaved={() => {
            setSetupOpen(false);
            if (canAnalyze) analyze();
          }}
        />
      </Modal>
    </View>
  );
}

function NumBox({ label, unit, value, onChange, color = colors.text }: { label: string; unit: string; value: string; onChange: (v: string) => void; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>
        {label} <Text style={{ color: colors.sub, fontWeight: '400' }}>{unit}</Text>
      </Text>
      <Input value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="-" style={{ paddingHorizontal: 8, textAlign: 'center' }} />
    </View>
  );
}

function EstimateBox({ result }: { result: MealEstimate }) {
  return (
    <View style={{ backgroundColor: '#EEF2FF', borderRadius: 10, padding: 10, gap: 4 }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={{ fontWeight: '800', color: colors.text }}>🤖 AI 추정 · {result.kcal.toLocaleString()}kcal</Text>
        <Text style={[styles.muted, result.confidence === 'low' && { color: colors.danger }]}>신뢰도 {CONFIDENCE_TEXT[result.confidence]}</Text>
      </View>
      {result.items.map((i, idx) => (
        <Text key={idx} style={{ color: colors.text, fontSize: 13 }}>
          • {i.name} <Text style={{ color: colors.sub }}>{i.amount}</Text> — {Math.round(i.kcal)}kcal
        </Text>
      ))}
      {result.note ? <Text style={[styles.muted, { lineHeight: 18 }]}>{result.note}</Text> : null}
      <Text style={[styles.muted, { fontSize: 11 }]}>사진으로 본 대략적인 값이에요. 아래 숫자를 고쳐서 저장할 수 있어요.</Text>
    </View>
  );
}

function AiSetupSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.screenTitle}>AI 연결</Text>
          <Button label="닫기" small outline onPress={onClose} />
        </View>
        <AiSettingsCard onSaved={onSaved} />
      </ScrollView>
    </View>
  );
}

/** 하루 탄·단·지 합계와 열량 비율 (권장 비율과 비교) */
function NutritionCard({ meals }: { meals: Meal[] }) {
  const t = mealTotals(meals);
  const shares = macroShares(t);
  if (!shares && t.kcal === 0) return null;
  return (
    <Card title="📊 하루 영양" right={t.kcal > 0 ? <Text style={{ fontWeight: '800', color: colors.text }}>{Math.round(t.kcal).toLocaleString()}kcal</Text> : undefined}>
      <View style={styles.row}>
        {MACROS.map((m) => (
          <View key={m.k} style={{ flex: 1, backgroundColor: colors.bg, borderRadius: 10, padding: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: m.color }}>{m.label}</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
              {Math.round(t[m.k])}
              <Text style={{ fontSize: 12, color: colors.sub }}>g</Text>
            </Text>
            {shares && <Text style={styles.muted}>{Math.round(shares[m.k] * 100)}%</Text>}
          </View>
        ))}
      </View>
      {shares && (
        <>
          <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.line }}>
            {MACROS.map((m) => (
              <View key={m.k} style={{ flex: shares[m.k], backgroundColor: m.color }} />
            ))}
          </View>
          <Text style={[styles.muted, { lineHeight: 18 }]}>
            권장 비율 {MACROS.map((m) => `${m.short} ${MACRO_RANGE[m.k][0]}–${MACRO_RANGE[m.k][1]}%`).join(' · ')} (한국인 영양소 섭취기준, 열량 기준)
          </Text>
        </>
      )}
    </Card>
  );
}
