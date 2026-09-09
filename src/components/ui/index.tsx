import { cn } from '@/lib/utils'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export function Card({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)] disabled:bg-[var(--color-subtle)]',
  secondary:
    'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-brand-soft)]',
  ghost: 'text-[var(--color-muted)] hover:bg-[var(--color-brand-soft)]',
  danger:
    'border border-[var(--color-negative)] text-[var(--color-negative)] hover:bg-red-50 dark:hover:bg-red-950',
}

export function Button({
  variant = 'primary',
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'button'> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_STYLES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  required,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[var(--color-fg)]"
      >
        {label}
        {required && <span className="ml-1 text-[var(--color-negative)]">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  )
}

export function Input({ className, ...rest }: ComponentPropsWithoutRef<'input'>) {
  return (
    <input
      className={cn(
        'min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-base text-[var(--color-fg)] outline-none transition-colors placeholder:text-[var(--color-subtle)] focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20',
        className,
      )}
      {...rest}
    />
  )
}

export function Select({ className, children, ...rest }: ComponentPropsWithoutRef<'select'>) {
  return (
    <select
      className={cn(
        'min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-fg)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'brand' | 'positive' | 'negative' | 'warn'
  children: ReactNode
  className?: string
}) {
  // 다크 모드에서 밝은 배지가 흰 덩어리로 튀지 않도록 톤을 뒤집는다
  const tones = {
    neutral: 'bg-[var(--color-bg)] text-[var(--color-muted)] border-[var(--color-border)]',
    brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border-transparent',
    positive:
      'bg-emerald-50 text-emerald-700 border-transparent dark:bg-emerald-950 dark:text-emerald-300',
    negative:
      'bg-red-50 text-red-700 border-transparent dark:bg-red-950 dark:text-red-300',
    warn: 'bg-amber-50 text-amber-700 border-transparent dark:bg-amber-950 dark:text-amber-300',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-md text-sm text-[var(--color-muted)]">{description}</p>
      {action}
    </Card>
  )
}

export function Disclaimer() {
  return (
    <p className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 text-xs leading-relaxed text-[var(--color-muted)]">
      본 점수와 순위는 공개된 공공데이터를 기반으로 한 참고 정보이며, 특정 부동산의
      매수·매도를 권유하거나 투자 수익을 보장하지 않습니다. 실제 거래 전 반드시 현장
      확인 및 전문가 상담을 거치십시오.
    </p>
  )
}
