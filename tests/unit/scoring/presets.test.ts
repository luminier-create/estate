import { describe, expect, it } from 'vitest'
import {
  CUSTOM_PRESET_ID,
  PRESETS,
  isKnownPresetId,
  safePresetId,
} from '@/lib/scoring/presets'

describe('프리셋 id 정규화', () => {
  it('알려진 프리셋과 custom 을 통과시킨다', () => {
    for (const p of PRESETS) expect(isKnownPresetId(p.id)).toBe(true)
    expect(isKnownPresetId(CUSTOM_PRESET_ID)).toBe(true)
  })

  it('알 수 없는 값은 기본 프리셋으로 되돌린다', () => {
    // getPreset 은 조용히 balanced 를 쓰지만 원문 id 는 분석 문서 ID 로 흘러간다.
    // 쓸 때와 읽을 때가 어긋나면 저장한 분석을 영영 못 찾아 화면이 계속 "미분석"이 된다.
    expect(isKnownPresetId('bogus/../x')).toBe(false)
    expect(safePresetId('bogus/../x')).toBe(PRESETS[0]!.id)
    expect(safePresetId(undefined)).toBe(PRESETS[0]!.id)
    expect(safePresetId('')).toBe(PRESETS[0]!.id)
  })

  it('정규화한 값을 다시 정규화해도 같다', () => {
    for (const id of [...PRESETS.map((p) => p.id), CUSTOM_PRESET_ID, 'junk']) {
      const once = safePresetId(id)
      expect(safePresetId(once)).toBe(once)
    }
  })
})
