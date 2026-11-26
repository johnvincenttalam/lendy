/**
 * Build step: write the list of built files into public/sw.js's copy in dist,
 * so the service worker caches every page's code on install. Pages load on
 * demand, so without this a page never opened while online wouldn't open offline.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import type { Plugin } from 'vite'

const BUILD_PLACEHOLDER = /'[^']*' \/\*__BUILD__\*\//
const PRECACHE_PLACEHOLDER = /\[[^\]]*\] \/\*__PRECACHE__\*\//

/** Built assets worth caching: code, styles, fonts and images; never the page, the worker or source maps. */
export function precacheFiles(files: string[]): string[] {
  return files
    .filter((f) => f.startsWith('assets/') && /\.(js|css|woff2?|webp|png|svg)$/.test(f))
    .sort()
}

export function injectPrecache(swSource: string, files: string[], version: string): string {
  if (!BUILD_PLACEHOLDER.test(swSource) || !PRECACHE_PLACEHOLDER.test(swSource)) {
    throw new Error('sw.js is missing its __BUILD__ or __PRECACHE__ placeholder')
  }
  return swSource
    .replace(BUILD_PLACEHOLDER, `'${version}' /*__BUILD__*/`)
    .replace(PRECACHE_PLACEHOLDER, `${JSON.stringify(files.map((f) => `./${f}`))} /*__PRECACHE__*/`)
}

/** Vite plugin: after the bundle is written, fill in dist/sw.js. A new build gets a new cache name. */
export function precacheServiceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'ollie-precache-sw',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    // closeBundle: by then dist holds the bundle and the copied public/ files (Ollie's artwork).
    closeBundle() {
      const built = readdirSync(join(outDir, 'assets'), { recursive: true, encoding: 'utf8' })
        .map((f) => `assets/${f.split(sep).join('/')}`)
      const files = precacheFiles(built)
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
      const swPath = join(outDir, 'sw.js')
      writeFileSync(swPath, injectPrecache(readFileSync(swPath, 'utf8'), files, version))
    },
  }
}
