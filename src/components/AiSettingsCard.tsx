import { useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { Button, Card, Input, Segmented, styles } from './ui';
import { confirmAction, notify } from '../dialog';
import { AI_MODELS, maskKey, saveApiKey, saveModel, useAiSettings } from '../ai/settings';
import { verifyApiKey } from '../ai/mealAnalysis';
import { colors } from '../theme';

const CONSOLE_KEYS = 'https://platform.claude.com/settings/keys';

/** 사진 칼로리 분석에 쓸 Claude API 키와 분석 방식 설정 (설정 화면 · 식단 화면에서 함께 씀) */
export function AiSettingsCard({ onSaved }: { onSaved?: () => void }) {
  const ai = useAiSettings();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const model = AI_MODELS.find((m) => m.id === ai.model) ?? AI_MODELS[0];
  const showInput = !ai.apiKey || editing;

  const save = async () => {
    const key = draft.trim();
    if (!key) return notify('API 키를 붙여넣어 주세요.');
    setBusy(true);
    try {
      await verifyApiKey(key);
      await saveApiKey(key);
      setDraft('');
      setEditing(false);
      notify('연결됐어요', '이제 식단에서 사진을 넣으면 칼로리와 탄단지를 추정해요.');
      onSaved?.();
    } catch (e) {
      notify('키를 확인하지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    confirmAction('API 키 삭제', '이 기기에서 API 키를 지울까요? 사진은 계속 저장되지만 AI 분석은 멈춰요.', '삭제', () => {
      saveApiKey(null).catch((e) => notify('삭제 실패', String(e)));
    });

  return (
    <Card title="🤖 사진 칼로리 분석 (AI)">
      <Text style={{ color: colors.text, lineHeight: 20 }}>
        식사 사진을 넣으면 Claude AI가 음식과 양을 보고 칼로리·탄수화물·단백질·지방을 추정해요. 본인 Claude API 키가 필요하고, 쓴 만큼 요금이 나가요.
      </Text>

      {ai.apiKey && !editing ? (
        <View style={[styles.row, { justifyContent: 'space-between', backgroundColor: '#EAF7EF', borderRadius: 10, padding: 10 }]}>
          <Text style={{ color: colors.text, fontWeight: '700', flexShrink: 1 }}>✅ 연결됨 · {maskKey(ai.apiKey)}</Text>
          <View style={styles.row}>
            <Button label="바꾸기" small outline onPress={() => setEditing(true)} />
            <Button label="삭제" small outline color={colors.danger} onPress={remove} />
          </View>
        </View>
      ) : null}

      {showInput && (
        <>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder="sk-ant- 로 시작하는 API 키 붙여넣기"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button label={busy ? '확인하는 중…' : '확인 후 저장'} disabled={busy} onPress={save} />
            </View>
            {editing && (
              <Button
                label="취소"
                outline
                onPress={() => {
                  setEditing(false);
                  setDraft('');
                }}
              />
            )}
          </View>
        </>
      )}

      <Text style={{ fontWeight: '700', color: colors.text }}>분석 방식</Text>
      <Segmented label="분석 방식" options={AI_MODELS.map((m) => ({ value: m.id, label: m.label }))} value={ai.model} onChange={(id) => saveModel(id).catch(() => {})} />
      <Text style={styles.muted}>{model.desc}</Text>

      <Pressable role="button" aria-expanded={help} onPress={() => setHelp((v) => !v)} hitSlop={8}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>API 키 받는 방법 {help ? '▴' : '▾'}</Text>
      </Pressable>
      {help && (
        <View style={{ gap: 4, backgroundColor: colors.bg, borderRadius: 10, padding: 10 }}>
          <Text style={{ color: colors.text, lineHeight: 20 }}>1. Claude 콘솔(platform.claude.com)에 가입하고 로그인해요.</Text>
          <Text style={{ color: colors.text, lineHeight: 20 }}>2. Settings › Billing 에서 크레딧을 충전해요. 쓴 만큼 차감되는 선불 방식이에요.</Text>
          <Text style={{ color: colors.text, lineHeight: 20 }}>3. Settings › API Keys 에서 ‘Create Key’로 키를 만들고 복사해요.</Text>
          <Text style={{ color: colors.text, lineHeight: 20 }}>4. 위 칸에 붙여넣고 ‘확인 후 저장’을 눌러요.</Text>
          <Pressable role="link" aria-label="Claude 콘솔 열기" onPress={() => Linking.openURL(CONSOLE_KEYS).catch(() => {})} hitSlop={8}>
            <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>Claude 콘솔 열기 ›</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.muted}>
        분석할 때만 사진이 Anthropic(Claude) 서버로 전송돼요. API 키는 {Platform.OS === 'web' ? '이 기기 브라우저에만' : '이 휴대폰에 암호화해서'} 저장하고, 백업 파일에는 넣지 않아요.
      </Text>
    </Card>
  );
}
