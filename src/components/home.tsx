import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Card, Chip, NumberField, ProgressBar, styles } from './ui';
import { useStore } from '../store';
import { fetchWeather, Weather } from '../weather';
import { bmiInfo, controlStats, cpkVerdict, dayScore, SCORE_LSL, scoreComment } from '../score';
import { challengeProgress } from '../challenges';
import { dayActivities } from '../report';
import { addDays, formatKey, fromKey, todayKey } from '../date';
import { ControlChart, Ring } from './charts';
import { colors } from '../theme';

export function WeatherCard() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchWeather()
      .then((w) => {
        if (!alive) return;
        setWeather(w);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : '날씨를 불러오지 못했어요'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const load = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <Card
      title={weather ? `📍 ${weather.place}` : '오늘의 날씨'}
      right={
        <Pressable onPress={load} hitSlop={10} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontSize: 18 }}>↻</Text>}
        </Pressable>
      }
    >
      {error && !weather && <Text style={styles.muted}>{error} · 오른쪽 위 ↻ 로 다시 시도</Text>}
      {weather && (
        <>
          <View style={[styles.row, { gap: 14 }]}>
            <Text style={{ fontSize: 44 }}>{weather.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text }}>
                {weather.temp}°<Text style={{ fontSize: 16, fontWeight: '600', color: colors.sub }}> {weather.label}</Text>
              </Text>
              <Text style={styles.muted}>
                체감 {weather.feelsLike}° · 최고 {weather.max}° / 최저 {weather.min}°
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.muted}>강수확률</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.water }}>{weather.rainChance}%</Text>
            </View>
          </View>
          {weather.rainChance >= 50 && <Text style={{ color: colors.water, fontWeight: '600' }}>☔ 우산 챙기세요!</Text>}
          {weather.note && <Text style={styles.muted}>{weather.note}</Text>}
        </>
      )}
    </Card>
  );
}

export function DailyReport() {
  const { data } = useStore();
  const today = todayKey();
  // 어제 기록이 없으면(처음 쓰는 날 등) 오늘 리포트부터 보여줌
  const [which, setWhich] = useState<'yesterday' | 'today'>(() => (dayScore(data, addDays(today, -1)).hasRecord ? 'yesterday' : 'today'));
  const date = which === 'today' ? today : addDays(today, -1);
  const score = dayScore(data, date);
  const before = dayScore(data, addDays(date, -1));
  const diff = score.total - before.total;
  const ranked = [...score.items].sort((a, b) => b.ratio - a.ratio);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const fullCount = score.items.filter((i) => i.ratio >= 1).length;
  const activities = dayActivities(data, date);

  return (
    <Card
      title="📊 하루 리포트"
      right={
        <View style={styles.row}>
          <Chip label="어제" active={which === 'yesterday'} onPress={() => setWhich('yesterday')} />
          <Chip label="오늘" active={which === 'today'} onPress={() => setWhich('today')} />
        </View>
      }
    >
      <View style={[styles.row, { gap: 16 }]}>
        <Ring ratio={score.total / 100} size={118} stroke={12} color={colors.primary}>
          <Text style={{ fontSize: 34, fontWeight: '900', color: colors.text }}>{score.hasRecord ? score.total : '-'}</Text>
          <Text style={{ fontSize: 11, color: colors.sub, marginTop: -2 }}>/ 100점</Text>
        </Ring>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontSize: 13, color: colors.sub }}>{formatKey(date)}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{score.hasRecord ? scoreComment(score.total) : '기록이 없어요'}</Text>
          {before.hasRecord && score.hasRecord && (
            <Text style={{ fontWeight: '700', color: diff > 0 ? colors.steps : diff < 0 ? colors.danger : colors.sub }}>
              {which === 'today' ? '어제' : '그저께'} {before.total}점 대비 {diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${-diff}` : '변동 없음'}
            </Text>
          )}
          <Text style={styles.muted}>
            목표 100% 달성 {fullCount}/{score.items.length}개 항목
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, marginTop: 4 }}>
        {score.items.map((item) => (
          <View key={item.key} style={{ width: '25%', alignItems: 'center', gap: 3 }}>
            <Ring ratio={item.ratio} size={58} stroke={6} color={item.color}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: item.ratio >= 1 ? item.color : colors.text }}>{Math.round(item.ratio * 100)}%</Text>
            </Ring>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{item.label}</Text>
            <Text style={{ fontSize: 10, color: colors.sub }}>{item.valueText}</Text>
          </View>
        ))}
      </View>

      {activities.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{which === 'today' ? '오늘' : '어제'} 한 일</Text>
          {activities.map((a) => (
            <View key={a.label} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ width: 62, fontSize: 13, color: colors.sub }}>
                {a.icon} {a.label}
              </Text>
              <Text style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 }}>{a.text}</Text>
            </View>
          ))}
        </View>
      )}

      {score.hasRecord && best.ratio > 0 && (
        <View style={{ backgroundColor: colors.bg, borderRadius: 10, padding: 10, gap: 2 }}>
          <Text style={{ fontSize: 13, color: colors.text }}>
            👏 가장 잘한 것 <Text style={{ fontWeight: '800' }}>{best.label}</Text> ({Math.round(best.ratio * 100)}%)
          </Text>
          {worst.ratio < 1 && (
            <Text style={{ fontSize: 13, color: colors.text }}>
              🎯 채워볼 것 <Text style={{ fontWeight: '800' }}>{worst.label}</Text> ({Math.round(worst.ratio * 100)}%)
            </Text>
          )}
        </View>
      )}
    </Card>
  );
}

export function ScoreControlCard() {
  const { data } = useStore();
  const st = controlStats(data, todayKey(), 14);
  const verdict = cpkVerdict(st);
  const [help, setHelp] = useState(false);

  const stats = [
    { label: '평균 (CL)', value: st.n ? `${Math.round(st.mean)}점` : '-' },
    { label: '편차 (σ)', value: st.n >= 2 ? `±${st.sigma.toFixed(1)}` : '-' },
    { label: 'Cpk', value: st.cpk != null ? st.cpk.toFixed(2) : '-', color: verdict.color },
    { label: `${SCORE_LSL}점 미만`, value: `${st.belowLsl}일`, color: st.belowLsl ? colors.exercise : undefined },
  ];

  return (
    <Card title="📈 루틴 관리도 · 최근 14일" right={<Pressable onPress={() => setHelp(!help)} hitSlop={8}><Text style={{ color: colors.primary, fontWeight: '600' }}>{help ? '닫기' : '보는 법'}</Text></Pressable>}>
      {st.n === 0 ? (
        <Text style={[styles.empty, { paddingVertical: 30 }]}>며칠 기록이 쌓이면 관리도가 그려져요</Text>
      ) : (
        <ControlChart
          points={st.points.map((p) => ({ label: String(fromKey(p.date).getDate()), value: p.value }))}
          cl={st.mean}
          ucl={st.ucl}
          lcl={st.lcl}
          lsl={SCORE_LSL}
        />
      )}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {stats.map((s) => (
          <View key={s.label} style={{ flex: 1, backgroundColor: colors.bg, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: colors.sub }}>{s.label}</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: s.color ?? colors.text }}>{s.value}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontWeight: '700', color: verdict.color }}>
        루틴 안정도: {verdict.text}
        {st.outOfControl > 0 ? <Text style={{ color: colors.danger }}>{`  · 관리 이탈 ${st.outOfControl}일`}</Text> : null}
      </Text>
      {help && (
        <View style={{ gap: 3 }}>
          <Text style={styles.muted}>· CL: 기간 평균 점수 / UCL·LCL: 평균 ± 3σ (평소 범위)</Text>
          <Text style={styles.muted}>· σ: 하루하루 점수 차이(이동범위) 평균 ÷ 1.128 로 추정 (I-MR 관리도 방식)</Text>
          <Text style={styles.muted}>· LSL: 목표 하한 {SCORE_LSL}점. 아래 주황 영역은 미달 구간</Text>
          <Text style={styles.muted}>· Cpk = (평균 − {SCORE_LSL}) ÷ 3σ. 1.33↑ 매우 안정, 1.0↑ 안정, 1.0 미만이면 점수가 자주 {SCORE_LSL}점 아래로 떨어질 수 있어요</Text>
          <Text style={styles.muted}>· 빨간 점: 평소 범위를 벗어난 날, 주황 점: {SCORE_LSL}점 미만인 날</Text>
        </View>
      )}
    </Card>
  );
}

export function QuickRecordCard({ links }: { links: ReactNode }) {
  const { data, getLog, updateLog, setProfile } = useStore();
  const today = todayKey();
  const log = getLog(today);
  const weight = log.weight;
  const height = data.profile.heightCm;

  // 오늘 이전의 가장 최근 체중 기록
  const prevDate = Object.keys(data.logs)
    .filter((d) => d < today && data.logs[d].weight != null)
    .sort()
    .pop();
  const prevWeight = prevDate ? data.logs[prevDate].weight : undefined;
  const change = weight != null && prevWeight != null ? Math.round((weight - prevWeight) * 10) / 10 : null;
  const bmi = weight != null && height ? bmiInfo(weight, height) : null;

  return (
    <Card title="✏️ 오늘 빠른 기록">
      <View style={[styles.row, { gap: 10 }]}>
        <Text style={{ width: 52, fontWeight: '700', color: colors.text }}>💧 물</Text>
        <Pressable
          onPress={() => updateLog(today, (l) => ({ ...l, water: Math.max(0, l.water - 1) }))}
          hitSlop={6}
          style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: colors.water, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.water, fontSize: 18, fontWeight: '700' }}>－</Text>
        </Pressable>
        <Pressable
          onPress={() => updateLog(today, (l) => ({ ...l, water: l.water + 1 }))}
          style={({ pressed }) => [{ flex: 1, height: 40, backgroundColor: '#E8F6FD', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}
        >
          <Text style={{ color: colors.water, fontWeight: '800' }}>
            ＋ 한 잔 ({log.water}/{data.goals.waterCups})
          </Text>
        </Pressable>
      </View>

      <View style={[styles.row, { gap: 10 }]}>
        <Text style={{ width: 52, fontWeight: '700', color: colors.text }}>⚖️ 체중</Text>
        <View style={{ flex: 1 }}>
          <NumberField decimal value={weight} placeholder="오늘 몸무게 (예: 65.2)" unit="kg" onCommit={(v) => updateLog(today, (l) => ({ ...l, weight: v }))} />
        </View>
      </View>
      {!height && (
        <View style={[styles.row, { gap: 10 }]}>
          <Text style={{ width: 52, fontWeight: '700', color: colors.text }}>📏 키</Text>
          <View style={{ flex: 1 }}>
            <NumberField decimal value={undefined} placeholder="BMI 계산용 키 (예: 170)" unit="cm" onCommit={(v) => v && setProfile({ ...data.profile, heightCm: v })} />
          </View>
        </View>
      )}
      {(bmi || change != null) && (
        <View style={[styles.row, { justifyContent: 'space-between', backgroundColor: colors.bg, borderRadius: 10, padding: 10 }]}>
          {bmi ? (
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              BMI {bmi.bmi.toFixed(1)} <Text style={{ color: bmi.color }}>{bmi.label}</Text>
            </Text>
          ) : (
            <View />
          )}
          {change != null && (
            <Text style={{ fontWeight: '600', color: change > 0 ? colors.danger : change < 0 ? colors.steps : colors.sub }}>
              지난 기록 대비 {change > 0 ? `+${change}` : change}kg
            </Text>
          )}
        </View>
      )}
      <View style={[styles.row, { justifyContent: 'space-around', paddingTop: 2 }]}>{links}</View>
    </Card>
  );
}

export function ChallengeSummary({ onOpen }: { onOpen: () => void }) {
  const { data, updateChallenge } = useStore();
  const today = todayKey();
  return (
    <Card title="🎯 목표 진행" right={<Pressable onPress={onOpen}><Text style={{ color: colors.primary, fontWeight: '600' }}>전체 ›</Text></Pressable>}>
      {data.challenges.length === 0 && (
        <Pressable onPress={onOpen}>
          <Text style={[styles.muted, { textAlign: 'center', paddingVertical: 6 }]}>다이어트, 공부 같은 장·단기 목표를 만들어 보세요 ›</Text>
        </Pressable>
      )}
      {data.challenges.map((c) => {
        const p = challengeProgress(data, c, today);
        const pct = Math.round(p.ratio * 100);
        const color = p.status === 'done' ? colors.steps : p.status === 'behind' ? colors.exercise : colors.primary;
        const doneToday = c.kind === 'streak' && c.doneDates.includes(today);
        return (
          <View key={c.id} style={{ gap: 4 }}>
            <View style={styles.row}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                {c.emoji} {c.title}
              </Text>
              <Text style={styles.muted}>{p.dayLabel}</Text>
              {c.kind === 'streak' && (
                <Pressable
                  hitSlop={6}
                  onPress={() =>
                    updateChallenge(c.id, (x) =>
                      x.kind === 'streak'
                        ? { ...x, doneDates: doneToday ? x.doneDates.filter((d) => d !== today) : [...x.doneDates, today] }
                        : x,
                    )
                  }
                  style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: doneToday ? colors.steps : colors.bg, borderWidth: 1, borderColor: doneToday ? colors.steps : colors.line }}
                >
                  {doneToday && <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</Text>}
                </Pressable>
              )}
              <Text style={{ width: 44, textAlign: 'right', fontWeight: '800', color }}>{pct}%</Text>
            </View>
            <ProgressBar value={p.ratio} max={1} color={color} marker={p.expected} />
            <Text style={[styles.muted, { fontSize: 12 }]} numberOfLines={1}>
              {p.summary}
              {p.status === 'behind' ? '  · 조금 뒤처졌어요' : p.status === 'ahead' ? '  · 순항 중' : ''}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}
