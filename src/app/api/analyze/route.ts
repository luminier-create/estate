/** 단지 분석 실행 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/firebase/session'
import { runAnalysis } from '@/app/(app)/actions'

const schema = z.object({
  propertyId: z.string().min(1),
  presetId: z.string().optional(),
})

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  try {
    const result = await runAnalysis(parsed.data.propertyId, parsed.data.presetId)
    return NextResponse.json(result)
  } catch (e) {
    // 내부 메시지를 그대로 내보내면 인증 상태·저장소 오류가 클라이언트로 샌다
    console.error('[api/analyze]', e)
    return NextResponse.json({ error: '분석에 실패했습니다.' }, { status: 500 })
  }
}
