import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Empty, GradeBadge, headingLevel, ProgressBar, Screen, Segmented, SERIF, styles } from '../components/ui';
import { useStore } from '../store';
import { countedRangeLabel, DayGrade, GRADES, GradeInfo, PeriodKind, periodReport, PeriodReport } from '../grade';
import { fromKey, shortDate, todayKey, weekdayOf } from '../date';
import { colors, ink } from '../theme';

const PAPER = '#FFFDF7';
const PAPER_LINE = '#E8DFC9';
const PAPER_HEAD = '#F5F0E3';

function periodTitle(kind: PeriodKind, offset: number, dates: string[]): string {
  if (kind === 'week') return offset === 0 ? '이번 주 성적표' : offset === 1 ? '지난주 성적표' : '주간 성적표';
  return `${fromKey(dates[0]).getMonth() + 1}월 성적표`;
}

function rangeText(dates: string[]): string {
  const first = fromKey(dates[0]);
  return `${first.getFullYear()}.${shortDate(dates[0])} (${weekdayOf(dates[0])}) ~ ${shortDate(dates[dates.length - 1])} (${weekdayOf(dates[dates.length - 1])})`;
}

export default function ReportScreen() {
  const { data } = useStore();
  const [kind, setKind] = useState<PeriodKind>('week');
  const [offset, setOffset] = useState(0);
  const r = periodReport(data, kind, offset, todayKey());

  return (
    <Screen title="리포트">
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={{ width: 168 }}>
          <Segmented
            label="성적표 기간"
            options={[
              { value: 'week', label: '주간' },
              { value: 'month', label: '월간' },
            ]}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setOffset(0);
            }}
          />
        </View>
        <View style={[styles.row, { gap: 8 }]}>
          <Pressable role="button" aria-label={kind === 'week' ? '이전 주' : '이전 달'} onPress={() => setOffset(offset + 1)} hitSlop={4} style={({ pressed }) => [styles.navButton, { backgroundColor: '#fff' }, pressed && { opacity: 0.6 }]}>
            <Text style={styles.dateArrow}>‹</Text>
          </Pressable>
          <Pressable
            role="button"
            aria-label={kind === 'week' ? '다음 주' : '다음 달'}
            aria-disabled={offset === 0}
            onPress={() => setOffset(Math.max(0, offset - 1))}
            hitSlop={4}
            disabled={offset === 0}
            style={({ pressed }) => [styles.navButton, { backgroundColor: '#fff' }, offset === 0 && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.dateArrow}>›</Text>
          </Pressable>
        </View>
      </View>

      <ReportHeader r={r} title={periodTitle(kind, offset, r.dates)} />
      {r.score != null && (
        <>
          <SubjectTable r={r} />
          <GoalTable r={r} />
          <BodyCard r={r} />
          <CommentCard r={r} />
        </>
      )}
      <Legend />
    </Screen>
  );
}

function GradeStamp({ grade, size = 96 }: { grade: GradeInfo; size?: number }) {
  return (
    <View
      role="img"
      aria-label={`종합 ${grade.grade} 등급, ${grade.label}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 3,
        borderColor: ink(grade.color),
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-12deg' }],
      }}
    >
      <View style={{ position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderRadius: size / 2, borderWidth: 1, borderColor: ink(grade.color), opacity: 0.6 }} />
      <Text style={{ fontSize: size * 0.48, lineHeight: size * 0.56, fontWeight: '900', color: ink(grade.color), fontFamily: SERIF }} maxFontSizeMultiplier={1}>
        {grade.grade}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: '800', color: ink(grade.color) }} maxFontSizeMultiplier={1.1}>
        {grade.label}
      </Text>
    </View>
  );
}

function ReportHeader({ r, title }: { r: PeriodReport; title: string }) {
  const diff = r.score != null && r.prev ? Math.round((r.score - r.prev.score) * 10) / 10 : undefined;
  const absent = r.days.filter((d) => d.status === 'absent').length;
  return (
    <View style={{ backgroundColor: PAPER, borderRadius: 16, borderWidth: 1, borderColor: PAPER_LINE, padding: 16, gap: 12 }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ fontSize: 12, letterSpacing: 2, color: colors.sub }}>하루관리 생활 기록</Text>
        <Text role="heading" {...headingLevel(2)} style={{ fontSize: 22, fontWeight: '800', color: colors.text, fontFamily: SERIF }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: colors.sub }}>{rangeText(r.dates)}</Text>
      </View>
      <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: PAPER_LINE, height: 4 }} />

      {r.score == null || !r.grade ? (
        <Empty text={r.counted.length ? '이 기간에는 기록이 없어요' : '이 기간에는 집계할 기록이 없어요. 기록을 시작하면 성적표가 만들어져요.'} />
      ) : (
        <>
          <View style={[styles.row, { gap: 18, paddingHorizontal: 4 }]}>
            <GradeStamp grade={r.grade} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.muted}>종합 점수</Text>
              <Text style={{ fontSize: 34, fontWeight: '900', color: colors.text, fontFamily: SERIF }}>
                {r.score.toFixed(1)}
                <Text style={{ fontSize: 15, color: colors.sub }}> 점</Text>
              </Text>
              {r.prev && diff != null && (
                <Text style={{ fontSize: 13, fontWeight: '700', color: diff > 0 ? ink(colors.steps) : diff < 0 ? ink(colors.danger) : colors.sub }}>
                  {r.prevName} {r.prev.grade.grade} ({r.prev.score.toFixed(1)}) → {diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${-diff}` : '변동 없음'}
                </Text>
              )}
              <Text style={{ fontSize: 13, color: colors.text }}>
                출석 {r.recordedDays}/{r.counted.length}일{absent ? <Text style={{ color: ink(colors.danger) }}> · 결석 {absent}일</Text> : null}
              </Text>
              <Text style={[styles.muted, { fontSize: 12 }]}>{countedRangeLabel(r)}</Text>
            </View>
          </View>

          <DayBars days={r.days} kind={r.kind} />

          <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
            {r.distribution
              .filter((d) => d.count > 0)
              .map((d) => (
                <View key={d.grade.grade} style={[styles.row, { gap: 4, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: PAPER_LINE, paddingHorizontal: 8, paddingVertical: 3 }]}>
                  <Text style={{ fontWeight: '900', color: ink(d.grade.color), fontFamily: SERIF }}>{d.grade.grade}</Text>
                  <Text style={{ fontSize: 12, color: colors.text }}>{d.count}일</Text>
                </View>
              ))}
            {absent > 0 && (
              <View style={{ backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: PAPER_LINE, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 12, color: colors.sub }}>결석 {absent}일</Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

/** 날짜별 점수 막대 (주간: 등급 글자 표시, 월간: 막대만) */
function DayBars({ days, kind }: { days: DayGrade[]; kind: PeriodKind }) {
  const H = 64;
  const today = todayKey();
  const spoken = days
    .filter((d) => d.status === 'scored' || d.status === 'absent')
    .map((d) => `${shortDate(d.date)} ${d.status === 'absent' ? '결석' : `${d.grade?.grade} ${Math.round(d.score ?? 0)}점`}`)
    .join(', ');
  return (
    <View role="img" aria-label={`날짜별 점수: ${spoken || '기록 없음'}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: kind === 'week' ? 6 : 2 }}>
      {days.map((d) => {
        const n = fromKey(d.date).getDate();
        const label = kind === 'week' ? (d.date === today ? '오늘' : weekdayOf(d.date)) : n === 1 || n % 5 === 0 ? String(n) : '';
        const top = d.status === 'scored' ? d.grade?.grade : d.status === 'absent' ? '결' : '';
        return (
          <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            {kind === 'week' && (
              <Text style={{ fontSize: 13, fontWeight: '900', fontFamily: SERIF, color: d.status === 'scored' && d.grade ? ink(d.grade.color) : colors.sub }}>{top}</Text>
            )}
            <View style={{ height: H, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
              {d.status === 'scored' && (
                <View style={{ width: kind === 'week' ? '70%' : '80%', height: Math.max(((d.score ?? 0) / 100) * H, 3), borderRadius: 4, backgroundColor: d.grade?.color }} />
              )}
              {d.status === 'absent' && <View style={{ width: kind === 'week' ? '70%' : '80%', height: 3, borderRadius: 2, backgroundColor: colors.danger, opacity: 0.5 }} />}
              {(d.status === 'future' || d.status === 'before') && (
                <View style={{ width: kind === 'week' ? '70%' : '80%', height: 3, borderRadius: 2, backgroundColor: colors.line }} />
              )}
            </View>
            <Text style={{ fontSize: 11, width: 30, textAlign: 'center', color: d.date === today ? colors.primary : colors.sub }} maxFontSizeMultiplier={1.2}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function TableHeader({ cols }: { cols: [string, number | 'flex'][] }) {
  return (
    <View style={[styles.row, { backgroundColor: PAPER_HEAD, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8 }]}>
      {cols.map(([name, w]) => (
        <Text key={name} style={[{ fontSize: 12, fontWeight: '700', color: colors.sub }, w === 'flex' ? { flex: 1 } : { width: w, textAlign: 'center' }]}>
          {name}
        </Text>
      ))}
    </View>
  );
}

function SubjectTable({ r }: { r: PeriodReport }) {
  return (
    <Card title="📚 과목별 성적">
      <TableHeader cols={[['과목', 72], ['평균 달성률', 'flex'], ['등급', 40]]} />
      {r.subjects.map((s, i) => (
        <View key={s.key} style={[styles.row, { paddingVertical: 7, paddingHorizontal: 8, backgroundColor: i % 2 ? '#FAFBFD' : '#fff', borderRadius: 6 }]}>
          <Text style={{ width: 72, fontSize: 14, color: colors.text }}>{s.label}</Text>
          <View style={[styles.row, { flex: 1, gap: 6 }]}>
            <View style={{ flex: 1 }}>
              <ProgressBar value={s.ratio} max={1} color={s.color} label={`${s.name} 평균 달성률`} />
            </View>
            <Text style={{ width: 38, textAlign: 'right', fontSize: 12, color: colors.text }}>{Math.round(s.ratio * 100)}%</Text>
          </View>
          <View style={{ width: 40, alignItems: 'center' }}>
            <GradeBadge grade={s.grade} />
          </View>
        </View>
      ))}
    </Card>
  );
}

function GoalTable({ r }: { r: PeriodReport }) {
  if (!r.goals.length) return null;
  return (
    <Card
      title="🎯 목표 관리"
      right={
        r.goalGrade ? (
          <View style={[styles.row, { gap: 6 }]}>
            <Text style={styles.muted}>목표 등급</Text>
            <GradeBadge grade={r.goalGrade} />
          </View>
        ) : undefined
      }
    >
      <TableHeader cols={[['목표 · 이 기간 실적', 'flex'], ['등급', 40], ['전체', 44]]} />
      {r.goals.map((g, i) => (
        <View key={g.id} style={[styles.row, { paddingVertical: 8, paddingHorizontal: 8, backgroundColor: i % 2 ? '#FAFBFD' : '#fff', borderRadius: 6 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={1}>
              {g.emoji} {g.title}
            </Text>
            <Text style={[styles.muted, { fontSize: 12 }]}>
              {g.detail}
              {g.ratio != null ? ` · 계획 대비 ${Math.round(g.ratio * 100)}%` : ''}
            </Text>
          </View>
          <View style={{ width: 40, alignItems: 'center' }}>
            <GradeBadge grade={g.grade} />
          </View>
          <Text style={{ width: 44, textAlign: 'right', fontSize: 13, fontWeight: '700', color: colors.primary }}>{Math.round(g.overall * 100)}%</Text>
        </View>
      ))}
      <Text style={[styles.muted, { fontSize: 12, lineHeight: 17 }]}>등급은 이 기간 동안 계획한 양을 얼마나 해냈는지, ‘전체’는 목표 전체 진행률이에요.</Text>
    </Card>
  );
}

function BodyCard({ r }: { r: PeriodReport }) {
  const b = r.body;
  const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString();
  const items: { label: string; value: string; color?: string }[] = [];
  if (b.weightAvg != null) items.push({ label: '평균 체중', value: `${fmt(b.weightAvg)}kg` });
  if (b.weightChange != null)
    items.push({
      label: '체중 변화',
      value: `${b.weightChange > 0 ? '+' : ''}${fmt(b.weightChange, 2)}kg`,
      color: b.weightChange < 0 ? colors.steps : b.weightChange > 0 ? colors.danger : undefined,
    });
  items.push({ label: '운동', value: `${b.exerciseMin}분 · ${b.exerciseDays}일` });
  if (b.stepsAvg != null) items.push({ label: '평균 걸음', value: `${fmt(b.stepsAvg, 0)}보` });
  if (b.sleepAvg != null) items.push({ label: '평균 수면', value: `${fmt(b.sleepAvg)}시간` });
  return (
    <Card title="📏 생활 기록">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((it) => (
          <View key={it.label} style={{ flexGrow: 1, minWidth: '30%', backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10 }}>
            <Text style={{ fontSize: 12, color: colors.sub }}>{it.label}</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: it.color ? ink(it.color) : colors.text }}>{it.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function CommentCard({ r }: { r: PeriodReport }) {
  if (!r.comments.length) return null;
  return (
    <View style={{ backgroundColor: PAPER, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: PAPER_LINE, padding: 16, gap: 8 }}>
      <Text role="heading" {...headingLevel(2)} style={{ fontSize: 16, fontWeight: '800', color: colors.text, fontFamily: SERIF }}>
        📝 종합 의견
      </Text>
      {r.comments.map((c) => (
        <Text key={c} style={{ fontSize: 14, color: colors.text, lineHeight: 21 }}>
          · {c}
        </Text>
      ))}
      <Text style={{ alignSelf: 'flex-end', fontSize: 12, color: colors.sub, fontFamily: SERIF }}>— 하루관리 담임</Text>
    </View>
  );
}

function Legend() {
  return (
    <View style={{ gap: 6, paddingHorizontal: 4 }}>
      <View style={[styles.row, { flexWrap: 'wrap', gap: 10 }]}>
        {GRADES.map((g, i) => (
          <Text key={g.grade} style={{ fontSize: 12, color: colors.sub }}>
            <Text style={{ fontWeight: '900', color: ink(g.color), fontFamily: SERIF }}>{g.grade}</Text> {i === GRADES.length - 1 ? `${GRADES[i - 1].min} 미만` : `${g.min}↑`}
          </Text>
        ))}
      </View>
      <Text style={[styles.muted, { fontSize: 12, lineHeight: 17 }]}>종합 점수는 하루 점수의 평균이에요. 기록이 없는 날은 0점(결석)으로, 오늘은 하루가 끝난 뒤 반영돼요.</Text>
    </View>
  );
}
