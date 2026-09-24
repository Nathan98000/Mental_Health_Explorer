/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Preload what every page needs before its JavaScript runs: the two Latin font files (so the
 * first paint already uses them), the overview and explorer chunks, and the catalog.
 */
function preloadCritical(): Plugin {
  return {
    name: 'preload-critical',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return []
        const files = Object.keys(ctx.bundle)
        const base = ctx.server ? '/' : '/Mental_Health_Explorer/'
        const tags = []
        for (const file of files.filter((f) => /(inter|nunito)-latin-wght-normal-.*\.woff2$/.test(f))) {
          tags.push({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: base + file }, injectTo: 'head' as const })
        }
        for (const file of files.filter((f) => /assets\/(Home|Explore)-.*\.js$/.test(f))) {
          tags.push({ tag: 'link', attrs: { rel: 'modulepreload', href: base + file }, injectTo: 'head' as const })
        }
        tags.push({ tag: 'link', attrs: { rel: 'preload', as: 'fetch', crossorigin: '', href: `${base}data/catalog.json` }, injectTo: 'head' as const })
        return tags
      },
    },
  }
}

// The site is served from https://nathan98000.github.io/Mental_Health_Explorer/
export default defineConfig({
  base: '/Mental_Health_Explorer/',
  plugins: [react(), tailwindcss(), preloadCritical()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
