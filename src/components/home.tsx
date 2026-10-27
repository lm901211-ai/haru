import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Card, NumberField, ProgressBar, styles } from './ui';
import { useStore } from '../store';
import { fetchWeather, Weather } from '../weather';
import { bmiInfo, dayScore, scoreComment } from '../score';
import { challengeProgress } from '../challenges';
import { addDays, todayKey, weekdayOf } from '../date';
import { colors } from '../theme';

export function WeatherCard() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchWeather()
      .then(setWeather)
      .catch((e) => setError(e instanceof Error ? e.message : '날씨를 불러오지 못했어요'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

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

export function ScoreReport() {
  const { data } = useStore();
  const today = todayKey();
  const todayScore = dayScore(data, today);
  const yesterday = dayScore(data, addDays(today, -1));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => ({ date: d, ...dayScore(data, d) }));

  const diff = todayScore.total - yesterday.total;
  const ranked = [...todayScore.items].sort((a, b) => b.ratio - a.ratio);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return (
    <Card title="📊 오늘의 리포트">
      <View style={[styles.row, { alignItems: 'flex-end', justifyContent: 'space-between' }]}>
        <View>
          <Text style={{ fontSize: 48, fontWeight: '900', color: colors.primary, lineHeight: 52 }}>
            {todayScore.total}
            <Text style={{ fontSize: 18, color: colors.sub, fontWeight: '600' }}> 점</Text>
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{scoreComment(todayScore.total)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={styles.muted}>어제</Text>
          {yesterday.hasRecord ? (
            <>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{yesterday.total}점</Text>
              <Text style={{ fontWeight: '700', color: diff > 0 ? colors.steps : diff < 0 ? colors.danger : colors.sub }}>
                {diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${-diff}` : '― 0'}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 15, color: colors.sub }}>기록 없음</Text>
          )}
        </View>
      </View>

      {/* 최근 7일 점수 */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 84, marginTop: 4 }}>
        {week.map((d) => {
          const isToday = d.date === today;
          return (
            <View key={d.date} style={{ alignItems: 'center', flex: 1, gap: 3 }}>
              <Text style={{ fontSize: 11, color: colors.sub }}>{d.hasRecord ? d.total : ''}</Text>
              <View
                style={{
                  width: 18,
                  height: Math.max(d.hasRecord ? (d.total / 100) * 52 : 0, 3),
                  borderRadius: 5,
                  backgroundColor: isToday ? colors.primary : d.hasRecord ? '#B9C9FF' : colors.line,
                }}
              />
              <Text style={{ fontSize: 11, color: isToday ? colors.primary : colors.sub, fontWeight: isToday ? '700' : '400' }}>{weekdayOf(d.date)}</Text>
            </View>
          );
        })}
      </View>

      <View style={{ gap: 7, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}>
        {todayScore.items.map((item) => (
          <View key={item.key} style={styles.row}>
            <Text style={{ width: 62, fontSize: 13, color: colors.text }}>{item.label}</Text>
            <View style={{ flex: 1 }}>
              <ProgressBar value={item.ratio} max={1} color={item.color} />
            </View>
            <Text style={{ width: 44, textAlign: 'right', fontSize: 12, color: colors.sub }}>
              {Math.round(item.ratio * item.weight)}/{item.weight}
            </Text>
          </View>
        ))}
      </View>

      {best.ratio > 0 && (
        <Text style={styles.muted}>
          👏 가장 잘한 것: <Text style={{ color: colors.text, fontWeight: '700' }}>{best.label}</Text>
          {worst.ratio < 1 && (
            <>
              {'   '}🎯 채워볼 것: <Text style={{ color: colors.text, fontWeight: '700' }}>{worst.label}</Text>
            </>
          )}
        </Text>
      )}
    </Card>
  );
}

export function WeightCard() {
  const { data, getLog, updateLog, setProfile } = useStore();
  const today = todayKey();
  const weight = getLog(today).weight;
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
    <Card title="⚖️ 오늘의 체중">
      {!height && (
        <>
          <Text style={styles.muted}>BMI 계산을 위해 키를 먼저 입력해 주세요</Text>
          <NumberField decimal value={undefined} placeholder="키 (예: 170)" unit="cm" onCommit={(v) => v && setProfile({ ...data.profile, heightCm: v })} />
        </>
      )}
      <NumberField decimal value={weight} placeholder="오늘 몸무게 (예: 65.2)" unit="kg" onCommit={(v) => updateLog(today, (l) => ({ ...l, weight: v }))} />
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        {height ? <Text style={styles.muted}>키 {height}cm</Text> : <View />}
        {change != null && (
          <Text style={{ fontWeight: '600', color: change > 0 ? colors.danger : change < 0 ? colors.steps : colors.sub }}>
            지난 기록 대비 {change > 0 ? `+${change}` : change}kg
          </Text>
        )}
      </View>
      {bmi && (
        <View style={[styles.row, { justifyContent: 'space-between', backgroundColor: colors.bg, borderRadius: 10, padding: 10 }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>BMI {bmi.bmi.toFixed(1)}</Text>
          <Text style={{ color: bmi.color, fontWeight: '700' }}>{bmi.label}</Text>
        </View>
      )}
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
          <View key={c.id} style={{ gap: 5 }}>
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
          </View>
        );
      })}
    </Card>
  );
}
