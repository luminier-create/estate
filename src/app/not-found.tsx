import Link from 'next/link'
import { Button } from '@/components/ui'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-[var(--color-muted)]">
        주소가 잘못되었거나 삭제된 단지일 수 있습니다.
      </p>
      <Link href="/dashboard">
        <Button>내 후보로 이동</Button>
      </Link>
    </main>
  )
}
