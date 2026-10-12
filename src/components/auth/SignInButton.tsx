'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui'
import { signInWithGoogle } from '@/lib/firebase/client'

export function SignInButton({ configured }: { configured: boolean }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  async function handleGoogle() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
      startTransition(() => router.replace('/dashboard'))
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDemo() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: true }),
      })
      if (!res.ok) throw new Error('데모 모드 진입에 실패했습니다.')
      startTransition(() => router.replace('/dashboard'))
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || pending

  return (
    <div className="w-full space-y-3">
      {configured ? (
        <Button onClick={handleGoogle} disabled={disabled} className="w-full">
          {disabled ? '진행 중…' : 'Google 계정으로 계속하기'}
        </Button>
      ) : (
        <Button onClick={handleDemo} disabled={disabled} className="w-full">
          {disabled ? '진행 중…' : '데모 모드로 둘러보기'}
        </Button>
      )}

      {!configured && (
        <p className="text-center text-xs leading-relaxed text-[var(--color-muted)]">
          Firebase 환경변수가 설정되지 않아 구글 로그인이 비활성화되었습니다.
          <br />
          데모 모드는 시드 데이터로 전체 기능을 시연합니다.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
