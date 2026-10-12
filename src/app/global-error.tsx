'use client'
/**
 * 루트 레이아웃까지 실패했을 때의 최후 경계.
 * 자체 <html>/<body> 를 렌더해야 하며, 앱의 스타일이 없을 수 있으므로
 * 인라인 스타일로 최소한의 읽을 수 있는 화면을 만든다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', 'Noto Sans KR', sans-serif",
          background: '#f7f8fa',
          color: '#111827',
        }}
      >
        <main style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.75rem' }}>
            페이지를 표시할 수 없습니다
          </h1>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.7, color: '#6b7280', margin: 0 }}>
            예기치 못한 오류가 발생했습니다. 다시 시도해도 해결되지 않으면
            브라우저를 새로 고침하십시오.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: '1rem',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#9ca3af',
              }}
            >
              오류 코드: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: '2.75rem',
              padding: '0 1.25rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: '#1a5fd0',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  )
}
