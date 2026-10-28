export const colors = {
  bg: '#F4F6FA',
  card: '#FFFFFF',
  text: '#1A2233',
  sub: '#5E6677', // 배경(#F4F6FA)에서도 대비 5:1 이상
  line: '#E6E9F0',
  field: '#F7F8FB', // 입력칸 바탕
  soft: '#F1F3F8', // 아이콘 배지 · 보조 바탕
  outline: '#868E9E', // 체크박스 테두리처럼 알아봐야 하는 선 (흰 바탕 대비 3:1 이상)
  primary: '#2F5FE8', // 흰 글자와 대비 5.3:1
  primarySoft: '#EAF0FF',
  water: '#2FA8E0',
  steps: '#2BB673',
  exercise: '#FF8A3D',
  sleep: '#8B6CFF',
  danger: '#E5484D',
  star: '#F5B400',
};

export const radius = { card: 20, control: 12, pill: 999 };

/** 카드 그림자 (아주 옅게) */
export const shadow = { boxShadow: '0px 1px 2px rgba(22, 34, 64, 0.05), 0px 4px 14px rgba(22, 34, 64, 0.05)' } as const;

/** 목표 기간을 달력에 칠하는 형광펜 색 (목표 순서대로 돌려 씀) */
export const HIGHLIGHTERS = ['#FFE14D', '#7EE0B5', '#FF9CC2', '#8CC8FF', '#C9A7FF'];

/* ---------- 글자 대비 (WCAG AA 4.5:1) ---------- */

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexOf = (rgb: number[]) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const luminance = (hex: string) => {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const toHsl = ([r, g, b]: number[]) => {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
};
const fromHsl = ([h, s, l]: number[]) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => (v + m) * 255);
};

/** 색조·채도는 그대로 두고 밝기만 낮춰서 탁해지지 않게 */
const darkenUntil = (color: string, against: string, cache: Map<string, string>, target: number) => {
  const hit = cache.get(color);
  if (hit) return hit;
  let out = color;
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const [h, s, l] = toHsl(rgbOf(color));
    for (let lightness = l; lightness > 0 && contrast(out, against) < target; lightness -= 0.01) {
      out = hexOf(fromHsl([h, s, lightness]));
    }
  }
  cache.set(color, out);
  return out;
};

const inkCache = new Map<string, string>();
const solidCache = new Map<string, string>();

/** 그래프용 밝은 색을 글자색으로 쓸 때: 같은 색조로 어둡게 해서 밝은 바탕·옅은 색 바탕에서도 잘 읽히게 */
export const ink = (color: string) => darkenUntil(color, colors.bg, inkCache, 5.2);

/** 흰 글자를 올릴 바탕색: 흰 글자가 잘 읽히도록 같은 색조로 어둡게 */
export const solid = (color: string) => darkenUntil(color, '#FFFFFF', solidCache, 4.6);

/** 옅은 바탕색 (#RRGGBB + 투명도) */
export const tint = (color: string, alpha = 0.12) =>
  /^#[0-9a-f]{6}$/i.test(color) ? color + Math.round(alpha * 255).toString(16).padStart(2, '0') : color;

const LEADING_ICON = /^([^\sA-Za-z0-9가-힣]+)\s+(.+)$/;

/** "🍚 식사" → { icon: '🍚', text: '식사' } (앞에 이모지가 없으면 icon 없음) */
export function splitIcon(title: string): { icon?: string; text: string } {
  const m = title.match(LEADING_ICON);
  return m ? { icon: m[1], text: m[2] } : { text: title };
}

/** 화면 읽기 프로그램에 이모지 이름이 읽히지 않도록 글자만 남김 */
export const plain = (s: string) => splitIcon(s).text;
