import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE ?? '/',
  test: {
    // Dates are device-local; pin tests to the owner's zone so midnight cases mean the same everywhere.
    env: { TZ: 'Asia/Manila' },
    // Playwright runs these (npm run test:e2e).
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
})
