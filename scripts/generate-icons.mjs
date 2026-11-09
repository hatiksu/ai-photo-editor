// Генерирует PNG-иконки PWA из public/favicon.svg с помощью Playwright (Chromium).
// Запуск: npm run icons
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// Playwright может быть установлен глобально, поэтому подключаем через require
const { chromium } = createRequire(import.meta.url)('playwright')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8')

const targets = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0, square: true },
  // Для maskable оставляем безопасную зону ~10% по краям
  { file: 'icon-maskable-512.png', size: 512, padding: 0.1, square: true },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.padding * 2))
  const bg = t.square ? '#0b0c12' : 'transparent'
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(`<html><body style="margin:0;background:${bg};display:grid;place-items:center;height:100vh">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`)
  await page.screenshot({ path: join(root, 'public', t.file), omitBackground: !t.square })
  console.log('icon:', t.file)
}
await browser.close()
