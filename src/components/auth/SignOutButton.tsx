'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/firebase/client'

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter()

  async function handle() {
    await signOut().catch(() => {
      // Firebase 미설정(데모 모드)에서는 쿠키 삭제만으로 충분하다
    })
    router.replace('/')
    router.refresh()
  }

  return (
    <button
      onClick={handle}
      className={
        compact
          ? 'min-h-11 px-2 text-sm text-[var(--color-muted)]'
          : 'min-h-11 w-full rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-brand-soft)]'
      }
    >
      로그아웃
    </button>
  )
}
