import 'server-only'
/**
 * 저장소 추상화
 *
 * Firebase Admin 이 설정되어 있으면 Firestore 를, 없으면 인메모리 저장소를 쓴다.
 * 키 없이도 앱 전체를 시연할 수 있게 하기 위한 설계다.
 * 인메모리 저장소는 서버 재시작 시 초기화되므로 데모 용도로만 쓴다.
 */
import { adminDb, isAdminConfigured } from '../firebase/admin'

export interface DocStore {
  readonly kind: 'firestore' | 'memory'
  get<T>(path: string): Promise<T | null>
  set<T>(path: string, value: T): Promise<void>
  update<T>(path: string, patch: Partial<T>): Promise<void>
  delete(path: string): Promise<void>
  list<T>(collectionPath: string): Promise<T[]>
  /**
   * 숫자 필드를 원자적으로 증감한다.
   *
   * 읽지 않고 쓰므로 갱신 손실도, 경합 재시도도 없다. 증감 후 값은 돌려주지
   * 않는다 — 그걸 알려면 트랜잭션이 필요한데, 외부 호출 1건마다 같은 문서에
   * 트랜잭션을 걸면 분석 한 번(36건 동시)에 단일 문서가 병목이 된다.
   */
  increment(
    path: string,
    field: string,
    by: number,
    meta?: Record<string, unknown>,
  ): Promise<void>
}

class FirestoreStore implements DocStore {
  readonly kind = 'firestore' as const

  async get<T>(path: string): Promise<T | null> {
    const snap = await adminDb().doc(path).get()
    return snap.exists ? (snap.data() as T) : null
  }
  async set<T>(path: string, value: T): Promise<void> {
    await adminDb().doc(path).set(value as Record<string, unknown>, { merge: false })
  }
  async update<T>(path: string, patch: Partial<T>): Promise<void> {
    await adminDb().doc(path).set(patch as Record<string, unknown>, { merge: true })
  }
  async delete(path: string): Promise<void> {
    await adminDb().doc(path).delete()
  }
  async list<T>(collectionPath: string): Promise<T[]> {
    const snap = await adminDb().collection(collectionPath).get()
    return snap.docs.map((d) => d.data() as T)
  }
  async increment(
    path: string,
    field: string,
    by: number,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    const { FieldValue } = await import('firebase-admin/firestore')
    await adminDb()
      .doc(path)
      .set({ ...meta, [field]: FieldValue.increment(by) }, { merge: true })
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Firestore 의 `set(merge: true)` 와 같은 병합 규칙 — 중첩 맵은 병합하고
 * 배열·원시값은 교체한다.
 *
 * 얕게 덮어쓰면 데모(메모리)와 프로덕션(Firestore)에서 동작이 갈린다.
 * 예를 들어 `weights: {presetId}` 만 갱신할 때 기존 `custom` 이 남느냐 사라지느냐가
 * 저장소별로 달라진다 — E2E 는 데모로 돌아가므로 이런 차이는 잡히지 않는다.
 */
function deepMerge(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...prev }
  for (const [k, v] of Object.entries(patch)) {
    const before = out[k]
    out[k] = isPlainObject(before) && isPlainObject(v) ? deepMerge(before, v) : v
  }
  return out
}

/** 프로세스 전역 인메모리 저장소. HMR 로 초기화되지 않도록 globalThis 에 둔다. */
const memory: Map<string, unknown> =
  (globalThis as { __homefitStore?: Map<string, unknown> }).__homefitStore ??
  new Map()
;(globalThis as { __homefitStore?: Map<string, unknown> }).__homefitStore = memory

class MemoryStore implements DocStore {
  readonly kind = 'memory' as const

  async get<T>(path: string): Promise<T | null> {
    return (memory.get(path) as T) ?? null
  }
  async set<T>(path: string, value: T): Promise<void> {
    memory.set(path, structuredClone(value))
  }
  async update<T>(path: string, patch: Partial<T>): Promise<void> {
    const prev = (memory.get(path) as Record<string, unknown>) ?? {}
    memory.set(path, deepMerge(prev, structuredClone(patch) as Record<string, unknown>))
  }
  async delete(path: string): Promise<void> {
    memory.delete(path)
  }
  async list<T>(collectionPath: string): Promise<T[]> {
    const prefix = `${collectionPath}/`
    return [...memory.entries()]
      .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
      .map(([, v]) => v as T)
  }
  async increment(
    path: string,
    field: string,
    by: number,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    // 단일 프로세스이고 이 함수 안에 await 이 없으므로 그 자체로 원자적이다.
    const prev = (memory.get(path) as Record<string, unknown> | undefined) ?? {}
    const cur = Number(prev[field] ?? 0)
    memory.set(path, {
      ...prev,
      ...structuredClone(meta),
      [field]: (Number.isFinite(cur) ? cur : 0) + by,
    })
  }
}

let cached: DocStore | null = null

export function store(): DocStore {
  if (cached) return cached
  cached = isAdminConfigured ? new FirestoreStore() : new MemoryStore()
  return cached
}

export function isDemoStore(): boolean {
  return !isAdminConfigured
}
