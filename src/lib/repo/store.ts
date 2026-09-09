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
   * 숫자 필드를 원자적으로 증감하고 **증감 후 값**을 돌려준다.
   * 쿼터 카운터처럼 동시 요청이 같은 문서를 갱신하는 경우, read-then-write 로는
   * 갱신 손실이 나서 상한이 지켜지지 않는다.
   */
  increment(
    path: string,
    field: string,
    by: number,
    meta?: Record<string, unknown>,
  ): Promise<number>
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
  ): Promise<number> {
    const ref = adminDb().doc(path)
    // FieldValue.increment 는 증감 후 값을 돌려주지 않는다. 상한 판정에 그 값이
    // 필요하므로 트랜잭션을 쓴다 (경합 시 Firestore 가 재시도한다).
    return adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const prev = Number((snap.data() as Record<string, unknown> | undefined)?.[field] ?? 0)
      const next = (Number.isFinite(prev) ? prev : 0) + by
      tx.set(ref, { ...meta, [field]: next }, { merge: true })
      return next
    })
  }
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
    memory.set(path, { ...prev, ...structuredClone(patch) })
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
  ): Promise<number> {
    // 단일 프로세스이고 이 함수 안에 await 이 없으므로 그 자체로 원자적이다.
    const prev = (memory.get(path) as Record<string, unknown> | undefined) ?? {}
    const cur = Number(prev[field] ?? 0)
    const next = (Number.isFinite(cur) ? cur : 0) + by
    memory.set(path, { ...prev, ...structuredClone(meta), [field]: next })
    return next
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
