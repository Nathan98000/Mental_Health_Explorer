// Copies the committed pipeline outputs (../data) into web/public/data/, which is
// git-ignored and served as static files. Runs before `npm run dev` and `npm run build`.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '../../data')
const target = resolve(here, '../public/data')
const items = ['estimates', 'associations', 'manifest.json', 'availability.json']

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
const copied = []
for (const item of items) {
  const from = join(source, item)
  if (!existsSync(from)) {
    console.warn(`sync-data: ${from} is missing (run the pipeline first)`)
    continue
  }
  cpSync(from, join(target, item), { recursive: true })
  copied.push(item)
}
console.log(`sync-data: copied ${copied.join(', ')} to ${target}`)
