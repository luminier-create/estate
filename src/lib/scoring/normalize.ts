/**
 * 정규화 유틸리티
 * 설계 근거: docs/01-ALGORITHM.md §4
 */

/** [입력값, 점수] 쌍. 입력값 오름차순으로 정렬되어 있어야 한다. */
export type Breakpoint = readonly [input: number, score: number]

/**
 * 구간 선형보간. 모든 축 정규화의 기반 함수.
 *
 * 첫 지점보다 작으면 첫 점수, 마지막 지점보다 크면 마지막 점수로 고정(clamp)한다.
 *
 * 입력이 NaN·Infinity 이면 NaN 을 돌려준다. 첫 점수로 대체하면 대부분의 곡선이
 * 내림차순(작을수록 좋음)이라 계산 불능이 만점으로 둔갑한다 —
 * 순위 앱에서 가장 나쁜 실패 방식이다. 호출부(ok())가 NaN 을 결측으로 강등한다.
 *
 * @example piecewise(42, [[30,100],[60,55],[90,10]]) // → 82
 */
export function piecewise(x: number, points: readonly Breakpoint[]): number {
  if (points.length === 0) {
    throw new Error('piecewise: 구간 정의가 비어 있음')
  }
  const first = points[0]!
  const last = points[points.length - 1]!

  if (!Number.isFinite(x)) return Number.NaN
  if (x <= first[0]) return first[1]
  if (x >= last[0]) return last[1]

  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]!
    const [x2, y2] = points[i + 1]!
    if (x >= x1 && x <= x2) {
      if (x2 === x1) return y2
      return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1)
    }
  }
  return last[1]
}

export function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v))
}

/** 소수 1자리 반올림. 점수 표기 통일용. */
export function round1(v: number): number {
  return Math.round(v * 10) / 10
}

// ─── 거리·시간 환산 ──────────────────────────────────────────

/** 성인 평균 보행속도 (m/min). 4.0 km/h 기준. */
export const WALK_SPEED_M_PER_MIN = 67

/**
 * 우회계수. 카카오 로컬이 반환하는 직선거리를 실제 보행거리로 보정한다.
 * 도심 격자 도로망의 실거리/직선거리 평균 근사치.
 */
export const DETOUR_FACTOR = 1.25

/** 직선거리(m) → 실보행 소요시간(분) */
export function walkMinutes(straightLineM: number): number {
  return (straightLineM * DETOUR_FACTOR) / WALK_SPEED_M_PER_MIN
}

/**
 * 도보 소요시간(분) → 직선거리(m). walkMinutes 의 역함수.
 * 지도에 "도보 N분 반경"을 그릴 때 쓴다.
 */
export function metersForWalkMinutes(minutes: number): number {
  return (minutes * WALK_SPEED_M_PER_MIN) / DETOUR_FACTOR
}

/** 두 좌표 간 하버사인 거리(m) */
export function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

// ─── 면적 환산 ───────────────────────────────────────────────

/** 1평 = 400/121 ㎡ */
export const M2_PER_PYEONG = 400 / 121

export function pyeongToM2(pyeong: number): number {
  return pyeong * M2_PER_PYEONG
}

export function m2ToPyeong(m2: number): number {
  return m2 / M2_PER_PYEONG
}

// ─── 통계 ────────────────────────────────────────────────────

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]!
  return sorted[lo]! + (pos - lo) * (sorted[hi]! - sorted[lo]!)
}

/**
 * IQR 1.5배 밖 이상치 제거.
 * 실거래가에는 직거래·특수관계 거래 등 비정상 가격이 섞이므로 시세 산출 전 반드시 적용한다.
 */
export function removeOutliers(values: readonly number[]): number[] {
  if (values.length < 4) return [...values]
  const q1 = quantile(values, 0.25)
  const q3 = quantile(values, 0.75)
  const iqr = q3 - q1
  const lo = q1 - 1.5 * iqr
  const hi = q3 + 1.5 * iqr
  return values.filter((v) => v >= lo && v <= hi)
}

// ─── 표기 ────────────────────────────────────────────────────

/** 만원 단위 금액을 한국식으로 표기. 125000 → "12억 5,000만원" */
export function formatManwon(manwon: number): string {
  const eok = Math.floor(manwon / 10_000)
  const rest = Math.round(manwon % 10_000)
  if (eok === 0) return `${rest.toLocaleString('ko-KR')}만원`
  if (rest === 0) return `${eok.toLocaleString('ko-KR')}억원`
  return `${eok.toLocaleString('ko-KR')}억 ${rest.toLocaleString('ko-KR')}만원`
}

/** 분 단위를 "1시간 12분" 형태로 */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`
}

export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)}m`
    : `${(meters / 1000).toFixed(1)}km`
}

/** 오늘 날짜 (YYYY-MM-DD). SourceRef.asOf 기본값용. */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
