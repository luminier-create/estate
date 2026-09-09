'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { deletePropertyAction } from '@/app/(app)/actions'

export function DeletePropertyButton({
  propertyId,
  name,
}: {
  propertyId: string
  name: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handle() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setBusy(true)
    await deletePropertyAction(propertyId)
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <Button variant="danger" onClick={handle} disabled={busy}>
      {busy ? '삭제 중…' : confirming ? `'${name}' 삭제 확인` : '삭제'}
    </Button>
  )
}
