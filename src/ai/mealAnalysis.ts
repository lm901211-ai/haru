import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import { MealType } from '../types';
import { AiModelId } from './settings';

// 스키마는 평평하게 유지 (배열에 describe 를 붙이면 $ref 로 쪼개지고, enum 은 설명으로만 전달돼서 문자열로 받음)
const EstimateSchema = z.object({
  is_food: z.boolean().describe('사진(또는 설명)에 먹을 수 있는 음식·음료가 있으면 true'),
  menu: z.string().describe('식사를 한 줄로 요약한 한국어 메뉴 이름 (예: "김치찌개 정식", "닭가슴살 샐러드와 아메리카노")'),
  items: z.array(
    z.object({
      name: z.string().describe('음식 이름 (한국어). 보이는 음식마다 한 항목'),
      amount: z.string().describe('추정 분량 (예: "1공기 210g", "1/2인분", "350ml")'),
      kcal: z.number().describe('열량 (kcal)'),
      carbs_g: z.number().describe('탄수화물 (g)'),
      protein_g: z.number().describe('단백질 (g)'),
      fat_g: z.number().describe('지방 (g)'),
    }),
  ),
  confidence: z.string().describe('추정 신뢰도: "high", "medium", "low" 중 하나'),
  note: z.string().describe('추정 근거나 불확실한 점을 한국어 한두 문장으로. 없으면 빈 문자열'),
});

const CONFIDENCE = ['high', 'medium', 'low'] as const;

const SYSTEM = `당신은 한국 음식과 식품 영양성분에 밝은 영양사입니다. 사용자가 보낸 식사 사진(또는 메뉴 설명)을 보고 음식별 분량과 열량(kcal), 탄수화물·단백질·지방(g)을 추정합니다.

추정 방법:
- 보이는 음식을 하나씩 구분해 항목으로 나눕니다. 밥, 국·찌개, 반찬, 소스, 음료도 각각 넣습니다.
- 그릇·접시·수저·손 같은 주변 물체의 크기를 기준으로 실제 분량을 가늠하고, 한국 가정식·식당 1인분의 일반적인 양을 참고합니다.
- 영양성분은 일반적인 식품 영양성분표 수준의 값을 기준으로 하고, 튀김·볶음·소스처럼 조리법에 따라 늘어나는 기름과 당을 반영합니다.
- 사용자 메모(메뉴 이름, 먹은 양 등)가 있으면 사진보다 우선해서 반영합니다.
- 사진만으로 알기 어려운 부분은 가장 그럴듯한 값으로 정하고, confidence 를 낮춘 뒤 note 에 무엇이 불확실한지 적습니다.
- 각 항목의 열량은 탄수화물·단백질 4kcal/g, 지방 9kcal/g 으로 계산한 값과 크게 어긋나지 않게 합니다 (술은 알코올 열량이 따로 있어 예외).
- 음식이 아닌 사진이면 is_food 를 false 로, items 를 빈 배열로 둡니다.
모든 글은 한국어로 씁니다.`;

export type EstimateItem = { name: string; amount: string; kcal: number; carbs: number; protein: number; fat: number };
export type MealEstimate = {
  menu: string;
  items: EstimateItem[];
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  confidence: (typeof CONFIDENCE)[number];
  note: string;
};

/** 화면에 그대로 보여줄 수 있는 오류 */
export class AiError extends Error {}

// Opus 5.5 가 안전 정책으로 거절하면 서버가 권장 모델로 다시 시도 (Haiku 5.5 는 지원 안 함)
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const client = (apiKey: string) =>
  // 사용자가 직접 넣은 본인 키로 휴대폰/브라우저에서 바로 호출
  new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 120_000 });

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * 식사 사진(없으면 메뉴 설명만)으로 열량과 탄·단·지를 추정.
 * React Native 의 fetch 는 응답 스트리밍을 못 해서 스트리밍 없이 한 번에 받는다 (응답이 짧아 충분함).
 */
export async function estimateMeal(opts: {
  apiKey: string;
  model: AiModelId;
  photoBase64?: string;
  mealType: MealType;
  hint?: string;
  signal?: AbortSignal;
}): Promise<MealEstimate> {
  const { apiKey, model, photoBase64, mealType, signal } = opts;
  const hint = opts.hint?.trim();
  if (!photoBase64 && !hint) throw new AiError('사진을 넣거나 메뉴를 적어 주세요.');

  const text = photoBase64
    ? `식사: ${mealType}\n사용자 메모: ${hint || '없음'}\n이 식사의 영양성분을 추정해 주세요.`
    : `식사: ${mealType}\n메뉴 설명: ${hint}\n사진은 없습니다. 설명에 양이 없으면 일반적인 1인분 기준으로 추정해 주세요.`;
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...(photoBase64 ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: photoBase64 } }] : []),
    { type: 'text', text },
  ];

  let res;
  try {
    res = await client(apiKey).beta.messages.parse(
      {
        model,
        max_tokens: 16000,
        system: SYSTEM,
        messages: [{ role: 'user', content }],
        output_config: { effort: 'medium', format: betaZodOutputFormat(EstimateSchema) },
        ...(model === 'claude-opus-5-5' ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
      },
      { signal },
    );
  } catch (e) {
    throw toAiError(e);
  }

  if (res.stop_reason === 'refusal') throw new AiError('AI가 이 사진은 분석하지 않았어요. 다른 사진으로 다시 시도해 주세요.');
  const out = res.parsed_output;
  if (!out) throw new AiError(res.stop_reason === 'max_tokens' ? '분석이 너무 길어져 멈췄어요. 다시 시도해 주세요.' : 'AI 응답을 읽지 못했어요. 다시 시도해 주세요.');
  if (!out.is_food || out.items.length === 0) throw new AiError(out.note || '사진에서 음식을 찾지 못했어요.');

  const items = out.items.map((i) => ({ name: i.name, amount: i.amount, kcal: pos(i.kcal), carbs: pos(i.carbs_g), protein: pos(i.protein_g), fat: pos(i.fat_g) }));
  const sum = (k: 'kcal' | 'carbs' | 'protein' | 'fat') => Math.round(items.reduce((s, i) => s + i[k], 0));
  return {
    menu: out.menu.trim() || items.map((i) => i.name).join(', '),
    items,
    kcal: sum('kcal'),
    carbs: sum('carbs'),
    protein: sum('protein'),
    fat: sum('fat'),
    confidence: CONFIDENCE.find((c) => c === out.confidence.trim().toLowerCase()) ?? 'medium',
    note: out.note.trim(),
  };
}

/** 키가 맞는지 확인 (요금이 들지 않는 모델 정보 조회) */
export async function verifyApiKey(apiKey: string): Promise<void> {
  try {
    await client(apiKey).models.retrieve('claude-opus-5-5');
  } catch (e) {
    throw toAiError(e);
  }
}

export const isAbort = (e: unknown) => e instanceof Anthropic.APIUserAbortError || (e instanceof Error && e.name === 'AbortError');

function toAiError(e: unknown): Error {
  if (isAbort(e)) return e as Error;
  if (e instanceof Anthropic.AuthenticationError) return new AiError('API 키가 올바르지 않아요. 설정에서 키를 다시 확인해 주세요.');
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError('이 API 키로는 사용할 수 없어요. Claude 콘솔에서 키 권한을 확인해 주세요.');
  if (e instanceof Anthropic.RateLimitError) return new AiError('요청이 몰렸어요. 잠시 후 다시 시도해 주세요.');
  if (e instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(e.message)) return new AiError('API 크레딧이 부족해요. Claude 콘솔(platform.claude.com) › Billing 에서 충전해 주세요.');
    return new AiError(`요청을 처리하지 못했어요. (${e.message})`);
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new AiError('응답이 너무 늦어요. 잠시 후 다시 시도해 주세요.');
  if (e instanceof Anthropic.APIConnectionError) return new AiError('인터넷에 연결되지 않았어요. 연결을 확인해 주세요.');
  if (e instanceof Anthropic.InternalServerError) return new AiError('AI 서버가 잠시 바빠요. 조금 뒤 다시 시도해 주세요.');
  if (e instanceof Anthropic.APIError) return new AiError(`AI 요청 오류 (${e.status ?? '?'}): ${e.message}`);
  return e instanceof Error ? e : new Error(String(e));
}
