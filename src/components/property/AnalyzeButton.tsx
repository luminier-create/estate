'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { runAnalysis } from '@/app/(app)/actions'

export function AnalyzeButton({
  propertyId,
  label,
}: {
  propertyId: string
  label: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle() {
    setBusy(true)
    setError(null)
    try {
      const res = await runAnalysis(propertyId)
      if (!res.ok) setError(res.error)
      else router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shrink-0">
      <Button variant="secondary" onClick={handle} disabled={busy}>
        {busy ? '분석 중…' : label}
      </Button>
      {error && <p className="mt-2 text-xs text-[var(--color-negative)]">{error}</p>}
    </div>
  )
}
