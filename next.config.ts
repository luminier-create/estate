import type { NextConfig } from 'next'
import { webConfigBuildError, webEnvFromAppHosting } from './src/lib/firebase/web-config'

// 웹 앱 연결이 빠진 firebase 모드 빌드는 내보내지 않는다 — 로그인이 깨진 채로
// 배포되는 것보다 빌드 실패가 원인을 찾기 쉽다.
const buildError = webConfigBuildError(process.env)
if (buildError) throw new Error(`[next.config] ${buildError}`)

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // App Hosting 이 빌드 때 넣는 FIREBASE_WEBAPP_CONFIG 를 NEXT_PUBLIC_FIREBASE_* 로 옮긴다
  env: webEnvFromAppHosting(process.env).env,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 't1.daumcdn.net' },
    ],
  },
}

export default nextConfig
