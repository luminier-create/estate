/** 장소·주소 검색 프록시. API 키를 클라이언트에 노출하지 않기 위한 경로. */
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/session'
import { geoProvider } from '@/lib/providers'

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const query = new URL(req.url).searchParams.get('q')?.trim()
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const results = await geoProvider().searchPlaces(query)
    return NextResponse.json({ results: results.slice(0, 10) })
  } catch {
    return NextResponse.json(
      { error: '장소 검색에 실패했습니다.', results: [] },
      { status: 502 },
    )
  }
}
