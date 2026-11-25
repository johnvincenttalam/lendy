import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

// Ollie's evals call the real model, so they live apart from `npm test`
// and only run with `npm run eval:ollie`.
export default defineConfig({
  test: {
    include: ['evals/**/*.eval.ts'],
    // Reads GROQ_API_KEY from .env.local (gitignored), or the shell.
    env: loadEnv('', process.cwd(), ''),
    testTimeout: 180_000,
    hookTimeout: 30_000,
  },
})
