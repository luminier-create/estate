import Link from 'next/link'
import type { ReactNode } from 'react'
import { SignOutButton } from '@/components/auth/SignOutButton'

const NAV = [
  { href: '/dashboard', label: '내 후보', icon: '◉' },
  { href: '/properties/new', label: '단지 등록', icon: '＋' },
  { href: '/compare', label: '비교', icon: '⇄' },
  { href: '/settings', label: '내 정보', icon: '⚙' },
] as const

export function AppShell({
  children,
  user,
  demoNotice,
}: {
  children: ReactNode
  user: { displayName: string; email: string; isDemo: boolean }
  demoNotice?: string
}) {
  return (
    <div className="min-h-dvh md:flex">
      {/* 데스크톱 사이드바 */}
      <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:flex md:flex-col">
        <Link href="/dashboard" className="text-lg font-bold text-[var(--color-brand-text)]">
          HomeFit
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-brand-soft)]"
            >
              <span aria-hidden className="w-4 text-center text-[var(--color-brand-text)]">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 pt-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="truncate text-xs text-[var(--color-muted)]">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 모바일 상단바 */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-5 backdrop-blur md:hidden">
          <Link href="/dashboard" className="font-bold text-[var(--color-brand-text)]">
            HomeFit
          </Link>
          <SignOutButton compact />
        </header>

        {demoNotice && (
          <p className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
            {demoNotice}
          </p>
        )}

        <main className="pb-safe mx-auto w-full max-w-5xl flex-1 px-5 py-6 sm:px-8">
          {children}
        </main>

        {/* 모바일 하단 탭바 */}
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[var(--color-muted)]"
            >
              <span aria-hidden className="text-base text-[var(--color-brand-text)]">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
