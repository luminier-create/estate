'use client'
/** 주소·장소 검색 자동완성. 서버 프록시를 통해 지오코딩 API 를 호출한다. */
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui'

export interface PickedPlace {
  name: string
  address: string
  lat: number
  lng: number
}

interface SearchResult {
  id: string
  name: string
  address: string
  roadAddress: string | null
  lat: number
  lng: number
}

export function PlacePicker({
  id,
  placeholder,
  value,
  onPick,
}: {
  id?: string
  placeholder: string
  value?: string
  onPick: (place: PickedPlace) => void
}) {
  const [query, setQuery] = useState(value ?? '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`)
        const data = (await res.json()) as { results?: SearchResult[] }
        setResults(data.results ?? [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query])

  function pick(r: SearchResult) {
    setQuery(r.name)
    setOpen(false)
    onPick({
      name: r.name,
      address: r.roadAddress ?? r.address ?? r.name,
      lat: r.lat,
      lng: r.lng,
    })
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={query}
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-3.5 text-xs text-[var(--color-muted)]">
          검색 중…
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                className="flex min-h-11 w-full flex-col items-start gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--color-brand-soft)]"
              >
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {r.roadAddress ?? r.address}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
