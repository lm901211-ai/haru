import * as Location from 'expo-location';

export type Weather = {
  place: string;
  temp: number;
  feelsLike: number;
  max: number;
  min: number;
  rainChance: number;
  label: string;
  emoji: string;
  note?: string;
};

// 위치 권한이 없을 때 기본 위치
const FALLBACK = { latitude: 37.5665, longitude: 126.978, place: '서울' };

// WMO 날씨 코드 → 한국어 설명
function describe(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: '맑음', emoji: '☀️' };
  if (code <= 2) return { label: '구름 조금', emoji: '🌤️' };
  if (code === 3) return { label: '흐림', emoji: '☁️' };
  if (code <= 48) return { label: '안개', emoji: '🌫️' };
  if (code <= 57) return { label: '이슬비', emoji: '🌦️' };
  if (code <= 67) return { label: '비', emoji: '🌧️' };
  if (code <= 77) return { label: '눈', emoji: '❄️' };
  if (code <= 82) return { label: '소나기', emoji: '🌧️' };
  if (code <= 86) return { label: '눈 소나기', emoji: '🌨️' };
  return { label: '뇌우', emoji: '⛈️' };
}

async function getPosition(): Promise<{ latitude: number; longitude: number; place: string; note?: string }> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { ...FALLBACK, note: '위치 권한이 없어 서울 날씨를 보여드려요' };
    const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const { latitude, longitude } = pos.coords;
    let place = '현재 위치';
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addr) place = [addr.city ?? addr.region, addr.district ?? addr.subregion].filter(Boolean).join(' ') || place;
    } catch {
      // 주소 변환 실패 시 '현재 위치'로 표시
    }
    return { latitude, longitude, place };
  } catch {
    return { ...FALLBACK, note: '위치를 가져오지 못해 서울 날씨를 보여드려요' };
  }
}

export async function fetchWeather(): Promise<Weather> {
  const pos = await getPosition();
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${pos.latitude}&longitude=${pos.longitude}` +
    '&current=temperature_2m,apparent_temperature,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=auto&forecast_days=1';
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('인터넷에 연결되지 않아 날씨를 불러오지 못했어요');
  }
  if (!res.ok) throw new Error(`날씨 서버 오류 (${res.status})`);
  const json = await res.json();
  return {
    place: pos.place,
    note: pos.note,
    temp: Math.round(json.current.temperature_2m),
    feelsLike: Math.round(json.current.apparent_temperature),
    max: Math.round(json.daily.temperature_2m_max[0]),
    min: Math.round(json.daily.temperature_2m_min[0]),
    rainChance: json.daily.precipitation_probability_max[0] ?? 0,
    ...describe(json.current.weather_code),
  };
}
