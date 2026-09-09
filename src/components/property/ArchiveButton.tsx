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

  async function handle() {
    setBusy(true)
    await setPropertyStatusAction(propertyId, archived ? 'ACTIVE' : 'ARCHIVED')
    router.refresh()
    setBusy(false)
  }

  return (
    <Button variant="secondary" onClick={handle} disabled={busy}>
      {busy ? '처리 중…' : archived ? '후보로 되돌리기' : '보류함으로 이동'}
    </Button>
  )
}
