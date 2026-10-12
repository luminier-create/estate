import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HomeFit — 아파트 입지 적합도 분석',
    short_name: 'HomeFit',
    description:
      '내 조건에 맞춰 관심 아파트의 입지 적합도를 0~100점으로 산출하고 순위를 매깁니다.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f7f8fa',
    theme_color: '#1a5fd0',
    lang: 'ko',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
