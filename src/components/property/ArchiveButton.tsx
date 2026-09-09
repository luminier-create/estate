'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { setPropertyStatusAction } from '@/app/(app)/actions'

export function ArchiveButton({
  propertyId,
  archived,
}: {
  propertyId: string
  archived: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle() {
    setBusy(true)
    setError(null)
    const res = await setPropertyStatusAction(
      propertyId,
      archived ? 'ACTIVE' : 'ARCHIVED',
    )
    if (!res.ok) setError(res.error)
    else router.refresh()
    setBusy(false)
  }

  return (
    <div>
      <Button variant="secondary" onClick={handle} disabled={busy}>
        {busy ? '처리 중…' : archived ? '후보로 되돌리기' : '보류함으로 이동'}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--color-negative)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
