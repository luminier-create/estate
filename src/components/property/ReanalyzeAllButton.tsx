'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { reanalyzeAllAction } from '@/app/(app)/actions'

export function ReanalyzeAllButton({ count }: { count: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handle() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await reanalyzeAllAction()
      setMessage(
        res.failed > 0
          ? `${res.total}개 중 ${res.failed}개 분석에 실패했습니다.`
          : `${res.total}개 단지를 재분석했습니다.`,
      )
      router.refresh()
    } catch {
      setMessage('재분석에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={handle} disabled={busy}>
        {busy ? '분석 중…' : `분석되지 않은 ${count}개 단지 분석하기`}
      </Button>
      {message && <span className="text-xs text-[var(--color-muted)]">{message}</span>}
    </div>
  )
}
