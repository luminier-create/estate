import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // next-env.d.ts 는 Next.js 가 생성하며 버전 관리 대상이 아니다
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'coverage/**', 'next-env.d.ts'],
  },
]

export default config
