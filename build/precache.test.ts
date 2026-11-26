import { describe, it, expect } from 'vitest'
import { injectPrecache, precacheFiles } from './precache'

const SW = "const BUILD = 'dev' /*__BUILD__*/\nconst PRECACHE = [] /*__PRECACHE__*/\n"

describe('injectPrecache', () => {
  it('writes the build version and file list into the service worker', () => {
    const out = injectPrecache(SW, ['assets/a.js', 'assets/b.css'], 'abc123')
    expect(out).toContain("const BUILD = 'abc123'")
    expect(out).toContain('const PRECACHE = ["./assets/a.js","./assets/b.css"]')
  })

  it('fails loudly if the placeholders are missing', () => {
    expect(() => injectPrecache('self.addEventListener()', [], 'x')).toThrow(/placeholder/)
  })
})

describe('precacheFiles', () => {
  it('keeps built assets and leaves out the page, the worker and source maps', () => {
    expect(precacheFiles(['index.html', 'sw.js', 'assets/x.js', 'assets/x.js.map', 'assets/y.css', 'assets/f.woff2', 'assets/ollie/ollie-happy.webp']))
      .toEqual(['assets/f.woff2', 'assets/ollie/ollie-happy.webp', 'assets/x.js', 'assets/y.css'])
  })
})
