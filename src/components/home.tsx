import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Card, GradeBadge, NumberField, ProgressBar, Segmented, styles } from './ui';
import { useStore } from '../store';
import { fetchWeather, Weather } from '../weather';
import { bmiInfo, dayScore, scoreComment } from '../score';
import { challengeProgress } from '../challenges';
import { dayActivities } from '../report';
import { periodReport } from '../grade';
import { addDays, formatKey, todayKey } from '../date';
import { Ring } from './charts';
import { colors, ink, plain } from '../theme';

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
      title={weather ? `📍 ${weather.place}` : '🌤️ 오늘의 날씨'}
      style={{ backgroundColor: '#EEF5FF' }}
      right={
        <Pressable
          role="button"
          aria-label="날씨 새로고침"
          aria-busy={loading}
          onPress={load}
          disabled={loading}
          hitSlop={6}
          style={({ pressed }) => [styles.navButton, { width: 38, height: 38, backgroundColor: '#fff' }, pressed && { opacity: 0.6 }]}
        >
          {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontSize: 18 }}>↻</Text>}
        </Pressable>
      }
    >
      {error && !weather && <Text style={styles.muted}>{error} · 오른쪽 위 ↻ 로 다시 시도</Text>}
      {weather && (
        <>
          <View style={[styles.row, { gap: 14 }]}>
            <Text style={{ fontSize: 46 }} aria-hidden>
              {weather.emoji}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1 }}>
                {weather.temp}°<Text style={{ fontSize: 16, fontWeight: '600', color: colors.sub }}> {weather.label}</Text>
              </Text>
              <Text style={styles.muted}>
                체감 {weather.feelsLike}° · 최고 {weather.max}° / 최저 {weather.min}°
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.muted}>강수확률</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: ink(colors.water) }}>{weather.rainChance}%</Text>
            </View>
          </View>
          {weather.rainChance >= 50 && <Text style={{ color: ink(colors.water), fontWeight: '700' }}>☔ 우산 챙기세요!</Text>}
          {weather.note && <Text style={styles.muted}>{weather.note}</Text>}
        </>
      )}
    </Card>
  );
}

export function DailyReport({ onOpenReport }: { onOpenReport: () => void }) {
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
  const week = periodReport(data, 'week', 0, today);

  return (
    <Card
      title="📊 하루 리포트"
      right={
        <View style={{ width: 124 }}>
          <Segmented
            label="리포트 날짜"
            options={[
              { value: 'yesterday', label: '어제' },
              { value: 'today', label: '오늘' },
            ]}
            value={which}
            onChange={setWhich}
          />
        </View>
      }
    >
      <View style={[styles.row, { gap: 16 }]}>
        <Ring ratio={score.total / 100} size={118} stroke={12} color={colors.primary} label={score.hasRecord ? `하루 점수 ${score.total}점, 100점 만점` : '하루 점수 기록 없음'}>
          <Text style={{ fontSize: 36, fontWeight: '900', color: colors.text, letterSpacing: -1 }} maxFontSizeMultiplier={1.1}>
            {score.hasRecord ? score.total : '-'}
          </Text>
          <Text style={{ fontSize: 11, color: colors.sub, marginTop: -2 }} maxFontSizeMultiplier={1.1}>
            / 100점
          </Text>
        </Ring>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontSize: 13, color: colors.sub }}>{formatKey(date)}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{score.hasRecord ? scoreComment(score.total) : '기록이 없어요'}</Text>
          {before.hasRecord && score.hasRecord && (
            <Text style={{ fontWeight: '700', color: diff > 0 ? ink(colors.steps) : diff < 0 ? ink(colors.danger) : colors.sub }}>
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
          <View
            key={item.key}
            role="img"
            aria-label={`${plain(item.label)} ${Math.round(item.ratio * 100)}%, ${item.valueText}`}
            style={{ width: '25%', alignItems: 'center', gap: 3 }}
          >
            <Ring ratio={item.ratio} size={58} stroke={6} color={item.color}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: item.ratio >= 1 ? ink(item.color) : colors.text }} maxFontSizeMultiplier={1.1}>
                {Math.round(item.ratio * 100)}%
              </Text>
            </Ring>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }} maxFontSizeMultiplier={1.3}>
              {item.label}
            </Text>
            <Text style={{ fontSize: 11, color: colors.sub }} maxFontSizeMultiplier={1.3}>
              {item.valueText}
            </Text>
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
        <View style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 12, gap: 4 }}>
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
      <Pressable
        role="button"
        aria-label={`이번 주 성적 ${week.grade ? `${week.grade.grade} 등급 ${week.score?.toFixed(1)}점` : '집계 전'}. 성적표 보기`}
        onPress={onOpenReport}
        style={({ pressed }) => [styles.row, { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, minHeight: 44 }, pressed && { opacity: 0.6 }]}
      >
        <View style={[styles.row, { gap: 8 }]}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>📋 이번 주 성적</Text>
          {week.grade ? (
            <>
              <GradeBadge grade={week.grade} size={22} />
              <Text style={{ fontSize: 13, color: colors.text }}>{week.score?.toFixed(1)}점</Text>
            </>
          ) : (
            <Text style={styles.muted}>집계 전</Text>
          )}
        </View>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>성적표 보기 ›</Text>
      </Pressable>
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
        <Text style={{ width: 52, fontWeight: '700', color: colors.text }}>⚖️ 체중</Text>
        <View style={{ flex: 1 }}>
          <NumberField decimal value={weight} label="오늘 체중" placeholder="오늘 몸무게 (예: 65.2)" unit="kg" onCommit={(v) => updateLog(today, (l) => ({ ...l, weight: v }))} />
        </View>
      </View>
      {!height && (
        <View style={[styles.row, { gap: 10 }]}>
          <Text style={{ width: 52, fontWeight: '700', color: colors.text }}>📏 키</Text>
          <View style={{ flex: 1 }}>
            <NumberField decimal value={undefined} label="키" placeholder="BMI 계산용 키 (예: 170)" unit="cm" onCommit={(v) => v && setProfile({ ...data.profile, heightCm: v })} />
          </View>
        </View>
      )}
      {(bmi || change != null) && (
        <View style={[styles.row, { justifyContent: 'space-between', backgroundColor: colors.bg, borderRadius: 12, padding: 12 }]}>
          {bmi ? (
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              BMI {bmi.bmi.toFixed(1)} <Text style={{ color: ink(bmi.color) }}>{bmi.label}</Text>
            </Text>
          ) : (
            <View />
          )}
          {change != null && (
            <Text style={{ fontWeight: '700', color: change > 0 ? ink(colors.danger) : change < 0 ? ink(colors.steps) : colors.sub }}>
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
    <Card
      title="🎯 목표 진행"
      right={
        <Pressable role="button" aria-label="목표 전체 보기" onPress={onOpen} hitSlop={10}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>전체 ›</Text>
        </Pressable>
      }
    >
      {data.challenges.length === 0 && (
        <Pressable role="button" onPress={onOpen}>
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
              {c.kind === 'streak' && today >= c.startDate && (
                <Pressable
                  role="checkbox"
                  aria-checked={doneToday}
                  aria-label={`${c.title} 오늘 했어요`}
                  hitSlop={10}
                  onPress={() =>
                    updateChallenge(c.id, (x) =>
                      x.kind === 'streak'
                        ? { ...x, doneDates: doneToday ? x.doneDates.filter((d) => d !== today) : [...x.doneDates, today] }
                        : x,
                    )
                  }
                  style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: doneToday ? ink(colors.steps) : colors.bg, borderWidth: 1.5, borderColor: doneToday ? ink(colors.steps) : '#C9CED8' }}
                >
                  {doneToday && <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</Text>}
                </Pressable>
              )}
              <Text style={{ width: 46, textAlign: 'right', fontWeight: '800', color: ink(color) }}>{pct}%</Text>
            </View>
            <ProgressBar value={p.ratio} max={1} color={color} marker={p.expected} label={`${c.title} 진행률`} />
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
