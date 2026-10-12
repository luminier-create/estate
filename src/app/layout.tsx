import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HomeFit — 아파트 입지 적합도 분석',
  description:
    '내 조건(예산·통근지·생활반경)에 맞춰 관심 아파트의 입지 적합도를 0~100점으로 산출하고 순위를 매깁니다.',
  applicationName: 'HomeFit',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'HomeFit', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
