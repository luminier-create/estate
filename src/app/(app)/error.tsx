'use client'
/**
 * 앱 화면 오류 경계.
 *
 * 분석 중 예외나 저장소 오류가 나면 Next 기본 오류 화면 대신
 * 무엇이 잘못됐고 다음에 무엇을 할 수 있는지 보여준다.
 */
import { useEffect } from 'react'
import Link from 'next/link'
import { Button, Card } from '@/components/ui'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 서버 로그와 대조할 수 있도록 digest 를 남긴다
    console.error('화면 오류:', error.message, error.digest)
  }, [error])

  return (
    <Card className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">화면을 불러오지 못했습니다</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
          일시적인 문제일 수 있습니다. 다시 시도해도 같은 오류가 나면 단지 정보를
          확인하거나 잠시 후 다시 열어보십시오. 저장된 데이터는 사라지지 않습니다.
        </p>
      </div>

      {error.digest && (
        <p className="rounded-lg bg-[var(--color-bg)] p-3 font-mono text-xs text-[var(--color-muted)]">
          오류 코드: {error.digest}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>다시 시도</Button>
        <Link href="/dashboard">
          <Button variant="secondary">내 후보로 이동</Button>
        </Link>
      </div>
    </Card>
  )
}
