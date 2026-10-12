/**
 * Mock 시드 데이터 — 실제 좌표 기반
 * 개발·테스트·데모가 외부 API 쿼터에 묶이지 않도록 한다.
 */
import type { CategoryCode } from '../types'

export interface SeedPlace {
  name: string
  lat: number
  lng: number
  category: CategoryCode
}

export const SEED_PLACES: readonly SeedPlace[] = [
  // ─── 지하철역 (서울 주요) ───
  { name: '강남역 2호선', lat: 37.497942, lng: 127.027621, category: 'SUBWAY' },
  { name: '역삼역 2호선', lat: 37.500622, lng: 127.036456, category: 'SUBWAY' },
  { name: '선릉역 2호선 수인분당선 환승', lat: 37.504503, lng: 127.049008, category: 'SUBWAY' },
  { name: '삼성역 2호선', lat: 37.508844, lng: 127.063172, category: 'SUBWAY' },
  { name: '도곡역 3호선 수인분당선 환승', lat: 37.490858, lng: 127.055225, category: 'SUBWAY' },
  { name: '매봉역 3호선', lat: 37.486947, lng: 127.046703, category: 'SUBWAY' },
  { name: '한티역 수인분당선', lat: 37.496087, lng: 127.052860, category: 'SUBWAY' },
  { name: '양재역 3호선 신분당선 환승', lat: 37.484147, lng: 127.034311, category: 'SUBWAY' },
  { name: '교대역 2호선 3호선 환승', lat: 37.493415, lng: 127.014279, category: 'SUBWAY' },
  { name: '잠실역 2호선 8호선 환승', lat: 37.513950, lng: 127.100138, category: 'SUBWAY' },
  { name: '노원역 4호선 7호선 환승', lat: 37.655128, lng: 127.061368, category: 'SUBWAY' },
  { name: '상계역 4호선', lat: 37.661030, lng: 127.055146, category: 'SUBWAY' },
  { name: '중계역 7호선', lat: 37.644504, lng: 127.064524, category: 'SUBWAY' },
  { name: '마들역 7호선', lat: 37.649423, lng: 127.057029, category: 'SUBWAY' },
  { name: '판교역 신분당선', lat: 37.394761, lng: 127.111217, category: 'SUBWAY' },
  { name: '정자역 신분당선 수인분당선 환승', lat: 37.367673, lng: 127.108182, category: 'SUBWAY' },
  { name: '서현역 수인분당선', lat: 37.385158, lng: 127.123273, category: 'SUBWAY' },
  { name: '여의도역 5호선 9호선 환승', lat: 37.521624, lng: 126.924191, category: 'SUBWAY' },
  { name: '홍대입구역 2호선 경의중앙선 공항철도 환승', lat: 37.557192, lng: 126.925381, category: 'SUBWAY' },
  { name: '광화문역 5호선', lat: 37.571026, lng: 126.976611, category: 'SUBWAY' },

  // ─── 버스정류장 ───
  { name: '역삼역.르네상스호텔 (간선)', lat: 37.500958, lng: 127.036889, category: 'BUS_STOP' },
  { name: '도곡2동주민센터 (지선)', lat: 37.489472, lng: 127.048917, category: 'BUS_STOP' },
  { name: '타워팰리스 (지선)', lat: 37.489108, lng: 127.053391, category: 'BUS_STOP' },
  { name: '강남역12번출구 (광역 M4403)', lat: 37.498294, lng: 127.028137, category: 'BUS_STOP' },
  { name: '상계주공7단지 (지선)', lat: 37.658294, lng: 127.058310, category: 'BUS_STOP' },
  { name: '노원역7번출구 (간선)', lat: 37.654812, lng: 127.062102, category: 'BUS_STOP' },
  { name: '판교역.낙생육교 (광역 9003)', lat: 37.395204, lng: 127.110283, category: 'BUS_STOP' },
  { name: '봇들마을4단지 (마을)', lat: 37.393018, lng: 127.106712, category: 'BUS_STOP' },

  // ─── 학교 ───
  { name: '대도초등학교', lat: 37.495611, lng: 127.045200, category: 'ELEMENTARY' },
  { name: '도곡초등학교', lat: 37.489156, lng: 127.043794, category: 'ELEMENTARY' },
  { name: '대치초등학교', lat: 37.499308, lng: 127.058164, category: 'ELEMENTARY' },
  { name: '상원초등학교', lat: 37.657812, lng: 127.056094, category: 'ELEMENTARY' },
  { name: '상계초등학교', lat: 37.660219, lng: 127.061847, category: 'ELEMENTARY' },
  { name: '보평초등학교', lat: 37.392847, lng: 127.108391, category: 'ELEMENTARY' },
  { name: '단대초등학교', lat: 37.397102, lng: 127.113847, category: 'ELEMENTARY' },
  { name: '숙명여자중학교', lat: 37.493847, lng: 127.048291, category: 'MIDDLE' },
  { name: '도곡중학교', lat: 37.487194, lng: 127.047382, category: 'MIDDLE' },
  { name: '단대중학교', lat: 37.394018, lng: 127.110284, category: 'MIDDLE' },
  { name: '상계중학교', lat: 37.659104, lng: 127.058291, category: 'MIDDLE' },
  { name: '경기고등학교', lat: 37.499182, lng: 127.041847, category: 'HIGH' },
  { name: '중동고등학교', lat: 37.492847, lng: 127.056193, category: 'HIGH' },
  { name: '상계고등학교', lat: 37.663018, lng: 127.059847, category: 'HIGH' },
  { name: '낙생고등학교', lat: 37.391284, lng: 127.115018, category: 'HIGH' },

  // ─── 대형마트 ───
  { name: '이마트 역삼점', lat: 37.501847, lng: 127.041284, category: 'MART' },
  { name: '롯데마트 서울역점', lat: 37.554847, lng: 126.970284, category: 'MART' },
  { name: '홈플러스 강남점', lat: 37.492018, lng: 127.036847, category: 'MART' },
  { name: '코스트코 양재점', lat: 37.470284, lng: 127.038194, category: 'MART' },
  { name: '이마트 상봉점', lat: 37.596018, lng: 127.085847, category: 'MART' },
  { name: '홈플러스 중계점', lat: 37.646284, lng: 127.070018, category: 'MART' },
  { name: '이마트 트레이더스 월계점', lat: 37.630847, lng: 127.056284, category: 'MART' },
  { name: '이마트 판교점', lat: 37.397847, lng: 127.108018, category: 'MART' },

  // ─── 유흥상권 (RISK 판정용) ───
  { name: '유흥주점 A', lat: 37.499284, lng: 127.029847, category: 'NIGHTLIFE' },
  { name: '단란주점 B', lat: 37.499018, lng: 127.030284, category: 'NIGHTLIFE' },
  { name: '클럽 C', lat: 37.498847, lng: 127.029018, category: 'NIGHTLIFE' },
  { name: '유흥주점 D', lat: 37.500018, lng: 127.030847, category: 'NIGHTLIFE' },
  { name: '단란주점 E', lat: 37.499572, lng: 127.031204, category: 'NIGHTLIFE' },
  { name: '유흥주점 F', lat: 37.498294, lng: 127.030018, category: 'NIGHTLIFE' },

  // ─── 간선도로 ───
  { name: '강남대로', lat: 37.497018, lng: 127.026847, category: 'MAJOR_ROAD' },
  { name: '테헤란로', lat: 37.501284, lng: 127.039018, category: 'MAJOR_ROAD' },
  { name: '동부간선도로', lat: 37.652847, lng: 127.068284, category: 'MAJOR_ROAD' },
  { name: '경부고속도로', lat: 37.400018, lng: 127.100847, category: 'MAJOR_ROAD' },

  // ─── 기피시설 ───
  { name: '노원자원회수시설', lat: 37.640284, lng: 127.077018, category: 'AVOIDED' },
  { name: '강남변전소', lat: 37.485018, lng: 127.062847, category: 'AVOIDED' },
]

export function seedByCategory(category: CategoryCode): SeedPlace[] {
  return SEED_PLACES.filter((p) => p.category === category)
}
